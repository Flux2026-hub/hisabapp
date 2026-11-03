const fs = require('fs');
let code = fs.readFileSync('app/index.tsx', 'utf8');

// 1. استيراد الأدوات اللازمة
if (!code.includes("AsyncStorage")) {
    code = code.replace('import { useEffect, useState } from "react";', 'import { useEffect, useState, useRef } from "react";\nimport AsyncStorage from "@react-native-async-storage/async-storage";\nimport { Animated } from "react-native";');
}

// 2. إضافة متغيرات الحالة والحركة
code = code.replace(
    "const [searchOpen, setSearchOpen] = useState(false);", 
    "const [searchOpen, setSearchOpen] = useState(false);\n  const [pinNavbar, setPinNavbar] = useState(false);\n  const scrollY = useRef(new Animated.Value(0)).current;"
);

// 3. قراءة الإعدادات عند فتح الشاشة
const effectTarget = `useEffect(() => {
    const fetchKPIs = async () => {`;
const effectReplacement = `useEffect(() => {
    // قراءة إعداد تثبيت الشريط
    AsyncStorage.getItem("flux_settings_v1").then(raw => {
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.pinNavbar !== undefined) setPinNavbar(parsed.pinNavbar);
      }
    });
  }, [tab]);

  useEffect(() => {
    const fetchKPIs = async () => {`;
code = code.replace(effectTarget, effectReplacement);

// 4. إعداد حركة الإخفاء والظهور
code = code.replace("return (\n    <SafeAreaView", `// إعداد حركة الإخفاء (Clamp يمنع الشريط من الخروج عن الحدود)
  const diffClamp = Animated.diffClamp(scrollY, 0, 80);
  const translateY = diffClamp.interpolate({
    inputRange: [0, 80],
    outputRange: [0, -80], // يختفي للأعلى بمقدار 80 بكسل
  });

  // إذا كان الإعداد "تثبيت" فارغة (لا حركة)، وإلا نطبق الحركة
  const navAnimatedStyle = pinNavbar ? {} : { transform: [{ translateY }] };

  return (
    <SafeAreaView`);

// 5. تحويل شريط التنقل إلى Animated.View
code = code.replace(
    '<View style={[styles.nav, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>', 
    '<Animated.View style={[styles.nav, { backgroundColor: colors.surface, borderBottomColor: colors.border }, navAnimatedStyle]}>'
);
// إغلاق الـ Animated.View
code = code.replace(
    `      </View>\n\n      {menuOpen && <Pressable style={styles.overlay}`,
    `      </Animated.View>\n\n      {menuOpen && <Pressable style={styles.overlay}`
);

// 6. تحويل ScrollView إلى Animated.ScrollView وربط التمرير
code = code.replace(
    '<ScrollView contentContainerStyle={[styles.scrollBackground, isDesktop && styles.desktopContent]} keyboardShouldPersistTaps="handled">',
    '<Animated.ScrollView \n        contentContainerStyle={[styles.scrollBackground, isDesktop && styles.desktopContent]} \n        keyboardShouldPersistTaps="handled"\n        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}\n        scrollEventThrottle={16}\n      >'
);
// إغلاق الـ ScrollView
const lastScrollIndex = code.lastIndexOf("</ScrollView>");
if (lastScrollIndex !== -1) {
    code = code.substring(0, lastScrollIndex) + "</Animated.ScrollView>" + code.substring(lastScrollIndex + 13);
}

fs.writeFileSync('app/index.tsx', code);
console.log("✅ تم تفعيل حركة إخفاء شريط التنقل بنجاح!");
