const readline = require('readline');
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

rl.question('ألصق التوكن (Token) هنا:\n', (token) => {
  rl.question('ألصق الـ Chat ID هنا:\n', async (chatId) => {
    try {
      console.log("⏳ جاري إرسال رسالة تجريبية...");
      const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: "🚀 رسالة اختبار من Termux: الاتصال يعمل بنجاح!" })
      });
      const data = await res.json();
      if (data.ok) {
        console.log("✅ نجح الإرسال! تفقد تليجرام.");
      } else {
        console.log("❌ فشل الإرسال:", data.description);
      }
    } catch (e) {
      console.log("❌ خطأ في الشبكة:", e.message);
    }
    rl.close();
  });
});
