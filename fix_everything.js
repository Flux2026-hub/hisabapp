const fs = require('fs');
let code = fs.readFileSync('app/index.tsx', 'utf8');

// 1. إضافة استيراد البانر الجديد
if (!code.includes("PromoCarousel")) {
    code = code.replace('import PromoBanner from "../src/ui/components/PromoBanner";', 'import PromoCarousel from "../src/ui/components/PromoCarousel";');
    // إذا لم يكن هناك استيراد قديم، نضيفه بجانب الاستيرادات الأخرى
    if (!code.includes("PromoCarousel")) {
        code = code.replace('import GlobalSearchModal from "../src/ui/components/GlobalSearchModal";', 'import GlobalSearchModal from "../src/ui/components/GlobalSearchModal";\nimport PromoCarousel from "../src/ui/components/PromoCarousel";');
    }
}

// 2. حذف الرسم البياني بالكامل (البحث عن حاوية الرسم وإزالتها)
const chartRegex = /<View style=\{\[styles\.chartContainer[\s\S]*?<\/View>\s*<\/View>/;
code = code.replace(chartRegex, '');

// 3. استبدال أي بانر قديم بالبانر الجديد
code = code.replace(/<PromoBanner \/>/g, '<PromoCarousel />');

// 4. إصلاح شريط التنقل ليكون عائماً (Absolute) ولا يترك فراغاً أبيض
code = code.replace(
  '<Animated.View style={[styles.nav, { backgroundColor: colors.surface, borderBottomColor: colors.border }, navAnimatedStyle]}>',
  '<Animated.View style={[styles.nav, { backgroundColor: colors.surface, borderBottomColor: colors.border, position: "absolute", top: 0, left: 0, right: 0, zIndex: 4 }, navAnimatedStyle]}>'
);

// 5. إضافة مسافة علوية للمحتوى لكي لا يختفي تحت الشريط العائم
code = code.replace(
  'contentContainerStyle={[styles.scrollBackground, isDesktop && styles.desktopContent]}',
  'contentContainerStyle={[styles.scrollBackground, isDesktop && styles.desktopContent, { paddingTop: 75 }]}'
);

// 6. إعطاء الهيدر طبقة أعلى (zIndex) لكي يغطي الشريط عند اختفائه
code = code.replace(
  /header: \{ paddingHorizontal: 20, paddingVertical: 20, paddingTop: 35, borderBottomLeftRadius: 20, borderBottomRightRadius: 20, elevation: 8, shadowColor: '#000', shadowOffset: \{ width: 0, height: 4 \}, shadowOpacity: 0.3, shadowRadius: 5 \}/,
  "header: { paddingHorizontal: 20, paddingVertical: 20, paddingTop: 35, borderBottomLeftRadius: 20, borderBottomRightRadius: 20, elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 5, zIndex: 10 }"
);

fs.writeFileSync('app/index.tsx', code);
console.log("✅ تم تنفيذ جميع التعديلات بنجاح!");
