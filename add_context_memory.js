const fs = require('fs');
let code = fs.readFileSync('src/utils/telegram.ts', 'utf8');

// إضافة دالة حفظ واسترجاع آخر عميل
const contextFunctions = `
// ✅ ذاكرة السياق: حفظ واسترجاع آخر عميل
const LAST_CUSTOMER_KEY = '@flux_last_customer';
const saveLastCustomer = async (name: string) => { await AsyncStorage.setItem(LAST_CUSTOMER_KEY, name); };
const getLastCustomer = async () => { return await AsyncStorage.getItem(LAST_CUSTOMER_KEY); };
`;

// إضافة الاستدعاء في أوامر الرصيد والكشف
const oldQueryBalance = `    else if (parsed.intent === "query_customer_balance" && parsed.partyName) {`;
const newQueryBalance = `    else if (parsed.intent === "query_customer_balance" && parsed.partyName) {
      await saveLastCustomer(parsed.partyName);`;

const oldQueryStatement = `    else if (parsed.intent === "query_customer_statement" && parsed.partyName) {`;
const newQueryStatement = `    else if (parsed.intent === "query_customer_statement" && parsed.partyName) {
      await saveLastCustomer(parsed.partyName);`;

// إضافة دعم "رصيده" بدون اسم
const oldTextCmd = `      if (message.text) {`;
const newTextCmd = `      if (message.text) {
        // دعم "كم رصيده" باستخدام الذاكرة
        if (message.text.trim().match(/^(?:كم\\s+)?رصيده\\??$/)) {
          const lastName = await getLastCustomer();
          if (lastName) {
            await processTextCommand(\`رصيد \${lastName}\`);
            await AsyncStorage.setItem(LAST_UPDATE_ID_KEY, String(update.update_id));
            continue;
          } else {
            await sendTelegramMessage("⚠️ لم أتعرف على العميل. جرب: رصيد أحمد");
            await AsyncStorage.setItem(LAST_UPDATE_ID_KEY, String(update.update_id));
            continue;
          }
        }`;

if (!code.includes('LAST_CUSTOMER_KEY')) {
  code = code.replace('const processTextCommand = async (text: string) => {', contextFunctions + '\n' + 'const processTextCommand = async (text: string) => {');
}
code = code.replace(oldQueryBalance, newQueryBalance);
code = code.replace(oldQueryStatement, newQueryStatement);
code = code.replace(oldTextCmd, newTextCmd);

fs.writeFileSync('src/utils/telegram.ts', code);
console.log("✅ تم تفعيل ذاكرة السياق (كم رصيده؟)!");
