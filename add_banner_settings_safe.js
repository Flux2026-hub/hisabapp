const fs = require('fs');
let file = 'src/ui/SettingsModule.tsx';
let code = fs.readFileSync(file, 'utf8');

// 1. إضافة الاستيرادات
if (!code.includes("ImagePicker")) {
    code = code.replace('import AsyncStorage from "@react-native-async-storage/async-storage";', 'import AsyncStorage from "@react-native-async-storage/async-storage";\nimport * as ImagePicker from "expo-image-picker";\nimport * as FileSystem from "expo-file-system/legacy";\nimport { BANNER_IMAGE_KEY_1, BANNER_IMAGE_KEY_2 } from "./components/PromoCarousel";');
}

// 2. إضافة دالة pickBanner
const pickBannerCode = `
  const pickBanner = async (index: number) => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });

    if (!result.canceled) {
      const dest = FileSystem.documentDirectory + \`banner_\${index}_\${Date.now()}.jpg\`;
      try {
        await FileSystem.copyAsync({ from: result.assets[0].uri, to: dest });
        await AsyncStorage.setItem(index === 0 ? BANNER_IMAGE_KEY_1 : BANNER_IMAGE_KEY_2, dest);
        Alert.alert("نجاح", "تم حفظ صورة البانر بنجاح! اذهب للرئيسية لتشاهدها.");
      } catch (e) {
        Alert.alert("خطأ", "تعذر حفظ الصورة: " + String(e));
      }
    }
  };
`;
if (!code.includes("const pickBanner")) {
    code = code.replace('const save = async () => {', pickBannerCode + '\n  const save = async () => {');
}

// 3. إضافة الأزرار في تبويب المظهر
const targetUI = `<Text style={styles.sectionLabel}>لون الخلفية (الوضع النهاري)</Text>`;
const newUI = `
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
if (!code.includes("اختيار الصورة الأولى")) {
    code = code.replace(targetUI, newUI);
}

fs.writeFileSync(file, code);
console.log("✅ تم إضافة أزرار البانر في الإعدادات بنجاح!");
