const fs = require('fs');
let code = fs.readFileSync('app/index.tsx', 'utf8');

// 1. إضافة استيراد مكون البانر (إذا لم يكن موجوداً)
if (!code.includes("PromoBanner")) {
    code = code.replace('import GlobalSearchModal from "../src/ui/components/GlobalSearchModal";', 'import GlobalSearchModal from "../src/ui/components/GlobalSearchModal";\nimport PromoBanner from "../src/ui/components/PromoBanner";');
}

// 2. وضع البانر فوق الرسم البياني
const target = `<Text style={[styles.hint, { color: colors.textMuted }]}>نظرة سريعة على أرصدة المصنع</Text>

            <View style={[styles.chartContainer, { backgroundColor: colors.isDark ? "#1E293B" : "#F8FAFC" }]}>`;

const replacement = `<Text style={[styles.hint, { color: colors.textMuted }]}>نظرة سريعة على أرصدة المصنع</Text>

            {/* ✅ شاشة العرض (البانر الإعلاني) */}
            <PromoBanner />

            <View style={[styles.chartContainer, { backgroundColor: colors.isDark ? "#1E293B" : "#F8FAFC" }]}>`;

if (code.includes(target)) {
    code = code.replace(target, replacement);
    fs.writeFileSync('app/index.tsx', code);
    console.log("✅ تمت إضافة البانر إلى لوحة التحكم بنجاح!");
} else {
    console.log("⚠️ لم يتم العثور على النص المطابق. يرجى إبلاغي.");
}
