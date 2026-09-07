# Phase 3 — Database & Relations

## النطاق المنفذ

تمت إضافة طبقة البيانات التي تحتاجها المراحل اللاحقة دون تكرار المؤسسة أو التفتيش أو العينة الموجودين أصلاً.

## النماذج الجديدة

| النموذج | الغرض | المرجع |
|---|---|---|
| `TemperatureLog` | سجل درجات حرارة التجهيز والتخزين والاستلام | `TEMP-YYYY-NNNNNN` |
| `FoodProduct` | مراقبة المنتج، الدفعة، الصلاحية، التخزين والتتبع | `PROD-YYYY-NNNNNN` |
| `LabResult` | نتيجة تحليل مرتبطة بعينة | `LAB-YYYY-NNNNNN` |
| `FoodNonConformity` | عدم مطابقة مستقل قابل للتصحيح والمتابعة | `NC-YYYY-NNNNNN` |
| `FryingOilCheck` | فحص زيت القلي والتغيير والتخلص | `OIL-YYYY-NNNNNN` |

## العلاقات المضافة

```text
Establishment 1──N TemperatureLog
Establishment 1──N FoodProduct
Establishment 1──N LabResult
Establishment 1──N FoodNonConformity
Establishment 1──N FryingOilCheck

Inspection 1──N TemperatureLog
Inspection 1──N FoodProduct
Inspection 1──N FoodNonConformity
Inspection 1──N FryingOilCheck
Inspection 1──N Sample

Sample 1──N LabResult
FoodReport 1──N Inspection
```

## قواعد البيانات

- كل نموذج يحتوي على `commune` للفصل الترابي والفهرسة.
- العلاقات التابعة تستخدم `onDelete: Cascade` عندما تكون جزءاً من سجل المؤسسة.
- العلاقات الاختيارية تستخدم `onDelete: SetNull` حتى لا يؤدي حذف مرجع اختياري إلى حذف التاريخ.
- حالات المطابقة والمستويات قيم نصية قابلة للتهيئة، وليست قرارات قانونية hard-coded.
- تم تطبيق المخطط بواسطة `prisma db push` على SQLite الحالي، دون حذف البيانات الموجودة.

## ما لم ينفذ بعد

- واجهات CRUD ومسارات API للنماذج الجديدة.
- صلاحيات الإنشاء والتعديل لكل مسار.
- رفع الأدلة والصور وربطها بالوثائق.
- نماذج الحجز والإتلاف والحملات.

هذه العناصر تأتي في المراحل التالية بعد تثبيت الاختبارات والصلاحيات.
