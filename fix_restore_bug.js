const fs = require('fs');
let code = fs.readFileSync('src/utils/backup.ts', 'utf8');

// تغيير INSERT إلى INSERT OR REPLACE لتجنب خطأ التكرار
code = code.replace(
  '`INSERT INTO ${table} (${cols}) VALUES (${placeholders})`',
  '`INSERT OR REPLACE INTO ${table} (${cols}) VALUES (${placeholders})`'
);

fs.writeFileSync('src/utils/backup.ts', code);
console.log("✅ تم إصلاح كود الاستعادة (INSERT OR REPLACE)!");
