const fs = require('fs');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question('ألصق المفتاح هنا ثم اضغط Enter (لن يظهر المفتاح في الشاشة):\n', (key) => {
  const cleanKey = key.trim();
  if (!cleanKey) {
    console.log("❌ لم يتم إدخال مفتاح.");
    rl.close();
    return;
  }

  let code = fs.readFileSync('src/utils/telegram.ts', 'utf8');
  // البحث عن أي مفتاح قديم أو النص البديل واستبداله بالمفتاح الجديد
  code = code.replace(/new GoogleGenerativeAI\(".*?"\);/g, `new GoogleGenerativeAI("${cleanKey}");`);
  
  fs.writeFileSync('src/utils/telegram.ts', code);
  console.log("✅ تم حفظ المفتاح بأمان داخل الكود!");
  rl.close();
});
