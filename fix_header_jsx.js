const fs = require('fs');
let code = fs.readFileSync('app/index.tsx', 'utf8');

// نبحث عن كتلة الهيدر بالكامل (LinearGradient) ونستبدلها بالكود السليم
const headerRegex = /<LinearGradient[\s\S]*?<\/LinearGradient>/;
const newHeader = `<LinearGradient
        colors={['#051A34', '#0B2545', '#133A68', '#0B2545']}
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

if (headerRegex.test(code)) {
    code = code.replace(headerRegex, newHeader);
    fs.writeFileSync('app/index.tsx', code);
    console.log("✅ تم إصلاح الهيدر بنجاح وإعادة النص لليسار!");
} else {
    console.log("⚠️ لم يتم العثور على الهيدر. يرجى إبلاغي.");
}
