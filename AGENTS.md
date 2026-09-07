# AGENTS.md — دليل المُطوّر والوكيل

> هذا الملف موجّه للوكلاء الذكيين والمطوّرين الذين يعملون على المنصة.
> اقرأه بالكامل قبل أي تغيير جوهري.

---

## 1. غاية التطبيق

**المنصة المندمجة لتدبير قسم الوقاية وحفظ الصحة** (`BCH Prévention et Hygiène`) هي منصة داخلية لقسم الوقاية وحفظ الصحة في العمالة المغربية. الاسم الرسمي:

> **قسم الوقاية وحفظ الصحة** · *Service de prévention et d'hygiène*

الهدف: تدبير حملات مكافحة القوارض (Dératisation) والحشرات (Désinsectisation) والتطهير (Désinfection) — ومنها اختصار **3D** — إضافةً إلى الشكايات المواطنية، أوامر العمل الميدانية، الحيوانات الشاردة (CSVR)، والسلامة الغذائية.

### الرؤية المستقبلية
المنصة في طريقها لتصبح منصة بلدية شاملة بـ **تسعة مكاتب وظيفية** (Bureaux). راجع `docs/BACKLOG.md` لخارطة الطريق الكاملة، و`docs/DATA_MODEL.md` لخريطة ربط كل مكتب بالوحدات الموجودة/المفقودة.

---

## 2. البنية التقنية (Tech Stack)

| الطبقة | التقنية | ملاحظات |
|---|---|---|
| الإطار | **Next.js 16** (App Router, Turbopack) | React 19, TypeScript |
| الواجهة | Tailwind CSS + **shadcn/ui** (49 مكوّن في `src/components/ui/`) | framer-motion للحركة |
| الحالة | **Zustand** (`src/lib/store.ts`) | لا Redux |
| قاعدة البيانات | **Prisma ORM + SQLite** (`db/custom.db`) | مخطط بدفع `db:push` (لا migrations) |
| الخرائط | **Leaflet** (vanilla, استيراد ديناميكي) | ليست react-leaflet |
| i18n | قاموس مركزي يدوي (`src/lib/i18n.ts`) | عربي (افتراضي/RTL) + فرنسي |
| المصادقة | جلسات مخصصة (cookie + scrypt) | لا NextAuth |
| متاح أيضاً | TanStack Query/Table, React Hook Form, `@hookform/resolvers` | موجودة في الاعتماديات |

> **ملاحظة:** رغم وجود TanStack وRHF في الاعتماديات، الوحدات الحالية تستخدم أساساً Zustand + `fetch` مباشر. راجع `docs/ARCHITECTURE.md` لقرار الاستخدام المستقبلي.

---

## 3. منظومة المكاتب التسعة المستهدفة

الـ spec المرجعي يصف تسعة مكاتب. الوضع الحالي يغطي بعضها جزئياً:

| # | المكتب (فرنسي / عربي) | الحالة الحالية | الوحدات المرتبطة |
|---|---|---|---|
| 01 | Direction / Chef de Service — الإدارة | ✅ جزئياً | `dashboard-view-lite`, `kpi-view`, `reports-view` |
| 02 | Contrôle Sanitaire et Sécurité Alimentaire — المراقبة الصحية | 🟡 جزئي | `food-view` (بلاغات فقط، لا سجل منشآت/تفتيش) |
| 03 | Eau, Assainissement et Hygiène du Milieu — الماء والتطهير | ❌ مفقود | — |
| 04 | Lutte Antivectorielle, Désinfection et Animaux Errants — محاربة النواقل | ✅ الأقوى | `interventions`, `campagnes`, `csvr-view`, `inventory` |
| 05 | Funérailles, Cimetières et Morgue — الجنائز | ❌ مفقود | — |
| 06 | Protection de l'Environnement — البيئة | ❌ مفقود | — |
| 07 | Réclamations, Veille et Alertes — الشكايات واليقظة | ✅ موجود | `complaints-view`, `alerts-view` |
| 08 | Avis Sanitaire, Autorisations et Commissions — التراخيص | ❌ مفقود | — |
| 09 | Planification, Rapports et Statistiques — التقارير | 🟡 جزئي | `reports-view`, `export-view`, `operations-view` |

راجع `docs/BACKLOG.md` لترتيب تطوير المكاتب المفقودة.

---

## 4. اصطلاحات الكود (Coding Conventions)

