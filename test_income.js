const fs = require('fs');
const code = fs.readFileSync('src/utils/gemini.ts', 'utf8');
const match = code.match(/const API_KEY = "(.*?)";/);
const API_KEY = match ? match[1] : null;

async function test() {
  const text = "استلمت مبلغ 14000 ريال يمني من العميل مراد الوليدي";
  console.log("⏳ جاري تحليل الجملة:", text);

  const prompt = `
      أنت مساعد محاسبي ذكي. حلل النص التالي واستخرج البيانات في JSON فقط.
      النص: "${text}"

      قواعد:
      - إذا كان النص يتحدث عن استلام أو قبض، اجعل intent = "income".
      - استخرج اسم الشخص في حقل partyName.
      - استخرج المبلغ في حقل amount.
      - ضع أي وصف إضافي في description.

      الأرقام يجب أن تكون أرقاماً (14000) وليس نصاً.
      أمثلة: { "intent": "income", "amount": 14000, "partyName": "مراد الوليدي", "description": "استلام مبلغ" }
  `;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${API_KEY}`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });
    const data = await res.json();
    if (data.error) {
      console.log("❌ خطأ:", data.error.message);
    } else {
      console.log("\n🤖 رد Gemini:");
      console.log(data.candidates[0].content.parts[0].text);
    }
  } catch (e) { console.log("❌ خطأ شبكة:", e.message); }
}
test();
