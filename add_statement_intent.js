const fs = require('fs');
let code = fs.readFileSync('src/utils/gemini.ts', 'utf8');

// 1. إضافة النية الجديدة
code = code.replace(
  'intent: "expense" | "income" | "invoice" | "create_customer" | "query_customer_balance" | "query_last_payment" | "query_stock" | "unknown";',
  'intent: "expense" | "income" | "invoice" | "create_customer" | "query_customer_balance" | "query_last_payment" | "query_stock" | "query_customer_statement" | "unknown";'
);

// 2. إضافة القاعدة في البرومبت
code = code.replace(
  '7. إذا كان النص يسأل عن كمية مخزون صنف (مثل: "كم بقي من ماسورة")، اجعل intent = "query_stock". (استخرج اسم الصنف في itemName).',
  '7. إذا كان النص يسأل عن كمية مخزون صنف (مثل: "كم بقي من ماسورة")، اجعل intent = "query_stock". (استخرج اسم الصنف في itemName).\n      8. إذا كان النص يطلب كشف حساب لعميل (مثل: "كشف حساب أحمد" أو "أرسل لي كشف حساب مراد")، اجعل intent = "query_customer_statement". (استخرج اسم العميل في partyName).'
);

// 3. تحديث رقم القاعدة التالية
code = code.replace('8. إذا لم يكن النص محاسبياً', '9. إذا لم يكن النص محاسبياً');

// 4. إضافة مثال في الأمثلة
code = code.replace(
  '{ "intent": "query_stock", "itemName": "ماسورة", "amount": 0, "description": "استعلام مخزون" }',
  '{ "intent": "query_stock", "itemName": "ماسورة", "amount": 0, "description": "استعلام مخزون" }\n      { "intent": "query_customer_statement", "partyName": "أحمد", "amount": 0, "description": "كشف حساب" }'
);

fs.writeFileSync('src/utils/gemini.ts', code);
console.log("✅ تم تحديث Gemini ليفهم أمر كشف الحساب!");
