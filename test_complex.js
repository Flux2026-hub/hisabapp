const fs = require('fs');
const code = fs.readFileSync('src/utils/gemini.ts', 'utf8');
const match = code.match(/const API_KEY = "(.*?)";/);
const API_KEY = match ? match[1] : null;

async function testText(text) {
  console.log(`\n⏳ اختبار الجملة: "${text}"`);
  const prompt = `
      أنت مساعد محاسبي ذكي جداً وتفهم كل اللهجات العربية (خاصة اليمنية). مهمتك هي تحليل النص التالي واستخراج البيانات منه بدقة.
      النص: "${text}"

      قواعد صارمة:
      1. إذا كان النص يتحدث عن دفع أو صرف أو شراء، اجعل intent = "expense". (استخرج اسم المورد/العميل في partyName، واسم الحساب إذا ذُكر في accountName، واسم الصندوق إذا ذُكر في cashboxName).
      2. إذا كان النص يتحدث عن استلام أو قبض أو دخل، اجعل intent = "income". (استخرج اسم العميل/المورد في partyName، واسم الحساب إذا ذُكر في accountName، واسم الصندوق إذا ذُكر في cashboxName).
      3. إذا كان النص يطلب إضافة عميل جديد، اجعل intent = "create_customer". (استخرج الاسم في partyName، والهاتف في phone).
      4. إذا كان النص يتحدث عن إصدار فاتورة مبيعات أو بيع أصناف، اجعل intent = "invoice". (استخرج اسم العميل في partyName، اسم الصنف في itemName، الكمية في quantity، سعر الوحدة في unitPrice، العملة في currencyCode، الخصم في discountValue، اسم المندوب في salesRepName).
      5. إذا كان النص يسأل عن رصيد عميل، اجعل intent = "query_customer_balance". (استخرج اسم العميل في partyName).
      6. إذا كان النص يسأل عن آخر سداد لعميل، اجعل intent = "query_last_payment". (استخرج اسم العميل في partyName).
      7. إذا كان النص يسأل عن كمية مخزون صنف، اجعل intent = "query_stock". (استخرج اسم الصنف في itemName).
      8. إذا كان النص يطلب كشف حساب لعميل (مثل: "كشف حساب أحمد" أو "كشف العميل أحمد")، اجعل intent = "query_customer_statement". (استخرج اسم العميل في partyName).
      9. إذا لم يكن النص محاسبياً، اجعل intent = "unknown".

      أمثلة:
      { "intent": "expense", "amount": 500, "partyName": "أحمد", "description": "بنزين" }
      { "intent": "expense", "amount": 12500, "cashboxName": "الكريمي", "accountName": "تسويق وإعلان", "description": "خشب للاستاند" }
      { "intent": "query_customer_statement", "partyName": "مراد الوليدي", "amount": 0, "description": "كشف حساب" }
  `;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${API_KEY}`;
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) });
    const data = await res.json();
    if (data.error) {
      console.log("❌ خطأ:", data.error.message);
    } else {
      console.log("🤖 رد Gemini:", data.candidates[0].content.parts[0].text);
    }
  } catch (e) { console.log("❌ خطأ شبكة"); }
}

(async () => {
  await testText("كشف العميل مراد الوليدي");
  await testText("صرفت من صندوق الكريمي مبلغ 12500 ريال يمني مقابل خشب للاستاند لحساب تسويق وإعلان");
})();
