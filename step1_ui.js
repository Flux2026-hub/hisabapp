const fs = require('fs');
const path = require('path');
const walk = (dir) => {
  fs.readdirSync(dir).forEach(file => {
    const p = path.join(dir, file);
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (p.endsWith('.tsx') && !p.includes('app/index.tsx')) {
      let c = fs.readFileSync(p, 'utf8');
      // إزالة الخلفية البيضاء والظل مع إبقاء مسافة 8 بكسل للحواف
      c = c.replace(/backgroundColor:\s*["']#(ffffff|FFFFFF)["']\s*,\s*marginHorizontal:\s*16\s*,\s*marginTop:\s*16\s*,\s*marginBottom:\s*16\s*,\s*borderRadius:\s*16\s*,\s*padding:\s*20\s*,\s*paddingBottom:\s*40/g, 'backgroundColor: "transparent", paddingHorizontal: 8, paddingTop: 16, paddingBottom: 40');
      c = c.replace(/backgroundColor:\s*["']#(ffffff|FFFFFF)["']/g, 'backgroundColor: "transparent"');
      fs.writeFileSync(p, c);
    }
  });
};
walk('src');
console.log('✅ الخطوة 1: تم إصلاح الواجهات');
