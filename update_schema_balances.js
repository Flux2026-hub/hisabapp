const fs = require('fs');
let code = fs.readFileSync('src/db/accounting-schema.ts', 'utf8');

// تحديث جدول العملاء
code = code.replace(
  'balance:real("balance").notNull().default(0), createdAt:integer("created_at",{mode:"timestamp_ms"}).notNull() });\nexport const suppliers',
  'balance:real("balance").notNull().default(0), balanceYer:real("balance_yer").default(0), balanceSar:real("balance_sar").default(0), createdAt:integer("created_at",{mode:"timestamp_ms"}).notNull() });\nexport const suppliers'
);

// تحديث جدول الموردين
code = code.replace(
  'balance:real("balance").notNull().default(0), createdAt:integer("created_at",{mode:"timestamp_ms"}).notNull() });\nexport const cashboxes',
  'balance:real("balance").notNull().default(0), balanceYer:real("balance_yer").default(0), balanceSar:real("balance_sar").default(0), createdAt:integer("created_at",{mode:"timestamp_ms"}).notNull() });\nexport const cashboxes'
);

fs.writeFileSync('src/db/accounting-schema.ts', code);
console.log("✅ تم تحديث ملف Schema لدعم الأرصدة المتعددة!");
