const fs = require('fs');
const code = fs.readFileSync('src/utils/gemini.ts', 'utf8');
const match = code.match(/const API_KEY = "(.*?)";/);
const API_KEY = match ? match[1] : null;

async function test() {
  const text = "استلمت من العميل محلات البتراء مبلغ عشرين ألف ريال يمني إلى حساب محفظة الكريمي";
  console.log("⏳ اختبار الجملة:", text);
  const prompt = `
      أنت مساعد محاسبي ذكي. حلل النص التالي واستخرج البيانات في JSON فقط.
      النص: "${text}"
      القواعد:
      - إذا كان النص يتحدث عن استلام أو قبض، اجعل intent = "income".
      - استخرج اسم العميل في partyName، الصندوق في cashboxName، المبلغ في amount (حول الأرقام المكتوبة بالحروف إلى أرقام: عشرين ألف = 20000).
      أمثلة: { "intent": "income", "amount": 20000, "partyName": "محلات البتراء", "cashboxName": "الكريمي", "currencyCode": "YER", "description": "استلام مبلغ" }
  `;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${API_KEY}`;
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) });
    const data = await res.json();
    if (data.error) {
      console.log("❌ خطأ:", data.error.message);
    } else {
      console.log("🤖 رد Gemini:\n", data.candidates[0].content.parts[0].text);
    }
  } catch (e) { console.log("❌ خطأ شبكة"); }
}
test();