### اللغة
- **التعليقات بالعربية** (مع مصطلحات إدارية مغربية عند الحاجة).
- أسماء الجداول/الحقول **بالفرنسية** (`statut`, `commune`, `quartier`, `reference`).
- المفاتيح في i18n بالإنجليزية، القيم بالعربية والفرنسية.

### أنماط البيانات
- كل كيان له **`reference String @unique`** بنمط مميّز: `PL-` (شكاية)، `OT-` (أمر عمل)، `SIG-CSVR-` (حيوان شارد)، `SIG-FOOD-` (غذاء).
- **`commune String`** هو المحور التنظيمي الأساسي (ترابي، لا وظيفي). قيمة `'ALL'` = مسؤول عام.
- **`statut String`** (ليس enum) — القيم المسموحة موثّقة كتعليقات في `schema.prisma`. راجع `docs/DATA_MODEL.md`.
- **`source String`**: `INTERNAL` (افتراضي) / `PUBLIC` / `PHONE` / `AUTHORITY`.
- **`priority String`**: `FAIBLE` / `NORMALE` / `HAUTE` / `URGENTE` / `SANITAIRE`.
- النماذج المرفقة بصور تتبع نمط `*Photo` (مثل `InterventionPhoto`, `FoodReportPhoto`).

### نمط API الموحّد
كل مسار محمي يتبع:
```typescript
const authResult = await requireAuth()          // أو requireAdmin()
if ('error' in authResult) return authResult.error
const { user } = authResult

const communeFilter = getScopedCommuneFilter(user, searchParams)  // فلتر ترابي
// ... استعلام Prisma مع where.commune = communeFilter
```

### التخزين المبني على الملفات
- مجلد `storage/` (غير متتبّع في git) يحتوي: `documents/`, `csvr-photos/`, `food-photos/`, `product-images/`, `work-order-photos/`.
- وحدات `src/lib/*-storage.ts` توفّر: تطهير الاسم، فحص الامتداد، المسار الآمن.
- رفع الصور العمومية: `crypto.randomUUID()` + `flag: 'wx'` + rollback عند فشل DB.

### الاستيراد الديناميكي للوحدات
كل الوحدات تُحمّل بـ `dynamic(() => import('./xxx-view'), { ssr: false })` لتقسيم الكود (`page.tsx:22-45`).

---

## 5. قواعد الأمان

راجع `docs/SECURITY.md` للتفاصيل الكاملة. الملخص:

- **RBAC بثلاثة أدوار**: `admin` (كل شيء، `commune='ALL'`) / `responsable` (مرتبط بجماعة أو مجموعة جماعات) / `agent` (ميداني، `/terrain` فقط).
- **تطبيق الصلاحيات في الخادم** — لا تكتفِ بإخفاء الأزرار في الواجهة.
- **المسارات العمومية** (`/api/public/*`): `consumePublicRateLimit` (5/ساعة/IP) + honeypot `website` + FormData للصور.
- **لا أسرار في الكود**: كل الحساسة في `.env` (راجع `.env.example`).
- **خدمة الملفات آمنة من path-traversal** عبر `get*Path()` في وحدات التخزين.
- **سجل التدقيق**: `ActivityLog` لكل إنشاء/تحديث/حذف/تغيير حالة.

---

## 6. متطلبات RTL / i18n

- **القاموس المركزي** في `src/lib/i18n.ts` — أضف مفاتيح جديدة للكتلتين `ar` و `fr` معاً.
- **الاتجاه**: `<html dir="rtl">` للعربية (افتراضي)، `dir="ltr"` للفرنسية. يُبدّل في `page.tsx:349`.
- **لا تكرّر مكوّنات للترجمة** — استخدم `t(key, lang)` من القاموس المركزي.
- اللغة محفوظة في Zustand + `localStorage` (مفتاح `app-language`).
- عند إضافة قسم جديد للقائمة الجانبية، أضف مفتاح `sectionXxx` في i18n + استخدمه في `navItems[].sectionKey`.

---

## 7. قاعدة السلامة القانونية ⚠️

هذه قاعدة حرجة. راجع `docs/LEGAL_SAFETY.md` للتفاصيل.

> **لا تخترع قوانين مغربية، أرقام مراسيم، أو مواد قانونية.**

