const fs = require('fs');
let code = fs.readFileSync('app/index.tsx', 'utf8');
let original = code;

// 1. إضافة الاستيرادات
if (!code.includes('import { Animated }')) {
    code = code.replace('import { BackHandler, Image, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View, Dimensions, useWindowDimensions } from "react-native";', 'import { BackHandler, Image, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View, Dimensions, useWindowDimensions, Animated } from "react-native";\nimport { useRef } from "react";');
}

// 2. إضافة متغيرات الحركة
const targetVar = 'const [menuOpen, setMenuOpen] = useState(false);';
const newVar = 'const [menuOpen, setMenuOpen] = useState(false);\n  const scrollY = useRef(new Animated.Value(0)).current;\n  const diffClamp = Animated.diffClamp(scrollY, 0, 120);\n  const translateY = diffClamp.interpolate({ inputRange: [0, 120], outputRange: [0, -120] });\n  const navAnimatedStyle = { transform: [{ translateY }] };';
if (code.includes(targetVar)) {
    code = code.replace(targetVar, newVar);
}

// 3. حذف زر القائمة وتحويل الشريط إلى Animated
const oldNavStart = `<View style={[styles.nav, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>`;
const newNavStart = `<Animated.View style={[styles.nav, { backgroundColor: colors.surface, borderBottomColor: colors.border, position: "absolute", top: 120, left: 0, right: 0, zIndex: 1 }, navAnimatedStyle]}>`;
if (code.includes(oldNavStart)) {
    code = code.replace(oldNavStart, newNavStart);
}

// حذف زر القائمة والفاصل
const oldMenuBtn = `          <View style={{ width: 1, height: 20, backgroundColor: colors.border, marginHorizontal: 8 }} />
          <Pressable style={styles.menuButton} onPress={() => setMenuOpen((v) => !v)}>
            <MaterialCommunityIcons name="menu" size={24} color={colors.text} />
          </Pressable>`;
if (code.includes(oldMenuBtn)) {
    code = code.replace(oldMenuBtn, '');
}

// إغلاق Animated.View
const oldNavEnd = `</View>\n\n      {menuOpen && <Pressable style={styles.overlay}`;
const newNavEnd = `</Animated.View>\n\n      {menuOpen && <Pressable style={styles.overlay}`;
if (code.includes(oldNavEnd)) {
    code = code.replace(oldNavEnd, newNavEnd);
}

// 4. تحويل ScrollView إلى Animated.ScrollView
const oldScroll = `<ScrollView contentContainerStyle={[styles.scrollBackground, isDesktop && styles.desktopContent]} keyboardShouldPersistTaps="handled">`;
const newScroll = `<Animated.ScrollView 
        contentContainerStyle={[styles.scrollBackground, isDesktop && styles.desktopContent, { paddingTop: 190 }]} 
        keyboardShouldPersistTaps="handled"
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
        scrollEventThrottle={16}
      >`;
if (code.includes(oldScroll)) {
    code = code.replace(oldScroll, newScroll);
    // استبدال إغلاق الـ ScrollView الرئيسي فقط (الذي يسبقه مسافات)
    code = code.replace(`      </ScrollView>\n    </SafeAreaView>`, `      </Animated.ScrollView>\n    </SafeAreaView>`);
}

// 5. تحديث التنسيقات (Z-Index)
code = code.replace(/header: \{ paddingHorizontal: 18, paddingVertical: 20, paddingTop: 26 \}/, "header: { paddingHorizontal: 18, paddingVertical: 20, paddingTop: 40, zIndex: 10, elevation: 10 }");
code = code.replace(/nav: \{ flexDirection: "row", borderBottomWidth: 1, paddingVertical: 8, alignItems: "center", paddingHorizontal: 12, shadowColor: "#000", shadowOffset: \{ width: 0, height: 2 \}, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2, zIndex: 5 \}/, 'nav: { flexDirection: "row", borderBottomWidth: 1, paddingVertical: 8, alignItems: "center", paddingHorizontal: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1, zIndex: 1 }');

if (code !== original) {
    fs.writeFileSync('app/index.tsx', code);
    console.log("✅ تم التعديل بنجاح! (حذف زر القائمة وإضافة حركة الإخفاء)");
} else {
    console.log("⚠️ لم يتم العثور على النص المطابق. الملف لم يتغير.");
}
