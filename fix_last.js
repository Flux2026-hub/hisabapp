const fs = require('fs');

// 1. إصلاح OpeningBalancesModule
let ob = fs.readFileSync('src/ui/OpeningBalancesModule.tsx', 'utf8');
ob = ob.replace(/textAlign:\s*"right",\s*textAlign:\s*"right"/g, 'textAlign: "right"');
fs.writeFileSync('src/ui/OpeningBalancesModule.tsx', ob);
console.log('✅ Fixed OpeningBalancesModule');

// 2. إصلاح CashboxesReport
let cb = fs.readFileSync('src/ui/reports/CashboxesReport.tsx', 'utf8');
cb = cb.replace('const html = buildPdfHtml();', 'const html = await buildPdfHtml();');
fs.writeFileSync('src/ui/reports/CashboxesReport.tsx', cb);
console.log('✅ Fixed CashboxesReport');
