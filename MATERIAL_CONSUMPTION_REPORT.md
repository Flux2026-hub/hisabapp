# تقرير استهلاك المواد الخام والهالك

## نقطة API

```text
GET /api/reports/material-consumption?companyId=1&from=2026-01-01&to=2026-12-31
```

يعيد التقرير لكل صنف ومخزن:

- `plannedQuantity`: الكمية المخططة حسب الوصفة.
- `consumedQuantity`: الكمية المصروفة فعليًا.
- `wasteQuantity`: الفرق الناتج عن الهدر.
- `totalCost`: تكلفة المواد المصروفة.
- `movementCount`: عدد حركات الصرف.

## طريقة الحساب

عند تنفيذ أمر صرف وصفة:

```text
الكمية المخططة = كمية المكون لكل وحدة × كمية الإنتاج
كمية الهالك = الكمية المصروفة - الكمية المخططة
الكمية المصروفة = الكمية المخططة × (1 + نسبة الهدر / 100)
```

وتسجل القيم في `stock_movements`، لذلك يمكن تجميعها حسب الصنف والمخزن والفترة وأمر الإنتاج.

## شاشة Android

في تبويب **التقارير** أدخل تاريخ البداية والنهاية بصيغة `YYYY-MM-DD`. تعرض الشاشة ملخص الاستهلاك والهالك، وعند اتصال API يتم تحميل الأرقام الفعلية من نقطة التقرير.

## ترقية قاعدة موجودة

إذا كانت قاعدة MySQL أو SQLite منشأة قبل إضافة الحقول، أضف:

```sql
ALTER TABLE stock_movements ADD COLUMN plannedQuantity DECIMAL(20,8) NOT NULL DEFAULT 0;
ALTER TABLE stock_movements ADD COLUMN wasteQuantity DECIMAL(20,8) NOT NULL DEFAULT 0;
```

أما قواعد SQLite الموجودة، فيجب تنفيذ migration محلية مخصصة لإضافة `planned_quantity` و`waste_quantity` قبل استخدام التقرير.
