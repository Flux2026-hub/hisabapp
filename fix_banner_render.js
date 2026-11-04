const fs = require('fs');

// 1. إصلاح SettingsModule
let settingsCode = fs.readFileSync('src/ui/SettingsModule.tsx', 'utf8');
const base64Code = `
  const pickBanner = async (index: number) => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
      base64: true,
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

const copyCode = `
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
        Alert.alert("نجاح", "تم حفظ صورة البانر بنجاح!");
      } catch (e) {
        Alert.alert("خطأ", "تعذر حفظ الصورة: " + String(e));
      }
    }
  };
`;
settingsCode = settingsCode.replace(base64Code, copyCode);
fs.writeFileSync('src/ui/SettingsModule.tsx', settingsCode);

// 2. إصلاح PromoCarousel (إضافة refreshTrigger)
let carouselCode = fs.readFileSync('src/ui/components/PromoCarousel.tsx', 'utf8');
carouselCode = carouselCode.replace(
  'export default function PromoCarousel() {',
  'export default function PromoCarousel({ refreshTrigger }: { refreshTrigger?: any }) {'
);
carouselCode = carouselCode.replace(
  `  useEffect(() => {
    loadImages();
  }, []);`,
  `  useEffect(() => {
    loadImages();
  }, [refreshTrigger]);`
);
fs.writeFileSync('src/ui/components/PromoCarousel.tsx', carouselCode);

// 3. تحديث app/index.tsx لتمرير refreshTrigger
let indexCode = fs.readFileSync('app/index.tsx', 'utf8');
indexCode = indexCode.replace(
  '<PromoCarousel />',
  '<PromoCarousel refreshTrigger={tab} />'
);
fs.writeFileSync('app/index.tsx', indexCode);

console.log("✅ تم إصلاح طريقة حفظ وعرض الصور!");
