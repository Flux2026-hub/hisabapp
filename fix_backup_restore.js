const fs = require('fs');
const p = 'src/utils/backup.ts';
let c = fs.readFileSync(p, 'utf8');

// تعديل دالة الاستعادة لتخطي جدول الحسابات (حماية COA الجديد)
c = c.replace(
  'for (const table of TABLES) {\n      const rows = backup.data[table];',
  'for (const table of TABLES) {\n      // 🚀 حماية دليل الحسابات الجديد من المسح إذا كانت النسخة قديمة\n      if (table === "accounts") continue;\n      \n      const rows = backup.data[table];'
);

fs.writeFileSync(p, c);
console.log('✅ تم تأمين دالة الاستعادة بنجاح');
