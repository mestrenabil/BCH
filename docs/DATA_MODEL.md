# Data Model — نموذج البيانات

> مرجع كامل لكل نماذج Prisma في المنصة، علاقاتها، والفجوات المعمارية.
> المصدر الأساسي للحقائق: `prisma/schema.prisma`.

---

## 1. قاعدة البيانات

- **Provider:** SQLite (`schema.prisma:6`)
- **URL:** `file:../db/custom.db` (قابل للتغيير عبر `DATABASE_URL`)
- **لا migrations**: النظام يعتمد `prisma db push` لتطبيق المخطط مباشرةً.
- **لا `enum`**: كل حقول الحالة/النوع/المصدر هي `String` مع تعليقات تُوثّق القيم المسموحة.

> ⚠️ عند الترحيل لـ PostgreSQL (المرحلة 12)، يُنصح بتحويل هذه الحقول لـ `enum` حقيقي لضمان سلامة البيانات.

---

## 2. فهرس النماذج (28 نموذجاً)

### النواة التشغيلية (3D)
| النموذج | الوصف | `statut` / المرجع |
|---|---|---|
| `Intervention` (L10) | تدخل 3D (مكافحة قوارض/حشرات/تطهير) | `PLANIFIEE/EN_COURS/TERMINEE/ANNULEE` · ref تلقائي |
| `Campagne` (L45) | حملة (تجميع تدخلات) | `PLANIFIEE/EN_COURS/TERMINEE/ANNULEE` · `CAMP-YYYY-NNN` |
| `Quartier` (L65) | حي (اسم فريد داخل الجماعة) | `@@unique([nom, commune])` |

### المخزون والمنتجات
| النموذج | الوصف |
|---|---|
| `Product` (L75) | منتج (بيوسيد، طُعم...) مع `reference`، `unite`، `stockSeuil` |
| `ProductCategory` (L95) | فئة مخصصة للمنتجات، مرتبطة بالجماعة وقابلة للإضافة من نموذج المنتج |
| `InterventionMaterial` (L95) | مادة مستخدمة في تدخل (`@@unique([interventionId, productId])`) |
| `StockMovement` (L150) | حركة مخزون (ENTREE/SORTIE/AJUSTEMENT) |

### الأشخاص والمصادقة
| النموذج | الوصف |
|---|---|
| `Agent` (L108) | عون ميداني (`nom`, `prenom`, `fonction`, `telephone`, `commune`, `teamId?`) |
| `Team` (L124) | فريق تابع لجماعة، مرتبط بمكتب ومهمة، ويمكن أن يضم عدة أعوان |
| `User` (L122) | مستخدم نظام (`username`, `role`, `commune`, `managedCommunes`, `agentId?`) |
| `Session` (L140) | جلسة (`token` فريد، `expiresAt`، `userId`) |

### الوثائق والصور
| النموذج | الوصف |
|---|---|
| `Document` (L169) | وثيقة عامة (`titre`, `type`, `contenu`, `reference`) |
| `DocumentCategory` (L223) | فئة مخصصة للمستندات، مرتبطة بالجماعة وقابلة للإضافة من نافذة الرفع |
| `InterventionDocument` (L188) | ربط M:N تدخل↔وثيقة |
| `InterventionPhoto` (L200) | صورة تدخل (`storedFileName`, `lat/lng?`) |
| `InterventionComment` (L310) | تعليق على تدخل |

### الشكايات
| النموذج | الوصف | `statut` / المرجع |
|---|---|---|
| `Complaint` (L210) | شكاية مواطنية | `EN_ATTENTE/EN_COURS/TRAITEE/REJETEE` · `PL-YYYY-NNN` |
| `ComplaintContact` (L237) | جهة اتصال الشكاية (M:1) |

