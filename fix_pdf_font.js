const fs = require('fs');
const path = require('path');

const dir = 'src/ui/reports';
let count = 0;

fs.readdirSync(dir).forEach(file => {
  if (file.endsWith('.tsx')) {
    const p = path.join(dir, file);
    let content = fs.readFileSync(p, 'utf8');
    let changed = false;

    // البحث عن font-size:12px أو font-size: 12px واستبدالها بـ 14px
    if (content.match(/font-size:\s*12px/g)) {
      content = content.replace(/font-size:\s*12px/g, 'font-size:14px');
      changed = true;
    }

    if (changed) {
      fs.writeFileSync(p, content);
      console.log('✅ تم تكبير الخط إلى 14px في:', p);
      count++;
    }
  }
});

console.log(`\n🎉 تم تعديل ${count} ملف تقارير.`);
