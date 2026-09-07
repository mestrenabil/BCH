#!/bin/bash
# سكريبت ترحيل البيانات من SQLite إلى PostgreSQL
# الاستخدام: ./scripts/migrate-to-postgres.sh
# يتطلب: DATABASE_URL=postgresql://... في .env

set -e

echo "🚀 BCH — ترحيل SQLite → PostgreSQL"
echo "===================================="

# تحقق من .env
if [ ! -f .env ]; then
  echo "❌ ملف .env غير موجود"
  exit 1
fi

source <(grep DATABASE_URL .env)

if [[ ! "$DATABASE_URL" =~ ^postgresql:// ]]; then
  echo "❌ DATABASE_URL في .env ليس PostgreSQL"
  echo "   بدّله لـ: postgresql://user:pass@host:5432/db?schema=public"
  exit 1
fi

echo "📡 الاتصال بـ PostgreSQL..."
echo "   URL: $DATABASE_URL"

# 1. ولّد Prisma Client
echo ""
echo "1️⃣ توليد Prisma Client..."
npx prisma generate

# 2. طبّق المخطط
echo ""
echo "2️⃣ تطبيق المخطط على PostgreSQL..."
npx prisma db push

# 3. إضافة PostGIS (إن أمكن)
echo ""
echo "3️⃣ تفعيل PostGIS..."
psql "$DATABASE_URL" -c "CREATE EXTENSION IF NOT EXISTS postgis;" 2>/dev/null || echo "   ⚠️ تعذّر تفعيل PostGIS (قد يكون مُفعّلاً بالفعل)"

# 4. نسخ احتياطي من SQLite
echo ""
echo "4️⃣ نسخة احتياطية من SQLite..."
if [ -f db/custom.db ]; then
  cp db/custom.db "db/custom-backup-$(date +%F).db"
  echo "   ✅ تم: db/custom-backup-$(date +%F).db"
else
  echo "   ⚠️ لا توجد قاعدة SQLite لترحيلها"
fi

# 5. ترحيل البيانات (إن وُجدت)
echo ""
echo "5️⃣ ترحيل البيانات..."

# صدّر من SQLite
if [ -f db/custom.db ]; then
  echo "   📤 تصدير من SQLite..."
  node -e "
    const { PrismaClient } = require('@prisma/client');
    const oldDb = new PrismaClient({
      datasources: { db: { url: 'file:./db/custom.db' } },
    });
    (async () => {
      try {
        const fs = require('fs');
        const tables = ['agent', 'user', 'intervention', 'complaint', 'foodReport', 'product'];
        const data = {};
        for (const t of tables) {
          try { data[t] = await oldDb[t].findMany(); console.log('  ' + t + ': ' + data[t].length); }
          catch(e) { console.log('  ' + t + ': تخطّي (' + e.message.slice(0, 50) + ')'); }
        }
        fs.writeFileSync('export.json', JSON.stringify(data));
        console.log('✅ تصدير: export.json');
      } catch(e) { console.error(e.message); }
      await oldDb.\$disconnect();
    })();
  " || echo "   ⚠️ تعذّر التصدير (قد تكون قاعدة SQLite قديمة)"
fi

# استورد لـ PostgreSQL
if [ -f export.json ]; then
  echo "   📥 استيراد لـ PostgreSQL..."
  node -e "
    const { PrismaClient } = require('@prisma/client');
    const db = new PrismaClient();
    const data = JSON.parse(require('fs').readFileSync('export.json', 'utf-8'));
    (async () => {
      for (const [table, rows] of Object.entries(data)) {
        if (rows.length > 0) {
          try {
            await db[table].createMany({ data: rows, skipDuplicates: true });
            console.log('  ✅ ' + table + ': ' + rows.length + ' سجل');
          } catch(e) { console.log('  ⚠️ ' + table + ': ' + e.message.slice(0, 80)); }
        }
      }
      await db.\$disconnect();
    })();
  " || echo "   ⚠️ تعذّر الاستيراد"
  rm export.json
fi

echo ""
echo "✅ اكتمل الترحيل!"
echo ""
echo "الخطوات التالية:"
echo "  1. تحقق من البيانات: npx prisma studio"
echo "  2. ابن التطبيق: npm run build"
echo "  3. شغّل: npm run dev"
echo ""
echo "📄 راجع docs/POSTGRES_MIGRATION.md لإضافة أعمدة PostGIS"