### أوامر العمل الميدانية
| النموذج | الوصف | `statut` / المرجع |
|---|---|---|
| `WorkOrder` (L251) | أمر عمل ميداني | `NOUVEAU/ASSIGNE/EN_ROUTE/EN_COURS/TERMINE/ANNULE` · `OT-YYYY-XXXXXXXX` |
| `WorkOrderPhoto` (L281) | دليل إنجاز بصورة |

### التدقيق والإعدادات
| النموذج | الوصف |
|---|---|
| `ActivityLog` (L297) | سجل النشاط (`entityType`, `action`, `details`) |
| `CommuneSettings` (L162) | إعدادات لكل جماعة (`commune` فريد، JSON) |
| `CsvrSettings` (L520) | إعدادات CSVR لكل جماعة (JSON: species/priority/shelters) |

### الحيوانات الشاردة (CSVR)
| النموذج | الوصف | `statut` / المرجع |
|---|---|---|
| `StrayReport` (L324) | بلاغ حيوان شارد | 10 حالات · `SIG-CSVR-YYYY-XXXXXX` |
| `StrayReportPhoto` (L364) | صورة بلاغ |
| `CaptureMission` (L379) | مهمة التقاط | 9 حالات · `MIS-CSVR-YYYY-NNN` |
| `CaptureMissionPhoto` (L424) | صورة مهمة |
| `StrayAnimal` (L440) | حيوان مسجّل | 20 حالة · `BCH-CSVR-YYYY-NNNNNN` |
| `StrayAnimalPhoto` (L490) | صورة حيوان |
| `StrayAnimalStatus` | تاريخ تغيّر حالة الحيوان |
| `StrayAnimalCareEvent` | فحص، علاج، تلقيح، تعقيم، ومراقبة بيطرية مرتبطة بالحيوان |
| `StrayAnimalDestination` | إعادة إلى المجال، تبنٍ، نقل، أو نفوق مع الموقع والتأكيدات |
| `StrayAnimalDestination` | يتضمن أيضاً مرجع وثيقة التبني وإقرار الالتزام مع إخفاء رقم الهاتف في العرض |
| `StrayAnimalCenter` | مركز إيواء/بيطري أو حجر صحي مع الطاقة الاستيعابية |
| `StrayAnimalAdmission` | دخول حيوان إلى مركز مع الصندوق والحالة والقياسات |
| `StrayAnimalTransport` | سجل نقل الحيوان بين موقع الالتقاط والمركز أو الوجهة مع المركبة والطاقم والحوادث |
| `StrayAnimalHealthAlert` | تنبيه صحي للاشتباه أو الإصابة أو الحجر، مع الإجراء والإخبار والتتبع دون تشخيص آلي |
| `StrayAnimalDeathReport` | سجل حيوان نافق أو مجموعة مع الموقع والسبب الظاهر والاشتباه الصحي والتكفل والإزالة |
| `StrayAnimalHotspot` | نقطة ساخنة مع مؤشرات البلاغات والمجموعات والعضات والتدخلات وأولوية المتابعة |
| `StrayPartner` | دليل الجهات والشركاء المتعاونين حسب جماعة الحساب مع حالة النشاط وبيانات الاتصال |
| `StrayAnimalIdentification` | وسيلة تعريف الحيوان مع رقم فريد وتحديث حالة الحيوان إلى معرّف |
| `StrayCampaign` | برنامج سنوي للحصر أو الالتقاط أو التلقيح أو التعقيم مع أهداف ومؤشرات إنجاز |
| `StrayCampaignActivity` | حصيلة ميدانية يومية مرتبطة بحملة، تُجمع تلقائياً لتحديث الإنجاز |

تستخدم مسارات `/api/csvr/care` و`/api/csvr/destinations` نفس `requireAuth` و`canAccessCommune`، وتسجل العمليات في `ActivityLog` وتحدّث `StrayAnimalStatus` داخل معاملة واحدة.
| `StrayAnimalStatus` (L506) | **timeline حالة** (`fromStatus`/`toStatus`/`reason`) |

