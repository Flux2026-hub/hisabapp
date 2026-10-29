const fs = require('fs');
const path = require('path');

const walk = (dir) => {
  fs.readdirSync(dir).forEach(file => {
    const p = path.join(dir, file);
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (p.endsWith('.tsx')) {
      let c = fs.readFileSync(p, 'utf8');
      let orig = c;

      let prev;
      do {
         prev = c;
         // إزالة تكرار paddingBottom
         c = c.replace(/paddingBottom:\s*([\d.]+),\s*([^}]*?)paddingBottom:\s*[\d.]+/g, 'paddingBottom: $1, $2');
         // إزالة تكرار paddingHorizontal
         c = c.replace(/paddingHorizontal:\s*([\d.]+),\s*([^}]*?)paddingHorizontal:\s*[\d.]+/g, 'paddingHorizontal: $1, $2');
         // إزالة تكرار paddingTop
         c = c.replace(/paddingTop:\s*([\d.]+),\s*([^}]*?)paddingTop:\s*[\d.]+/g, 'paddingTop: $1, $2');
         // إزالة تكرار padding
         c = c.replace(/padding:\s*([\d.]+),\s*([^}]*?)padding:\s*[\d.]+/g, 'padding: $1, $2');
      } while (c !== prev);

      if (c !== orig) {
         fs.writeFileSync(p, c);
         console.log('✅ تم تنظيف التكرار في:', p);
      }
    }
  });
};
walk('src');
