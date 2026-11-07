const fs = require('fs');
let code = fs.readFileSync('src/utils/telegram.ts', 'utf8');

// 1. إضافة إنشاء العمود (Migration) في بداية دالة الفحص
const startFunc = 'export const checkTelegramCommands = async () => {';
if (code.includes(startFunc) && !code.includes('ALTER TABLE vouchers ADD COLUMN')) {
    code = code.replace(startFunc, startFunc + `
  try { await sqlite.execAsync("ALTER TABLE vouchers ADD COLUMN party_amount REAL;"); } catch(e) {}
  try { await sqlite.execAsync("ALTER TABLE customers ADD COLUMN updated_at INTEGER;"); } catch(e) {}
`);
}

// 2. تغيير رسالة الخطأ العامة إلى رسالة حقيقية
code = code.replace(
    'await sendTelegramMessage("❌ حدث خطأ أثناء تنفيذ الأمر.");',
    'await sendTelegramMessage(`❌ خطأ: ${error instanceof Error ? error.message : String(error)}`);'
);

fs.writeFileSync('src/utils/telegram.ts', code);
console.log("✅ تم تجهيز الكود للبناء (مع Migration وإظهار الأخطاء)!");
