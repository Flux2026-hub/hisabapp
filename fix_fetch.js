const fs = require('fs');
let code = fs.readFileSync('src/utils/telegram.ts', 'utf8');

const oldFunctionRegex = /export const checkTelegramCommands = async \(\) => \{[\s\S]*?\n\};/g;

const newFunction = `export const checkTelegramCommands = async () => {
  try { Alert.alert("تصحيح 1", "بدء فحص أوامر تليجرام..."); } catch(e){}
  
  try {
    const { token, chatId } = await getTelegramSettings();
    if (!token || !chatId) { 
      Alert.alert("تصحيح 2", "لم يتم العثور على التوكن أو Chat ID!"); 
      return; 
    }

    // ✅ تجاهل الرقم القديم واقرأ كل الرسائل
    await AsyncStorage.removeItem(LAST_UPDATE_ID_KEY);
    
    // ✅ طلب كل الرسائل بدون Offset
    const url = \`https://api.telegram.org/bot\${token}/getUpdates?timeout=5\`;
    const response = await fetch(url);
    const data = await response.json();

    // ✅ إظهار عدد الرسائل التي وصلت
    Alert.alert("تصحيح 3", "عدد الرسائل التي تم جلبها: " + (data.result ? data.result.length : "خطأ"));

    if (!data.ok || !data.result || data.result.length === 0) return;

    for (const update of data.result) {
      const message = update.message;
      if (!message) continue;
      
      // التحقق من الـ Chat ID
      if (String(message.chat.id) !== String(chatId)) continue;

      if (message.text) {
        await processTextCommand(message.text.trim());
      }
      else if (message.voice) {
        await processVoiceCommand(message.voice, token);
      }

      // حفظ رقم الرسالة الحالية
      await AsyncStorage.setItem(LAST_UPDATE_ID_KEY, String(update.update_id));
    }
  } catch (error: any) {
    Alert.alert("خطأ في الفحص", String(error.message || error));
  }
};`;

if (code.match(oldFunctionRegex)) {
  code = code.replace(oldFunctionRegex, newFunction);
  fs.writeFileSync('src/utils/telegram.ts', code);
  console.log("✅ تم استبدال دالة الفحص بنجاح!");
} else {
  console.log("⚠️ لم يتم العثور على الدالة. سأحتاج لرؤية الملف.");
}
