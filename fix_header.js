const fs = require('fs');
let code = fs.readFileSync('app/index.tsx', 'utf8');

// 1. إزالة أيقونة البحث من الشريط الأزرق
code = code.replace(/<Pressable style=\{styles\.searchBtn\} onPress=\{\(\) => setSearchOpen\(true\)\}>\s*<MaterialCommunityIcons name="magnify" size=\{26\} color="#FFF" \/>\s*<\/Pressable>/, '');

// 2. تعديل ستايل الشعار والنص ليكونا في اليسار بجانب بعضهما
code = code.replace(/brandRow: \{ flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between" \}/, 'brandRow: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "flex-start", gap: 15 }');

// 3. استبدال زر القائمة في الشريط الأبيض بـ (بحث + فاصل + قائمة)
const oldMenu = `<Pressable style={styles.menuButton} onPress={() => setMenuOpen((v) => !v)}>
          <MaterialCommunityIcons name="menu" size={26} color={colors.text} />
        </Pressable>`;
        
const newMenu = `<View style={{ flexDirection: "row", alignItems: "center" }}>
          <Pressable style={styles.searchBtn} onPress={() => setSearchOpen(true)}>
            <MaterialCommunityIcons name="magnify" size={24} color={colors.text} />
          </Pressable>
          <View style={{ width: 1, height: 20, backgroundColor: colors.border, marginHorizontal: 8 }} />
          <Pressable style={styles.menuButton} onPress={() => setMenuOpen((v) => !v)}>
            <MaterialCommunityIcons name="menu" size={24} color={colors.text} />
          </Pressable>
        </View>`;

code = code.replace(oldMenu, newMenu);

fs.writeFileSync('app/index.tsx', code);
console.log("✅ تم تعديل الهيدر بنجاح!");
