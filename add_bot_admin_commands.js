const fs = require('fs');
let code = fs.readFileSync('src/utils/telegram.ts', 'utf8');

// 1. إضافة دوال المساعدة والإدارة قبل دالة checkTelegramCommands
const adminFunctions = `
// ✅ دالة عرض الحالة والأوامر المعلقة
const handleStatus = async (token: string, chatId: string) => {
  try {
    const res = await fetch(\`https://api.telegram.org/bot\${token}/getUpdates\`);
    const data = await res.json();
    const pendingCount = data.ok ? data.result.length : "غير معروف";
    const lastUpdateId = await AsyncStorage.getItem(LAST_UPDATE_ID_KEY);
    await sendTelegramMessage(
      \`📊 <b>حالة النظام</b>\\n\\n\` +
      \`📥 الرسائل المعلقة: \${pendingCount}\\n\` +
      \`🔢 آخر رقم رسالة تمت معالجتها: \${lastUpdateId || 'لا يوجد'}\\n\` +
      \`🤖 حالة الذكاء الاصطناعي: يعمل (تأكد من الحصة اليومية)\\n\\n\` +
      \`💡 لإلغاء الرسائل المعلقة أرسل: /cancel\`
    );
  } catch (e) {
    await sendTelegramMessage("❌ تعذر جلب الحالة. تأكد من اتصال الإنترنت.");
  }
};

// ✅ دالة إلغاء الأوامر المعلقة
const handleCancel = async (token: string, chatId: string) => {
  try {
    // جلب آخر رسالة لتخطي كل ما قبلها
    const res = await fetch(\`https://api.telegram.org/bot\${token}/getUpdates?offset=-1\`);
    const data = await res.json();
    if (data.ok && data.result.length > 0) {
      const lastUpdateId = data.result[0].update_id;
      // إخبار تليجرام بتجاهل كل ما قبل هذه الرسالة
      await fetch(\`https://api.telegram.org/bot\${token}/getUpdates?offset=\${lastUpdateId + 1}\`);
      await AsyncStorage.setItem(LAST_UPDATE_ID_KEY, String(lastUpdateId));
      await sendTelegramMessage("✅ تم إلغاء جميع الأوامر المعلقة. أنت الآن تبدأ من جديد!");
    } else {
      await sendTelegramMessage("ℹ️ لا توجد أوامر معلقة لإلغائها.");
    }
  } catch (e) {
    await sendTelegramMessage("❌ تعذر إلغاء الأوامر.");
  }
};

// ✅ دالة عرض قائمة الأوامر
const handleHelp = async () => {
  await sendTelegramMessage(
    \`📚 <b>دليل الأوامر المتاحة</b>\\n\\n\` +
    \`<b>الأوامر النصية السريعة:</b>\\n\` +
    \`- <code>صرفت 500 بنزين</code>\\n\` +
    \`- <code>استلمت 1000 من أحمد</code>\\n\` +
    \`- <code>رصيد أحمد</code>\\n\` +
    \`- <code>كشف حساب أحمد</code>\\n\` +
    \`- <code>مخزون ماسورة</code>\\n\\n\` +
    \`<b>الأوامر الإدارية:</b>\\n\` +
    \`- <code>/start</code> : القائمة الرئيسية\\n\` +
    \`- <code>/status</code> : حالة النظام والرسائل المعلقة\\n\` +
    \`- <code>/cancel</code> : إلغاء الأوامر المعلقة\\n\` +
    \`- <code>/help</code> : هذه القائمة\\n\\n\` +
    \`<b>الأوامر المعقدة (بالصوت أو النص):</b>\\n\` +
    \`تحدث بحرية تامة (مثال: "بعت لماكس مول 100 علبة بسعر 3 ريال ونص").\`
  );
};
`;

const marker = 'export const checkTelegramCommands = async () => {';
if (!code.includes('const handleStatus')) {
  code = code.replace(marker, adminFunctions + '\n' + marker);
}

// 2. تعديل حلقة معالجة النصوص لإضافة الأوامر الإدارية
const oldTextHandler = `      if (message.text) {
        const txt = message.text.trim();
        if (txt === '/start' || txt === 'القائمة' || txt === 'الرئيسية') {
          await sendMainMenu();
        } else {
          await processTextCommand(txt);
        }
      }`;

const newTextHandler = `      if (message.text) {
        const txt = message.text.trim();
        
        // الأوامر الإدارية
        if (txt === '/start' || txt === 'القائمة' || txt === 'الرئيسية') {
          await sendMainMenu();
        } else if (txt === '/status' || txt === 'الحالة') {
          await handleStatus(token, chatId);
        } else if (txt === '/cancel' || txt === 'الغي' || txt === 'إلغاء') {
          await handleCancel(token, chatId);
        } else if (txt === '/help' || txt === 'مساعدة') {
          await handleHelp();
        } else {
          await processTextCommand(txt);
        }
      }`;

if (code.includes(oldTextHandler)) {
  code = code.replace(oldTextHandler, newTextHandler);
} else {
  console.log("⚠️ لم يتم العثور على معالج النصوص القديم. تحقق من الملف.");
}

fs.writeFileSync('src/utils/telegram.ts', code);
console.log("✅ تم إضافة الأوامر الإدارية (/status, /cancel, /help)!");
