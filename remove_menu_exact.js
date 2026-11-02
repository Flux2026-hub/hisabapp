const fs = require('fs');
let code = fs.readFileSync('app/index.tsx', 'utf8');

// هذا هو النص المطابق تماماً لما أرسلته لي (الفاصل + زر القائمة)
const targetString = `          <View style={{ width: 1, height: 20, backgroundColor: colors.border, marginHorizontal: 8 }} />
          <Pressable style={styles.menuButton} onPress={() => setMenuOpen((v) => !v)}>
            <MaterialCommunityIcons name="menu" size={24} color={colors.text} />
          </Pressable>`;

if (code.includes(targetString)) {
    code = code.replace(targetString, ''); // حذف النص
    fs.writeFileSync('app/index.tsx', code);
    console.log("✅ تم حذف زر القائمة والفاصل بنجاح، وبقيت أيقونة البحث فقط!");
} else {
    console.log("⚠️ لم يتم العثور على النص المطابق. يرجى إبلاغي.");
}
