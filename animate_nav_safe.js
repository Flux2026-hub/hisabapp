const fs = require('fs');
let code = fs.readFileSync('app/index.tsx', 'utf8');

// 1. إضافة useRef و Animated للاستيرادات إذا لم تكن موجودة
if (!code.includes('import { Animated }')) {
    code = code.replace('import { BackHandler, Image, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View, Dimensions, useWindowDimensions } from "react-native";', 'import { BackHandler, Image, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View, Dimensions, useWindowDimensions, Animated } from "react-native";\nimport { useRef } from "react";');
}

// 2. إضافة متغيرات الحركة داخل المكون
const targetVar = 'const [menuOpen, setMenuOpen] = useState(false);';
const newVar = 'const [menuOpen, setMenuOpen] = useState(false);\n  const scrollY = useRef(new Animated.Value(0)).current;\n  const diffClamp = Animated.diffClamp(scrollY, 0, 80);\n  const translateY = diffClamp.interpolate({ inputRange: [0, 80], outputRange: [0, -80] });\n  const navAnimatedStyle = { transform: [{ translateY }] };';
code = code.replace(targetVar, newVar);

// 3. تعديل شريط التنقل (تحويله إلى Animated وحذف زر القائمة)
const oldNav = `<View style={[styles.nav, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Pressable style={styles.searchBtn} onPress={() => setSearchOpen(true)}>
            <MaterialCommunityIcons name="magnify" size={24} color={colors.text} />
          </Pressable>
          <View style={{ width: 1, height: 20, backgroundColor: colors.border, marginHorizontal: 8 }} />
          <Pressable style={styles.menuButton} onPress={() => setMenuOpen((v) => !v)}>
            <MaterialCommunityIcons name="menu" size={24} color={colors.text} />
          </Pressable>
        </View>`;

const newNav = `<Animated.View style={[styles.nav, { backgroundColor: colors.surface, borderBottomColor: colors.border, position: "absolute", top: 0, left: 0, right: 0, zIndex: 4 }, navAnimatedStyle]}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Pressable style={styles.searchBtn} onPress={() => setSearchOpen(true)}>
            <MaterialCommunityIcons name="magnify" size={24} color={colors.text} />
          </Pressable>
        </View>`;

code = code.replace(oldNav, newNav);

// إغلاق الـ Animated.View بدلاً من View
code = code.replace(`</View>\n\n      {menuOpen && <Pressable style={styles.overlay}`, `</Animated.View>\n\n      {menuOpen && <Pressable style={styles.overlay}`);

// 4. تحويل ScrollView إلى Animated.ScrollView وإضافة حدث التمرير
const oldScroll = `<ScrollView contentContainerStyle={[styles.scrollBackground, isDesktop && styles.desktopContent]} keyboardShouldPersistTaps="handled">`;
const newScroll = `<Animated.ScrollView 
        contentContainerStyle={[styles.scrollBackground, isDesktop && styles.desktopContent, { paddingTop: 75 }]} 
        keyboardShouldPersistTaps="handled"
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
        scrollEventThrottle={16}
      >`;
code = code.replace(oldScroll, newScroll);
code = code.replace(`</ScrollView>`, `</Animated.ScrollView>`);

// 5. تعديل التنسيقات (Styles) لضبط zIndex
code = code.replace(/header: \{ paddingHorizontal: 18, paddingVertical: 20, paddingTop: 26 \}/, "header: { paddingHorizontal: 18, paddingVertical: 20, paddingTop: 26, zIndex: 10 }");
code = code.replace(/nav: \{ flexDirection: "row", borderBottomWidth: 1, paddingVertical: 8, alignItems: "center", paddingHorizontal: 12, shadowColor: "#000", shadowOffset: \{ width: 0, height: 2 \}, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2, zIndex: 5 \}/, 'nav: { flexDirection: "row", borderBottomWidth: 1, paddingVertical: 8, alignItems: "center", paddingHorizontal: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1, zIndex: 1 }');

fs.writeFileSync('app/index.tsx', code);
console.log("✅ تم تفعيل حركة الشريط وحذف زر القائمة بنجاح!");
