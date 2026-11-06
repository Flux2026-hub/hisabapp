const fs = require('fs');
let code = fs.readFileSync('src/utils/telegram.ts', 'utf8');

// إضافة استيراد Alert إذا لم يكن موجوداً
if (!code.includes("import { Alert }")) {
    code = code.replace('import AsyncStorage from "@react-native-async-storage/async-storage";', 'import AsyncStorage from "@react-native-async-storage/async-storage";\nimport { Alert } from "react-native";');
}

// إضافة تنبيه في بداية دالة الفحص
const startFunction = `export const checkTelegramCommands = async () => {`;
if (code.includes(startFunction) && !code.includes('بدء فحص أوامر تليجرام')) {
    code = code.replace(startFunction, startFunction + `\n  try { Alert.alert("تصحيح 1", "بدء فحص أوامر تليجرام..."); } catch(e){}`);
}

// إضافة تنبيه إذا لم يجد التوكن
const checkToken = `if (!token || !chatId) return;`;
if (code.includes(checkToken) && !code.includes('لم يتم العثور على التوكن')) {
    code = code.replace(checkToken, `if (!token || !chatId) { Alert.alert("تصحيح 2", "لم يتم العثور على التوكن أو Chat ID في الذاكرة!"); return; }`);
}

fs.writeFileSync('src/utils/telegram.ts', code);
console.log("✅ تم إضافة إشعارات التصحيح!");
