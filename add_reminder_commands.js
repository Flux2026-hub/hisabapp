const fs = require('fs');
let code = fs.readFileSync('src/utils/telegram.ts', 'utf8');

// إضافة أمر التذكير في معالج النصوص
const oldTextHandler = `        } else {
          await processTextCommand(txt);
        }
      }`;

const newTextHandler = `        } else if (txt.startsWith('ذكرني')) {
          // صيغة: ذكرني [الموضوع] [بعد عدد أيام]
          // مثال: ذكرني سداد شيك أحمد بعد 3 أيام
          const match = txt.match(/ذكرني\\s+(.+?)\\s+بعد\\s+(\\d+)\\s+أيام?/);
          if (match) {
            const title = match[1].trim();
            const days = parseInt(match[2], 10);
            const dueDate = Date.now() + (days * 24 * 60 * 60 * 1000);
            const success = await addReminder(title, dueDate);
            if (success) {
              await sendTelegramMessage(\`✅ تم إضافة التذكير:\\n📝 \${title}\\n📅 بعد \${days} أيام (\${new Date(dueDate).toLocaleDateString('ar-YE')})\`);
            } else {
              await sendTelegramMessage("❌ تعذر إضافة التذكير.");
            }
          } else {
            await sendTelegramMessage("⚠️ صيغة خاطئة. جرب: ذكرني سداد شيك أحمد بعد 3 أيام");
          }
        } else {
          await processTextCommand(txt);
        }
      }`;

if (code.includes(oldTextHandler)) {
  code = code.replace(oldTextHandler, newTextHandler);
  fs.writeFileSync('src/utils/telegram.ts', code);
  console.log("✅ تم إضافة أمر التذكير (ذكرني... بعد X أيام)!");
}