### السلامة الغذائية — 2 نموذج
| النموذج | الوصف | `statut` / المرجع |
|---|---|---|
| `FoodReport` (L529) | بلاغ مخالفة غذائية | 7 حالات · `SIG-FOOD-YYYY-XXXXXX` |
| `FoodReportPhoto` (L556) | صورة بلاغ غذائي |

### المحافظة على البيئة — 6 نماذج
| النموذج | الوصف | `statut` / المرجع |
|---|---|---|
| `EnvironmentalDossier` | ملف بيئي موحّد للمكتب 06، مرتبط اختيارياً بـ`Dossier` عام وبالشكايات/البلاغات العمومية لمتابعة الحالة والآجال | `NEW/IN_PROGRESS/INSPECTED/ACTION_REQUIRED/FOLLOW_UP/CLOSED` · `ENV-YYYY-XXXXXX` |
| `EnvironmentalDossierDocument` | ربط M:N بين الملف البيئي والمستندات الموجودة | |
| `PollutionIncident` | حادث تلوث (هواء/ماء/تربة/ضجيج...) | `POL-YYYY-XXXXXX` |
| `WasteBlackSpot` | نقطة سوداء للنفايات مع التكرار | `DEP-YYYY-XXXXXX` |
| `NaturalSite` | موقع طبيعي أو تراثي قابل للعرض في GIS | `SITE-YYYY-XXXXXX` |
| `AwarenessCampaign` | حملة تحسيس بيئي ونتائجها | `ENV-CAMP-YYYY-XXXXXX` |

---

## 3. أنماط المراجع (Reference Patterns)

| الكيان | النمط | مثال |
|---|---|---|
| Complaint | `PL-{year}-{seq}` | `PL-2026-001` |
| WorkOrder | `OT-{year}-{8 hex}` | `OT-2026-AB12CD34` |
| StrayReport | `SIG-CSVR-{year}-{6 hex}` | `SIG-CSVR-2026-A1B2C3` |
| CaptureMission | `MIS-CSVR-{year}-{seq}` | `MIS-CSVR-2026-001` |
| StrayAnimal | `BCH-CSVR-{year}-{6 digit}` | `BCH-CSVR-2026-000001` |
| FoodReport | `SIG-FOOD-{year}-{6 hex}` | `SIG-FOOD-2026-A1B2C3` |
| Campagne | `CAMP-{year}-{seq}` | `CAMP-2026-001` |
| EnvironmentalDossier | `ENV-{year}-{6 hex}` | `ENV-2026-A1B2C3` |
| PollutionIncident | `POL-{year}-{6 hex}` | `POL-2026-A1B2C3` |
| WasteBlackSpot | `DEP-{year}-{6 hex}` | `DEP-2026-A1B2C3` |

> **نمط التوليد**: لكل مرجع عشوائي (hex)، يُعاد المحاولة حتى 5 مرات لتجنّب التصادم، ثم fallback لـ `Date.now().toString(36)`.

---

## 4. خريطة العلاقات

```
                    Campagne
                       │ 1:M
                       ▼
    Complaint ────► Intervention ◄──── WorkOrder
       │ 1:M           │ 1:M              │ 1:M
       ▼               ▼                  ▼
  Complaint-     Intervention-      WorkOrder-
   Contact        Material/           Photo
                  Document/
                  Photo/Comment

  StrayReport ──► CaptureMission ◄── StrayAnimal
       │ 1:M           │ 1:M             │ 1:M
       ▼               ▼                 ▼
  StrayReport-   CaptureMission-    StrayAnimalPhoto
   Photo           Photo             + StrayAnimalStatus (timeline)

  FoodReport
       │ 1:M
       ▼
  FoodReportPhoto

  User ──► Session
    │
    └──► Agent? (agentId, للعون الميداني فقط)

  Team ──► Agent[] (teamId اختياري، نفس الجماعة)

  Product ◄── InterventionMaterial
    │
    └── StockMovement

  EnvironmentalDossier ──► Dossier (timeline موحّد)
  Complaint (ENVIRONMENT/Public) ──► EnvironmentalDossier (إنشاء تلقائي أو ربط يدوي)
          │ M:N
          ▼
       Document
```

