const fs = require('fs');
const path = 'src/ui/SettingsModule.tsx';
let c = fs.readFileSync(path, 'utf8');

c = c.replace('reportShowLogo: boolean;', 'reportShowLogo: boolean;\n  darkMode: boolean;\n  lightBgColor: string;');
c = c.replace('reportShowLogo: true,', 'reportShowLogo: true,\n  darkMode: false,\n  lightBgColor: "#FFFFFF",');
c = c.replace('type Tab = "company" | "invoices" | "reports";', 'type Tab = "company" | "invoices" | "reports" | "appearance";');

// إضافة التبويب
c = c.replace(/(<Pressable\s+style={\[styles\.tab, activeTab === "reports" && styles\.tabActive\]}[\s\S]*?<\/Pressable>)/, `$1
          <Pressable
            style={[styles.tab, activeTab === "appearance" && styles.tabActive]}
            onPress={() => setActiveTab("appearance")}
          >
            <Text style={[styles.tabText, activeTab === "appearance" && styles.tabTextActive]}>
              المظهر
            </Text>
          </Pressable>`);

// إضافة الواجهة
const appearanceUI = `
        {activeTab === "appearance" && (
          <View>
            <Text style={styles.sectionLabel}>الوضع الليلي</Text>
            <SwitchRow
              label="تفعيل الوضع الليلي (Dark Mode)"
              value={settings.darkMode}
              onChange={(v) => update("darkMode", v)}
            />

            <Text style={styles.sectionLabel}>لون الخلفية (الوضع النهاري)</Text>
            <Text style={styles.backupHint}>اختر اللون الذي يريح عينيك للاستخدام في النهار.</Text>
            <View style={{ flexDirection: "row-reverse", flexWrap: "wrap", gap: 12, marginTop: 10 }}>
              {[
                { color: "#FFFFFF", name: "أبيض" },
                { color: "#F8FAFC", name: "رمادي فاتح" },
                { color: "#EFF6FF", name: "أزرق فاتح" },
                { color: "#F0FDF4", name: "أخضر فاتح" },
                { color: "#FDFBF7", name: "بيج دافئ" },
              ].map((item) => (
                <Pressable
                  key={item.color}
                  onPress={() => update("lightBgColor", item.color)}
                  style={{ alignItems: "center", gap: 5 }}
                >
                  <View style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: item.color, borderWidth: settings.lightBgColor === item.color ? 3 : 1, borderColor: settings.lightBgColor === item.color ? COLORS.blue : COLORS.border }} />
                  <Text style={{ fontSize: 10, color: COLORS.textMuted }}>{item.name}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        <View style={styles.buttons}>`;

c = c.replace('<View style={styles.buttons}>', appearanceUI);
fs.writeFileSync(path, c);
console.log('✅ الخطوة 3: تم إضافة واجهة المظهر');
