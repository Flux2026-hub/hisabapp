const fs = require('fs');
let code = fs.readFileSync('src/utils/gemini.ts', 'utf8');

const newPrompt = `
      أنت مساعد محاسبي ذكي جداً وتفهم كل اللهجات العربية (خاصة اليمنية). مهمتك هي تحليل النص التالي واستخراج البيانات منه بدقة.
      النص: "${text}"

      قواعد صارمة:
      1. إذا كان النص يتحدث عن دفع أو صرف أو شراء، اجعل intent = "expense".
      2. إذا كان النص يتحدث عن استلام أو قبض أو دخل، اجعل intent = "income".
      3. إذا كان النص يطلب إضافة عميل جديد، اجعل intent = "create_customer".
      4. إذا كان النص يتحدث عن إصدار فاتورة مبيعات أو بيع أصناف (مثل: "بعت"، "فاتورة"، "سجل مبيعات")، اجعل intent = "invoice".
      5. إذا كان النص يسأل عن رصيد عميل، اجعل intent = "query_customer_balance".
      6. إذا كان النص يسأل عن آخر سداد لعميل، اجعل intent = "query_last_payment".
      7. إذا كان النص يسأل عن كمية مخزون صنف، اجعل intent = "query_stock".
      8. إذا كان النص يطلب كشف حساب لعميل، اجعل intent = "query_customer_statement".
      9. إذا لم يكن النص محاسبياً، اجعل intent = "unknown".

      ⚠️ قواعد هامة جداً لاستخراج البيانات:
      - استخرج المبلغ في حقل amount.
      - استخرج اسم العميل/المورد في حقل partyName.
      - استخرج اسم الحساب في حقل accountName (إذا ذُكرت كلمة "لحساب").
      - استخرج اسم الصندوق في حقل cashboxName (إذا ذُكرت كلمة "صندوق" أو "محفظة" أو "بنك").
      - لفاتورة المبيعات: استخرج اسم الصنف في itemName، الكمية في quantity، سعر الوحدة في unitPrice.
      - العملات: إذا ذُكر "سعودي" اجعل currencyCode = "SAR". إذا ذُكر "يمني" اجعل currencyCode = "YER". الافتراضي YER.
      
      💡 معالجة الكسور اللفظية (مهم جداً):
      - إذا قال "ونص" أو "ونصف"، أضف 0.5 إلى الرقم (مثلاً 3 ونص = 3.5).
      - إذا قال "وربع"، أضف 0.25 إلى الرقم (مثلاً 10 وربع = 10.25).
      - إذا قال "وثلاثة أرباع"، أضف 0.75.

      أمثلة:
      { "intent": "invoice", "partyName": "ماكس مول", "itemName": "مسلك مجاري", "quantity": 100, "unitPrice": 3.5, "currencyCode": "SAR", "amount": 350, "description": "فاتورة مبيعات" }
      { "intent": "expense", "amount": 12500, "cashboxName": "الكريمي", "accountName": "تسويق وإعلان", "description": "خشب للاستاند" }
`;

code = code.replace(/const prompt = `[\s\S]*?`;/, 'const prompt = `' + newPrompt + '`;');
fs.writeFileSync('src/utils/gemini.ts', code);
console.log("✅ تم تحديث البرومبت ليفهم الكسور اللفظية (ونص، وربع)!");
