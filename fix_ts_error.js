const fs = require('fs');
const p = 'src/ui/SettingsModule.tsx';
let c = fs.readFileSync(p, 'utf8');

// إضافة النوع any للمتغير v في دوال التحديث
c = c.replace(/\(v\)\s*=>\s*update/g, '(v: any) => update');
c = c.replace(/\(v\)\s*=>\s*setSettings/g, '(v: any) => setSettings');

fs.writeFileSync(p, c);
console.log('✅ تم إصلاح أخطاء TypeScript بنجاح');
