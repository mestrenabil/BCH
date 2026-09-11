# Security — الأمان والصلاحيات

> نموذج التهديد، الضوابط المطبّقة، والترقيات الموصى بها لمنصة BCH.

---

## 1. المصادقة (Authentication)

### كلمات المرور
- **التجزئة**: `scrypt` (Node.js crypto) — `src/lib/auth.ts:42-46`
  - الملح: 16 بايت عشوائي.
  - المفتاح المشتق: 64 بايت.
  - الصيغة المخزّنة: `scrypt$<salt-hex>$<key-hex>`.
- **التحقق** (`verifyPassword`, auth.ts:48): يقبل scrypt الحديث + sha256 القديم (للتوافق مع حسابات قديمة). يستخدم `crypto.timingSafeEqual` لتفادي هجمات التوقيت.
- **إعادة التجزئة** (`needsPasswordRehash`): تُعاد تلقائياً عند تسجيل الدخول التالي لكلمة sha256 قديمة.

### الجلسات
- **Cookie**: `3d_session_token` — رمز عشوائي 32 بايت (hex).
- **المدة**: 24 ساعة (`SESSION_DURATION_HOURS`).
- **التخزين**: جدول `Session` في قاعدة البيانات (قابل للحذف عند الخروج).
- **الخصائص**: `httpOnly` (لا وصول JS)، `sameSite=lax`، `path=/`.

> ⚠️ راجع القسم 6: يجب إضافة `secure: true` في الإنتاج (HTTPS فقط).

### تقييد محاولات الدخول (Login Throttling)
- **النافذة**: 15 دقيقة (`LOGIN_ATTEMPT_WINDOW_MS`).
- **الحد**: 5 محاولات (`MAX_LOGIN_ATTEMPTS`).
- **المفتاح**: عنوان IP.
- **التخزين**: `Map` في الذاكرة (غير موزّع — راجع القسم 6 للترقية).

---

## 2. التحكم بالوصول (RBAC)

ثلاثة أدوار في `User.role`:

| الدور | الصلاحية | النطاق |
|---|---|---|
| `admin` | كل شيء، بما فيه إدارة جميع المستخدمين وإنشاء المسؤولين العامين | `commune='ALL'` (كل الجماعات) |
| `responsable` | إدارة الكيانات وحسابات المستخدمين غير العامين داخل نطاقه فقط | `commune='X'` أو `managedCommunes=[...]` |
| `agent` | **التطبيق الميداني فقط** (`/terrain`) | مرتبط بـ `Agent` عبر `agentId` |

### الدوال المساعدة (`src/lib/auth.ts`)
```typescript
requireAuth({ allowFieldAgent? })   // → { user } | { error: 401/403 }
requireAdmin()                       // → { user } | { error: 401/403 }
requireUserManager()                 // → admin/responsable أو خطأ 401/403
canManageUserAccount(manager, user)  // يمنع تجاوز النطاق وتصعيد الصلاحيات
isAdmin(user)                        // boolean
canAccessCommune(user, commune)      // boolean
getScopedCommuneFilter(user, params) // 'ALL' | 'sla' | { in: [...] }
getManagedCommunes(user)             // string[]
isCommuneGroupAccount(user)          // boolean
resolveRecordCommune(user, commune)  // يفرض جماعة المستخدم على الكتابة
```

### القاعدة الذهبية
> **تطبيق الصلاحيات في الخادم دائماً.** لا تكتفِ بإخفاء الأزرار في الواجهة — الواجهة تُحسّن التجربة فقط، لكن الحماية الفعلية في `requireAuth`/`canAccessCommune`.

كل مسار API محمي يبدأ بـ:
```typescript
const authResult = await requireAuth()
if ('error' in authResult) return authResult.error
const { user } = authResult
// ... getScopedCommuneFilter(user, ...) للقراءة
// ... canAccessCommune(user, record.commune) للوصول لسجل محدّد
```

### الفلترة الترابية
- المسؤول العام (`admin`): يرى كل الجماعات.
- مسؤول جماعة: يرى جماعته فقط (فلتر إلزامي في كل استعلام).
- حساب مجموعة: يرى جماعاته المُدارة (`managedCommunes`).
- مسؤول الجماعة يستطيع إنشاء وتحديث وتعطيل وحذف الحسابات غير العامة الواقعة بالكامل داخل نطاقه، ولا يستطيع إدارة حساب `admin` أو منح هذا الدور.

---

## 3. المسارات العمومية (Public Endpoints)

الصفحات العمومية (لا مصادقة): `/signaler`, `/signalerfood`, `/signaler-animal`.

