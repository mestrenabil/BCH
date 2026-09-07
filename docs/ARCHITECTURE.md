# Architecture — المعمارية

> نظرة شاملة على بنية منصة BCH وكيفية تفاعل طبقاتها.

---

## 1. النظرة العامة

المنصة **تطبيق صفحة واحدة (SPA) من جهة العميل** مبني فوق Next.js App Router. الواجهة الرئيسية (`src/app/page.tsx`) مكوّن `'use client'` يدير التنقل بين الوحدات عبر حالة `currentView` في Zustand — وليس عبر تنقّل المسارات التقليدي.

```
┌─────────────────────────────────────────────────────┐
│                    المتصفح (Client)                  │
│  ┌───────────────────────────────────────────────┐  │
│  │  src/app/page.tsx  (currentView switch)       │  │
│  │  ├── dashboard-view-lite  ← dynamic import   │  │
│  │  ├── interventions-view  ← dynamic import    │  │
│  │  ├── csvr-view           ← dynamic import    │  │
│  │  ├── food-view           ← dynamic import    │  │
│  │  └── ... (23 وحدة)                            │  │
│  │  Zustand store: user, lang, currentView...   │  │
│  └──────────────────┬────────────────────────────┘  │
│                     │ fetch() + cookie session       │
└─────────────────────┼───────────────────────────────┘
                      │
┌─────────────────────┼───────────────────────────────┐
│              خادم Next.js (Node.js)                  │
│  ┌──────────────────▼────────────────────────────┐  │
│  │  src/app/api/*  (~75 route handlers)          │  │
│  │  ├── auth/          (login, logout, me...)    │  │
│  │  ├── interventions/ (CRUD + bulk + photos)    │  │
│  │  ├── complaints/    (CRUD)                    │  │
│  │  ├── food-reports/  (CRUD + photos)           │  │
│  │  ├── public/        (لا مصادقة + rate limit)  │  │
│  │  └── ...                                      │  │
│  │  requireAuth() → canAccessCommune()           │  │
│  └──────────────────┬────────────────────────────┘  │
│                     │                                │
│  ┌──────────────────▼────────────────────────────┐  │
│  │  src/lib/                                     │  │
│  │  ├── auth.ts       (scrypt + session + RBAC)  │  │
│  │  ├── db.ts         (Prisma singleton)         │  │
│  │  ├── *-storage.ts  (file-based storage)       │  │
│  │  └── geography.ts  (territory scope helpers)  │  │
│  └──────────────────┬────────────────────────────┘  │
└─────────────────────┼───────────────────────────────┘
                      │
        ┌─────────────┴─────────────┐
        ▼                           ▼
  ┌───────────┐              ┌────────────┐
  │  SQLite   │              │  storage/  │
  │ custom.db │              │ (ملفات)    │
  │ (28 جدول) │              │ صور/وثائق  │
  └───────────┘              └────────────┘
```

---

## 2. نمط العرض الديناميكي (Dynamic Views)

كل وحدة تُحمّل عند الحاجة لتقسيم الكود:

```typescript
// src/app/page.tsx:22-45
const DashboardView = dynamic(() => import('./dashboard-view-lite'), { ssr: false })
const CsvrView = dynamic(() => import('./csvr-view'), { ssr: false })
const FoodView = dynamic(() => import('./food-view'), { ssr: false })
// ...

// العرض الشرطي:
{currentView === 'dashboard' && <DashboardView ... />}
{currentView === 'food' && <FoodView selectedCommune={...} territoryFilter={...} useTerritoryFilter={...} />}
```

**لماذا `ssr: false`؟** لأن Leaflet وframer-motion والمكوّنات التفاعلية تحتاج `window`. الـ SSR معطّل للوحدات لتفادي أخطاء الترطيب (hydration errors).

### إضافة وحدة جديدة
1. أنشئ `src/app/xxx-view.tsx` مع props موحّدة: `{ selectedCommune, territoryFilter, useTerritoryFilter }`
2. أضف `'xxx'` إلى `ViewType` في `src/lib/store.ts`
3. أضف الاستيراد الديناميكي + شرط العرض في `page.tsx`
4. أضف إدخال `navItems` + مفاتيح i18n (`xxx`, `descXxx`)

---

## 3. المصادقة والجلسات

