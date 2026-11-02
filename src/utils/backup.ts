import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as DocumentPicker from 'expo-document-picker';
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
  settings?: any;
};

export async function exportBackup(): Promise<{ success: boolean; uri?: string; error?: string }> {
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

    let settings = null;
    try {
      const rawSettings = await AsyncStorage.getItem("flux_settings_v1");
      if (rawSettings) settings = JSON.parse(rawSettings);
    } catch (e) {
      console.log("Failed to fetch settings for backup", e);
    }

    const backup: BackupFile = {
      version: "1.0",
      createdAt: Date.now(),
      appName: "فلوكس - مسلك مجاري",
      data,
      settings,
    };

    const date = new Date().toISOString().slice(0, 10);
    const filename = `flux-backup-${date}.json`;
    const path = FileSystem.cacheDirectory + filename;

    await FileSystem.writeAsStringAsync(path, JSON.stringify(backup, null, 2), {
      encoding: FileSystem.EncodingType.UTF8,
    });

    const can = await Sharing.isAvailableAsync();
    if (can) {
      await Sharing.shareAsync(path, {
        mimeType: "application/json",
        dialogTitle: "مشاركة النسخة الاحتياطية",
        UTI: "public.json",
      });
    }
    return { success: true, uri: path };
  } catch (e: any) {
    return { success: false, error: String(e) };
  }
}

// ✅ الدالة الجديدة التي تستخدم DocumentPicker (تفتح مدير الملفات مباشرة)
export async function pickBackupFile(): Promise<{ success: boolean; backup?: BackupFile; error?: string }> {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/json', // السماح فقط بملفات JSON
      copyToCacheDirectory: true,
    });

    if (result.canceled) {
      return { success: false, error: "تم الإلغاء" };
    }

    const fileUri = result.assets[0].uri;
    const content = await FileSystem.readAsStringAsync(fileUri, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    const backup: BackupFile = JSON.parse(content);

    if (!backup.data || typeof backup.data !== "object") {
      return { success: false, error: "ملف غير صالح" };
    }

    return { success: true, backup };
  } catch (e: any) {
    return { success: false, error: String(e) };
  }
}

export async function restoreBackup(backup: BackupFile): Promise<{ success: boolean; restored?: number; error?: string }> {
  try {
    let restored = 0;

    if (backup.settings) {
      try {
        await AsyncStorage.setItem("flux_settings_v1", JSON.stringify(backup.settings));
      } catch (e) {
        console.log("Failed to restore settings", e);
      }
    }

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
            `INSERT INTO ${table} (${cols}) VALUES (${placeholders})`,
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
