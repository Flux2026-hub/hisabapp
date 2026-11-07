const fs = require('fs');
const code = fs.readFileSync('src/utils/gemini.ts', 'utf8');
const match = code.match(/const API_KEY = "(.*?)";/);
const API_KEY = match ? match[1] : null;

async function testText(text) {
  const prompt = `
      أنت مساعد محاسبي ذكي جداً وتفهم كل اللهجات العربية (خاصة اليمنية). مهمتك هي تحليل النص التالي واستخراج البيانات منه بدقة.
      النص: "${text}"

      قواعد صارمة:
      1. إذا كان النص يتحدث عن دفع أو صرف أو شراء (مثل: "صرفت"، "دفعت"، "اشتريت")، اجعل intent = "expense".
      2. إذا كان النص يتحدث عن استلام أو قبض أو دخل (مثل: "استلمت"، "قبضت")، اجعل intent = "income".
      3. إذا كان النص يطلب فتح حساب أو إضافة عميل (مثل: "افتح حساب"، "أضف عميل"، "سجل زبون")، اجعل intent = "create_customer".
      4. إذا قال المستخدم أن الرقم موجود في جهات الاتصال، أو لم يذكر رقماً وطلب البحث، اجعل useContact = true.
      5. استخرج اسم العميل في حقل partyName، ورقم الهاتف في حقل phone (إذا وجد).
      6. استخرج المبلغ في حقل amount.
      7. أي كلام إضافي أو وصف للعملية ضعه في description.

      أمثلة على المخرجات المطلوبة (JSON فقط):
      { "intent": "create_customer", "partyName": "حسان العشاري", "phone": "777696688", "amount": 0, "description": "إضافة عميل" }
      { "intent": "expense", "amount": 500, "description": "بنزين" }
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
      console.log(`❌ [${text}] -> خطأ: ${data.error.message}`);
    } else {
      console.log(`✅ [${text}] -> الرد:\n${data.candidates[0].content.parts[0].text}`);
    }
  } catch (e) {
    console.log("❌ خطأ شبكة:", e.message);
  }
}

(async () => {
  console.log("⏳ جاري اختبار الجملتين من تليجرام...");
  await testText("افتح حساب عميل جديد باسم محمد نجيب الحاتمي رقم تلفونه موجود في جهات الاتصال");
  await testText("استلمت مبلغ 14000 ريال يمني من العميل مراد الوليدي");
})();
