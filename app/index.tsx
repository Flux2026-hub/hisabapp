import { useState } from "react";
import {
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import AccountingModule from "../src/ui/AccountingModule";
import SettingsModule from "../src/ui/SettingsModule";

const colors = {
  navy: "#0B2545",
  blue: "#1E40AF",
  orange: "#F97316",
  ink: "#0F172A",
  muted: "#8494B0",
  bg: "#F1F5F9",
  card: "#FFFFFF",
  line: "#D6E3F8",
};

type Tab = "home" | "accounting" | "settings";

const sections: Array<[Tab, string]> = [
  ["home", "الرئيسية"],
  ["accounting", "المحاسبة"],
  ["settings", "الإعدادات"],
];

export default function HomeScreen() {
  const [tab, setTab] = useState<Tab>("home");
  const [menuOpen, setMenuOpen] = useState(false);

  const go = (next: Tab) => {
    setTab(next);
    setMenuOpen(false);
  };

  return (
    <SafeAreaView style={styles.root}>
      {/* ===== الهيدر بخلفية فلوكس الداكنة ===== */}
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <View style={styles.brandTextWrap}>
            <Text style={styles.brandName}>فلوكس</Text>
            <Text style={styles.brandSub}>مسلك مجاري</Text>
          </View>
          <Image
            source={require("../assets/images/flux-logo.png")}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>
      </View>

      {/* ===== شريط التبويبات ===== */}
      <View style={styles.nav}>
        <Pressable
          style={styles.menuButton}
          onPress={() => setMenuOpen((v) => !v)}
        >
          <Text style={styles.menuText}>☰ الأقسام</Text>
        </Pressable>
        {sections.map(([key, label]) => (
          <Pressable
            key={key}
            onPress={() => go(key)}
            style={[styles.navItem, tab === key && styles.navActive]}
          >
            <Text style={tab === key ? styles.navTextActive : styles.navText}>
              {label}
            </Text>
          </Pressable>
        ))}
      </View>

      {menuOpen && (
        <View style={styles.dropdown}>
          {sections.map(([key, label]) => (
            <Pressable
              key={key}
              onPress={() => go(key)}
              style={styles.dropdownItem}
            >
              <Text style={styles.dropdownText}>{label}</Text>
            </Pressable>
          ))}
        </View>
      )}

      <ScrollView contentContainerStyle={styles.content}>
        {tab === "home" && (
          <>
            <Text style={styles.title}>لوحة التحكم</Text>
            <Text style={styles.hint}>
              البيانات محفوظة على الجهاز وتعمل بدون إنترنت
            </Text>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>إجراءات سريعة</Text>
              <Action
                label="المحاسبة والإدارة"
                sub="العملاء · الموردون · الفواتير · السندات · التقارير"
                onPress={() => go("accounting")}
              />
              <Action
                label="إعدادات التقارير"
                sub="ترويسة التقرير واللوجو والتذييل"
                onPress={() => go("settings")}
              />
            </View>
          </>
        )}

        {tab === "accounting" && (
          <>
            <Text style={styles.title}>المحاسبة والإدارة</Text>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>الوحدات المحاسبية</Text>
              <AccountingModule />
            </View>
          </>
        )}

        {tab === "settings" && (
          <>
            <Text style={styles.title}>الإعدادات</Text>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>إعدادات التقارير</Text>
              <SettingsModule onBack={() => go("home")} />
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Action({
  label,
  sub,
  onPress,
}: {
  label: string;
  sub: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.action}>
      <Text style={styles.actionArrow}>←</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.actionLabel}>{label}</Text>
        <Text style={styles.small}>{sub}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },

  // ===== الهيدر =====
  header: {
    backgroundColor: colors.navy,
    paddingHorizontal: 18,
    paddingVertical: 20,
    paddingTop: 26,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  brandTextWrap: {
    alignItems: "flex-end",
  },
  brandName: {
    color: "#FFFFFF",
    fontSize: 26,
    fontWeight: "800",
    textAlign: "right",
  },
  brandSub: {
    color: "#D6E3F8",
    fontSize: 12,
    textAlign: "right",
    marginTop: 3,
    fontWeight: "600",
  },
  logo: {
    width: 100,
    height: 80,
  },

  // ===== المحتوى =====
  content: { padding: 16, paddingBottom: 40 },
  title: {
    color: colors.ink,
    fontSize: 24,
    fontWeight: "800",
    textAlign: "right",
    marginTop: 7,
  },
  hint: {
    color: colors.muted,
    fontSize: 12,
    textAlign: "right",
    marginVertical: 8,
  },

  // ===== التبويبات =====
  nav: {
    flexDirection: "row-reverse",
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    paddingVertical: 10,
    alignItems: "center",
  },
  menuButton: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: colors.navy,
    borderRadius: 8,
    marginHorizontal: 4,
  },
  menuText: { color: "#FFFFFF", fontSize: 10, fontWeight: "700" },
  navItem: { flex: 1, alignItems: "center", paddingVertical: 6 },
  navActive: {
    borderBottomWidth: 3,
    borderBottomColor: colors.orange,
  },
  navText: { color: colors.muted, fontSize: 11, fontWeight: "600" },
  navTextActive: {
    color: colors.blue,
    fontWeight: "800",
    fontSize: 11,
  },

  // ===== القائمة المنسدلة =====
  dropdown: {
    position: "absolute",
    top: 130,
    right: 8,
    zIndex: 20,
    elevation: 8,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    width: 210,
    shadowColor: "#0B2545",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
  },
  dropdownItem: {
    padding: 13,
    borderBottomWidth: 1,
    borderBottomColor: colors.bg,
  },
  dropdownText: {
    textAlign: "right",
    fontWeight: "700",
    color: colors.ink,
  },

  // ===== البطاقات =====
  card: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1.2,
    borderColor: colors.line,
    padding: 16,
    marginTop: 14,
    shadowColor: "#0B2545",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  cardTitle: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "800",
    textAlign: "right",
    marginBottom: 10,
  },

  // ===== الأزرار السريعة =====
  action: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  actionLabel: {
    color: colors.ink,
    fontWeight: "700",
    textAlign: "right",
    fontSize: 14,
  },
  actionArrow: { color: colors.orange, fontSize: 22, fontWeight: "700" },
  small: {
    color: colors.muted,
    fontSize: 11,
    textAlign: "right",
    marginTop: 3,
  },
});
