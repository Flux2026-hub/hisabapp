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
import { MaterialCommunityIcons } from "@expo/vector-icons";
import AccountingModule from "../src/ui/AccountingModule";
import SettingsModule from "../src/ui/SettingsModule";
import { COLORS, FONTS } from "../src/ui/theme";
import { sqlite } from "../src/db/local";

type Tab = "home" | "accounting" | "settings";

const sections: Array<[Tab, string]> = [
  ["home", "الرئيسية"],
  ["accounting", "المحاسبة"],
  ["settings", "الإعدادات"],
];

export default function HomeScreen() {
  const [tab, setTab] = useState<Tab>("home");
  const [menuOpen, setMenuOpen] = useState(false);
  
  // حالات الأرصدة
  const [kpis, setKpis] = useState({
    customers: 0,
    suppliers: 0,
    cashboxes: 0,
    inventory: 0,
  });

  const go = (next: Tab) => {
    setTab(next);
    setMenuOpen(false);
  };

  useEffect(() => {
    // جلب الإحصائيات من قاعدة البيانات
    const fetchKPIs = async () => {
      try {
        const c: any = await sqlite.getFirstAsync("SELECT SUM(balance) as total FROM customers");
        const s: any = await sqlite.getFirstAsync("SELECT SUM(balance) as total FROM suppliers");
        const cb: any = await sqlite.getFirstAsync("SELECT SUM(balance) as total FROM cashboxes");
        const inv: any = await sqlite.getFirstAsync("SELECT SUM(stock_quantity * IFNULL(average_cost, 0)) as total FROM items");
        
        setKpis({
          customers: Number(c?.total) || 0,
          suppliers: Number(s?.total) || 0,
          cashboxes: Number(cb?.total) || 0,
          inventory: Number(inv?.total) || 0,
        });
      } catch (e) {
        console.log("Failed to fetch KPIs", e);
      }
    };
    fetchKPIs();
  }, [tab]); // يتم التحديث عند العودة للشاشة

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
            <View style={{ width: "100%", alignItems: "flex-start" }}><View style={{ width: "100%", alignItems: "flex-start" }}><Text style={{ ...styles.title, textAlign: "right", width: "100%", writingDirection: "rtl" }}>لوحة التحكم</Text></View></View>
            <Text style={styles.hint}>
              نظرة سريعة على أرصدة المصنع
            </Text>

            {/* بطاقات الإحصائيات */}
            <View style={styles.kpiGrid}>
              <View style={[styles.kpiCard, { borderRightColor: "#059669", borderRightWidth: 4 }]}>
                <View style={styles.kpiHeader}>
                  <MaterialCommunityIcons name="account-group" size={24} color="#059669" />
                  <Text style={styles.kpiTitle}>العملاء (مدينون)</Text>
                </View>
                <Text style={styles.kpiValue}>{kpis.customers.toFixed(2)} <Text style={styles.kpiCurrency}>ر.ي</Text></Text>
              </View>

              <View style={[styles.kpiCard, { borderRightColor: "#DC2626", borderRightWidth: 4 }]}>
                <View style={styles.kpiHeader}>
                  <MaterialCommunityIcons name="truck-delivery" size={24} color="#DC2626" />
                  <Text style={styles.kpiTitle}>الموردون (دائنون)</Text>
                </View>
                <Text style={styles.kpiValue}>{kpis.suppliers.toFixed(2)} <Text style={styles.kpiCurrency}>ر.ي</Text></Text>
              </View>

              <View style={[styles.kpiCard, { borderRightColor: "#2563EB", borderRightWidth: 4 }]}>
                <View style={styles.kpiHeader}>
                  <MaterialCommunityIcons name="wallet" size={24} color="#2563EB" />
                  <Text style={styles.kpiTitle}>إجمالي الصناديق</Text>
                </View>
                <Text style={styles.kpiValue}>{kpis.cashboxes.toFixed(2)} <Text style={styles.kpiCurrency}>ر.ي</Text></Text>
              </View>

              <View style={[styles.kpiCard, { borderRightColor: "#F97316", borderRightWidth: 4 }]}>
                <View style={styles.kpiHeader}>
                  <MaterialCommunityIcons name="package-variant" size={24} color="#F97316" />
                  <Text style={styles.kpiTitle}>قيمة المخزون</Text>
                </View>
                <Text style={styles.kpiValue}>{kpis.inventory.toFixed(2)} <Text style={styles.kpiCurrency}>ر.ي</Text></Text>
              </View>
            </View>

            {/* الإجراءات السريعة */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>إجراءات سريعة</Text>
              <Action
                label="المحاسبة والإدارة"
                sub="العملاء · الموردون · الفواتير · السندات · التقارير"
                onPress={() => go("accounting")}
              />
              <Action
                label="إعدادات النظام"
                sub="ترويسة التقرير واللوجو والتذييل"
                onPress={() => go("settings")}
              />
            </View>
          </>
        )}

        {tab === "accounting" && (
          <>
            <View style={{ width: "100%", alignItems: "flex-start" }}><View style={{ width: "100%", alignItems: "flex-start" }}><View style={{ width: "100%", alignItems: "flex-start" }}><Text style={{ ...styles.title, textAlign: "right", width: "100%", writingDirection: "rtl" }}>المحاسبة والإدارة</Text></View></View></View>
            <View style={styles.card}>
              <View style={{ width: "100%", alignItems: "flex-start" }}><View style={{ width: "100%", alignItems: "flex-start" }}><Text style={{ ...styles.cardTitle, textAlign: "right", width: "100%", writingDirection: "rtl" }}>الوحدات المحاسبية</Text></View></View>
              <AccountingModule />
            </View>
          </>
        )}

        {tab === "settings" && (
          <>
            <View style={{ width: "100%", alignItems: "flex-start" }}><View style={{ width: "100%", alignItems: "flex-start" }}><Text style={{ ...styles.title, textAlign: "right", width: "100%", writingDirection: "rtl" }}>الإعدادات</Text></View></View>
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
      <View style={styles.actionTextWrap}>
        <Text style={styles.actionLabel}>{label}</Text>
        <Text style={styles.small}>{sub}</Text>
      </View>
      <View style={styles.actionIconWrap}>
        <Text style={styles.actionArrow}>{"->"}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  header: { backgroundColor: COLORS.navy, paddingHorizontal: 18, paddingVertical: 20, paddingTop: 26 },
  brandRow: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between" },
  brandTextWrap: { alignItems: "flex-start" },
  brandName: { fontFamily: FONTS.heading, color: "#FFF", fontSize: 22, textAlign: "right" },
  brandSub: { fontFamily: "Alexandria-Regular", color: "#94A3B8", fontSize: 11, textAlign: "right", marginTop: -2 },
  logo: { width: 90, height: 70 },
  content: { padding: 16, paddingBottom: 40 },
  title: {color: COLORS.text, fontSize: 24,  marginTop: 7, fontFamily: "CodecBold", width: "100%" ,  writingDirection: "rtl"},
  hint: {color: COLORS.textMuted, fontSize: 12,  marginVertical: 8, width: "100%", textAlign: "right", writingDirection: "rtl"},
  
  // KPI Grid
  kpiGrid: { flexDirection: "row-reverse", flexWrap: "wrap", justifyContent: "space-between", marginTop: 10, marginBottom: 20 },
  kpiCard: { width: "48%", backgroundColor: "#ffffff", borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: "#E2E8F0", elevation: 2, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4 },
  kpiHeader: { flexDirection: "row-reverse", alignItems: "center", gap: 6, marginBottom: 8 },
  kpiTitle: { fontSize: 12, color: "#64748B", fontWeight: "700", textAlign: "right", flex: 1 },
  kpiValue: { fontSize: 16, fontWeight: "800", color: "#0F172A", textAlign: "right", writingDirection: "rtl" },
  kpiCurrency: { fontSize: 10, color: "#94A3B8", fontWeight: "normal" },

  nav: { flexDirection: "row", backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border, paddingVertical: 10, alignItems: "center", paddingHorizontal: 10 },
  navTabs: { flex: 1, flexDirection: "row-reverse", justifyContent: "space-around" },
  menuButton: { paddingHorizontal: 12, paddingVertical: 8, backgroundColor: COLORS.navy, borderRadius: 8 },
  menuText: { color: "#FFF", fontSize: 20, fontWeight: "700" },
  navItem: { alignItems: "center", paddingVertical: 6, paddingHorizontal: 12 },
  navActive: { borderBottomWidth: 3, borderBottomColor: COLORS.orange },
  navText: { color: COLORS.textMuted, fontSize: 13, fontWeight: "600" },
  navTextActive: { color: COLORS.blue, fontWeight: "800", fontSize: 13 },
  dropdown: { position: "absolute", top: 130, left: 10, zIndex: 20, elevation: 8, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, width: 200 },
  dropdownItem: { padding: 13, borderBottomWidth: 1, borderBottomColor: COLORS.bg },
  dropdownText: { textAlign: "right", fontWeight: "700", color: COLORS.text },
  card: { backgroundColor: COLORS.surface, borderRadius: 14, padding: 16, marginTop: 12 },
  cardTitle: {fontSize: 16, fontFamily: "CodecBold", color: COLORS.text,  marginBottom: 10, width: "100%" ,  writingDirection: "rtl"},
  action: { flexDirection: "row", alignItems: "center", paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: "#E2E8F0" },
  actionTextWrap: { flex: 1, alignItems: "flex-start", paddingRight: 10 },
  actionIconWrap: { width: 36, height: 36, borderRadius: 10, backgroundColor: "#FFF7ED", justifyContent: "center", alignItems: "center" },
  actionArrow: { color: "#F97316", fontSize: 18, fontWeight: "bold" },
  actionLabel: { fontSize: 16, fontFamily: "CodecBold", color: "#0F172A", textAlign: "right" },
  small: { fontSize: 12, color: "#64748B", textAlign: "right", marginTop: 4 },
});
