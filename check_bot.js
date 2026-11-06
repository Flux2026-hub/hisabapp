const readline = require('readline');
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

rl.question('ألصق التوكن (Token) هنا:\n', async (token) => {
  try {
    console.log("⏳ جاري مسح أي Webhook عالق...");
    await fetch(`https://api.telegram.org/bot${token}/deleteWebhook`);

    console.log("⏳ جاري فحص الرسائل الجديدة على سيرفر تليجرام...");
    const res = await fetch(`https://api.telegram.org/bot${token}/getUpdates`);
    const data = await res.json();

    if (!data.ok) {
      console.log("❌ خطأ من تليجرام:", data.description);
      rl.close();
      return;
    }

    if (data.result.length === 0) {
      console.log("⚠️ لا توجد رسائل جديدة في انتظار التطبيق حالياً.");
      console.log("جرب إرسال رسالة جديدة للبوت الآن، ثم أعد تشغيل هذا السكربت.");
    } else {
      console.log(`✅ يوجد ${data.result.length} رسالة في انتظار التطبيق!`);
      const lastMsg = data.result[data.result.length - 1].message;
      if (lastMsg && lastMsg.text) {
        console.log(`- آخر رسالة: "${lastMsg.text}"`);
      }
    }
  } catch (e) {
    console.log("❌ خطأ في الشبكة:", e.message);
  }
  rl.close();
});
