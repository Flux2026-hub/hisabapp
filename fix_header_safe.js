const fs = require('fs');
let code = fs.readFileSync('app/index.tsx', 'utf8');

// 1. إضافة استيراد التدرج اللوني إذا لم يكن موجوداً
if (!code.includes("expo-linear-gradient")) {
    code = code.replace('import { MaterialCommunityIcons } from "@expo/vector-icons";', 'import { MaterialCommunityIcons } from "@expo/vector-icons";\nimport { LinearGradient } from "expo-linear-gradient";');
}

// 2. البحث عن الهيدر القديم واستبداله بالنص المباشر
const oldHeader = `<View style={[styles.header, { backgroundColor: colors.navy }]}>
        <View style={styles.brandRow}>
          <Image source={require("../assets/images/flux-logo.png")} style={styles.logo} resizeMode="contain" />

          <Pressable style={styles.searchBtn} onPress={() => setSearchOpen(true)}>
            <MaterialCommunityIcons name="magnify" size={26} color="#FFF" />
          </Pressable>

          <View style={styles.brandTextWrap}>
            <Text style={styles.brandName}>فلوكس</Text>
            <Text style={styles.brandSub}>لأنابيب أكثر نظافة</Text>
          </View>
        </View>
      </View>`;

const newHeader = `<LinearGradient
        colors={['#051A34', '#0B2545', '#1A3B6B']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <View style={styles.brandRow}>
          <Image source={require("../assets/images/flux-logo.png")} style={styles.logo} resizeMode="contain" />
          <View style={styles.brandTextWrap}>
            <Text style={styles.brandName}>فلوكس</Text>
            <Text style={styles.brandSub}>لأنابيب أكثر نظافة</Text>
          </View>
        </View>
      </LinearGradient>`;

// استبدال الهيدر
code = code.replace(oldHeader, newHeader);

// 3. تعديل الستايلات (الخط والشعار)
code = code.replace(/header: \{ paddingHorizontal: 18, paddingVertical: 20, paddingTop: 26 \}/, "header: { paddingHorizontal: 20, paddingVertical: 20, paddingTop: 35, borderBottomLeftRadius: 20, borderBottomRightRadius: 20, elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 5 }");
code = code.replace(/brandRow: \{ flexDirection: "row-reverse", alignItems: "center", justifyContent: "flex-start", gap: 15 \}/, 'brandRow: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", width: "100%" }');
code = code.replace(/brandTextWrap: \{ alignItems: "flex-end", flex: 1 \}/, 'brandTextWrap: { alignItems: "flex-end" }');
code = code.replace(/brandName: \{ fontFamily: FONTS\.heading, color: "#FFF", fontSize: 22, textAlign: "right" \}/, 'brandName: { fontFamily: FONTS.heading, color: "#FFF", fontSize: 22, textAlign: "left" }');
code = code.replace(/brandSub: \{ fontFamily: "Alexandria-Regular", color: "#94A3B8", fontSize: 11, textAlign: "right", marginTop: -2 \}/, 'brandSub: { fontFamily: "Alexandria-Regular", color: "#94A3B8", fontSize: 11, textAlign: "left", marginTop: 2 }');
code = code.replace(/logo: \{ width: 90, height: 70 \}/, 'logo: { width: 100, height: 75 }');

fs.writeFileSync('app/index.tsx', code);
console.log("✅ تم التعديل بأمان!");
