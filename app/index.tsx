import { useState } from "react";
import {
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
  navy: "#0b1220",
  teal: "#10a88a",
  ink: "#172033",
  muted: "#758298",
  bg: "#f5f7fb",
  card: "#fff",
  line: "#e5eaf0",
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
      <View style={styles.header}>
        <Text style={styles.brand}>فلوكس</Text>
        <Text style={styles.headerSub}>مسلك مجاري · يعمل بدون إنترنت</Text>
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

      <ScrollView contentContainerStyle={styles.content}>
        {tab === "home" && (
          <>
            <Text style={styles.title}>لوحة التحكم</Text>
            <Text style={styles.hint}>
              البيانات محفوظة على الجهاز وتعمل بدون إنترنت
            </Text>

            <Card title="إجراءات سريعة">
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
            </Card>
          </>
        )}

        {tab === "accounting" && (
          <>
            <Text style={styles.title}>المحاسبة والإدارة</Text>
            <Card title="الوحدات المحاسبية">
              <AccountingModule />
            </Card>
          </>
        )}

        {tab === "settings" && (
          <>
            <Text style={styles.title}>الإعدادات</Text>
            <Card title="إعدادات التقارير">
              <SettingsModule onBack={() => go("home")} />
            </Card>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      {children}
    </View>
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
  header: { backgroundColor: colors.navy, padding: 20, paddingTop: 26 },
  brand: { color: "#fff", fontSize: 26, fontWeight: "800", textAlign: "right" },
  headerSub: { color: "#aab7c9", fontSize: 11, textAlign: "right", marginTop: 3 },
  content: { padding: 16, paddingBottom: 40 },
  title: {
    color: colors.ink,
    fontSize: 24,
    fontWeight: "800",
    textAlign: "right",
    marginTop: 7,
  },
  hint: { color: colors.muted, fontSize: 11, textAlign: "right", marginVertical: 7 },
  nav: {
    flexDirection: "row-reverse",
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    paddingVertical: 10,
    alignItems: "center",
  },
  menuButton: {
    paddingHorizontal: 8,
    paddingVertical: 8,
    backgroundColor: colors.navy,
    borderRadius: 7,
    marginHorizontal: 4,
  },
  menuText: { color: "#fff", fontSize: 10, fontWeight: "700" },
  navItem: { flex: 1, alignItems: "center" },
  navActive: { borderBottomWidth: 2, borderBottomColor: colors.teal },
  navText: { color: colors.muted, fontSize: 11 },
  navTextActive: { color: colors.teal, fontWeight: "800", fontSize: 11 },
  dropdown: {
    position: "absolute",
    top: 112,
    right: 8,
    zIndex: 20,
    elevation: 8,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    width: 210,
  },
  dropdownItem: {
    padding: 13,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  dropdownText: { textAlign: "right", fontWeight: "700", color: colors.ink },
  card: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 16,
    marginTop: 14,
  },
  cardTitle: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "800",
    textAlign: "right",
    marginBottom: 10,
  },
  action: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  actionLabel: { color: colors.ink, fontWeight: "700", textAlign: "right" },
  actionArrow: { color: colors.teal, fontSize: 20 },
  small: { color: colors.muted, fontSize: 10, textAlign: "right", marginTop: 3 },
});
