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

  let code = fs.readFileSync('src/utils/gemini.ts', 'utf8');
  // البحث عن سطر المفتاح واستبدال ما بداخل علامات التنصيص
  code = code.replace(/const API_KEY = ".*?";/, `const API_KEY = "${cleanKey}";`);
  
  fs.writeFileSync('src/utils/gemini.ts', code);
  console.log("✅ تم حفظ المفتاح بنجاح في الكود!");
  rl.close();
});
