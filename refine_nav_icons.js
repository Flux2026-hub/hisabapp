const fs = require('fs');
let code = fs.readFileSync('app/index.tsx', 'utf8');

// البحث عن بلوك زر التنقل الذي أضفناه سابقاً
const oldNavItem = /<Pressable key=\{key\} onPress=\{\(\) => go\(key\)\} style=\{\[styles\.navItem, active && \{ backgroundColor: colors\.isDark \? 'rgba\(249, 115, 22, 0\.2\)' : 'rgba\(249, 115, 22, 0\.1\)' \}\]\}>[\s\S]*?<\/Pressable>/;

const newNavItem = `<Pressable key={key} onPress={() => go(key)} style={[styles.navItem, active && { backgroundColor: colors.isDark ? 'rgba(249, 115, 22, 0.15)' : 'rgba(249, 115, 22, 0.08)' }]}>
                <MaterialCommunityIcons 
                  name={key === 'home' ? 'home-outline' : key === 'accounting' ? 'calculator-variant-outline' : 'cog-outline'} 
                  size={18} // ✅ تصغير الأيقونة
                  color={active ? colors.orange : colors.textMuted} 
                  style={{ marginBottom: 2 }} // ✅ تقليل المسافة بين الأيقونة والنص
                />
                <Text style={active ? [styles.navTextActive, { color: colors.orange, fontSize: 12 }] : [styles.navText, { color: colors.textMuted, fontSize: 12 }]}>
                  {label}
                </Text>
              </Pressable>`;

// استبدال البلوك القديم بالجديد
if (oldNavItem.test(code)) {
    code = code.replace(oldNavItem, newNavItem);
    fs.writeFileSync('app/index.tsx', code);
    console.log("✅ تم تصغير الأيقونات وجعلها خفيفة وعصرية!");
} else {
    console.log("⚠️ لم يتم العثور على الكود السابق، قد يكون تم تعديله يدوياً.");
}