### مسارات API العمومية (`/api/public/*`)
| المسار | الوظيفة | الحماية |
|---|---|---|
| `POST /api/public/complaints` | شكاية مواطنية | rate limit + honeypot + validate |
| `POST /api/public/food-reports` | بلاغ غذائي (FormData + صور) | rate limit + honeypot + validate |
| `POST /api/public/csvr-reports` | بلاغ حيوان شارد (FormData + صور) | rate limit + honeypot + validate |
| `GET /api/public/food-photos/[photoId]` | عرض صورة بلاغ غذائي | path-traversal safe |
| `GET /api/public/csvr-photos/[photoId]` | عرض صورة CSVR | path-traversal safe |
| `GET /api/geocode/reverse` | اكتشاف الجماعة من الإحداثيات | — |
| `GET /api/geocode/commune-centroid` | مركز الجماعة | — |

### Rate Limiting العمومي
`src/lib/public-rate-limit.ts` — `consumePublicRateLimit(key, limit, windowMs)`:
- **الحد النموذجي**: 5 طلبات / ساعة / IP (لإرسال البلاغات).
- **التخزين**: `Map` في الذاكرة (تنظيف تلقائي عند تجاوز 2000 إدخال).
- **المفتاح**: عنوان IP (يُستخرج عبر `x-forwarded-for` أو `x-real-ip`).

> ⚠️ غير مناسب للنشر متعدد الخوادم (الذاكرة محلية). راجع القسم 6 للترقية لـ Redis.

### Honeypot
كل نموذج عمومي يحتوي حقل `website` مخفي:
```html
<input name="website" type="text" style="display:none" tabIndex={-1} autoComplete="off" />
```
إذا لم يكن فارغاً، يُرفض الطلب بهدوء (البوتات تملأ الحقول تلقائياً).

### التحقق من المدخلات
- **الجماعة**: تُتحقق ضد `catalog.json` (كتالوج الجهات/الأقاليم/الجماعات). تُرفض القيم غير المعروفة.
- **الحقول النصية**: تُقتطع (trim) وتُحدّد بطول أقصى.
- **الإحداثيات**: نطاقات صالحة (lat: -90..90, lng: -180..180).
- **الصور**: فحص الامتداد + حجم أقصى (8MB) + نوع MIME.

---

## 4. رفع الملفات والصور (File Upload)

### النمط المعتمد
```
1. استلام FormData (نص + ملفات)
2. لكل صورة:
   a. فحص الامتداد (isAllowedXxx) — .jpg/.jpeg/.png/.webp
   b. فحص الحجم (MAX_XXX_SIZE_BYTES = 8MB)
   c. توليد اسم: crypto.randomUUID() + ext
   d. الكتابة بـ flag:'wx' (يفشل إذا كان موجوداً — يمنع الكتابة فوق ملف)
3. إنشاء السجل + الصور في معاملة Prisma
4. عند فشل DB: حذف الملفات المكتوبة (rollback)
```

### الوحدات (`src/lib/*-storage.ts`)
- `document-storage.ts` — وثائق التدخل.
- `csvr-photo-storage.ts` — صور CSVR.
- `food-photo-storage.ts` — صور بلاغات الأغذية.
- `product-image-storage.ts` — صور المنتجات.
- `work-order-photo-storage.ts` — أدلة أوامر العمل.

كل وحدة توفّر `getXxxPath(fileName)` التي **تحلّ المسار داخل المجلد المسموح فقط** — تمنع path traversal (`../`).

### خدمة الملفات
المسارات `GET /api/xxx/[photoId]` تخدم الملفات:
- تقرأ `storedFileName` من DB.
- تستخدم `getXxxPath()` للوصول الآمن.
- تتحقق من الوجود + نوع MIME.
- لا تثق بمدخلات المستخدم لاسم الملف.

---

## 5. سجل التدقيق (Audit Log)

جدول `ActivityLog` (`schema.prisma:297`):

| الحقل | الوصف |
|---|---|
| `userId` | من قام بالفعل |
| `action` | `CREATE`/`UPDATE`/`DELETE`/`LOGIN`/`LOGOUT`/`EXPORT`/`IMPORT`/`STATUS_CHANGE` |
| `entityType` | نص حر: `INTERVENTION`/`COMPLAINT`/`PRODUCT`/`USER`/`DOCUMENT`/`FOOD_REPORT`... |
| `entityId` | معرّف الكيان |
| `commune` | الجماعة المرتبطة |
| `details` | JSON (مرجع، قيم سابقة/جديدة...) |
| `createdAt` | الطابع الزمني |

### الاستخدام عبر `recordActivity()`
كل عملية إنشاء/تحديث/حذف/تغيير حالة تستدعي `recordActivity({ user, action, entityType, entityId, commune, details })`.

> ⚠️ راجع `docs/DATA_MODEL.md` الفجوة 4: `entityType` يفتقد بعض الكيانات في تعليقه + لا `fromStatus`/`toStatus` كأعمدة صريحة.

---

