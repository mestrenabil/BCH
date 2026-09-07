# PostgreSQL / PostGIS Migration — دليل الترحيل

> ترحيل منصة BCH من SQLite إلى PostgreSQL/PostGIS للاستفادة من الاستعلامات المكانية والأداء.

---

## 1. لماذا الترحيل؟

| المعيار | SQLite (الحالي) | PostgreSQL/PostGIS |
|---|---|---|
| **الاستعلامات المكانية** | لا يدعم (Haversine في JS) | `ST_DWithin`, `ST_Distance`, `ST_Within` |
| **التزامن** | قفل ملف واحد | اتصالات متزامنة |
| **النسخ الاحتياطي** | نسخ ملف | `pg_dump` (ساخن) |
| **التحجيم** | مناسب < 100 ألف سجل | مناسب للملايين |
| **PostGIS** | — | فهارس GIST + تحليل مكاني |

### متى تُرحّل؟
- **الآن (SQLite كافٍ):** إذا كان عدد المستخدمين < 50 وعدد السجلات < 50 ألف.
- **رحّل لـ PostgreSQL:** عند الحاجة لاستعلامات مكانية متقدمة، تزامن عالٍ، أو نشر إنتاجي بملايين السجلات.

---

## 2. التغييرات المطلوبة

### 2.1 `prisma/schema.prisma`

غيّر الـ datasource:
```prisma
// SQLite (التطوير المحلي)
// datasource db {
//   provider = "sqlite"
//   url      = env("DATABASE_URL")
// }

// PostgreSQL/PostGIS (الإنتاج)
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

> **ملاحظة:** Prisma لا يدعم `geometry` كنوع أصلي بعد. الإحداثيات تبقى `Float?` في Prisma، لكن نضيف عمود `geom geometry(Point, 4326)` مباشرة في SQL عبر migration مخصّص + trigger لتحديثه تلقائياً.

### 2.2 `.env`

```env
# SQLite (تطوير)
# DATABASE_URL="file:../db/custom.db"

# PostgreSQL (إنتاج)
DATABASE_URL="postgresql://bch_user:password@localhost:5432/bch_health?schema=public"
```

### 2.3 توافق الاستعلامات

معظم استعلامات Prisma تعمل بدون تغيير. الاختلافات:
- **`String` مع `contains`**: SQLite حساس لحالة الأحرف افتراضياً، PostgreSQL ليس كذلك (أفضل).
- **`JSON` fields**: PostgreSQL يدعم `JsonDbType` أصلي. SQLite يخزّنها كنص.
- **`@default(now())`**: يعمل في كليهما.
- **`@db.Text`**: PostgreSQL يدعمه (للنصوص الطويلة)، SQLite يتجاهله.

---

## 3. خطوات الترحيل

### 3.1 إنشاء PostgreSQL + PostGIS

```bash
# أنشئ قاعدة البيانات
sudo -u postgres createuser bch_user --pwprompt
sudo -u postgres createdb bch_health --owner=bch_user

# فعّل PostGIS
sudo -u postgres psql -d bch_health -c "CREATE EXTENSION IF NOT EXISTS postgis;"
```

### 3.2 تغيير الـ datasource

```bash
# عدّل schema.prisma (غيّر provider لـ postgresql)
# عدّل .env (DATABASE_URL لـ PostgreSQL)

# ولّد Prisma Client الجديد
npx prisma generate

# أنشئ المخطط في PostgreSQL
npx prisma db push
```

### 3.3 إضافة أعمدة PostGIS (للاستعلامات المكانية)

```sql
-- migrations/postgis-columns.sql

