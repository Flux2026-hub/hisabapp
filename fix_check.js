const fs = require('fs');
let code = fs.readFileSync('app/_layout.tsx', 'utf8');

// 1. إضافة الاستيراد إذا لم يكن موجوداً
if (!code.includes('checkTelegramCommands')) {
  code = code.replace(
    'import { checkAndSendAutoBackup } from "../src/utils/telegramAutoBackup";',
    'import { checkAndSendAutoBackup } from "../src/utils/telegramAutoBackup";\nimport { checkTelegramCommands } from "../src/utils/telegram";'
  );
}

// 2. إضافة استدعاء الدالة بعد النسخ الاحتياطي
if (!code.includes('checkTelegramCommands()')) {
  code = code.replace(
    'checkAndSendAutoBackup().catch(console.error);',
    'checkAndSendAutoBackup().catch(console.error);\n        checkTelegramCommands().catch(console.error);'
  );
}

fs.writeFileSync('app/_layout.tsx', code);
console.log("✅ تم إضافة دالة الفحص بنجاح!");
