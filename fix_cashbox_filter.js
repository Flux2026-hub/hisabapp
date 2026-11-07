const fs = require('fs');
let code = fs.readFileSync('src/utils/telegram.ts', 'utf8');

// استبدال استعلام المصروف
code = code.replace(
  'const cashbox: any = await sqlite.getFirstAsync("SELECT id FROM cashboxes LIMIT 1");\n      const cashboxId = cashbox ? cashbox.id : null;\n\n      if (!cashboxId) {\n        await sendTelegramMessage("❌ لا يوجد صندوق مسجل في التطبيق لخصم المصروف منه.");',
  'const cashbox: any = await sqlite.getFirstAsync("SELECT id FROM cashboxes WHERE cashbox_type = \'analytical\' LIMIT 1");\n      const cashboxId = cashbox ? cashbox.id : null;\n\n      if (!cashboxId) {\n        await sendTelegramMessage("❌ لا يوجد صندوق تحليلي مسجل في التطبيق لخصم المصروف منه.");'
);

// استبدال استعلام الإيراد
code = code.replace(
  'const cashbox: any = await sqlite.getFirstAsync("SELECT id FROM cashboxes LIMIT 1");\n      const cashboxId = cashbox ? cashbox.id : null;\n\n      if (!cashboxId) {\n        await sendTelegramMessage("❌ لا يوجد صندوق مسجل في التطبيق لإضافة الإيراد إليه.");',
  'const cashbox: any = await sqlite.getFirstAsync("SELECT id FROM cashboxes WHERE cashbox_type = \'analytical\' LIMIT 1");\n      const cashboxId = cashbox ? cashbox.id : null;\n\n      if (!cashboxId) {\n        await sendTelegramMessage("❌ لا يوجد صندوق تحليلي مسجل في التطبيق لإضافة الإيراد إليه.");'
);

fs.writeFileSync('src/utils/telegram.ts', code);
console.log("✅ تم تعديل كود البوت ليختار الصناديق التحليلية فقط!");
