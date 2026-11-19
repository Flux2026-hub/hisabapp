const fs = require('fs');
let code = fs.readFileSync('app/_layout.tsx', 'utf8');

// إضافة الترحيلات للعملاء
if (!code.includes('balance_yer')) {
  code = code.replace(
    'try { await sqlite.execAsync("ALTER TABLE customers ADD COLUMN account_code TEXT;"); } catch(e) {}',
    `try { await sqlite.execAsync("ALTER TABLE customers ADD COLUMN account_code TEXT;"); } catch(e) {}
    try { await sqlite.execAsync("ALTER TABLE customers ADD COLUMN balance_yer REAL DEFAULT 0;"); } catch(e) {}
    try { await sqlite.execAsync("ALTER TABLE customers ADD COLUMN balance_sar REAL DEFAULT 0;"); } catch(e) {}`
  );
}

// إضافة الترحيلات للموردين
if (!code.includes('supplier_balance_yer')) {
  code = code.replace(
    'try { await sqlite.execAsync("ALTER TABLE suppliers ADD COLUMN account_code TEXT;"); } catch(e) {}',
    `try { await sqlite.execAsync("ALTER TABLE suppliers ADD COLUMN account_code TEXT;"); } catch(e) {}
    try { await sqlite.execAsync("ALTER TABLE suppliers ADD COLUMN balance_yer REAL DEFAULT 0;"); } catch(e) {}
    try { await sqlite.execAsync("ALTER TABLE suppliers ADD COLUMN balance_sar REAL DEFAULT 0;"); } catch(e) {}`
  );
}

fs.writeFileSync('app/_layout.tsx', code);
console.log("✅ تم إضافة حقول الأرصدة المتعددة للعملاء والموردين!");
