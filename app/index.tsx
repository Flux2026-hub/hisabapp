import { useEffect, useState } from "react";
import {
  BackHandler,
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
import { COLORS, FONTS } from "../src/ui/theme";

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

  useEffect(() => {
    const onBackPress = () => {
      if (menuOpen) {
        setMenuOpen(false);
        return true;
      }
      if (tab !== "home") {
        setTab("home");
        return true;
      }
      return false;
    };
    const sub = BackHandler.addEventListener("hardwareBackPress", onBackPress);
    return () => sub.remove();
  }, [tab, menuOpen]);

  return (
    <SafeAreaView style={styles.root}>
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

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
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
  root: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    backgroundColor: COLORS.navy,
    paddingHorizontal: 18,
    paddingVertical: 20,
    paddingTop: 26,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  brandTextWrap: { alignItems: "flex-end" },
  brandName: {
    fontFamily: FONTS.heading,
    color: "#FFF",
    fontSize: 28,
    textAlign: "right",
  },
  brandSub: {
    fontFamily: FONTS.subheading,
    color: COLORS.blueSoft,
    fontSize: 12,
    textAlign: "right",
    marginTop: 3,
  },
  logo: { width: 100, height: 80 },
  content: { padding: 16, paddingBottom: 40 },
  title: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: "800",
    textAlign: "right",
    marginTop: 7,
  },
  hint: {
    color: COLORS.textMuted,
    fontSize: 12,
    textAlign: "right",
    marginVertical: 8,
  },
  nav: {
    flexDirection: "row",
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingVertical: 10,
    alignItems: "center",
  },
  menuButton: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: COLORS.navy,
    borderRadius: 8,
    marginHorizontal: 4,
  },
  menuText: { color: "#FFF", fontSize: 10, fontWeight: "700" },
  navItem: { flex: 1, alignItems: "center", paddingVertical: 6 },
  navActive: { borderBottomWidth: 3, borderBottomColor: COLORS.orange },
  navText: { color: COLORS.textMuted, fontSize: 11, fontWeight: "600" },
  navTextActive: { color: COLORS.blue, fontWeight: "800", fontSize: 11 },
  dropdown: {
    position: "absolute",
    top: 130,
    right: 8,
    zIndex: 20,
    elevation: 8,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    width: 210,
  },
  dropdownItem: {
    padding: 13,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.bg,
  },
  dropdownText: { textAlign: "right", fontWeight: "700", color: COLORS.text },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    borderWidth: 1.2,
    borderColor: COLORS.border,
    padding: 16,
    marginTop: 14,
  },
  cardTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "800",
    textAlign: "right",
    marginBottom: 10,
  },
  action: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  actionLabel: {
    color: COLORS.text,
    fontWeight: "700",
    textAlign: "right",
    fontSize: 14,
  },
  actionArrow: { color: COLORS.orange, fontSize: 22, fontWeight: "800" },
  small: {
    color: COLORS.textMuted,
    fontSize: 11,
    textAlign: "right",
    marginTop: 3,
  },
});
