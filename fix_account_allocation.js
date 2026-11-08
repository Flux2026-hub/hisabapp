const fs = require('fs');

// 1. تحديث ملف Gemini
let geminiCode = fs.readFileSync('src/utils/gemini.ts', 'utf8');
geminiCode = geminiCode.replace(
  'partyName?: string;',
  'partyName?: string;\n  accountName?: string;'
);

const promptAddition = `
      8. إذا ذكر المستخدم عبارة "لحساب [اسم الحساب]" مثل "لحساب تسويق وإعلان" أو "على حساب المصروفات الإدارية"، استخرج اسم الحساب في حقل accountName.
      
      أمثلة:
      { "intent": "expense", "amount": 6800, "accountName": "تسويق وإعلان", "description": "لاصق للاستاند" }
`;
geminiCode = geminiCode.replace('أمثلة على المخرجات المطلوبة (JSON فقط):', promptAddition + '\n      أمثلة على المخرجات المطلوبة (JSON فقط):');

// إضافة حقل accountName إلى أمثلة الـ JSON في البرومبت
geminiCode = geminiCode.replace(
  '{ "intent": "expense", "amount": 500, "partyName": "أحمد", "description": "بنزين" }',
  '{ "intent": "expense", "amount": 500, "partyName": "أحمد", "description": "بنزين" }\n      { "intent": "expense", "amount": 6800, "accountName": "تسويق وإعلان", "description": "لاصق استاند" }'
);
fs.writeFileSync('src/utils/gemini.ts', geminiCode);

// 2. تحديث ملف Telegram (للمصروفات)
let tgCode = fs.readFileSync('src/utils/telegram.ts', 'utf8');

// إضافة فحص الحساب في المصروف
const oldExpenseParty = `      let partyId = null;
      let pType = 'none';
      let pName = 'مصروف ذكي';

      if (parsed.partyName) {`;
const newExpenseParty = `      let partyId = null;
      let pType = 'none';
      let pName = 'مصروف ذكي';

      // البحث عن حساب في دليل الحسابات إذا تم ذكره
      if (parsed.accountName) {
        const acc: any = await sqlite.getFirstAsync("SELECT id, name FROM accounts WHERE name LIKE ? LIMIT 1", [\`%\${parsed.accountName}%\`]);
        if (acc) { partyId = acc.id; pType = 'account'; pName = acc.name; }
      }

      if (!partyId && parsed.partyName) {`;
tgCode = tgCode.replace(oldExpenseParty, newExpenseParty);

// إضافة فحص الحساب في الإيراد
const oldIncomeParty = `      let partyId = null;
      let pType = 'none';
      let pName = 'إيراد ذكي';

      if (parsed.partyName) {`;
const newIncomeParty = `      let partyId = null;
      let pType = 'none';
      let pName = 'إيراد ذكي';

      // البحث عن حساب في دليل الحسابات إذا تم ذكره
      if (parsed.accountName) {
        const acc: any = await sqlite.getFirstAsync("SELECT id, name FROM accounts WHERE name LIKE ? LIMIT 1", [\`%\${parsed.accountName}%\`]);
        if (acc) { partyId = acc.id; pType = 'account'; pName = acc.name; }
      }

      if (!partyId && parsed.partyName) {`;
tgCode = tgCode.replace(oldIncomeParty, newIncomeParty);

fs.writeFileSync('src/utils/telegram.ts', tgCode);
console.log("✅ تم تحديث الكود ليدعم توجيه المصروفات والإيرادات إلى دليل الحسابات (مثل حساب تسويق وإعلان)!");
