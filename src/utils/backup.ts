import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as DocumentPicker from "expo-document-picker";
import { sqlite } from "../db/local";

const TABLES = [
  "items", "warehouses", "product_boms", "product_bom_lines",
  "stock_receipts", "stock_receipt_lines", "stock_movements",
  "customers", "suppliers", "cashboxes",
  "invoices", "invoice_lines", "vouchers",
  "journal_entries", "journal_lines", "account_transfers",
  "accounts", "currencies",
];

export type BackupFile = {
  version: string;
  createdAt: number;
  appName: string;
  data: Record<string, any[]>;
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
    const backup: BackupFile = {
      version: "1.0",
      createdAt: Date.now(),
      appName: "فلوكس - مسلك مجاري",
      data,
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

export async function pickBackupFile(): Promise<{ success: boolean; backup?: BackupFile; error?: string }> {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: "application/json",
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets || result.assets.length === 0) {
      return { success: false, error: "تم الإلغاء" };
    }
    const uri = result.assets[0].uri;
    const content = await FileSystem.readAsStringAsync(uri, {
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
