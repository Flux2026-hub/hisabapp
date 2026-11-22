import * as SQLite from "expo-sqlite";
import { drizzle } from "drizzle-orm/expo-sqlite";

export const sqlite = SQLite.openDatabaseSync("hisabapp.db");
export const db = drizzle(sqlite);

export async function initializeLocalDatabase() {
  await sqlite.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS items (id TEXT PRIMARY KEY NOT NULL, sku TEXT NOT NULL UNIQUE, name TEXT NOT NULL, item_type TEXT NOT NULL, unit TEXT NOT NULL, stock_quantity REAL NOT NULL DEFAULT 0, average_cost REAL NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS warehouses (id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, warehouse_type TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS product_boms (id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, finished_item_id TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1, output_quantity REAL NOT NULL DEFAULT 1, output_unit TEXT NOT NULL, effective_from TEXT NOT NULL, is_active INTEGER NOT NULL DEFAULT 1);
    CREATE TABLE IF NOT EXISTS product_bom_lines (id TEXT PRIMARY KEY NOT NULL, bom_id TEXT NOT NULL, component_item_id TEXT NOT NULL, quantity_per_output REAL NOT NULL, unit TEXT NOT NULL, waste_percent REAL NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS stock_receipts (id TEXT PRIMARY KEY NOT NULL, receipt_no TEXT NOT NULL UNIQUE, source_name TEXT, warehouse_id TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'draft', sync_status TEXT NOT NULL DEFAULT 'pending', total_cost REAL NOT NULL DEFAULT 0, created_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS stock_receipt_lines (id TEXT PRIMARY KEY NOT NULL, receipt_id TEXT NOT NULL, item_id TEXT NOT NULL, quantity REAL NOT NULL, unit TEXT NOT NULL, unit_cost REAL NOT NULL);
    CREATE TABLE IF NOT EXISTS stock_movements (id TEXT PRIMARY KEY NOT NULL, source_type TEXT NOT NULL, source_id TEXT NOT NULL, item_id TEXT NOT NULL, warehouse_id TEXT NOT NULL, movement_type TEXT NOT NULL, quantity_in REAL NOT NULL DEFAULT 0, quantity_out REAL NOT NULL DEFAULT 0, planned_quantity REAL NOT NULL DEFAULT 0, waste_quantity REAL NOT NULL DEFAULT 0, unit_cost REAL NOT NULL DEFAULT 0, created_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS customers (id TEXT PRIMARY KEY NOT NULL, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL, phone TEXT, address TEXT, category TEXT, parent_account_code TEXT, balance REAL NOT NULL DEFAULT 0, balance_yer REAL NOT NULL DEFAULT 0, balance_sar REAL NOT NULL DEFAULT 0, created_at INTEGER NOT NULL, updated_at INTEGER);
    CREATE TABLE IF NOT EXISTS suppliers (id TEXT PRIMARY KEY NOT NULL, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL, phone TEXT, address TEXT, category TEXT, parent_account_code TEXT, balance REAL NOT NULL DEFAULT 0, balance_yer REAL NOT NULL DEFAULT 0, balance_sar REAL NOT NULL DEFAULT 0, created_at INTEGER NOT NULL, updated_at INTEGER);
    CREATE TABLE IF NOT EXISTS cashboxes (id TEXT PRIMARY KEY NOT NULL, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL, parent_id TEXT, account_id TEXT, account_code TEXT, cashbox_type TEXT NOT NULL, currency_code TEXT NOT NULL DEFAULT 'YER', balance REAL NOT NULL DEFAULT 0, created_at INTEGER NOT NULL, is_active INTEGER NOT NULL DEFAULT 1);
    CREATE TABLE IF NOT EXISTS invoices (id TEXT PRIMARY KEY NOT NULL, invoice_no TEXT NOT NULL UNIQUE, invoice_type TEXT NOT NULL, party_id TEXT, party_name TEXT, status TEXT NOT NULL DEFAULT 'posted', subtotal REAL NOT NULL, tax REAL NOT NULL DEFAULT 0, total REAL NOT NULL, created_at INTEGER NOT NULL, currency_code TEXT NOT NULL DEFAULT 'YER', exchange_rate REAL NOT NULL DEFAULT 1, payment_type TEXT, cashbox_id TEXT, sales_rep_id TEXT, sales_rep_name TEXT, commission_rate REAL NOT NULL DEFAULT 0, commission_amount REAL NOT NULL DEFAULT 0, discount_type TEXT, discount_value REAL NOT NULL DEFAULT 0, discount_amount REAL NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS invoice_lines (id TEXT PRIMARY KEY NOT NULL, invoice_id TEXT NOT NULL, item_id TEXT NOT NULL, description TEXT NOT NULL, quantity REAL NOT NULL, unit_price REAL NOT NULL, line_total REAL NOT NULL);
    CREATE TABLE IF NOT EXISTS vouchers (id TEXT PRIMARY KEY NOT NULL, voucher_no TEXT NOT NULL UNIQUE, voucher_type TEXT NOT NULL, cashbox_id TEXT NOT NULL, party_name TEXT, amount REAL NOT NULL, description TEXT, created_at INTEGER NOT NULL, party_type TEXT DEFAULT 'none', party_id TEXT, currency_code TEXT NOT NULL DEFAULT 'YER', exchange_rate REAL NOT NULL DEFAULT 1, party_amount REAL);
    CREATE TABLE IF NOT EXISTS journal_entries (id TEXT PRIMARY KEY NOT NULL, entry_no TEXT NOT NULL UNIQUE, description TEXT NOT NULL, total_debit REAL NOT NULL, total_credit REAL NOT NULL, created_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS journal_lines (id TEXT PRIMARY KEY NOT NULL, entry_id TEXT NOT NULL, account_code TEXT NOT NULL, account_name TEXT NOT NULL, debit REAL NOT NULL DEFAULT 0, credit REAL NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS account_transfers (id TEXT PRIMARY KEY NOT NULL, transfer_no TEXT NOT NULL UNIQUE, from_account TEXT NOT NULL, to_account TEXT NOT NULL, from_cashbox_id TEXT, to_cashbox_id TEXT, amount REAL NOT NULL, original_amount REAL, description TEXT, created_at INTEGER NOT NULL, from_currency TEXT NOT NULL DEFAULT 'YER', to_currency TEXT NOT NULL DEFAULT 'YER', exchange_rate REAL NOT NULL DEFAULT 1);
    CREATE TABLE IF NOT EXISTS accounts (id TEXT PRIMARY KEY NOT NULL, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL, account_type TEXT NOT NULL, parent_code TEXT, balance REAL NOT NULL DEFAULT 0, created_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS currencies (id TEXT PRIMARY KEY NOT NULL, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL, symbol TEXT NOT NULL, exchange_rate REAL NOT NULL DEFAULT 1, is_base INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS default_accounts (id TEXT PRIMARY KEY NOT NULL, inventory_account TEXT, sales_revenue_account TEXT, cogs_account TEXT, commission_account TEXT, customer_account TEXT, supplier_account TEXT, purchase_account TEXT, sales_return_account TEXT, purchase_return_account TEXT, created_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS sales_reps (id TEXT PRIMARY KEY NOT NULL, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL, phone TEXT, commission_rate REAL NOT NULL DEFAULT 0, is_active INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS purchase_returns (id TEXT PRIMARY KEY NOT NULL, return_no TEXT NOT NULL UNIQUE, invoice_id TEXT NOT NULL, invoice_no TEXT NOT NULL, supplier_id TEXT, supplier_name TEXT, total REAL NOT NULL, refund_type TEXT NOT NULL, cashbox_id TEXT, currency_code TEXT NOT NULL DEFAULT 'YER', exchange_rate REAL NOT NULL DEFAULT 1, created_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS purchase_return_lines (id TEXT PRIMARY KEY NOT NULL, return_id TEXT NOT NULL, item_id TEXT NOT NULL, item_name TEXT NOT NULL, quantity REAL NOT NULL, unit_price REAL NOT NULL, line_total REAL NOT NULL);
    CREATE TABLE IF NOT EXISTS sales_returns (id TEXT PRIMARY KEY NOT NULL, return_no TEXT NOT NULL UNIQUE, invoice_id TEXT NOT NULL, invoice_no TEXT NOT NULL, customer_id TEXT, customer_name TEXT, total REAL NOT NULL, refund_type TEXT NOT NULL, cashbox_id TEXT, currency_code TEXT NOT NULL DEFAULT 'YER', exchange_rate REAL NOT NULL DEFAULT 1, created_at INTEGER NOT NULL);
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
    "ALTER TABLE journal_entries ADD COLUMN currency_code TEXT",
    "ALTER TABLE journal_entries ADD COLUMN exchange_rate REAL DEFAULT 1",
    "ALTER TABLE journal_lines ADD COLUMN foreign_debit REAL DEFAULT 0",
    "ALTER TABLE journal_lines ADD COLUMN foreign_credit REAL DEFAULT 0",
    "ALTER TABLE invoices ADD COLUMN sales_rep_id TEXT",
    "ALTER TABLE invoices ADD COLUMN sales_rep_name TEXT",
    "ALTER TABLE invoices ADD COLUMN commission_rate REAL DEFAULT 0",
    "ALTER TABLE invoices ADD COLUMN commission_amount REAL DEFAULT 0",
    "ALTER TABLE invoices ADD COLUMN discount_type TEXT",
    "ALTER TABLE invoices ADD COLUMN discount_value REAL DEFAULT 0",
    "ALTER TABLE invoices ADD COLUMN discount_amount REAL DEFAULT 0",
    "ALTER TABLE account_transfers ADD COLUMN from_currency TEXT",
    "ALTER TABLE account_transfers ADD COLUMN to_currency TEXT",
    "ALTER TABLE account_transfers ADD COLUMN exchange_rate REAL DEFAULT 1",
    "ALTER TABLE account_transfers ADD COLUMN original_amount REAL",
    "ALTER TABLE cashboxes ADD COLUMN currency_code TEXT DEFAULT 'YER'",
    "ALTER TABLE customers ADD COLUMN balance_yer REAL NOT NULL DEFAULT 0",
    "ALTER TABLE customers ADD COLUMN balance_sar REAL NOT NULL DEFAULT 0",
    "ALTER TABLE customers ADD COLUMN updated_at INTEGER",
    "ALTER TABLE suppliers ADD COLUMN balance_yer REAL NOT NULL DEFAULT 0",
    "ALTER TABLE suppliers ADD COLUMN balance_sar REAL NOT NULL DEFAULT 0",
    "ALTER TABLE suppliers ADD COLUMN updated_at INTEGER",
    "ALTER TABLE cashboxes ADD COLUMN account_id TEXT",
    "ALTER TABLE cashboxes ADD COLUMN account_code TEXT",
    "ALTER TABLE cashboxes ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1",
    "ALTER TABLE vouchers ADD COLUMN party_amount REAL",
    "ALTER TABLE account_transfers ADD COLUMN from_cashbox_id TEXT",
    "ALTER TABLE account_transfers ADD COLUMN to_cashbox_id TEXT",
    "ALTER TABLE sales_returns ADD COLUMN currency_code TEXT DEFAULT 'YER'",
    "ALTER TABLE sales_returns ADD COLUMN exchange_rate REAL DEFAULT 1",
    "ALTER TABLE purchase_returns ADD COLUMN currency_code TEXT DEFAULT 'YER'",
    "ALTER TABLE purchase_returns ADD COLUMN exchange_rate REAL DEFAULT 1",
  ]) {
    try {
      await sqlite.execAsync(migration);
    } catch {
      /* العمود موجود مسبقاً */
    }
  }

  await sqlite.execAsync(`
    UPDATE customers
    SET balance_yer = balance
    WHERE COALESCE(balance_yer, 0) = 0
      AND COALESCE(balance, 0) <> 0;

    UPDATE suppliers
    SET balance_yer = balance
    WHERE COALESCE(balance_yer, 0) = 0
      AND COALESCE(balance, 0) <> 0;

    UPDATE account_transfers
    SET original_amount = amount
    WHERE original_amount IS NULL;

    UPDATE account_transfers
    SET from_currency = 'YER'
    WHERE from_currency IS NULL OR from_currency = '';

    UPDATE account_transfers
    SET to_currency = 'YER'
    WHERE to_currency IS NULL OR to_currency = '';

    UPDATE account_transfers
    SET exchange_rate = 1
    WHERE exchange_rate IS NULL OR exchange_rate <= 0;

    UPDATE invoices
    SET currency_code = 'YER'
    WHERE currency_code IS NULL OR currency_code = '';

    UPDATE invoices
    SET exchange_rate = 1
    WHERE exchange_rate IS NULL OR exchange_rate <= 0;

    UPDATE vouchers
    SET currency_code = 'YER'
    WHERE currency_code IS NULL OR currency_code = '';

    UPDATE vouchers
    SET exchange_rate = 1
    WHERE exchange_rate IS NULL OR exchange_rate <= 0;
  `);

  await sqlite.execAsync(`
    CREATE INDEX IF NOT EXISTS idx_customers_balance_yer
      ON customers(balance_yer);

    CREATE INDEX IF NOT EXISTS idx_customers_balance_sar
      ON customers(balance_sar);

    CREATE INDEX IF NOT EXISTS idx_suppliers_balance_yer
      ON suppliers(balance_yer);

    CREATE INDEX IF NOT EXISTS idx_suppliers_balance_sar
      ON suppliers(balance_sar);

    CREATE INDEX IF NOT EXISTS idx_cashboxes_currency
      ON cashboxes(currency_code);

    CREATE INDEX IF NOT EXISTS idx_invoices_cashbox_date
      ON invoices(cashbox_id, created_at);

    CREATE INDEX IF NOT EXISTS idx_invoices_party_date
      ON invoices(party_id, created_at);

    CREATE INDEX IF NOT EXISTS idx_vouchers_cashbox_date
      ON vouchers(cashbox_id, created_at);

    CREATE INDEX IF NOT EXISTS idx_vouchers_party_date
      ON vouchers(party_id, created_at);

    CREATE INDEX IF NOT EXISTS idx_transfers_from_cashbox_date
      ON account_transfers(from_cashbox_id, created_at);

    CREATE INDEX IF NOT EXISTS idx_transfers_to_cashbox_date
      ON account_transfers(to_cashbox_id, created_at);

    CREATE INDEX IF NOT EXISTS idx_invoice_lines_invoice
      ON invoice_lines(invoice_id);

    CREATE INDEX IF NOT EXISTS idx_stock_movements_source
      ON stock_movements(source_type, source_id);
  `);

  // 🗑️ حذف البيانات التجريبية القديمة
  await sqlite.execAsync(`
    DELETE FROM items WHERE sku IN ('RAW-001', 'RAW-002', 'FIN-001');
    DELETE FROM items WHERE id IN ('raw-silver', 'prod-stone', 'finished-ring');
    DELETE FROM warehouses WHERE id IN ('wip-main');
  `);

  // 📦 تهيئة المخازن الأساسية
  const warehouseRows: any = await sqlite.getAllAsync("SELECT id FROM warehouses LIMIT 1");
  if (!warehouseRows || warehouseRows.length === 0) {
    await sqlite.execAsync(`
      INSERT INTO warehouses (id, name, warehouse_type)
      VALUES ('wh-wip', 'مخزن تحت الإنتاج', 'work_in_progress'), ('wh-final', 'مخزن المخزون التام', 'finished_goods');
    `);
  }

  // 🚀 زرع دليل حسابات احترافي وشامل (COA)
  const now = Date.now();
  const coa = [
    // 1. الأصول
    { id: 'acc-1', code: '1', name: 'الأصول', type: 'asset', parent: null },
    { id: 'acc-11', code: '11', name: 'الأصول المتداولة', type: 'asset', parent: '1' },
    { id: 'acc-1101', code: '1101', name: 'الصندوق الرئيسي (النقدية)', type: 'asset', parent: '11' },
    { id: 'acc-1102', code: '1102', name: 'البنك', type: 'asset', parent: '11' },
    { id: 'acc-1103', code: '1103', name: 'العملاء (مدينون)', type: 'asset', parent: '11' },
    { id: 'acc-1104', code: '1104', name: 'المخزون', type: 'asset', parent: '11' },
    { id: 'acc-1105', code: '1105', name: 'مصروفات مدفوعة مقدماً', type: 'asset', parent: '11' },
    { id: 'acc-12', code: '12', name: 'الأصول الثابتة', type: 'asset', parent: '1' },
    { id: 'acc-1201', code: '1201', name: 'معدات وآلات', type: 'asset', parent: '12' },
    { id: 'acc-1202', code: '1202', name: 'سيارات ومركبات', type: 'asset', parent: '12' },
    { id: 'acc-1203', code: '1203', name: 'مجمع إهلاك الأصول', type: 'asset', parent: '12' },

    // 2. الخصوم
    { id: 'acc-2', code: '2', name: 'الخصوم', type: 'liability', parent: null },
    { id: 'acc-21', code: '21', name: 'الخصوم المتداولة', type: 'liability', parent: '2' },
    { id: 'acc-2101', code: '2101', name: 'الموردون (دائنون)', type: 'liability', parent: '21' },
    { id: 'acc-2102', code: '2102', name: 'مصروفات مستحقة', type: 'liability', parent: '21' },
    { id: 'acc-2103', code: '2103', name: 'ضرائب مستحقة', type: 'liability', parent: '21' },
    { id: 'acc-22', code: '22', name: 'الخصوم طويلة الأجل', type: 'liability', parent: '2' },
    { id: 'acc-2201', code: '2201', name: 'قروض طويلة الأجل', type: 'liability', parent: '22' },

    // 3. حقوق الملكية
    { id: 'acc-3', code: '3', name: 'حقوق الملكية', type: 'equity', parent: null },
    { id: 'acc-3101', code: '3101', name: 'رأس المال', type: 'equity', parent: '3' },
    { id: 'acc-3102', code: '3102', name: 'أرباح محتجزة', type: 'equity', parent: '3' },
    { id: 'acc-3103', code: '3103', name: 'أرباح/خسائر العام الحالي', type: 'equity', parent: '3' },
    { id: 'acc-3104', code: '3104', name: 'مسحوبات شخصية', type: 'equity', parent: '3' },

    // 4. الإيرادات
    { id: 'acc-4', code: '4', name: 'الإيرادات', type: 'revenue', parent: null },
    { id: 'acc-4101', code: '4101', name: 'إيرادات المبيعات', type: 'revenue', parent: '4' },
    { id: 'acc-4102', code: '4102', name: 'إيرادات خدمات', type: 'revenue', parent: '4' },
    { id: 'acc-4103', code: '4103', name: 'خصم مسموح به', type: 'revenue', parent: '4' },
    { id: 'acc-4104', code: '4104', name: 'إيرادات أخرى', type: 'revenue', parent: '4' },

    // 5. المصروفات
    { id: 'acc-5', code: '5', name: 'المصروفات', type: 'expense', parent: null },
    { id: 'acc-5101', code: '5101', name: 'تكلفة المبيعات', type: 'expense', parent: '5' },
    { id: 'acc-5102', code: '5102', name: 'رواتب وأجور', type: 'expense', parent: '5' },
    { id: 'acc-5103', code: '5103', name: 'إيجار', type: 'expense', parent: '5' },
    { id: 'acc-5104', code: '5104', name: 'كهرباء ومياه', type: 'expense', parent: '5' },
    { id: 'acc-5105', code: '5105', name: 'مصروفات صيانة', type: 'expense', parent: '5' },
    { id: 'acc-5106', code: '5106', name: 'تسويق وإعلان', type: 'expense', parent: '5' },
    { id: 'acc-5107', code: '5107', name: 'مصروفات إهلاك', type: 'expense', parent: '5' },
    { id: 'acc-5108', code: '5108', name: 'مصروفات بنكية', type: 'expense', parent: '5' },
    { id: 'acc-5109', code: '5109', name: 'خصم مسموح به', type: 'expense', parent: '5' },
    { id: 'acc-5110', code: '5110', name: 'مصروفات متنوعة', type: 'expense', parent: '5' },
  ];

  for (const acc of coa) {
    await sqlite.runAsync(
      `INSERT OR IGNORE INTO accounts (id, code, name, account_type, parent_code, balance, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [acc.id, acc.code, acc.name, acc.type, acc.parent, 0, now]
    );
  }

  // 🚀 زرع الصناديق (رئيسي/تحليلي) بعملات مختلفة
  const cashboxCount: any = await sqlite.getAllAsync("SELECT count(id) as count FROM cashboxes");
  if (cashboxCount[0].count === 0) {
    await sqlite.runAsync(`INSERT INTO cashboxes (id, code, name, parent_id, cashbox_type, currency_code, balance, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, ['cb-yer-main', '110101', 'الصندوق الرئيسي (YER)', null, 'main', 'YER', 0, now]);
    await sqlite.runAsync(`INSERT INTO cashboxes (id, code, name, parent_id, cashbox_type, currency_code, balance, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, ['cb-sar-main', '110102', 'الصندوق الرئيسي (SAR)', null, 'main', 'SAR', 0, now]);
    await sqlite.runAsync(`INSERT INTO cashboxes (id, code, name, parent_id, cashbox_type, currency_code, balance, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, ['cb-yer-sales', '11010101', 'صندوق المبيعات اليومي (YER)', 'cb-yer-main', 'sub', 'YER', 0, now]);
  }
}
