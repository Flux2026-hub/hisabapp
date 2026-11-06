const fs = require('fs');
let code = fs.readFileSync('src/utils/telegram.ts', 'utf8');

// 1. إصلاح استعلام إضافة العميل (حذف updated_at)
code = code.replace(
  'INSERT INTO customers (id, code, name, phone, balance, created_at, updated_at) VALUES (?, ?, ?, ?, 0, ?, ?)',
  'INSERT INTO customers (id, code, name, phone, balance, created_at) VALUES (?, ?, ?, ?, 0, ?)'
);
code = code.replace(
  '[customerId, nextCode, parsed.partyName, phoneNumber, now, now]',
  '[customerId, nextCode, parsed.partyName, phoneNumber, now]'
);

// 2. إظهار رسالة الخطأ الحقيقية بدلاً من "لم أفهم الأمر"
code = code.replace(
  'await sendTelegramMessage("🤖 لم أفهم الأمر. جرب:\\n- \\"صرفت 500 بنزين\\"\\n- \\"استلمت 1000 من أحمد\\"\\n- \\"افتح حساب عميل جديد باسم...\\"\\n- أو أرسل رسالة صوتية");',
  'if (parsed.error) {\n      await sendTelegramMessage(`❌ خطأ في الاتصال بالذكاء الاصطناعي:\\n${parsed.error}`);\n    } else {\n      await sendTelegramMessage("🤖 لم أفهم الأمر. جرب:\\n- \\"صرفت 500 بنزين\\"\\n- \\"استلمت 1000 من أحمد\\"\\n- \\"افتح حساب عميل جديد باسم...\\"\\n- أو أرسل رسالة صوتية");\n    }'
);

fs.writeFileSync('src/utils/telegram.ts', code);
console.log("✅ تم إصلاح خطأ قاعدة البيانات وإضافة رسائل خطأ الذكاء الاصطناعي!");
