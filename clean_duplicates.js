const fs = require('fs');
const p = 'src/ui/SettingsModule.tsx';
let c = fs.readFileSync(p, 'utf8');

// إزالة التكرار من تعريف الـ Type
c = c.replace(/darkMode:\s*boolean;\s*darkMode:\s*boolean;/g, 'darkMode: boolean;');
c = c.replace(/lightBgColor:\s*string;\s*lightBgColor:\s*string;/g, 'lightBgColor: string;');

// إزالة التكرار من القيم الافتراضية
c = c.replace(/darkMode:\s*false,\s*darkMode:\s*false,/g, 'darkMode: false,');
c = c.replace(/lightBgColor:\s*["']#FFFFFF["'],\s*lightBgColor:\s*["']#FFFFFF["'],/g, 'lightBgColor: "#FFFFFF",');

fs.writeFileSync(p, c);
console.log('✅ تم تنظيف التكرار بنجاح');
