const fs = require('fs');
let code = fs.readFileSync('app/_layout.tsx', 'utf8');

// إضافة أمر نقل الأرصدة القديمة إلى balance_yer (فقط إذا لم يكن الحقل فارغاً)
if (!code.includes('UPDATE customers SET balance_yer = balance')) {
  code = code.replace(
    'try { await sqlite.execAsync("ALTER TABLE customers ADD COLUMN balance_sar REAL DEFAULT 0;"); } catch(e) {}',
    `try { await sqlite.execAsync("ALTER TABLE customers ADD COLUMN balance_sar REAL DEFAULT 0;"); } catch(e) {}
    try { await sqlite.execAsync("UPDATE customers SET balance_yer = balance WHERE balance_yer = 0 AND balance != 0;"); } catch(e) {}`
  );
}

if (!code.includes('UPDATE suppliers SET balance_yer = balance')) {
  code = code.replace(
    'try { await sqlite.execAsync("ALTER TABLE suppliers ADD COLUMN balance_sar REAL DEFAULT 0;"); } catch(e) {}',
    `try { await sqlite.execAsync("ALTER TABLE suppliers ADD COLUMN balance_sar REAL DEFAULT 0;"); } catch(e) {}
    try { await sqlite.execAsync("UPDATE suppliers SET balance_yer = balance WHERE balance_yer = 0 AND balance != 0;"); } catch(e) {}`
  );
}

fs.writeFileSync('app/_layout.tsx', code);
console.log("✅ تم إضافة سكربت ترحيل الأرصدة القديمة!");