## 6. الترقيات الأمنية الموصى بها

### عالية الأولوية (قبل النشر الإنتاجي)
| الموضوع | الحالي | الموصى به |
|---|---|---|
| Cookie `secure` | قد لا يكون مفعّلاً | `secure: true` في الإنتاج (HTTPS فقط) |
| CSP | غير مضبوط | `Content-Security-Policy` عبر headers أو middleware |
| CSRF | غير مطبّق | CSRF tokens للنماذج الداخلية (المسارات العمومية لها honeypot) |
| HTTPS redirect | يعتمد على Caddy/Nginx | `X-Forwarded-Proto` check + redirect في middleware |
| Rate limit API الداخلية | غير مطبّق | rate limit per-user للمسارات الحساسة (تصدير، حذف جماعي) |

### متوسطة الأولوية
| الموضوع | الحالي | الموصى به |
|---|---|---|
| Rate limit موزّع | `Map` في الذاكرة | Redis للنشر متعدد الخوادم |
| Login throttling موزّع | `Map` في الذاكرة | Redis أو DB |
| Helmet headers | غير مفعّل | `helmet` middleware |
| File upload MIME sniff | فحص امتداد فقط | فحص magic bytes (`file-type`) |
| Password policy | لا قيد | حد أدنى للطول + تعقيد |
| Session revocation | حذف عند الخروج | إمكانية إنهاء كل الجلسات (admin) |

### منخفضة الأولوية
| الموضوع | الحالي | الموصى به |
|---|---|---|
| 2FA | غير موجود | TOTP للمسؤولين |
| Audit log immutable | قابل للحذف | append-only أو external log |
| Secrets rotation | يدوي | تدوير دوري للـ `INITIAL_SETUP_TOKEN` |

---

## 7. إدارة الأسرار (Secrets Management)

### ما يجب ألا يكون في الكود
- كلمات المرور، الرموز، مفاتيح API.
- سلاسل اتصال قاعدة البيانات.
- بيانات اعتماد SMTP.

### أين تُخزّن
`.env` (غير متتبّع في git، راجع `.gitignore`). القالب في `.env.example`:
```
DATABASE_URL=file:../db/custom.db
INITIAL_SETUP_TOKEN=replace-with-a-long-random-secret
INITIAL_ADMIN_USERNAME=admin
INITIAL_ADMIN_PASSWORD=replace-with-a-strong-password
INITIAL_ADMIN_NAME=المسؤول العام
ALLOW_DEMO_SEED=false
SMTP_HOST=...
SMTP_PORT=...
SMTP_USER=...
SMTP_PASSWORD=...
SMTP_FROM=...
```

### قواعد
1. **لا ترفع `.env`** إلى مستودع عام.
2. **غيّر** `INITIAL_SETUP_TOKEN` وكلمات المرور الافتراضية قبل الإطلاق.
3. **استخدم** متغيرات البيئة في الإنتاج (PM2 ecosystem / systemd EnvironmentFile).
4. **لا تسجّل** الأسرار في `ActivityLog` أو console.log.

---

## 8. النسخ الاحتياطي والاسترجاع

- **JSON Backup**: `GET /api/backup` (مسؤول فقط) — يصدّر الكيانات الرئيسية.
- **ملفات storage/**: تحتوي الصور والوثائق — **يجب نسخها يدوياً** (لا تشملها نسخة JSON).
- **قاعدة البيانات**: `db/custom.db` ملف واحد — انسخه بعد إيقاف الخادم أو استخدم `.backup` SQLite.

```bash
# نسخة احتياطية كاملة
curl -H "Cookie: 3d_session_token=..." http://localhost:3000/api/backup > backup.json
cp db/custom.db backup/custom-$(date +%F).db
cp -r storage/ backup/storage-$(date +%F)/
```

---

## 9. نقاط الفحص الأمني (Security Checklist)

عند إضافة ميزة جديدة، تحقق من:
- [ ] كل مسار API محمي بـ `requireAuth()` / `requireAdmin()`.
- [ ] الفلترة الترابية مطبّقة (`getScopedCommuneFilter` للقراءة، `resolveRecordCommune` للكتابة).
- [ ] `canAccessCommune` يُفحص قبل الوصول لسجل محدّد.
- [ ] المسارات العمومية لها rate limit + honeypot.
- [ ] المدخلات مُتحقّق منها (نوع، طول، نطاق).
- [ ] رفع الملفات: فحص امتداد + حجم + `flag:'wx'` + rollback.
- [ ] خدمة الملفات تستخدم `getXxxPath()` (آمنة من path traversal).
- [ ] `recordActivity()` يُستدعى للعمليات الحساسة.
- [ ] لا أسرار في الكود.
- [ ] الحذف الإداري: أرشفة بدل حذف مدمر (للسجلات الإدارية).
