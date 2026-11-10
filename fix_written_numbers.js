const fs = require('fs');
let code = fs.readFileSync('src/utils/gemini.ts', 'utf8');

const newPrompt = `
      أنت مساعد محاسبي ذكي جداً وتفهم كل اللهجات العربية (خاصة اليمنية). مهمتك هي تحليل النص التالي واستخراج البيانات منه بدقة.
      النص: "${text}"

      قواعد صارمة:
      1. إذا كان النص يتحدث عن دفع أو صرف أو شراء، اجعل intent = "expense".
      2. إذا كان النص يتحدث عن استلام أو قبض أو دخل (مثل "استلمت"، "قبضت")، اجعل intent = "income".
      3. إذا كان النص يطلب إضافة عميل جديد، اجعل intent = "create_customer".
      4. إذا كان النص يتحدث عن إصدار فاتورة مبيعات أو بيع أصناف، اجعل intent = "invoice".
      5. إذا كان النص يسأل عن رصيد عميل، اجعل intent = "query_customer_balance".
      6. إذا كان النص يسأل عن آخر سداد لعميل، اجعل intent = "query_last_payment".
      7. إذا كان النص يسأل عن كمية مخزون صنف، اجعل intent = "query_stock".
      8. إذا كان النص يطلب كشف حساب لعميل، اجعل intent = "query_customer_statement".
      9. إذا لم يكن النص محاسبياً، اجعل intent = "unknown".

      ⚠️ قواعد هامة جداً لاستخراج البيانات:
      - استخرج المبلغ في حقل amount.
      - تحويل الأرقام المكتوبة بالحروف إلى أرقام إنجليزية (مثلاً: "عشرين ألف" = 20000، "خمسة آلاف" = 5000، "ألفين" = 2000، "مليون" = 1000000).
      - استخرج اسم العميل/المورد في حقل partyName.
      - استخرج اسم الحساب في حقل accountName (إذا ذُكرت كلمة "لحساب").
      - استخرج اسم الصندوق في حقل cashboxName (إذا ذُكرت كلمة "صندوق" أو "محفظة" أو "بنك" أو "حساب").
      - لفاتورة المبيعات: استخرج اسم الصنف في itemName، الكمية في quantity، سعر الوحدة في unitPrice.
      - العملات: إذا ذُكر "سعودي" اجعل currencyCode = "SAR". إذا ذُكر "يمني" اجعل currencyCode = "YER". الافتراضي YER.
      
      💡 معالجة الكسور اللفظية:
      - إذا قال "ونص" أو "ونصف"، أضف 0.5 إلى الرقم (مثلاً 3 ونص = 3.5).
      - إذا قال "وربع"، أضف 0.25 إلى الرقم (مثلاً 10 وربع = 10.25).

      أمثلة:
      { "intent": "income", "amount": 20000, "partyName": "محلات البتراء", "cashboxName": "الكريمي", "currencyCode": "YER", "description": "استلام مبلغ" }
      { "intent": "invoice", "partyName": "ماكس مول", "itemName": "مسلك مجاري", "quantity": 100, "unitPrice": 3.5, "currencyCode": "SAR", "amount": 350, "description": "فاتورة مبيعات" }
      { "intent": "expense", "amount": 500, "partyName": "أحمد", "description": "بنزين" }
`;

code = code.replace(/const prompt = `[\s\S]*?`;/, 'const prompt = `' + newPrompt + '`;');
fs.writeFileSync('src/utils/gemini.ts', code);
console.log("✅ تم تحديث البرومبت ليفهم الأرقام المكتوبة بالحروف (عشرين ألف)!");
