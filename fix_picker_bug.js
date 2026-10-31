const fs = require('fs');
const path = require('path');

function walk(dir) {
  fs.readdirSync(dir).forEach(file => {
    const p = path.join(dir, file);
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (p.endsWith('.tsx')) {
      let c = fs.readFileSync(p, 'utf8');
      let orig = c;

      // 1. إضافة خاصية بقاء لوحة المفاتيح للقوائم المنسدلة
      c = c.replace(/nestedScrollEnabled(?!\s+keyboardShouldPersistTaps)/g, 'nestedScrollEnabled keyboardShouldPersistTaps="always"');

      // 2. تغيير onPress إلى onPressIn في عناصر القوائم المنسدلة
      const lines = c.split('\n');
      const newLines = lines.map(line => {
        if (line.includes('suggestItem') && line.includes('onPress=')) {
          return line.replace(/onPress=/g, 'onPressIn=');
        }
        return line;
      });
      c = newLines.join('\n');

      if (c !== orig) {
        fs.writeFileSync(p, c);
        console.log('✅ تم إصلاح:', p);
      }
    }
  });
}

walk('src/ui');
console.log('\n🎉 تم إصلاح مشكلة اختفاء القائمة في جميع الشاشات!');
