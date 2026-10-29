const fs = require('fs');

// 1. إصلاح ملف SettingsModule (حذف التكرار في الستايل)
let sm = fs.readFileSync('src/ui/SettingsModule.tsx', 'utf8');
sm = sm.replace(/back:\s*\{\s*alignSelf:\s*["']flex-end["']\s*,\s*paddingVertical:\s*10\s*\},\s*alignSelf:\s*["']flex-end["']\s*,/g, 'back: { alignSelf: "flex-end", paddingVertical: 10 },');
fs.writeFileSync('src/ui/SettingsModule.tsx', sm);
console.log('✅ تم إصلاح SettingsModule.tsx');

// 2. إصلاح ملف CashboxesReport (جعل الدالة async وإصلاح اللوجو)
let cb = fs.readFileSync('src/ui/reports/CashboxesReport.tsx', 'utf8');
cb = cb.replace('const buildPdfHtml = () => {', 'const buildPdfHtml = async () => {\n    const logoBase64 = await getLogoBase64();');
cb = cb.replace(/src=' \+ await getLogoBase64\(\) \+ '/g, "src=' + logoBase64 + '");
fs.writeFileSync('src/ui/reports/CashboxesReport.tsx', cb);
console.log('✅ تم إصلاح CashboxesReport.tsx');

// 3. إصلاح ملف OpeningBalancesModule (إصلاح السهم)
let ob = fs.readFileSync('src/ui/OpeningBalancesModule.tsx', 'utf8');
ob = ob.split('->').join('-&gt;');
fs.writeFileSync('src/ui/OpeningBalancesModule.tsx', ob);
console.log('✅ تم إصلاح OpeningBalancesModule.tsx');