### العلاقات المتقاطعة (الموجودة)
- `WorkOrder` له FKs اختيارية لـ `Complaint` و`Intervention` — يعمل كجسر جزئي.
- `Complaint.interventionId` يربط الشكاية بتدخل.
- `StrayReport.missionId` يربط البلاغ بمهمة التقاط.
- `Intervention.campagneId` يربط التدخل بحملة.

### العلاقات الناقصة
- لا يوجد ربط `FoodReport` ↔ `Intervention` أو `WorkOrder` (رغم أن المخالفة قد تُعالَج بتدخل).
- لا يوجد ربط `StrayReport` ↔ `BiteCase` (لسع/الكلاب — مفقود كلياً).
- `ActivityLog.entityType` لا يذكر `STRAY_REPORT`/`WORK_ORDER`/`FOOD_REPORT` في تعليقه (L302) — فجوة توثيقية.

---

## 5. الحقول المشتركة المتكرّرة

### `commune String` (المحور الترابي)
موجود على: Intervention, Campagne, Quartier, Product, Agent, User, CommuneSettings, CsvrSettings, Complaint, WorkOrder, StrayReport, CaptureMission, StrayAnimal, FoodReport, ActivityLog, StockMovement.

### `priority String` (الأولوية)
| القيمة | عربي | لون |
|---|---|---|
| `FAIBLE` | منخفضة | رمادي |
| `NORMALE` | عادية (افتراضي) | أزرق |
| `HAUTE` | مرتفعة | كهرماني |
| `URGENTE` | عاجلة | برتقالي |
| `SANITAIRE` | صحية خطيرة | أحمر |

> ⚠️ `Intervention` ليس له `priority`. `WorkOrder` يستخدم مجموعة فرعية (`URGENTE/HAUTE/NORMALE/BASSE` — لاحظ `BASSE` بدل `FAIBLE`).

### `source String`
`INTERNAL` (افتراضي) / `PUBLIC` / `PHONE` / `AUTHORITY`. على Complaint, StrayReport, FoodReport.

### `latitude Float?` / `longitude Float?`
على كل الكيانات الجغرافية. **نقاط بسيطة، ليست PostGIS geometry** — راجع القسم 7.

---

## 6. الفجوات المعمارية والتوصيات

### الفجوة 1: لا نظام Dossiers موحّد ⭐ (الأولوية القصوى)
**المشكلة:** كل كيان (Intervention, Complaint, WorkOrder, StrayReport, FoodReport) له:
- `statut` مختلف (4-10 قيم) دون تطابق.
- دورة حياة مختلفة.
- لا timeline موحّدة (فقط `StrayAnimalStatus` يخزّن تاريخ الحالات).

**التوصية (المرحلة 2):** أضف نموذج `Dossier` عام:
```prisma
model Dossier {
  id          String   @id @default(cuid())
  reference   String   @unique        // "DOS-2026-NNNNNN"
  office      String                  // OFFICE_01..OFFICE_09
  type        String                  // INSPECTION, COMPLAINT, MISSION...
  title       String
  status      String   @default("NEW") // NEW/ASSIGNED/IN_PROGRESS/.../ARCHIVED
  priority    String   @default("NORMALE")
  commune     String
  // روابط اختيارية للكيانات الموجودة (polymorphic-lite)
  interventionId String?
  complaintId   String?
  workOrderId   String?
  strayReportId String?
  foodReportId  String?
  // ...
  timeline    DossierEvent[]
}
model DossierEvent {
  id         String   @id @default(cuid())
  dossierId  String
  fromStatus String?
  toStatus   String
  changedBy  String
  reason     String?
  createdAt  DateTime @default(now())
}
```
هذا **لا يكسر** النماذج الحالية — يضيف طبقة توحيد فوقها.

