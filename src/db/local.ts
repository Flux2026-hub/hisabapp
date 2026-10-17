import * as SQLite from "expo-sqlite";
import { drizzle } from "drizzle-orm/expo-sqlite";

export const sqlite = SQLite.openDatabaseSync("hisabapp.db");
export const db = drizzle(sqlite);

export async function initializeLocalDatabase() {
  await sqlite.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS items (id TEXT PRIMARY KEY NOT NULL, sku TEXT NOT NULL UNIQUE, name TEXT NOT NULL, item_type TEXT NOT NULL, unit TEXT NOT NULL, stock_quantity REAL NOT NULL DEFAULT 0, average_cost REAL NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS warehouses (id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, warehouse_type TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS product_boms (id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, finished_item_id TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1, output_quantity REAL NOT NULL DEFAULT 1, output_unit TEXT NOT NULL, effective_from TEXT NOT NULL, is_active INTEGER NOT NULL DEFAULT 1);
    CREATE TABLE IF NOT EXISTS product_bom_lines (id TEXT PRIMARY KEY NOT NULL, bom_id TEXT NOT NULL, component_item_id TEXT NOT NULL, quantity_per_output REAL NOT NULL, unit TEXT NOT NULL, waste_percent REAL NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS stock_receipts (id TEXT PRIMARY KEY NOT NULL, receipt_no TEXT NOT NULL UNIQUE, source_name TEXT, warehouse_id TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'draft', sync_status TEXT NOT NULL DEFAULT 'pending', total_cost REAL NOT NULL DEFAULT 0, created_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS stock_receipt_lines (id TEXT PRIMARY KEY NOT NULL, receipt_id TEXT NOT NULL, item_id TEXT NOT NULL, quantity REAL NOT NULL, unit TEXT NOT NULL, unit_cost REAL NOT NULL);
    CREATE TABLE IF NOT EXISTS stock_movements (id TEXT PRIMARY KEY NOT NULL, source_type TEXT NOT NULL, source_id TEXT NOT NULL, item_id TEXT NOT NULL, warehouse_id TEXT NOT NULL, movement_type TEXT NOT NULL, quantity_in REAL NOT NULL DEFAULT 0, quantity_out REAL NOT NULL DEFAULT 0, planned_quantity REAL NOT NULL DEFAULT 0, waste_quantity REAL NOT NULL DEFAULT 0, unit_cost REAL NOT NULL DEFAULT 0, created_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS customers (id TEXT PRIMARY KEY NOT NULL, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL, phone TEXT, address TEXT, balance REAL NOT NULL DEFAULT 0, created_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS suppliers (id TEXT PRIMARY KEY NOT NULL, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL, phone TEXT, address TEXT, balance REAL NOT NULL DEFAULT 0, created_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS cashboxes (id TEXT PRIMARY KEY NOT NULL, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL, parent_id TEXT, cashbox_type TEXT NOT NULL, balance REAL NOT NULL DEFAULT 0, created_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS invoices (id TEXT PRIMARY KEY NOT NULL, invoice_no TEXT NOT NULL UNIQUE, invoice_type TEXT NOT NULL, party_id TEXT, party_name TEXT, status TEXT NOT NULL DEFAULT 'posted', subtotal REAL NOT NULL, tax REAL NOT NULL DEFAULT 0, total REAL NOT NULL, created_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS invoice_lines (id TEXT PRIMARY KEY NOT NULL, invoice_id TEXT NOT NULL, item_id TEXT NOT NULL, description TEXT NOT NULL, quantity REAL NOT NULL, unit_price REAL NOT NULL, line_total REAL NOT NULL);
    CREATE TABLE IF NOT EXISTS vouchers (id TEXT PRIMARY KEY NOT NULL, voucher_no TEXT NOT NULL UNIQUE, voucher_type TEXT NOT NULL, cashbox_id TEXT NOT NULL, party_name TEXT, amount REAL NOT NULL, description TEXT, created_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS journal_entries (id TEXT PRIMARY KEY NOT NULL, entry_no TEXT NOT NULL UNIQUE, description TEXT NOT NULL, total_debit REAL NOT NULL, total_credit REAL NOT NULL, created_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS journal_lines (id TEXT PRIMARY KEY NOT NULL, entry_id TEXT NOT NULL, account_code TEXT NOT NULL, account_name TEXT NOT NULL, debit REAL NOT NULL DEFAULT 0, credit REAL NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS account_transfers (id TEXT PRIMARY KEY NOT NULL, transfer_no TEXT NOT NULL UNIQUE, from_account TEXT NOT NULL, to_account TEXT NOT NULL, amount REAL NOT NULL, description TEXT, created_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS accounts (id TEXT PRIMARY KEY NOT NULL, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL, account_type TEXT NOT NULL, parent_code TEXT, balance REAL NOT NULL DEFAULT 0, created_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS currencies (id TEXT PRIMARY KEY NOT NULL, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL, symbol TEXT NOT NULL, exchange_rate REAL NOT NULL DEFAULT 1, is_base INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS sales_reps (id TEXT PRIMARY KEY NOT NULL, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL, phone TEXT, commission_rate REAL NOT NULL DEFAULT 0, is_active INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS sales_returns (id TEXT PRIMARY KEY NOT NULL, return_no TEXT NOT NULL UNIQUE, invoice_id TEXT NOT NULL, invoice_no TEXT NOT NULL, customer_id TEXT, customer_name TEXT, total REAL NOT NULL, refund_type TEXT NOT NULL, cashbox_id TEXT, created_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS sales_return_lines (id TEXT PRIMARY KEY NOT NULL, return_id TEXT NOT NULL, item_id TEXT NOT NULL, item_name TEXT NOT NULL, quantity REAL NOT NULL, unit_price REAL NOT NULL, line_total REAL NOT NULL);
    CREATE TABLE IF NOT EXISTS sync_queue (id INTEGER PRIMARY KEY AUTOINCREMENT, operation_id TEXT NOT NULL UNIQUE, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL, operation_type TEXT NOT NULL, payload TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', attempts INTEGER NOT NULL DEFAULT 0, last_error TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
  `);

  for (const migration of [
    "ALTER TABLE customers ADD COLUMN category TEXT",
    "ALTER TABLE customers ADD COLUMN parent_account_code TEXT",
    "ALTER TABLE suppliers ADD COLUMN category TEXT",
    "ALTER TABLE suppliers ADD COLUMN parent_account_code TEXT",
    "ALTER TABLE invoices ADD COLUMN currency_code TEXT",
    "ALTER TABLE invoices ADD COLUMN exchange_rate REAL DEFAULT 1",
    "ALTER TABLE invoices ADD COLUMN payment_type TEXT",
    "ALTER TABLE invoices ADD COLUMN cashbox_id TEXT",
    "ALTER TABLE vouchers ADD COLUMN party_type TEXT",
    "ALTER TABLE vouchers ADD COLUMN party_id TEXT",
    "ALTER TABLE vouchers ADD COLUMN currency_code TEXT",
    "ALTER TABLE vouchers ADD COLUMN exchange_rate REAL DEFAULT 1",
    "ALTER TABLE journal_lines ADD COLUMN party_type TEXT",
    "ALTER TABLE journal_lines ADD COLUMN party_id TEXT",
      "ALTER TABLE journal_lines ADD COLUMN party_name TEXT",
      "ALTER TABLE invoices ADD COLUMN sales_rep_id TEXT",
      "ALTER TABLE invoices ADD COLUMN sales_rep_name TEXT",
      "ALTER TABLE invoices ADD COLUMN commission_rate REAL DEFAULT 0",
      "ALTER TABLE invoices ADD COLUMN commission_amount REAL DEFAULT 0",
      "ALTER TABLE invoices ADD COLUMN discount_type TEXT",
      "ALTER TABLE invoices ADD COLUMN discount_value REAL DEFAULT 0",
      "ALTER TABLE invoices ADD COLUMN discount_amount REAL DEFAULT 0",
  ]) {
    try {
      await sqlite.execAsync(migration);
    } catch {
      /* العمود موجود في الإصدارات اللاحقة */
    }
  }

  // 🗑️ حذف البيانات التجريبية القديمة (فضة / زركون / خاتم)
  await sqlite.execAsync(`
    DELETE FROM items WHERE sku IN ('RAW-001', 'RAW-002', 'FIN-001');
    DELETE FROM items WHERE id IN ('raw-silver', 'prod-stone', 'finished-ring');
    DELETE FROM warehouses WHERE id IN ('wip-main');
  `);

  // 📦 تهيئة المخازن الأساسية
  const warehouseRows: any = await sqlite.getAllAsync(
    "SELECT id FROM warehouses LIMIT 1"
  );
  if (!warehouseRows || warehouseRows.length === 0) {
    await sqlite.execAsync(`
      INSERT INTO warehouses (id, name, warehouse_type)
      VALUES
        ('wh-wip', 'مخزن تحت الإنتاج', 'work_in_progress'),
        ('wh-final', 'مخزن المخزون التام', 'finished_goods');
    `);
  }
}