```
تسجيل الدخول (POST /api/auth/login)
  │
  ├── تحقق username/password (scrypt + sha256 fallback)
  ├── throttling: 5 محاولات / 15 دقيقة / IP
  ├── أنشئ Session (رمز عشوائي 32 بايت، صلاحية 24 ساعة)
  ├── اضبط cookie: 3d_session_token (httpOnly, 24h)
  └── أعد بيانات المستخدم

كل طلب لاحق
  │
  ├── اقرأ cookie → ابحث في Session
  ├── تحقق الصلاحية (24h)
  ├── أعد AuthUser { id, role, commune, managedCommunes... }
  └── requireAuth() / requireAdmin() / canAccessCommune()
```

**نقاط أساسية** (`src/lib/auth.ts`):
- `hashPassword()`: `scrypt$<salt>$<derivedKey>` (المفتاح 64 بايت).
- `verifyPassword()`: يقبل scrypt الحديث + sha256 القديم (للتوافق).
- `needsPasswordRehash()`: يُعيد التجزئة عند تسجيل الدخول التالي.
- الجلسات مخزّنة في جدول `Session` (قابلة للحذف عند تسجيل الخروج).

---

## 4. الفلترة الترابية (Territory Scope)

المحور التنظيمي الأساسي هو **`commune`** (جماعة ترابية)، لا "مكتب وظيفي". كل سجل له `commune` والوصول يُفلتر ترابياً:

```typescript
// المبدأ: المسؤول يرى جماعته فقط، admin يرى الكل
const communeFilter = getScopedCommuneFilter(user, searchParams)
// → 'ALL' (admin) | 'sla' (مسؤول سلا) | { in: ['sla','sale'] } (حساب مجموعة)

// فحص الوصول لسجل محدّد
canAccessCommune(user, record.commune)  // boolean
```

### التسلسل الإداري (Region > Province > Commune)
`src/lib/geography.ts` + `src/lib/territory-scope.ts` يدعمان فلترة متعددة المستويات:
- **المسؤول العام** (`admin`, `commune='ALL'`): يرى كل الجماعات + يمكنه تفعيل فلتر ترابي اختياري (region/province/commune).
- **مسؤول جماعة**: يرى جماعته فقط.
- **حساب مجموعة** (`managedCommunes` متعددة): يرى جماعاته المُدارة.

كتالوج الجهات/الأقاليم/الجماعات في `public/geography/catalog.json`.

---

## 5. التخزين المبني على الملفات (File-Based Storage)

الصور والوثائق تُخزّن على القرص (ليس في DB):

```
storage/
├── documents/          ← وثائق التدخل
├── csvr-photos/        ← صور الحيوانات الشاردة + أدلة الالتقاط
├── food-photos/        ← صور البلاغات الغذائية
├── product-images/     ← صور المنتجات
└── work-order-photos/  ← أدلة إنجاز أوامر العمل الميدانية
```

### وحدات التخزين (`src/lib/*-storage.ts`)
كل وحدة توفّر:
- `sanitizeXxxName(name)` — تطهير اسم الملف.
- `isAllowedXxx(name)` — فحص الامتداد (`.jpg .jpeg .png .webp`).
- `getXxxDirectory()` — المجلد (يُنشأ تلقائياً).
- `getXxxPath(fileName)` — المسار الكامل، **آمن من path-traversal**.

### نمط الرفع العمومي (FormData)
الصفحات العمومية (`/signaler`, `/signalerfood`, `/signaler-animal`) تستخدم FormData:
```
POST /api/public/food-reports  (multipart/form-data)
  ├── حقول نصية (name, commune, description...)
  ├── honeypot: website (يجب أن يكون فارغاً)
  └── ملفات صور متعددة

الخادم:
  1. consumePublicRateLimit(ip) — 5 طلبات/ساعة/IP
  2. تحقق honeypot فارغ
  3. اكتب كل صورة: crypto.randomUUID() + ext, flag:'wx' (fail if exists)
  4. أنشئ السجل + الصور في معاملة
  5. عند فشل DB: احذف الملفات المكتوبة (rollback)
```

---

## 6. الخرائط (Leaflet)

تُستخدم الخرائط في عدة وحدات: `map-view-lite`, `csvr/map-tab`, `food/map-tab`, `signaler*/page.tsx`.

### النمط المعتمد
```typescript
const L = await import('leaflet')          // استيراد ديناميكي
await import('leaflet/dist/leaflet.css')

const map = L.map(container, { center, zoom })
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map)

// إصلاح الخريطة الرمادية (حرج!)
setTimeout(() => map.invalidateSize(), 100)
setTimeout(() => map.invalidateSize(), 400)
setTimeout(() => map.invalidateSize(), 1000)
```

> **لماذا ليست react-leaflet؟** للتحكم الكامل في الأداء، طبقات مخصّصة، ومعالجة `invalidateSize` بدقة.

