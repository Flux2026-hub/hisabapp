const fs = require('fs');
const code = fs.readFileSync('src/utils/gemini.ts', 'utf8');
const match = code.match(/const API_KEY = "(.*?)";/);
const API_KEY = match[1];

fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`)
  .then(res => res.json())
  .then(data => {
    if (data.error) return console.log("❌ خطأ:", data.error.message);
    
    console.log("✅ النماذج المتاحة لمفتاحك:");
    data.models.forEach(m => {
        if (m.supportedGenerationMethods.includes('generateContent')) {
            console.log("-", m.name.replace('models/', ''));
        }
    });
  });
