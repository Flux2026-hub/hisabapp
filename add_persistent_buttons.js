const fs = require('fs');
let code = fs.readFileSync('src/utils/telegram.ts', 'utf8');

// 1. إضافة دالة إرسال الأزرار الثابتة (ReplyKeyboardMarkup)
const persistentMenuFunction = `
// ✅ دالة إرسال الأزرار الثابتة بجانب حقل الكتابة
const sendPersistentMenu = async () => {
  const { token, chatId } = await getTelegramSettings();
  if (!token || !chatId) return;
  
  const url = \`https://api.telegram.org/bot\${token}/sendMessage\`;
  
  // الأزرار التي ستظهر بجانب حقل الكتابة
  const replyKeyboard = {
    keyboard: [
      [{ text: "💰 سند قبض" }, { text: "💸 سند صرف" }],
      [{ text: "📊 كشف حساب" }, { text: "📦 مخزون" }],
      [{ text: "📋 القائمة" }],
    ],
    resize_keyboard: true, // تصغير حجم الأزرار
    persistent: true,      // إبقاء الأزرار ظاهرة دائماً
  };

  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: "✅ تم تفعيل الأزرار السريعة. يمكنك استخدامها في أي وقت.",
      reply_markup: JSON.stringify(replyKeyboard),
    }),
  });
};
`;

// إدراج الدالة قبل دالة checkTelegramCommands
const marker = 'export const checkTelegramCommands = async () => {';
if (!code.includes('const sendPersistentMenu')) {
  code = code.replace(marker, persistentMenuFunction + '\n' + marker);
}

// 2. ربط الأزرار بالأوامر (عندما يضغط المستخدم على الزر، يرسل النص)
const oldTextHandler = `      if (message.text) {
        const txt = message.text.trim();
        
        // الأوامر الإدارية
        if (txt === '/start' || txt === 'القائمة' || txt === 'الرئيسية') {
          await sendMainMenu();`;

const newTextHandler = `      if (message.text) {
        const txt = message.text.trim();
        
        // ✅ الأزرار الثابتة (ReplyKeyboardMarkup)
        if (txt === '💰 سند قبض') {
          await sendTelegramMessage("💰 تم اختيار سند قبض. اكتب: استلمت [المبلغ] من [الاسم]");
        } else if (txt === '💸 سند صرف') {
          await sendTelegramMessage("💸 تم اختيار سند صرف. اكتب: صرفت [المبلغ] [البيان]");
        } else if (txt === '📊 كشف حساب') {
          await sendTelegramMessage("📊 تم اختيار كشف حساب. اكتب: كشف [اسم العميل]");
        } else if (txt === '📦 مخزون') {
          await sendTelegramMessage("📦 تم اختيار المخزون. اكتب: مخزون [اسم الصنف]");
        } else if (txt === '📋 القائمة') {
          await sendPersistentMenu();
        }
        // الأوامر الإدارية
        else if (txt === '/start' || txt === 'القائمة' || txt === 'الرئيسية') {
          await sendMainMenu();`;

if (code.includes(oldTextHandler)) {
  code = code.replace(oldTextHandler, newTextHandler);
} else {
  console.log("⚠️ لم يتم العثور على معالج النصوص. تحقق من الملف.");
}

fs.writeFileSync('src/utils/telegram.ts', code);
console.log("✅ تم إضافة الأزرار الثابتة (ReplyKeyboardMarkup) بنجاح!");
