const readline = require('readline');
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

rl.question('ألصق التوكن (Token) هنا:\n', async (token) => {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getUpdates`);
    const data = await res.json();

    if (!data.ok) return console.log("Error:", data.description);
    if (data.result.length === 0) return console.log("No messages.");

    console.log("--- تفاصيل الرسائل المعلقة ---");
    data.result.forEach((update, index) => {
      if (update.message) {
        console.log(`رسالة ${index + 1}:`);
        console.log(`- النص: ${update.message.text || "صوتية/أخرى"}`);
        console.log(`- الـ Chat ID للمرسل: ${update.message.chat.id}`);
        console.log(`- الاسم: ${update.message.from.first_name}`);
      }
    });
    console.log("-----------------------------");
    console.log("⚠️ قارن الـ Chat ID أعلاه مع الـ Chat ID المحفوظ في إعدادات التطبيق.");
  } catch (e) { console.log(e.message); }
  rl.close();
});