### الفجوة 2: لا نموذج `Office` / `Bureau`
لا يوجد تمثيل للمكاتب الوظيفية التسعة. الحل الحالي: `navItems[].sectionKey` (تجميع واجهة فقط).

**التوصية:** لا تضف نموذج `Office` كجدول — يكفي ثابت في `constants.ts`:
```typescript
export const OFFICES = {
  OFFICE_01: { code: 'OFFICE_01', nameFr: 'Direction', nameAr: 'الإدارة', icon: '🏢' },
  OFFICE_02: { code: 'OFFICE_02', nameFr: 'Contrôle Sanitaire', nameAr: 'المراقبة الصحية', icon: '🍽️' },
  // ...
}
```
ثم أضف `office String?` اختيارياً لـ `Dossier` (ولاحقاً للكيانات الأخرى عند الحاجة).

### الفجوة 3: لا `enum` Prisma
كل الحالات `String`. خطر: قيم غير صحيحة قد تُكتب دون قيد.

**التوصية:** عند الترحيل لـ PostgreSQL، حوّل لـ `enum`. مؤقتاً، أضف تحقّق Zod في مسارات API.

### الفجوة 4: `ActivityLog` غير مكتمل
- `entityType` تعليقه يفتقد STRAY_REPORT/WORK_ORDER/FOOD_REPORT (لكنها تُستخدم فعلياً في الكود).
- لا `previousState`/`newState` منظم (فقط في `details` JSON).

**التوصية:** وسّع `entityType` لتشمل كل الكيانات + أضف `fromStatus`/`toStatus` كأعمدة صريحة لتغييرات الحالة.

### الفجوة 5: لا حذف ناعم (soft delete)
الحذف حالياً مدمر (`DELETE`). للسجلات الإدارية، يجب الأرشفة.

**التوصية:** أضف `archivedAt DateTime?` / `deletedAt DateTime?` للكيانات الإدارية + غيّر الحذف لـ "أرشفة".

---

## 7. ملاحظة PostGIS / الإحداثيات

**الحالي:** `latitude Float?` / `longitude Float?` — نقاط بسيطة، استعلامات المسافة تُحسب يدوياً (Haversine في JS).

**المستهدف (المرحلة 12):** عند الترحيل لـ PostgreSQL/PostGIS:
```sql
-- إضافة عمود geometry
ALTER TABLE "Intervention" ADD COLUMN geom geometry(Point, 4326);
UPDATE "Intervention" SET geom = ST_MakePoint(longitude, latitude)::geometry(Point, 4326);
CREATE INDEX idx_intervention_geom ON "Intervention" USING GIST(geom);

-- استعلامات المسافة
SELECT * FROM "Intervention"
WHERE ST_DWithin(geom, ST_MakePoint(-6.8, 34.05)::geography, 1000);  -- ضمن 1كم
```

في Prisma، الإحداثيات تبقى `Float?` للتطبيق، مع trigger/middleware لتحديث `geom` تلقائياً.

---

## 8. ثوابت الأنواع والحالات

كل التسميات والألوان في `src/lib/constants.ts`:
- `INTERVENTION_TYPE_LABELS`, `INTERVENTION_STATUS_*`
- `COMPLAINT_STATUS_*`, `COMPLAINT_PRIORITY_*`
- `WORK_ORDER_STATUS_*`
- `STRAY_REPORT_STATUS_*`, `ANIMAL_SPECIES_*`
- `FOOD_TYPE_LABELS`/`ICONS`/`COLORS`, `FOOD_REPORT_STATUS_*`, `FOOD_PRIORITY_*`
- `FOOD_ESTABLISHMENT_TYPES`, `FOOD_TYPE_ADVICE` (نصائح لكل نوع)
- `COMMUNE_LABELS`, `COMMUNE_COLORS` (خرائط لونية حسب الجماعة)

عند إضافة نوع/حالة جديدة، أضفه هنا أولاً، ثم استخدمه في الواجهات.

