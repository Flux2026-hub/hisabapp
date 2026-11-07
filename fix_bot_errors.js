const fs = require('fs');
let code = fs.readFileSync('src/utils/telegram.ts', 'utf8');

// 1. إضافة إنشاء العمود (Migration) في بداية دالة الفحص
const startFunction = `export const checkTelegramCommands = async () => {`;
if (!code.includes('party_amount REAL')) {
    code = code.replace(startFunction, startFunction + `
  try { await sqlite.execAsync("ALTER TABLE vouchers ADD COLUMN party_amount REAL;"); } catch(e) {}
`);
}

// 2. تغيير رسالة الخطأ العامة إلى رسالة حقيقية
code = code.replace(
  `await sendTelegramMessage("❌ حدث خطأ أثناء تنفيذ الأمر.");`,
  `await sendTelegramMessage(\`❌ حدث خطأ: \${error.message || error}\`);`
);

fs.writeFileSync('src/utils/telegram.ts', code);
console.log("✅ تم تعديل الكود لإظهار الخطأ الحقيقي وإنشاء العمود تلقائياً!");
