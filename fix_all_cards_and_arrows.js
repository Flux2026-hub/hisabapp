const fs = require('fs');
const path = require('path');

const walk = (dir) => {
  fs.readdirSync(dir).forEach(file => {
    const p = path.join(dir, file);
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (p.endsWith('.tsx') && !p.includes('app/index.tsx')) {
      let c = fs.readFileSync(p, 'utf8');
      let changed = false;

      // 1. إصلاح شكل زر العودة (تحويل &gt; إلى سهم أنيق ‹)
      if (c.includes('&gt;')) {
        c = c.split('&gt;').join('‹');
        changed = true;
      }

      // 2. إزالة البطاقة البيضاء من الحاويات
      // نبحث عن النمط الشائع للبطاقة ونستبدله بخلفية شفافة مع هوامش بسيطة
      if (c.includes('backgroundColor: "#ffffff"') || c.includes('backgroundColor: "#FFF"')) {
         c = c.replace(/backgroundColor:\s*["']#(ffffff|FFFFFF|FFF|fff)["']\s*,\s*marginHorizontal:\s*16\s*,\s*marginTop:\s*16\s*,\s*marginBottom:\s*16\s*,\s*borderRadius:\s*16/g, 'backgroundColor: "transparent", paddingHorizontal: 8, paddingTop: 16, paddingBottom: 40');
         
         // بعض الشاشات قد تستخدم تنسيقاً مختصراً
         c = c.replace(/backgroundColor:\s*["']#(ffffff|FFFFFF|FFF|fff)["']\s*,\s*margin:\s*10\s*,\s*borderRadius:\s*16/g, 'backgroundColor: "transparent", paddingHorizontal: 8, paddingTop: 16');
         
         // إذا كانت البطاقة مكتوبة في ستايل منفصل اسمه scrollContainer أو content
         c = c.replace(/backgroundColor:\s*["']#(ffffff|FFFFFF|FFF|fff)["']\s*,\s*marginHorizontal:\s*16\s*,\s*marginVertical:\s*16/g, 'backgroundColor: "transparent", paddingHorizontal: 8, paddingTop: 16');
         
         changed = true;
      }

      if (changed) {
        fs.writeFileSync(p, c);
        console.log('✅ تم التعديل في:', p);
      }
    }
  });
};

walk('src');
