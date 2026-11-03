const fs = require('fs');
let code = fs.readFileSync('app/index.tsx', 'utf8');

// 1. تحديث شكل أزرار التنقل في الـ JSX لإضافة أيقونات
const oldNavItem = `<Pressable key={key} onPress={() => go(key)} style={styles.navItem}>
                <Text style={active ? [styles.navTextActive, { color: colors.orange }] : [styles.navText, { color: colors.textMuted }]}>
                  {label}
                </Text>
                {active && <View style={[styles.activeIndicator, { backgroundColor: colors.orange }]} />}
              </Pressable>`;

const newNavItem = `<Pressable key={key} onPress={() => go(key)} style={[styles.navItem, active && { backgroundColor: colors.isDark ? 'rgba(249, 115, 22, 0.2)' : 'rgba(249, 115, 22, 0.1)' }]}>
                <MaterialCommunityIcons 
                  name={key === 'home' ? 'home-outline' : key === 'accounting' ? 'calculator-variant-outline' : 'cog-outline'} 
                  size={20} 
                  color={active ? colors.orange : colors.textMuted} 
                  style={{ marginBottom: 4 }}
                />
                <Text style={active ? [styles.navTextActive, { color: colors.orange }] : [styles.navText, { color: colors.textMuted }]}>
                  {label}
                </Text>
              </Pressable>`;

code = code.replace(oldNavItem, newNavItem);

// 2. تعديل التنسيقات (Styles) لجعل الأزرار تبدو كأقراص دواء (Pills) وتوسيط العناصر
code = code.replace(/navItem: \{ alignItems: "center", paddingVertical: 8, paddingHorizontal: 16, position: "relative" \}/, 'navItem: { alignItems: "center", justifyContent: "center", paddingVertical: 8, paddingHorizontal: 16, borderRadius: 12, marginHorizontal: 4, flexDirection: "column" }');

// إخفاء الخط البرتقالي السفلي القديم لأنه لم يعد ضرورياً مع الخلفية الجديدة
code = code.replace(/{active && <View style={\[styles\.activeIndicator, \{ backgroundColor: colors\.orange \}\]} \/>}/g, '');

fs.writeFileSync('app/index.tsx', code);
console.log("✅ تم تحديث شريط التنقل بأيقونات عصرية وخلفيات تفاعلية!");
