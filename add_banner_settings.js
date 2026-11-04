const fs = require('fs');
let code = fs.readFileSync('src/ui/SettingsModule.tsx', 'utf8');

// 1. إضافة الاستيرادات
if (!code.includes("ImagePicker")) {
    code = code.replace('import AsyncStorage from "@react-native-async-storage/async-storage";', 'import AsyncStorage from "@react-native-async-storage/async-storage";\nimport * as ImagePicker from "expo-image-picker";\nimport * as FileSystem from "expo-file-system/legacy";\nimport { BANNER_IMAGE_KEY_1, BANNER_IMAGE_KEY_2 } from "./components/PromoCarousel";');
}

// 2. إضافة دالة رفع الصورة
const pickBannerFunc = `
  const pickBanner = async (index: number) => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
      base64: true, // ✅ الطريقة المضمونة
    });

    if (!result.canceled && result.assets[0].base64) {
      const dest = FileSystem.documentDirectory + \`banner_\${index}_\${Date.now()}.jpg\`;
      try {
        await FileSystem.writeAsStringAsync(dest, result.assets[0].base64, { encoding: FileSystem.EncodingType.Base64 });
        await AsyncStorage.setItem(index === 0 ? BANNER_IMAGE_KEY_1 : BANNER_IMAGE_KEY_2, dest);
        Alert.alert("نجاح", "تم حفظ صورة البانر بنجاح!");
      } catch (e) {
        Alert.alert("خطأ", "تعذر حفظ الصورة: " + String(e));
      }
    }
  };
`;

code = code.replace('const save = async () => {', pickBannerFunc + '\n  const save = async () => {');

// 3. إضافة الأزرار في تبويب المظهر
const targetRender = `<Text style={styles.sectionLabel}>لون الخلفية (الوضع النهاري)</Text>`;
const newRender = `
            <Text style={styles.sectionLabel}>إعلانات لوحة التحكم (البانر)</Text>
            <Text style={styles.backupHint}>اختر صورتين تظهران في أعلى الشاشة الرئيسية.</Text>
            <Pressable style={styles.backupBtn} onPress={() => pickBanner(0)}>
              <Text style={styles.backupBtnText}>🖼️ اختيار الصورة الأولى</Text>
            </Pressable>
            <Pressable style={[styles.backupBtn, { backgroundColor: COLORS.textMuted, marginTop: 8 }]} onPress={() => pickBanner(1)}>
              <Text style={styles.backupBtnText}>🖼️ اختيار الصورة الثانية</Text>
            </Pressable>

            <Text style={styles.sectionLabel}>لون الخلفية (الوضع النهاري)</Text>
`;

code = code.replace(targetRender, newRender);
fs.writeFileSync('src/ui/SettingsModule.tsx', code);
console.log("✅ تم إضافة أزرار اختيار الصور في الإعدادات!");
