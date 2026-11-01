import * as FileSystem from "expo-file-system/legacy";
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

export async function runAutoBackup() {
  try {
    const lastBackup = await AsyncStorage.getItem("last_auto_backup");
    const now = Date.now();
    const oneWeek = 7 * 24 * 60 * 60 * 1000; // أسبوع

    if (lastBackup && (now - Number(lastBackup)) < oneWeek) {
      console.log("Auto backup skipped: less than a week since last backup.");
      return;
    }

    const data: Record<string, any[]> = {};
    for (const table of TABLES) {
      try {
        const rows: any = await sqlite.getAllAsync(`SELECT * FROM ${table}`);
        data[table] = rows || [];
      } catch (e) { data[table] = []; }
    }

    let settings = null;
    try {
      const rawSettings = await AsyncStorage.getItem("flux_settings_v1");
      if (rawSettings) settings = JSON.parse(rawSettings);
    } catch (e) {}

    const backup = {
      version: "1.0",
      createdAt: now,
      appName: "فلوكس - مسك مجاري",
      data,
      settings,
    };

    const date = new Date().toISOString().slice(0, 10);
    const filename = `flux-auto-backup-${date}.json`;
    const path = FileSystem.documentDirectory + filename;
    
    await FileSystem.writeAsStringAsync(path, JSON.stringify(backup, null, 2), {
      encoding: FileSystem.EncodingType.UTF8,
    });

    await AsyncStorage.setItem("last_auto_backup", String(now));
    console.log("Auto backup successful:", path);

  } catch (e) {
    console.log("Auto backup failed:", e);
  }
}