- للإجراءات الإدارية (إغلاق، مصادرة، إتلاف، تعليق، إذن دفن، نبش، عقوبة): استخدم **حقول قابلة للتهيئة** (`legal_reference`, `legal_article`, `competent_authority`, `decision_type`, `validation_status`).
- اعرض **"Base juridique à vérifier"** (الأساس القانوني قيد التحقق) عندما لا يكون مرجع موثّق مهيّأً.
- **لا تُنفّذ قرارات إدارية تلقائياً** بناءً على خوارزمية فقط. الموظف المختص يصادق يدوياً.
- درجة المخاطر الصحية (0-100) هي **أداة دعم قرار**، ليست قراراً قانونياً.

---

## 8. أوامر التطوير والاختبار

```bash
# التطوير
npm install              # تثبيت (تشغّل postinstall: prisma generate)
npm run dev              # المنفذ 3000

# قاعدة البيانات
npm run db:push          # تطبيق المخطط (بدون migrations)
npm run db:generate      # إعادة توليد Prisma Client

# الفحوصات
npx next build           # بناء الإنتاج (يجب أن ينجح)
npx tsc --noEmit         # فحص الأنواع
npm run lint             # ESLint
```

> **ملاحظة Prisma على Windows:** إذا فشل `prisma generate` بـ `EPERM` على `query_engine-windows.dll.node`، أوقف عمليات node أولاً: `taskkill //F //IM node.exe` ثم أعد التوليد.

### إصلاحات معروفة
- **الخرائط الرمادية**: Leaflet يحتاج `map.invalidateSize()` بعد التهيئة. النمط المعتمد: 3 استدعاءات `setTimeout` (100ms/400ms/1000ms).
- **اكتشاف الجماعة من الإحداثيات**: geocoding عكسي server-side (point-in-polygon ضد `communes-boundaries.geojson`، 1503 جماعة) عبر `src/lib/commune-boundaries.ts` — لا تُحمّل الـ 12MB على العميل.

---

## 9. تعريف الإنجاز (Definition of Done)

لا تعتبر المهمة منجزة ما لم:
- ✅ `npx next build` ينجح بدون أخطاء
- ✅ `npx tsc --noEmit` نظيف (أو أخطاء موجودة سابقاً فقط)
- ✅ المسارات تعمل (التطبيق يبدأ، التنقل سليم)
- ✅ RTL سليم (العربية افتراضية، الفرنسية قابلة للتبديل)
- ✅ النماذج مُتحقّق منها (تتحقق من `commune` ضد catalog، تمنع الحقول الفارغة الحرجة)
- ✅ الصلاحيات مطبّقة في الخادم (`requireAuth`/`canAccessCommune`)
- ✅ الكود معيارى ويتبع أنماط الملفات المجاورة
- ✅ التوثيق محدّث عند تغيير المخطط أو إضافة مسارات

---

## 10. بنية المجلدات

```
BCH/
├── AGENTS.md              ← هذا الملف
├── README.md              ← دليل التشغيل
├── docs/                  ← التوثيق التقني (أنشئ حديثاً)
│   ├── ARCHITECTURE.md
│   ├── DATA_MODEL.md
│   ├── SECURITY.md
│   ├── LEGAL_SAFETY.md
│   └── BACKLOG.md
├── prisma/
│   └── schema.prisma      ← 28 نموذج (مصدر الحقيقة للنماذج)
├── src/
│   ├── app/
│   │   ├── page.tsx       ← SPA الرئيسية (currentView switch)
│   │   ├── *-view.tsx     ← 23 وحدة عرض
│   │   ├── api/           ← ~75 مسار RESTful
│   │   ├── signaler*/     ← الصفحات العمومية (لا مصادقة)
│   │   └── terrain/       ← تطبيق العون الميداني (PWA)
│   ├── lib/               ← auth, db, store, i18n, constants, geography...
│   └── components/ui/     ← 49 مكوّن shadcn-style
├── public/
│   ├── communes-boundaries.geojson   ← حدود الجماعات (12MB)
│   └── geography/catalog.json        ← كتالوج الجهات/الأقاليم/الجماعات
└── storage/               ← الملفات المرفوعة (غير متتبّع)
```

---

## 11. الخطوة التالية الموصى بها

بعد إكمال هذه الوثائق، المهمة التالية الموحّاة هي **المرحلة 2** من `docs/BACKLOG.md`:

> **نظام Dossiers موحّد** — نموذج `Dossier` عام + timeline + روابط اختيارية للكيانات الموجودة (Intervention/Complaint/WorkOrder/StrayReport/FoodReport) + قسم "Dossiers" في القائمة الجانبية.

هذا يضع الأساس لتوحيد كل الكيانات تحت دورة حياة واحدة (NEW→ASSIGNED→...→ARCHIVED) دون كسر النماذج الحالية.
