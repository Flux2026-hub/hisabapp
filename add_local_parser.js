const fs = require('fs');
let code = fs.readFileSync('src/utils/telegram.ts', 'utf8');

// 1. إضافة دالة الفهم المحلي (Local Parser)
const localParserCode = `
// ✅ الفهم المحلي السريع (بدون إنترنت وبدون استهلاك حصة Gemini)
const localParse = (text: string): any | null => {
  const cleaned = text.trim();

  // 1. المصروف: صرفت 500 / دفعت 1000 / مصروف 2000 [بيان اختياري]
  const expenseMatch = cleaned.match(/^(?:صرفت|دفعت|مصروف)\\s+(\\d+(?:\\.\\d+)?)\\s*(.*)$/);
  if (expenseMatch) {
    return {
      intent: "expense",
      amount: parseFloat(expenseMatch[1]),
      description: expenseMatch[2] || "مصروف",
      cashboxName: undefined,
      partyName: undefined,
    };
  }

  // 2. الإيراد: استلمت 1000 / قبضت 500 [بيان اختياري]
  const incomeMatch = cleaned.match(/^(?:استلمت|قبضت|إيراد)\\s+(\\d+(?:\\.\\d+)?)\\s*(.*)$/);
  if (incomeMatch) {
    return {
      intent: "income",
      amount: parseFloat(incomeMatch[1]),
      description: incomeMatch[2] || "إيراد",
      cashboxName: undefined,
      partyName: undefined,
    };
  }

  // 3. استعلام رصيد: رصيد أحمد / كم رصيد أحمد
  const balanceMatch = cleaned.match(/^(?:كم\\s+)?رصيد\\s+(.+)$/);
  if (balanceMatch) {
    return {
      intent: "query_customer_balance",
      partyName: balanceMatch[1].trim(),
      amount: 0,
      description: "استعلام رصيد",
    };
  }

  // 4. استعلام مخزون: مخزون ماسورة / كم بقي ماسورة
  const stockMatch = cleaned.match(/^(?:كم\\s+)?(?:بقي\\s+)?مخزون\\s+(.+)$/);
  if (stockMatch) {
    return {
      intent: "query_stock",
      itemName: stockMatch[1].trim(),
      amount: 0,
      description: "استعلام مخزون",
    };
  }

  // 5. كشف حساب: كشف حساب أحمد / كشف أحمد
  const statementMatch = cleaned.match(/^كشف\\s+(?:حساب\\s+)?(.+)$/);
  if (statementMatch) {
    return {
      intent: "query_customer_statement",
      partyName: statementMatch[1].trim(),
      amount: 0,
      description: "كشف حساب",
    };
  }

  // 6. آخر سداد: آخر سداد أحمد / متى آخر سداد من أحمد
  const lastPaymentMatch = cleaned.match(/^(?:متى\\s+)?آخر\\s+سداد\\s+(?:من\\s+)?(.+)$/);
  if (lastPaymentMatch) {
    return {
      intent: "query_last_payment",
      partyName: lastPaymentMatch[1].trim(),
      amount: 0,
      description: "آخر سداد",
    };
  }

  return null; // لم يفهمها محلياً، اذهب إلى Gemini
};
`;

// إدراج دالة localParse قبل دالة processTextCommand
const marker = 'const processTextCommand = async (text: string) => {';
if (!code.includes('const localParse')) {
  code = code.replace(marker, localParserCode + '\n' + marker);
}

// 2. تعديل processTextCommand ليجرب الفهم المحلي أولاً
const oldParse = '    const parsed = await parseArabicCommand(text);';
const newParse = `    // 1. المحاولة المحلية أولاً (سريعة جداً)
    let parsed = localParse(text);
    
    // 2. إذا فشل الفهم المحلي، نلجأ إلى الذكاء الاصطناعي (Gemini)
    if (!parsed) {
      parsed = await parseArabicCommand(text);
    }`;

if (code.includes(oldParse)) {
  code = code.replace(oldParse, newParse);
} else {
  console.log("⚠️ تحذير: لم يتم العثور على سطر parseArabicCommand. تحقق من الملف.");
}

fs.writeFileSync('src/utils/telegram.ts', code);
console.log("✅ تم إضافة الفهم المحلي السريع (Hybrid NLP) بنجاح!");
