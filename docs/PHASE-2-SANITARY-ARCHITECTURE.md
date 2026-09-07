# Phase 2 — Architecture & Workflow

## الهدف

توحيد دورة المراقبة الصحية والسلامة الغذائية داخل بنية BCH الحالية، دون إنشاء تطبيق منفصل أو تكرار المؤسسات والشكايات والوثائق والخرائط.

## المبدأ المعماري

```text
Establishment
  → Programme / Inspection
  → Mesures & Checklist
  → Finding / Non-conformité
  → CorrectiveAction
  → CounterVisit
  → Validation / Clôture
  → GIS + Reports + AuditLog
```

تستعمل كل الوحدات الحالية:

- Zustand للتنقل والحالة العامة.
- مكونات Tailwind وRadix الموجودة بدلاً من تصميم جديد.
- Prisma و`commune` كنطاق ترابي أساسي.
- `requireAuth`, `getScopedCommuneFilter`, و`canAccessCommune` في الخادم.
- `/api/gis/points` للخريطة الموحدة.
- `Document` و`ActivityLog` للوثائق والتدقيق.

## الوحدات الحالية وإعادة الاستخدام

| المجال | الوضع الحالي | قرار Phase 2 |
|---|---|---|
| المؤسسات | `Establishment` + CRUD | يبقى المصدر الوحيد للمؤسسة |
| التفتيش | `Inspection` + `Finding` | أساس دورة الفحص |
| التصحيح | `CorrectiveAction` | يربط بالنقص والتتبع |
| إعادة المراقبة | `CounterVisit` | يغلق الدورة بعد التحقق |
| البطاقات | `HealthCard` | تبقى مستقلة مع ربط اختياري بالمؤسسة |
| العينات | `Sample` | تتوسع لاحقاً بنتائج المختبر وسلسلة الحيازة |
| الشكايات | `Complaint` و`FoodReport` | تحويل الشكاية إلى تفتيش، دون نظام شكايات مكرر |
| الخرائط | GIS الموحد | طبقات صحية خاصة داخل نفس الخريطة |

## Workflow المعتمد

توجد الخطوات المشتركة في `src/lib/sanitary-workflow.ts`:

`RECENSER → PLANIFIER → INSPECTER → MESURER → PRELEVER → EVALUER → CONSTATER → CORRIGER → SUIVRE → CLOTURER → ANALYSER`

قواعد الانتقال مركزية وقابلة للاختبار. لا تحتوي على حدود قانونية أو قرارات إدارية تلقائية؛ القرار النهائي يبقى للمسؤول المختص.

## الصلاحيات

- `admin`: التهيئة، التحقق، الإغلاق، التصدير، وإدارة كل الجماعات.
- `responsable`: التعيين، التحقق، الإغلاق، والتقارير ضمن نطاقه الترابي.
- `agent`: إنشاء المعاينة، القياسات، الصور، والمتابعة ضمن جماعة الحساب.

يجب أن تطبق الصلاحيات في API، وليس بإخفاء الأزرار فقط.

## العلاقات المخطط لها

```text
Establishment 1──N Inspection
Inspection 1──N Finding
Inspection 1──N CorrectiveAction
Inspection 1──N CounterVisit
Establishment 1──N HealthCard
Establishment 1──N Sample
Complaint 0──1 Inspection
Sample 1──N LabResult       (Phase لاحقة)
Finding 1──N Evidence       (Phase لاحقة)
```

## ما لا يضاف في Phase 2

- لا يتم إنشاء جدول مكرر للمؤسسات.
- لا يتم إنشاء محرك خرائط مستقل.
- لا يتم hard-code للنصوص القانونية أو الحدود المرجعية.
- لا يتم نقل قاعدة البيانات قبل تثبيت العلاقات واختبار الصلاحيات.

## مراحل التنفيذ التالية

1. تشديد صلاحيات API على السجلات المرتبطة بالمؤسسة.
2. إضافة نماذج درجات الحرارة والمواد الغذائية والزيوت.
3. إضافة نتائج المختبر وعدم المطابقة والإجراءات الإدارية.
4. ربط الوثائق وGIS والتقارير بكل دورة.
5. اختبارات تكاملية لكل انتقال وصلاحية.
