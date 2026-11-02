import AsyncStorage from "@react-native-async-storage/async-storage";
import { generateBackupFile } from "./backup";
import { sendTelegramDocument, getTelegramSettings } from "./telegram";

const LAST_BACKUP_KEY = 'last_telegram_backup_time';
const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000; // 3 أيام بالمللي ثانية

export const checkAndSendAutoBackup = async () => {
  try {
    // 1. التأكد من وجود إعدادات تليجرام
    const { token, chatId } = await getTelegramSettings();
    if (!token || !chatId) return; // إذا لم يتم إعداد تليجرام، نخرج بهدوء

    // 2. قراءة وقت آخر نسخة
    const lastBackupTimeStr = await AsyncStorage.getItem(LAST_BACKUP_KEY);
    const lastBackupTime = lastBackupTimeStr ? parseInt(lastBackupTimeStr, 10) : 0;
    const now = Date.now();

    // 3. التحقق: هل مرت 3 أيام؟
    if (now - lastBackupTime > THREE_DAYS_MS) {
      console.log("⏰ حان وقت النسخة الاحتياطية التلقائية...");
      
      // إنشاء الملف
      const backup = await generateBackupFile();
      if (backup.success && backup.uri && backup.filename) {
        // إرساله لتليجرام
        await sendTelegramDocument(
          backup.uri, 
          backup.filename, 
          `🤖 <b>نسخة احتياطية تلقائية</b>\n📅 التاريخ: ${new Date().toLocaleDateString('ar-YE')}`
        );
        
        // حفظ وقت النسخة الحالية لكي لا تتكرر قبل 3 أيام
        await AsyncStorage.setItem(LAST_BACKUP_KEY, now.toString());
        console.log("✅ تم إرسال النسخة التلقائية بنجاح!");
      }
    }
  } catch (error) {
    console.error("❌ فشل النسخ التلقائي:", error);
  }
};
