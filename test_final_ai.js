const fs = require('fs');
const code = fs.readFileSync('src/utils/gemini.ts', 'utf8');
const match = code.match(/const API_KEY = "(.*?)";/);
const API_KEY = match ? match[1] : null;

async function testText(text) {
  const prompt = `
      أنت مساعد محاسبي ذكي. حلل النص التالي واستخرج البيانات في JSON فقط.
      النص: "${text}"
      القواعد:
      - إذا كان النص يتحدث عن دفع/صرف، اجعل intent = "expense".
      - إذا كان النص يتحدث عن استلام/قبض، اجعل intent = "income".
      - استخرج اسم العميل في partyName، اسم الصندوق في cashboxName، المبلغ في amount.
      - الأرقام المكتوبة بالحروف: عشرين ألف = 20000، خمسة آلاف = 5000.
      أمثلة:
      { "intent": "income", "amount": 20000, "partyName": "محلات البتراء", "cashboxName": "الكريمي", "currencyCode": "YER", "description": "استلام مبلغ" }
  `;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${API_KEY}`;
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) });
    const data = await res.json();
    if (data.error) {
      console.log("❌ خطأ:", data.error.message);
    } else {
      console.log(`🤖 [${text}]:\n`, data.candidates[0].content.parts[0].text.trim());
    }
  } catch (e) { console.log("❌ خطأ شبكة"); }
}

(async () => {
  await testText("استلمت من محلات البتراء عشرين ألف ريال في محفظة الكريمي");
  await testText("صرفت خمسة آلاف ريال بنزين من صندوق النقدي");
})();
