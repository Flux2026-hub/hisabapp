import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
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

    await FileSystem.copyAsync({ from: dbPath, to: backupPath });

    Alert.alert('نجاح', 'تم إنشاء النسخة الاحتياطية بنجاح!');

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(backupPath, {
        mimeType: 'application/x-sqlite3',
        dialogTitle: 'مشاركة النسخة الاحتياطية',
      });
    }
  } catch (error: any) {
    Alert.alert('خطأ', 'حدث خطأ أثناء إنشاء النسخة: ' + error.message);
  }
};

// ✅ دالة الاستعادة الجديدة (تفتح مدير الملفات)
export const restoreBackup = async () => {
  try {
    // 1. فتح مدير الملفات لاختيار ملف
    const result = await DocumentPicker.getDocumentAsync({
      type: '*/*', // للسماح باختيار أي ملف (بما فيها db)
      copyToCacheDirectory: true,
    });

    if (result.canceled) return;

    const selectedFileUri = result.assets[0].uri;
    const dbName = 'fluxx.db'; 
    const dbPath = `${FileSystem.documentDirectory}SQLite/${dbName}`;

    // 2. نسخ الملف المختار ليكون هو قاعدة البيانات الحالية
    // (ملاحظة: يُفضل إغلاق التطبيق وإعادة فتحه بعد الاستعادة)
    await FileSystem.copyAsync({
      from: selectedFileUri,
      to: dbPath,
    });

    Alert.alert(
      'نجاح', 
      'تمت استعادة النسخة بنجاح! يرجى إغلاق التطبيق وإعادة فتحه لكي تظهر البيانات.'
    );

  } catch (error: any) {
    console.error(error);
    Alert.alert('خطأ', 'فشل استعادة النسخة: ' + error.message);
  }
};

export const runAutoBackup = async () => {
  console.log('Auto backup check triggered');
};
