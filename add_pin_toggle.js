const fs = require('fs');
let code = fs.readFileSync('src/ui/SettingsModule.tsx', 'utf8');

// 1. إضافة الخاصية في الأنواع (Types)
if (!code.includes("pinNavbar: boolean;")) {
    code = code.replace("darkMode: boolean;", "darkMode: boolean;\n  pinNavbar: boolean;");
}
// 2. إضافة القيمة الافتراضية
if (!code.includes("pinNavbar: false,")) {
    code = code.replace("darkMode: false,", "darkMode: false,\n  pinNavbar: false,");
}
// 3. إضافة زر التبديل تحت الوضع الليلي
const target = `<SwitchRow label="تفعيل الوضع الليلي (Dark Mode)" value={settings.darkMode} onChange={(v: any) => update("darkMode", v)} />`;
const newSwitch = `${target}\n            <SwitchRow label="تثبيت شريط التنقل (لا يختفي عند التمرير)" value={settings.pinNavbar} onChange={(v: any) => update("pinNavbar", v)} />`;

if (!code.includes("تثبيت شريط التنقل")) {
    code = code.replace(target, newSwitch);
}

fs.writeFileSync('src/ui/SettingsModule.tsx', code);
console.log("✅ تم إضافة خيار تثبيت الشريط في الإعدادات!");
