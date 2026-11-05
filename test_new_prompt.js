const fs = require('fs');
const code = fs.readFileSync('src/utils/gemini.ts', 'utf8');
const match = code.match(/const API_KEY = "(.*?)";/);
if (!match) return console.log("لم يتم العثور على المفتاح");
const API_KEY = match[1];

const testText = "افتح حساب عميل جديد باسم حسان العشاري رقم تلقونه 777696688";
console.log("⏳ جاري اختبار الجملة:", testText);

const prompt = `
      أنت مساعد محاسبي ذكي جداً وتفهم كل اللهجات العربية (خاصة اليمنية). مهمتك هي تحليل النص التالي واستخراج البيانات منه بدقة.
      النص: "${testText}"

      قواعد صارمة:
      1. إذا كان النص يتحدث عن دفع أو صرف أو شراء (مثل: "صرفت"، "دفعت"، "اشتريت")، اجعل intent = "expense".
      2. إذا كان النص يتحدث عن استلام أو قبض أو دخل (مثل: "استلمت"، "قبضت")، اجعل intent = "income".
      3. إذا كان النص يطلب فتح حساب أو إضافة عميل (مثل: "افتح حساب"، "أضف عميل"، "سجل زبون")، اجعل intent = "create_customer".
      4. استخرج اسم العميل في حقل partyName، ورقم الهاتف في حقل phone (إذا وجد).
      5. استخرج المبلغ في حقل amount.
      6. أي كلام إضافي ضعه في description.

      أمثلة على المخرجات المطلوبة (JSON فقط):
      { "intent": "create_customer", "partyName": "حسان العشاري", "phone": "777696688", "amount": 0, "description": "إضافة عميل" }
`;

const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${API_KEY}`;

fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
}).then(res => res.json()).then(data => {
  if (data.error) return console.log("❌ خطأ من جوجل:", data.error.message);
  console.log("🤖 رد الذكاء الاصطناعي:\n", data.candidates[0].content.parts[0].text);
});
