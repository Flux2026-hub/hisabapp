import * as FileSystem from 'expo-file-system/legacy'; // ✅ التعديل هنا للتوافق مع SDK 57
import * as Sharing from 'expo-sharing';
import { Alert } from 'react-native';

const BACKUP_DIR = FileSystem.documentDirectory + 'backups/';

const ensureDirExists = async () => {
  const dirInfo = await FileSystem.getInfoAsync(BACKUP_DIR);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(BACKUP_DIR, { intermediates: true });
  }
};

export const createBackup = async () => {
  try {
    await ensureDirExists();
    const dbName = 'fluxx.db'; 
    const dbPath = `${FileSystem.documentDirectory}SQLite/${dbName}`;
    
    const dbInfo = await FileSystem.getInfoAsync(dbPath);
    if (!dbInfo.exists) {
      Alert.alert('خطأ', 'لم يتم العثور على قاعدة البيانات.');
      return;
    }

    const date = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = `${BACKUP_DIR}backup_${date}.db`;

    await FileSystem.copyAsync({
      from: dbPath,
      to: backupPath,
    });

    Alert.alert('نجاح', 'تم إنشاء النسخة الاحتياطية بنجاح!');

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(backupPath, {
        mimeType: 'application/x-sqlite3',
        dialogTitle: 'مشاركة النسخة الاحتياطية',
        UTI: 'public.database',
      });
    }
  } catch (error: any) {
    console.error(error);
    Alert.alert('خطأ', 'حدث خطأ أثناء إنشاء النسخة: ' + error.message);
  }
};

export const listBackups = async () => {
  try {
    await ensureDirExists();
    const files = await FileSystem.readDirectoryAsync(BACKUP_DIR);
    return files.filter(f => f.endsWith('.db'));
  } catch (error) {
    console.error('خطأ في قراءة النسخ:', error);
    return [];
  }
};

// ✅ إرجاع الدالة المفقودة لكي يعمل ملف _layout.tsx بدون أخطاء
export const runAutoBackup = async () => {
  console.log('Auto backup check triggered on startup');
  // يمكنك هنا إضافة منطق النسخ التلقائي الصامت (بدون فتح نافذة المشاركة)
};
