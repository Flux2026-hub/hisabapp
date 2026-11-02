const fs = require('fs');
let code = fs.readFileSync('app/index.tsx', 'utf8');
// البحث عن حاوية الرسم البياني (التي تبدأ بـ chartContainer) وإزالتها مع الرسم
code = code.replace(/<View style=\{\[styles\.chartContainer[\s\S]*?<LineChart[\s\S]*?\/>\s*<\/View>/, '');
// تأكيد وجود البانر
if (!code.includes('<PromoCarousel />')) {
    code = code.replace(
        '<Text style={[styles.hint, { color: colors.textMuted }]}>نظرة سريعة على أرصدة المصنع</Text>',
        '<Text style={[styles.hint, { color: colors.textMuted }]}>نظرة سريعة على أرصدة المصنع</Text>\n\n            <PromoCarousel />'
    );
}
fs.writeFileSync('app/index.tsx', code);
console.log("✅ تم حذف الرسم وإضافة البانر بنجاح!");
