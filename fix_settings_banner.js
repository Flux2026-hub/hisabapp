const fs = require('fs');
let code = fs.readFileSync('src/ui/SettingsModule.tsx', 'utf8');

// حذف دالة pickBanner القديمة
const oldPickBanner = code.match(/const pickBanner = async \(index: number\) => \{[\s\S]*?\n  \};/);
if (oldPickBanner) {
    code = code.replace(oldPickBanner[0], '');
}

// إضافة دالة pickBanner الجديدة (Base64)
const newPickBanner = `
  const pickBanner = async (index: number) => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.6,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      try {
        const base64Image = \`data:image/jpeg;base64,\${result.assets[0].base64}\`;
        await AsyncStorage.setItem(index === 0 ? BANNER_IMAGE_KEY_1 : BANNER_IMAGE_KEY_2, base64Image);
        Alert.alert("نجاح", "تم حفظ صورة البانر بنجاح! اذهب للرئيسية لتشاهدها.");
      } catch (e) {
        Alert.alert("خطأ", "تعذر حفظ الصورة: " + String(e));
      }
    }
  };
`;

code = code.replace('const save = async () => {', newPickBanner + '\n  const save = async () => {');
fs.writeFileSync('src/ui/SettingsModule.tsx', code);
console.log("✅ تم تحديث دالة حفظ الصور!");
