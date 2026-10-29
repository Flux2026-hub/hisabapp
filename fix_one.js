const fs = require('fs');
let p = 'src/ui/OpeningBalancesModule.tsx';
let c = fs.readFileSync(p, 'utf8');

// إزالة التكرار لـ textAlign
c = c.replace(/textAlign:\s*["']right["']\s*,\s*fontWeight:\s*["']700["']\s*,\s*textAlign:\s*["']right["']/g, 'textAlign:"right",fontWeight:"700"');
c = c.replace(/textAlign:\s*["']right["']\s*,\s*textAlign:\s*["']right["']/g, 'textAlign:"right"');

fs.writeFileSync(p, c);
console.log('✅ تم إصلاح التكرار بنجاح');
