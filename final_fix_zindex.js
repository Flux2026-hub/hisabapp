const fs = require('fs');
let code = fs.readFileSync('app/index.tsx', 'utf8');

// 1. ضبط ستايل الهيدر (إعطاءه طبقة عالية وعدم جعله absolute)
code = code.replace(
  /header: \{[^}]+\}/,
  "header: { paddingHorizontal: 18, paddingVertical: 20, paddingTop: 40, zIndex: 10, elevation: 10 }"
);

// 2. ضبط شريط التنقل ليكون عائماً تحت الهيدر وطبقة منخفضة
code = code.replace(
  'position: "absolute", top: 120, left: 0, right: 0, zIndex: 4',
  'position: "absolute", top: 120, left: 0, right: 0, zIndex: 1, elevation: 1'
);

// 3. زيادة مسافة المحتوى لكي يبدأ بعد الهيدر والشريط
code = code.replace(
  /contentContainerStyle=\{\[styles\.scrollBackground, isDesktop && styles\.desktopContent, \{ paddingTop: \d+ \}\]\}/,
  'contentContainerStyle={[styles.scrollBackground, isDesktop && styles.desktopContent, { paddingTop: 190 }]}'
);

fs.writeFileSync('app/index.tsx', code);
console.log("✅ تم إصلاح ترتيب الطبقات بشكل نهائي وصارم!");