-- أضف عمود geom لكل جدول له إحداثيات
ALTER TABLE "Intervention" ADD COLUMN IF NOT EXISTS geom geometry(Point, 4326);
ALTER TABLE "Complaint" ADD COLUMN IF NOT EXISTS geom geometry(Point, 4326);
ALTER TABLE "Establishment" ADD COLUMN IF NOT EXISTS geom geometry(Point, 4326);
ALTER TABLE "WaterPoint" ADD COLUMN IF NOT EXISTS geom geometry(Point, 4326);
ALTER TABLE "PollutionIncident" ADD COLUMN IF NOT EXISTS geom geometry(Point, 4326);
ALTER TABLE "WasteBlackSpot" ADD COLUMN IF NOT EXISTS geom geometry(Point, 4326);
ALTER TABLE "NaturalSite" ADD COLUMN IF NOT EXISTS geom geometry(Point, 4326);
ALTER TABLE "StrayReport" ADD COLUMN IF NOT EXISTS geom geometry(Point, 4326);
ALTER TABLE "SanitationIncident" ADD COLUMN IF NOT EXISTS geom geometry(Point, 4326);
ALTER TABLE "BiteCase" ADD COLUMN IF NOT EXISTS geom geometry(Point, 4326);

-- عبّأ geom من latitude/longitude الموجودة
UPDATE "Intervention" SET geom = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
UPDATE "Complaint" SET geom = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
UPDATE "Establishment" SET geom = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
UPDATE "WaterPoint" SET geom = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
UPDATE "PollutionIncident" SET geom = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
UPDATE "WasteBlackSpot" SET geom = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
UPDATE "NaturalSite" SET geom = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
UPDATE "StrayReport" SET geom = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
UPDATE "SanitationIncident" SET geom = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
UPDATE "BiteCase" SET geom = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- أنشئ فهارس GIST للاستعلامات المكانية السريعة
CREATE INDEX idx_intervention_geom ON "Intervention" USING GIST(geom);
CREATE INDEX idx_complaint_geom ON "Complaint" USING GIST(geom);
CREATE INDEX idx_establishment_geom ON "Establishment" USING GIST(geom);
CREATE INDEX idx_waterpoint_geom ON "WaterPoint" USING GIST(geom);
CREATE INDEX idx_pollution_geom ON "PollutionIncident" USING GIST(geom);
CREATE INDEX idx_waste_geom ON "WasteBlackSpot" USING GIST(geom);
CREATE INDEX idx_site_geom ON "NaturalSite" USING GIST(geom);
CREATE INDEX idx_stray_geom ON "StrayReport" USING GIST(geom);
CREATE INDEX idx_sanitation_geom ON "SanitationIncident" USING GIST(geom);
CREATE INDEX idx_bite_geom ON "BiteCase" USING GIST(geom);

-- أنشئ triggers لتحديث geom تلقائياً عند إدراج/تحديث إحداثيات
CREATE OR REPLACE FUNCTION update_geom_from_latlng()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
    NEW.geom := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- طبّق الـ trigger على كل جدول
CREATE TRIGGER trg_intervention_geom BEFORE INSERT OR UPDATE ON "Intervention"
  FOR EACH ROW EXECUTE FUNCTION update_geom_from_latlng();
CREATE TRIGGER trg_complaint_geom BEFORE INSERT OR UPDATE ON "Complaint"
  FOR EACH ROW EXECUTE FUNCTION update_geom_from_latlng();
CREATE TRIGGER trg_establishment_geom BEFORE INSERT OR UPDATE ON "Establishment"
  FOR EACH ROW EXECUTE FUNCTION update_geom_from_latlng();
-- (كرّر لبقية الجداول...)
```

طبّق:
```bash
psql -U bch_user -d bch_health -f migrations/postgis-columns.sql
```

---

## 4. ترحيل البيانات الموجودة (SQLite → PostgreSQL)

### الطريقة 1: عبر JSON (موصى بها للبيانات الصغيرة)

```bash
# صدّر من SQLite إلى JSON
node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const tables = ['intervention', 'complaint', 'foodReport', 'establishment', 'agent', 'user'];
  const data = {};
  for (const t of tables) {
    data[t] = await p[t].findMany();
  }
  require('fs').writeFileSync('export.json', JSON.stringify(data, null, 2));
  await p.\$disconnect();
})();
"

