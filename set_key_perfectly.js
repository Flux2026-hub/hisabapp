const fs = require('fs');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question('ألصق مفتاح API الجديد هنا ثم اضغط Enter:\n', (key) => {
  const cleanKey = key.trim();
  if (!cleanKey) {
    console.log("❌ لم يتم إدخال مفتاح.");
    rl.close();
    return;
  }

  // 1. تحديث ملف gemini.ts
  let geminiCode = fs.readFileSync('src/utils/gemini.ts', 'utf8');
  geminiCode = geminiCode.replace(/const API_KEY = ".*?";/, `const API_KEY = "${cleanKey}";`);
  fs.writeFileSync('src/utils/gemini.ts', geminiCode);

  // 2. تحديث ملف telegram.ts
  let tgCode = fs.readFileSync('src/utils/telegram.ts', 'utf8');
  tgCode = tgCode.replace(/new GoogleGenerativeAI\(".*?"\);/g, `new GoogleGenerativeAI("${cleanKey}");`);
  fs.writeFileSync('src/utils/telegram.ts', tgCode);

  console.log("✅ تم حفظ المفتاح بنجاح في الملفين (gemini.ts و telegram.ts)!");
  rl.close();
});