## 9. سجل الكلورة والتطهير

يرتبط `WaterDisinfectionOperation` بمصدر واحد فقط: `WaterPoint` أو `Pool`، ويحفظ الجماعة، تاريخ العملية، نوعها، المادة الفعالة، رقم الدفعة، الجرعة، الحجم المعالج، القياس قبل/بعد التطهير، مدة التماس، المسؤول والنتيجة.

مسار API:
- `GET/POST /api/water-disinfection`

ويظهر السجل في قسم الماء والتطهير، وفي طبقة `waterDisinfection` على الخريطة، وفي التقرير الشامل، مع تطبيق نطاق الجماعة وتسجيل نشاط الإنشاء.

## 10. أصول وشبكات الصرف الصحي

يحفظ `SanitationAsset` جرد الأصول الميدانية مثل القنوات والمصارف ومحطات الضخ والخزانات ومحطات المعالجة، مع الموقع، الحالة، المشغل، السعة، آخر صيانة وموعد الصيانة القادمة.

مسار API:
- `GET/POST /api/sanitation-assets`

وتظهر الأصول ذات الإحداثيات في طبقة `sanitationAssets` مع تمييز الصيانة المتأخرة، مع احترام نطاق الجماعة وتسجيل عملية الإنشاء.

## 11. خطط الطوارئ واستمرارية التزويد

يحفظ `WaterEmergencyPlan` خطط الاستجابة لانقطاع التزويد أو التلوث أو الفيضانات أو نقص المياه، مع مستوى الخطر، الحالة، المسؤول، المصدر البديل، التدابير وخطة التواصل وآجال التفعيل والإغلاق.

مسار API:
- `GET/POST /api/water-emergency-plans`

تظهر الخطط النشطة أو الحرجة في التنبيهات الموحدة ضمن نطاق الجماعة، مع تسجيل عملية الإنشاء في سجل النشاط.

## 12. برامج الحملات الدورية

يحفظ `WaterMonitoringProgram` برامج الحملات المنظمة لجودة المياه والتطهير والصرف الصحي ومراقبة المسابح والطوارئ، مع الهدف، المنطقة المستهدفة، الفريق والمسؤول، الحالة، المدة، التواتر، والعدد المستهدف والمنجز.

مسار API:
- `GET/POST /api/water-programs`

يُعرض البرنامج في تبويب «برامج الحملات» مع نسبة الإنجاز ونطاق الجماعة. ويختلف عن «البرمجة الدورية» التي تحسب مواعيد العينات والتفتيش؛ فالبرنامج يمثل حملة تشغيلية قابلة للتتبع والتنفيذ.

## 13. حوادث المياه والانقطاعات

يحفظ `WaterIncident` الحوادث الفعلية مثل انقطاع التزويد، الاشتباه في التلوث، انخفاض الضغط، انفجار القنوات والفيضانات، مع موقع الحادث، شدته، عدد السكان والنقاط المتضررة، المسؤول، الاستجابة والحالة.

مسار API:
- `GET/POST /api/water-incidents`

تظهر الحوادث ذات الإحداثيات في طبقة `waterIncidents` على خريطة الماء، وتظهر الحوادث المرتفعة والحرجة المفتوحة في التنبيهات الموحدة، مع تطبيق نطاق الجماعة وتسجيل الإنشاء في سجل النشاط.

## 14. المختبرات والجهات المتعاونة

يحفظ `WaterLaboratory` دليل المختبرات المرتبطة بجماعة الحساب، بما يشمل النوع، حالة الاعتماد، مرجع الاعتماد، جهة الاتصال، المؤشرات المتاحة ومتوسط مدة إنجاز النتائج.

مسار API:
- `GET/POST /api/water-laboratories`

يُستخدم السجل كمرجع تشغيلي لاختيار الجهة المناسبة لتحليل العينات، مع احترام نطاق الجماعة وتسجيل الإضافة في سجل النشاط.
