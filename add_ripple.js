const fs = require('fs');
const path = require('path');

function walk(dir) {
  fs.readdirSync(dir).forEach(file => {
    const p = path.join(dir, file);
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (p.endsWith('.tsx')) {
      let c = fs.readFileSync(p, 'utf8');
      let orig = c;

      // إضافة تأثير الضغطة لكل زر Pressable لا يحتوي عليه مسبقاً
      c = c.replace(/<Pressable(?![^>]*android_ripple)/g, '<Pressable android_ripple={{ color: "rgba(0,0,0,0.1)" }}');

      if (c !== orig) {
        fs.writeFileSync(p, c);
        console.log('✅ تم إضافة تأثير الضغطة في:', p);
      }
    }
  });
}
walk('src/ui');
console.log('\n🎉 تم الانتهاء!');
