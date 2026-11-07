const readline = require('readline');
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

rl.question('ألصق التوكن (Token) هنا:\n', async (token) => {
  try {
    // جلب آخر رسالة لفهم أين وصلنا
    const res = await fetch(`https://api.telegram.org/bot${token}/getUpdates?offset=-1`);
    const data = await res.json();
    
    if (data.ok && data.result.length > 0) {
      const lastUpdateId = data.result[0].update_id;
      console.log("⏳ جاري مسح الرسائل المعلقة...");
      
      // إخبار تليجرام بتخطي كل الرسائل حتى آخر رسالة
      const clearRes = await fetch(`https://api.telegram.org/bot${token}/getUpdates?offset=${lastUpdateId + 1}`);
      const clearData = await clearRes.json();
      
      if (clearData.ok) {
        console.log("✅ تم مسح الطابور بنجاح! لن ينفذ التطبيق أي رسائل قديمة.");
      }
    } else {
      console.log("⚠️ لا توجد رسائل معلقة لمسحها.");
    }
  } catch (e) {
    console.log("❌ خطأ:", e.message);
  }
  rl.close();
});
