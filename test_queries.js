const fs = require('fs');
const code = fs.readFileSync('src/utils/gemini.ts', 'utf8');
const match = code.match(/const API_KEY = "(.*?)";/);
const API_KEY = match ? match[1] : null;

async function testText(text) {
  const prompt = `
      أنت مساعد محاسبي ذكي. حلل النص التالي واستخرج البيانات بصيغة JSON فقط.
      النص: "${text}"
      القواعد:
      1. إذا سأل عن رصيد عميل، اجعل intent = "query_customer_balance" واستخرج partyName.
      2. إذا سأل عن آخر سداد، اجعل intent = "query_last_payment" واستخرج partyName.
      3. إذا سأل عن مخزون صنف، اجعل intent = "query_stock" واستخرج itemName.
      أمثلة:
      { "intent": "query_customer_balance", "partyName": "أحمد" }
      { "intent": "query_last_payment", "partyName": "مراد" }
      { "intent": "query_stock", "itemName": "ماسورة" }
  `;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${API_KEY}`;
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) });
    const data = await res.json();
    console.log(`🤖 [${text}] ->`, data.candidates[0].content.parts[0].text.trim());
  } catch (e) { console.log("❌ خطأ شبكة"); }
}

(async () => {
  await testText("كم رصيد العميل مراد الوليدي؟");
  await testText("متى كان آخر سداد من مراد؟");
  await testText("كم بقي من مخزون ماسورة؟");
})();
