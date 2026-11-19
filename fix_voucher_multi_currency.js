const fs = require('fs');
let code = fs.readFileSync('src/ui/VouchersScreen.tsx', 'utf8');

// 1. دالة مساعدة لتحديث الرصيد حسب العملة
const helperFunction = `
const getBalanceField = (currencyCode: string) => {
  return currencyCode === 'SAR' ? 'balance_sar' : 'balance_yer';
};
`;

// إدراج الدالة قبل تعريف المكون
if (!code.includes('getBalanceField')) {
  code = code.replace('export default function VouchersScreen', helperFunction + '\nexport default function VouchersScreen');
}

// 2. تعديل منطق الحفظ (إضافة/تحديث السند)
// نبحث عن استعلامات UPDATE customers/suppliers ونستبدلها بالحقل الجديد

// تعديل استعلامات العملاء
code = code.replace(
  /await sqlite\.runAsync\("UPDATE customers SET balance = balance \+ \? WHERE id = \?", \[(newPDelta|partyDelta), (partyRecord\.id|oldV\.party_id)\]/g,
  (match, deltaVar, idVar) => {
    return `await sqlite.runAsync(\`UPDATE customers SET \${getBalanceField(currency.code)} = \${getBalanceField(currency.code)} + ? WHERE id = ?\`, [${deltaVar}, ${idVar}]`;
  }
);

// تعديل استعلامات الموردين
code = code.replace(
  /await sqlite\.runAsync\("UPDATE suppliers SET balance = balance \+ \? WHERE id = \?", \[(newPDelta|partyDelta), (partyRecord\.id|oldV\.party_id)\]/g,
  (match, deltaVar, idVar) => {
    return `await sqlite.runAsync(\`UPDATE suppliers SET \${getBalanceField(currency.code)} = \${getBalanceField(currency.code)} + ? WHERE id = ?\`, [${deltaVar}, ${idVar}]`;
  }
);

fs.writeFileSync('src/ui/VouchersScreen.tsx', code);
console.log("✅ تم تعديل كود السندات لدعم الأرصدة المتعددة!");
