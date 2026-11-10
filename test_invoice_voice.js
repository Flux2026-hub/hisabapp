const fs = require('fs');
const code = fs.readFileSync('src/utils/gemini.ts', 'utf8');
const match = code.match(/const API_KEY = "(.*?)";/);
const API_KEY = match ? match[1] : null;

async function test() {
  const text = "بعت للعميل ماكس مول 100 علبة مسلك مجاري بسعر 3 ريال ونص سعودي اعمل فاتورة";
  console.log("⏳ اختبار الجملة:", text);
  const prompt = `
      أنت مساعد محاسبي ذكي جداً وتفهم كل اللهجات العربية. حلل النص التالي واستخرج البيانات في JSON فقط.
      النص: "${text}"
      القواعد:
      - إذا كان النص يتحدث عن إصدار فاتورة مبيعات أو بيع أصناف، اجعل intent = "invoice".
      - استخرج اسم العميل في partyName، اسم الصنف في itemName، الكمية في quantity، سعر الوحدة في unitPrice، العملة في currencyCode.
      - الكسور: "ونص" تعني 0.5 (3 ونص = 3.5).
      - العملة: "سعودي" تعني SAR.
      أمثلة: { "intent": "invoice", "partyName": "ماكس مول", "itemName": "مسلك مجاري", "quantity": 100, "unitPrice": 3.5, "currencyCode": "SAR", "amount": 350, "description": "فاتورة مبيعات" }
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
