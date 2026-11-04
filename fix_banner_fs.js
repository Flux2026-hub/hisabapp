const fs = require('fs');
let code = fs.readFileSync('src/ui/SettingsModule.tsx', 'utf8');

// حذف دالة pickBanner القديمة
const oldPickBanner = code.match(/const pickBanner = async \(index: number\) => \{[\s\S]*?\n  \};/);
if (oldPickBanner) code = code.replace(oldPickBanner[0], '');

// إضافة الدالة الجديدة باستخدام FileSystem
const newPickBanner = `
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
        // نسخ الصورة إلى مجلد التطبيق الدائم
        await FileSystem.copyAsync({ from: result.assets[0].uri, to: dest });
        await AsyncStorage.setItem(index === 0 ? BANNER_IMAGE_KEY_1 : BANNER_IMAGE_KEY_2, dest);
        Alert.alert("نجاح", "تم حفظ صورة البانر بنجاح! اذهب للرئيسية لتشاهدها.");
      } catch (e) {
        Alert.alert("خطأ", "تعذر حفظ الصورة: " + String(e));
      }
    }
  };
`;
code = code.replace('const save = async () => {', newPickBanner + '\n  const save = async () => {');
fs.writeFileSync('src/ui/SettingsModule.tsx', code);
console.log("✅ تم تحديث طريقة الحفظ إلى FileSystem!");
