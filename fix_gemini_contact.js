const fs = require('fs');
let code = fs.readFileSync('src/utils/gemini.ts', 'utf8');

// تحديث النوع
code = code.replace(
  'phone?: string;',
  'phone?: string;\n  useContact?: boolean;'
);

// تحديث البرومبت
const oldPrompt = `أمثلة على JSON المطلوب:
      { "intent": "expense", "amount": 500, "description": "بنزين" }
      { "intent": "income", "amount": 1000, "description": "دفعة من العميل", "partyName": "أحمد" }
      { "intent": "create_customer", "partyName": "أحمد علي", "phone": "777123456", "amount": 0, "description": "إضافة عميل" }`;

const newPrompt = `أمثلة على JSON المطلوب:
      { "intent": "expense", "amount": 500, "description": "بنزين" }
      { "intent": "income", "amount": 1000, "description": "دفعة من العميل", "partyName": "أحمد" }
      { "intent": "create_customer", "partyName": "أحمد علي", "phone": "777123456", "amount": 0, "description": "إضافة عميل" }
      { "intent": "create_customer", "partyName": "وليد الوثلي", "useContact": true, "amount": 0, "description": "إضافة عميل من جهات الاتصال" }

      ملاحظة هامة: إذا قال المستخدم "رقمه في جهات الاتصال" أو "من جهات الاتصال" أو "ابحث عنه في الاتصالات"، اجعل useContact = true ولا تضع phone.`;

if (code.includes(oldPrompt)) {
  code = code.replace(oldPrompt, newPrompt);
  fs.writeFileSync('src/utils/gemini.ts', code);
  console.log("✅ تم تحديث ملف Gemini!");
} else {
  console.log("⚠️ لم يتم العثور على البرومبت القديم.");
}