# بدّل DATABASE_URL لـ PostgreSQL، ثم استورد
node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
const data = JSON.parse(require('fs').readFileSync('export.json', 'utf-8'));
(async () => {
  for (const [table, rows] of Object.entries(data)) {
    if (rows.length > 0) {
      await p[table].createMany({ data: rows, skipDuplicates: true });
      console.log('Imported', rows.length, 'to', table);
    }
  }
  await p.\$disconnect();
})();
"
```

### الطريقة 2: عبر `pg_loader` (للبيانات الكبيرة)

```bash
# صدّر SQLite كـ SQL
sqlite3 db/custom.db .dump > dump.sql

# حوّل أنواع SQLite لـ PostgreSQL يدوياً (أو استخدم أداة مثل pgloader)
pgloader dump.sql postgresql://bch_user:password@localhost/bch_health
```

---

## 5. استعلامات PostGIS المفيدة

بعد الترحيل، يمكن استخدام استعلامات مكانية متقدمة:

```sql
-- كل المنشآت ضمن 1 كم من نقطة معيّنة
SELECT * FROM "Establishment"
WHERE geom IS NOT NULL
  AND ST_DWithin(geom::geography, ST_MakePoint(-6.8, 34.05)::geography, 1000);

-- أقرب 5 بلاغات لموقع معيّن
SELECT *, ST_Distance(geom::geography, ST_MakePoint(-6.8, 34.05)::geography) as dist
FROM "Complaint"
WHERE geom IS NOT NULL
ORDER BY geom <-> ST_SetSRID(ST_MakePoint(-6.8, 34.05), 4326)
LIMIT 5;

-- عدد التدخلات داخل مضلّع جماعة
SELECT COUNT(*) FROM "Intervention" i
JOIN communes_boundaries c ON ST_Contains(c.geom, i.geom)
WHERE c.commune_code = 'sla';

-- تجميع حسب الجماعة (الحدود)
SELECT c.commune_name, COUNT(i.*) as interventions
FROM "Intervention" i
JOIN communes_boundaries c ON ST_Contains(c.geom, i.geom)
GROUP BY c.commune_name;
```

---

## 6. التحقق بعد الترحيل

```bash
# تحقق من العدد في كل جدول
psql -U bch_user -d bch_health -c "
  SELECT 'interventions' as t, COUNT(*) FROM \"Intervention\"
  UNION ALL SELECT 'complaints', COUNT(*) FROM \"Complaint\"
  UNION ALL SELECT 'establishments', COUNT(*) FROM \"Establishment\";
"

# تحقق من PostGIS
psql -U bch_user -d bch_health -c "SELECT PostGIS_Version();"

# تحقق من الفهارس
psql -U bch_user -d bch_health -c "
  SELECT indexname FROM pg_indexes WHERE schemaname='public' AND indexname LIKE '%geom%';
"

# اختبر التطبيق
npm run dev
# افتح http://localhost:3000 وتحقق من كل وحدة
```

---

## 7. العودة لـ SQLite (استرجاع)

إذا فشل الترحيل، يمكن العودة:
```bash
# غيّر schema.prisma لـ sqlite
# غيّل DATABASE_URL في .env
npx prisma generate
npx prisma db push
```

> **تحذير:** فقدان أي بيانات أُنشئت بعد الترحيل لـ PostgreSQL. احتفظ بنسخة احتياطية قبل الترحيل.

---

## 8. قائمة فحص الترحيل

- [ ] نسخة احتياطية كاملة من SQLite (`db/custom.db` + `storage/`)
- [ ] PostgreSQL مثبّت + PostGIS مُفعّل
- [ ] `schema.prisma` provider = `postgresql`
- [ ] `DATABASE_URL` محدّث في `.env`
- [ ] `npx prisma generate` ناجح
- [ ] `npx prisma db push` ناجح
- [ ] أعمدة `geom` + فهارس GIST منشأة
- [ ] بيانات مُرحّلة وتحقق العدّادات
- [ ] `npm run build` ناجح
- [ ] كل الوحدات تعمل على PostgreSQL
- [ ] استعلامات PostGIS تعمل
- [ ] النسخ الاحتياطي اليومي `pg_dump` مُعدّ
