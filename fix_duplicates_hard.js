const fs = require('fs');
const p = 'src/ui/SettingsModule.tsx';
let lines = fs.readFileSync(p, 'utf8').split('\n');

let seenDarkModeType = false;
let seenLightBgType = false;
let seenDarkModeVal = false;
let seenLightBgVal = false;

// تصفية الأسطر وحذف التكرار
lines = lines.filter(line => {
    const trimmed = line.trim();
    if (trimmed === 'darkMode: boolean;') {
        if (seenDarkModeType) return false;
        seenDarkModeType = true;
    }
    if (trimmed === 'lightBgColor: string;') {
        if (seenLightBgType) return false;
        seenLightBgType = true;
    }
    if (trimmed === 'darkMode: false,') {
        if (seenDarkModeVal) return false;
        seenDarkModeVal = true;
    }
    if (trimmed === 'lightBgColor: "#FFFFFF",' || trimmed === "lightBgColor: '#FFFFFF',") {
        if (seenLightBgVal) return false;
        seenLightBgVal = true;
    }
    return true;
});

fs.writeFileSync(p, lines.join('\n'));
console.log('✅ تم حذف التكرار بنجاح');
