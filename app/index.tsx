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
      {/* الشريط العلوي */}
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <Image
            source={require("../assets/images/flux-logo.png")}
            style={styles.logo}
            resizeMode="contain"
          />
          <View style={styles.brandTextWrap}>
            <Text style={styles.brandName}>فلوكس</Text>
            <Text style={styles.brandSub}>لأنابيب أكثر نظافة</Text>
          </View>
        </View>
      </View>

      {/* شريط التبويبات */}
      <View style={styles.nav}>
        <Pressable
          style={styles.menuButton}
          onPress={() => setMenuOpen((v) => !v)}
        >
          <Text style={styles.menuText}>☰</Text>
        </Pressable>
        <View style={styles.navTabs}>
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
      </View>

      {/* القائمة المنسدلة */}
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

      {/* المحتوى */}
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
      <View style={{ flex: 1, alignItems: "flex-end" }}>
        <Text style={styles.actionLabel}>{label}</Text>
        <Text style={styles.small}>{sub}</Text>
      </View>
      <Text style={styles.actionArrow}>{"<-"}</Text>
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
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
  },
  brandTextWrap: { alignItems: "flex-end" },
  brandName: {
    fontFamily: FONTS.heading,
    color: "#FFF",
    fontSize: 24,
    textAlign: "right",
  },
  brandSub: {
    fontFamily: "Alexandria-Regular",
    color: "#94A3B8",
    fontSize: 11,
    textAlign: "right",
    marginTop: -2,
  },
  logo: { width: 90, height: 70 },
  content: { padding: 16, paddingBottom: 40 },
  title: {
    color: COLORS.text,
    fontSize: 24,
    textAlign: "right",
    marginTop: 7,
    fontFamily: "CodecBold",
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
    paddingHorizontal: 10,
  },
  navTabs: {
    flex: 1,
    flexDirection: "row-reverse",
    justifyContent: "space-around",
  },
  menuButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: COLORS.navy,
    borderRadius: 8,
  },
  menuText: { color: "#FFF", fontSize: 20, fontWeight: "700" },
  navItem: { alignItems: "center", paddingVertical: 6, paddingHorizontal: 12 },
  navActive: { borderBottomWidth: 3, borderBottomColor: COLORS.orange },
  navText: { color: COLORS.textMuted, fontSize: 13, fontWeight: "600" },
  navTextActive: { color: COLORS.blue, fontWeight: "800", fontSize: 13 },
  dropdown: {
    position: "absolute",
    top: 130,
    left: 10,
    zIndex: 20,
    elevation: 8,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    width: 200,
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
    padding: 16,
    marginTop: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontFamily: "CodecBold",
    color: COLORS.text,
    textAlign: "right",
    marginBottom: 10,
  },
  action: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.bg,
  },
  actionArrow: { color: COLORS.orange, fontSize: 18, marginLeft: 10 },
  actionLabel: {
    fontSize: 15,
    fontFamily: "CodecBold",
    color: COLORS.text,
    textAlign: "right",
  },
  small: {
    fontSize: 12,
    color: COLORS.textMuted,
    textAlign: "right",
    marginTop: 2,
  },
});
