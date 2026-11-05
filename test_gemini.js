const fs = require('fs');

// 1. قراءة المفتاح من ملفك تلقائياً
const code = fs.readFileSync('src/utils/gemini.ts', 'utf8');
const match = code.match(/const API_KEY = "(.*?)";/);

if (!match || match[1] === "ضع_مفتاح_API_هنا") {
  console.log("❌ لم يتم العثور على مفتاح صالح في ملف src/utils/gemini.ts");
  process.exit(1);
}

const API_KEY = match[1];
console.log("✅ تم العثور على المفتاح:", API_KEY.substring(0, 10) + "...");

// 2. تجربة الذكاء الاصطناعي
async function testGemini() {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${API_KEY}`;
  
  const prompt = `
    أنت مساعد محاسبي. حلل هذه الجملة وأرجع JSON فقط:
    "صرفت 500 حق بنزين"
    
    المطلوب:
    { "intent": "expense", "amount": 500, "description": "بنزين" }
  `;

  try {
    console.log("⏳ جاري إرسال الطلب إلى جوجل...");
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });

    const data = await response.json();
    
    if (data.error) {
      console.log("❌ خطأ من جوجل:", data.error.message);
      return;
    }

    console.log("\n🤖 رد الذكاء الاصطناعي:");
    console.log(data.candidates[0].content.parts[0].text);

  } catch (e) {
    console.log("❌ خطأ في الاتصال:", e.message);
  }
}

testGemini();
