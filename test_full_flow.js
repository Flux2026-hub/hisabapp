const fs = require('fs');
const readline = require('readline');
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

// قراءة مفتاح Gemini من ملفك
const code = fs.readFileSync('src/utils/gemini.ts', 'utf8');
const keyMatch = code.match(/const API_KEY = "(.*?)";/);
const API_KEY = keyMatch ? keyMatch[1] : null;

if (!API_KEY) return console.log("❌ لم يتم العثور على مفتاح Gemini في الكود!");

rl.question('ألصق التوكن (Token) هنا:\n', async (token) => {
  try {
    console.log("⏳ جلب الرسائل من تليجرام...");
    const res = await fetch(`https://api.telegram.org/bot${token}/getUpdates`);
    const data = await res.json();

    if (!data.ok || data.result.length === 0) return console.log("❌ لا توجد رسائل.");

    // البحث عن أول رسالة نصية
    const textMsg = data.result.find(u => u.message && u.message.text);
    if (!textMsg) return console.log("❌ لا توجد رسائل نصية (كلها صوتية أو غيرها).");

    const userText = textMsg.message.text;
    const userId = textMsg.message.chat.id;
    
    console.log(`\n📩 تم العثور على رسالة من ID: ${userId}`);
    console.log(`📝 النص: "${userText}"`);
    console.log(`⏳ جاري إرسال النص إلى Gemini...`);

    // إرسال النص إلى Gemini
    const prompt = `
      أنت مساعد محاسبي ذكي جداً وتفهم كل اللهجات العربية (خاصة اليمنية). مهمتك هي تحليل النص التالي واستخراج البيانات منه بدقة.
      النص: "${userText}"

      قواعد صارمة:
      1. إذا كان النص يتحدث عن دفع أو صرف أو شراء (مثل: "صرفت"، "دفعت"، "اشتريت")، اجعل intent = "expense".
      2. إذا كان النص يتحدث عن استلام أو قبض أو دخل (مثل: "استلمت"، "قبضت")، اجعل intent = "income".
      3. إذا كان النص يطلب فتح حساب أو إضافة عميل (مثل: "افتح حساب"، "أضف عميل"، "سجل زبون")، اجعل intent = "create_customer".
      4. استخرج اسم العميل في حقل partyName، ورقم الهاتف في حقل phone (إذا وجد).
      5. استخرج المبلغ في حقل amount.
      6. أي كلام إضافي ضعه في description.

      أمثلة على المخرجات المطلوبة (JSON فقط):
      { "intent": "expense", "amount": 500, "description": "بنزين" }
    `;

    const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });

    const geminiData = await geminiRes.json();
    
    if (geminiData.error) {
      console.log("\n❌ خطأ من Gemini:", geminiData.error.message);
    } else {
      console.log("\n✅ رد Gemini الخام:");
      console.log(geminiData.candidates[0].content.parts[0].text);
    }

  } catch (e) {
    console.log("❌ خطأ في الشبكة:", e.message);
  }
  rl.close();
});
