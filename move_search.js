const fs = require('fs');
let code = fs.readFileSync('app/index.tsx', 'utf8');

// 1. إزالة أيقونة البحث من الهيدر
code = code.replace(/<Pressable onPress=\{\(\) => setSearchOpen\(true\)\} style=\{\{ padding: 8 \}\}>\s*<MaterialCommunityIcons name="magnify" size=\{26\} color="#FFF" \/>\s*<\/Pressable>/, '');

// 2. إضافة زر البحث في الشريط السفلي قبل الإعدادات
const searchTab = `
        <Pressable onPress={() => setSearchOpen(true)} style={styles.navItem}>
          <View style={styles.navIconWrapper}>
            <MaterialCommunityIcons name="magnify" size={24} color={colors.textMuted} />
          </View>
          <Text style={[styles.navText, { color: colors.textMuted, fontFamily: "Alexandria-Regular" }]}>البحث</Text>
        </Pressable>
`;
code = code.replace(
  '<Pressable onPress={() => go("settings")} style={styles.navItem}>',
  searchTab + '\n        <Pressable onPress={() => go("settings")} style={styles.navItem}>'
);

fs.writeFileSync('app/index.tsx', code);
console.log("✅ تم نقل زر البحث إلى الشريط السفلي بنجاح!");
