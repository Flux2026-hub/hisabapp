import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as DocumentPicker from 'expo-document-picker';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from "@react-native-async-storage/async-storage";
import { sqlite } from "../db/local";

const TABLES = [
  "items", "warehouses", "product_boms", "product_bom_lines",
  "stock_receipts", "stock_receipt_lines", "stock_movements",
  "customers", "suppliers", "cashboxes",
  "invoices", "invoice_lines", "vouchers",
  "journal_entries", "journal_lines", "account_transfers",
  "accounts", "currencies", "sales_reps", "sales_returns", "sales_return_lines",
  "purchase_returns", "purchase_return_lines", "sync_queue"
];

export type BackupFile = {
  version: string;
  createdAt: number;
  appName: string;
  data: Record<string, any[]>;
  settings?: any; // إعدادات الشركة (AsyncStorage)
  secureSettings?: { // إعدادات تليجرام (SecureStore)
    tg_token?: string | null;
    tg_chat_id?: string | null;
  };
};

export async function generateBackupFile(): Promise<{ success: boolean; uri?: string; filename?: string; error?: string }> {
  try {
    const data: Record<string, any[]> = {};
    for (const table of TABLES) {
      try {
        const rows: any = await sqlite.getAllAsync(`SELECT * FROM ${table}`);
        data[table] = rows || [];
      } catch (e) {
        data[table] = [];
      }
    }

    // 1. جلب إعدادات الشركة من AsyncStorage
    let settings = null;
    try {
      const rawSettings = await AsyncStorage.getItem("flux_settings_v1");
      if (rawSettings) settings = JSON.parse(rawSettings);
    } catch (e) {
      console.log("Failed to fetch settings for backup", e);
    }

    // 2. جلب بيانات تليجرام من SecureStore
    let secureSettings = {};
    try {
      const token = await SecureStore.getItemAsync("tg_token");
      const chatId = await SecureStore.getItemAsync("tg_chat_id");
      secureSettings = { tg_token: token, tg_chat_id: chatId };
    } catch (e) {
      console.log("Failed to fetch secure settings for backup", e);
    }

    const backup: BackupFile = {
      version: "1.1", // تم تحديث الإصدار
      createdAt: Date.now(),
      appName: "فلوكس - مسلك مجاري",
      data,
      settings,
      secureSettings,
    };

    const date = new Date().toISOString().slice(0, 10);
    const filename = `flux-backup-${date}.json`;
    const path = FileSystem.cacheDirectory + filename;

    await FileSystem.writeAsStringAsync(path, JSON.stringify(backup, null, 2), {
      encoding: FileSystem.EncodingType.UTF8,
    });

    return { success: true, uri: path, filename };
  } catch (e: any) {
    return { success: false, error: String(e) };
  }
}

export async function exportBackup(): Promise<{ success: boolean; uri?: string; error?: string }> {
  const res = await generateBackupFile();
  if (!res.success || !res.uri) return { success: false, error: res.error };
  
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(res.uri, {
      mimeType: "application/json",
      dialogTitle: "مشاركة النسخة الاحتياطية",
      UTI: "public.json",
    });
  }
  return { success: true, uri: res.uri };
}

export async function pickBackupFile(): Promise<{ success: boolean; backup?: BackupFile; error?: string }> {
  try {
    const result = await DocumentPicker.getDocumentAsync({ type: 'application/json', copyToCacheDirectory: true });
    if (result.canceled) return { success: false, error: "تم الإلغاء" };
    
    const content = await FileSystem.readAsStringAsync(result.assets[0].uri, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    
    const backup: BackupFile = JSON.parse(content);
    
    if (!backup.data || typeof backup.data !== "object") {
      return { success: false, error: "ملف غير صالح (لا يحتوي على بيانات)" };
    }
    
    return { success: true, backup };
  } catch (e: any) {
    return { success: false, error: String(e) };
  }
}

export async function restoreBackup(backup: BackupFile): Promise<{ success: boolean; restored?: number; error?: string }> {
  try {
    let restored = 0;

    // 1. استعادة إعدادات الشركة (AsyncStorage)
    if (backup.settings) {
      try {
        await AsyncStorage.setItem("flux_settings_v1", JSON.stringify(backup.settings));
      } catch (e) {
        console.log("Failed to restore settings", e);
      }
    }

    // 2. استعادة بيانات تليجرام (SecureStore)
    if (backup.secureSettings) {
      try {
        if (backup.secureSettings.tg_token) {
          await SecureStore.setItemAsync("tg_token", backup.secureSettings.tg_token);
        }
        if (backup.secureSettings.tg_chat_id) {
          await SecureStore.setItemAsync("tg_chat_id", backup.secureSettings.tg_chat_id);
        }
      } catch (e) {
        console.log("Failed to restore secure settings", e);
      }
    }

    // 3. استعادة الجداول
    for (const table of TABLES) {
      const rows = backup.data[table];
      if (!rows || !Array.isArray(rows) || rows.length === 0) continue;

      try {
        await sqlite.execAsync(`DELETE FROM ${table}`);
        for (const row of rows) {
          const keys = Object.keys(row);
          const values = keys.map((k) => row[k]);
          const placeholders = keys.map(() => "?").join(", ");
          const cols = keys.join(", ");

          await sqlite.runAsync(
            `INSERT OR REPLACE INTO ${table} (${cols}) VALUES (${placeholders})`,
            values
          );
          restored++;
        }
      } catch (e) {
        console.log(`Skip table ${table}:`, e);
      }
    }
    return { success: true, restored };
  } catch (e: any) {
    return { success: false, error: String(e) };
  }
}
