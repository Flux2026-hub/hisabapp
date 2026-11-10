const fs = require('fs');
let code = fs.readFileSync('src/utils/telegram.ts', 'utf8');

// 1. دالة إرسال القائمة الرئيسية
const mainMenuFunction = `
// ✅ دالة إرسال القائمة الرئيسية (Inline Keyboard)
const sendMainMenu = async () => {
  const { token, chatId } = await getTelegramSettings();
  if (!token || !chatId) return;
  
  const url = \`https://api.telegram.org/bot\${token}/sendMessage\`;
  const keyboard = {
    inline_keyboard: [
      [{ text: "💰 سند قبض", callback_data: "menu_receipt" }],
      [{ text: "💸 سند صرف", callback_data: "menu_payment" }],
      [{ text: "📊 كشف حساب عميل", callback_data: "menu_statement" }],
      [{ text: "📦 استعلام مخزون", callback_data: "menu_stock" }],
    ],
  };

  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: "👋 مرحباً بك في <b>بوت فلوكس</b>.\\n\\nاختر العملية التي تريد القيام بها:",
      parse_mode: 'HTML',
      reply_markup: JSON.stringify(keyboard),
    }),
  });
};
`;

// إدراج الدالة قبل دالة checkTelegramCommands
const marker = 'export const checkTelegramCommands = async () => {';
if (!code.includes('const sendMainMenu')) {
  code = code.replace(marker, mainMenuFunction + '\n' + marker);
}

// 2. تعديل checkTelegramCommands لتدعم الأزرار (Callback Queries) وأمر /start
const oldLoopStart = `    for (const update of data.result) {
      const message = update.message;
      if (!message) continue;
      if (String(message.chat.id) !== String(chatId)) continue;

      if (message.text) {
        await processTextCommand(message.text.trim());
      }
      else if (message.voice) {
        await processVoiceCommand(message.voice, token);
      }

      await AsyncStorage.setItem(LAST_UPDATE_ID_KEY, String(update.update_id));
    }`;

const newLoopStart = `    for (const update of data.result) {
      // ✅ دعم الأزرار (Callback Queries)
      if (update.callback_query) {
        const cb = update.callback_query;
        const data = cb.data;

        if (data === "menu_receipt") {
          await sendTelegramMessage("💰 اختر العميل لسند القبض:");
        } else if (data === "menu_payment") {
          await sendTelegramMessage("💸 اختر الطرف لسند الصرف:");
        } else if (data === "menu_statement") {
          await sendTelegramMessage("📊 اختر العميل لكشف الحساب:");
        } else if (data === "menu_stock") {
          await sendTelegramMessage("📦 اختر الصنف للاستعلام عن المخزون:");
        }

        // تأكيد استلام الضغطة
        try {
          await fetch(\`https://api.telegram.org/bot\${token}/answerCallbackQuery\`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ callback_query_id: cb.id }),
          });
        } catch (e) {}

        await AsyncStorage.setItem(LAST_UPDATE_ID_KEY, String(update.update_id));
        continue;
      }

      // ✅ الرسائل النصية والصوتية
      const message = update.message;
      if (!message) continue;
      if (String(message.chat.id) !== String(chatId)) continue;

      if (message.text) {
        const txt = message.text.trim();
        if (txt === '/start' || txt === 'القائمة' || txt === 'الرئيسية') {
          await sendMainMenu();
        } else {
          await processTextCommand(txt);
        }
      }
      else if (message.voice) {
        await processVoiceCommand(message.voice, token);
      }

      await AsyncStorage.setItem(LAST_UPDATE_ID_KEY, String(update.update_id));
    }`;

if (code.includes(oldLoopStart)) {
  code = code.replace(oldLoopStart, newLoopStart);
} else {
  console.log("⚠️ لم يتم العثور على حلقة المعالجة. تحقق من الملف.");
}

fs.writeFileSync('src/utils/telegram.ts', code);
console.log("✅ تم إضافة القائمة التفاعلية (Inline Keyboard) بنجاح!");