### Geocoding عكسي
`src/lib/commune-boundaries.ts` يحوّل إحداثيات → جماعة عبر point-in-polygon:
- يحمّل `communes-boundaries.geojson` (1503 جماعة، 12MB) **مرة واحدة** على الخادم (memoized).
- `getCommuneForPoint(lat, lng)` يعرض أول تطابق.
- مسار API: `GET /api/geocode/reverse?lat=..&lng=..` (عمومي، لا مصادقة).
- **لا تُحمّل الـ 12MB على العميل.**

---

## 7. البيانات والاستعلامات

### Prisma Singleton (`src/lib/db.ts`)
```typescript
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }
export const db = globalForPrisma.prisma ?? new PrismaClient()
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
```

### نمط المسارات (RESTful)
```
GET    /api/interventions           ← قائمة + فلترة
POST   /api/interventions           ← إنشاء
GET    /api/interventions/[id]      ← تفاصيل
PUT    /api/interventions/[id]      ← تحديث
DELETE /api/interventions/[id]      ← حذف
POST   /api/interventions/[id]/photos   ← رفع صورة
GET    /api/interventions/[id]/comments ← التعليقات
POST   /api/interventions/bulk      ← عمليات مجمّعة
```

### Migrations vs Push
المنصة تستخدم `prisma db push` (لا migrations). مناسب لـ SQLite والتطوير السريع. **عند الترحيل لـ PostgreSQL**، يُنصح بالانتقال لـ `prisma migrate` لإدارة التغييرات بشكل منضبط.

---

## 8. واجهة المستخدم (UI)

- **Tailwind CSS** + إعداد `tailwind.config.ts`.
- **shadcn/ui**: 49 مكوّن في `src/components/ui/` (button, dialog, form, table, tabs, dropdown-menu, command...). مبنية على Radix UI.
- **framer-motion**: انتقالات الوحدات والحركات (`AnimatePresence`).
- **sonner**: إشعارات toast.
- **cmdk**: البحث العام (Ctrl+K).
- الثوابت اللونية في `src/lib/constants.ts` (مثل `FOOD_TYPE_COLORS`, `COMMUNE_COLORS`).

---

## 9. الـ PWA والتطبيق الميداني

- `public/manifest.json` — تعريف PWA.
- `/terrain` (`src/app/terrain/page.tsx`) — تطبيق العون الميداني: أوامر العمل فقط، geolocation، رفع صور الإنجاز. مسموح فقط لـ `role='agent'`.
- `FieldAgentRedirect` في `page.tsx:47-53` يعيد توجيه الأعوان تلقائياً لـ `/terrain`.

---

## 10. خريطة الطريق المعمارية

| الموضوع | الحالي | المستهدف | المرحلة |
|---|---|---|---|
| قاعدة البيانات | SQLite | PostgreSQL/PostGIS | 12 |
| الإحداثيات | `Float?` | `geometry(Point, 4326)` | 12 |
| GIS | خرائط Leaflet لكل وحدة | صفحة GIS موحّدة بطبقات | 10 |
| Dossiers | كيانات منفصلة | نموذج `Dossier` موحّد + timeline | 2 |
| المكاتب | لا مفهوم | 9 مكاتب + ربط بالكيانات | 3-9 |
| i18n | قاموس يدوي | (يبقى) + إمكانية إضافة لغات | — |
| التقارير | عرض بصري | تصدير PDF/XLSX/DOCX | 11 |
| RBAC | 3 أدوار (admin/responsable/agent) | + أدوار حسب المكتب | متدرّج |

راجع `docs/BACKLOG.md` للتفاصيل الكاملة.

---

## 11. اعتبارات النشر

الوضع الحالي مناسب للاستخدام الداخلي (خادم واحد، SQLite). للنشر الإنتاجي الكامل:

```
المستخدم → HTTPS (Caddy/Nginx) → Next.js (PM2) → SQLite/PostgreSQL
                                         ↓
                                     storage/ (مجلد دائم)
```

- `scripts/prepare-standalone.cjs` يُحضّر بنية standalone بعد البناء.
- النسخ الاحتياطي: `GET /api/backup` (JSON) + نسخ `storage/` و`db/custom.db`.
- المراقبة: `GET /api/health` (200 عند توفّر DB، 503 عند تعذّرها).

**عند الانتقال لـ PostgreSQL** (المرحلة 12): غيّر `DATABASE_URL`، شغّل `prisma migrate`، انقل الإحداثيات لـ PostGIS، حدّث استعلامات المسافات لـ `ST_DWithin`.
