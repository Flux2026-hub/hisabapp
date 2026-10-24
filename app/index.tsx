import { useEffect, useState } from "react";
import {
  BackHandler, Image, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import AccountingModule from "../src/ui/AccountingModule";
import SettingsModule from "../src/ui/SettingsModule";
import { COLORS, FONTS } from "../src/ui/theme";
import { sqlite } from "../src/db/local";

type Tab = "home" | "accounting" | "settings";
const sections: Array<[Tab, string]> = [["home", "الرئيسية"], ["accounting", "المحاسبة"], ["settings", "الإعدادات"]];

export default function HomeScreen() {
  const [tab, setTab] = useState<Tab>("home");
  const [menuOpen, setMenuOpen] = useState(false);
  const [sarRate, setSarRate] = useState(140);
  
  const [kpis, setKpis] = useState({
    customers: 0, suppliers: 0, cashboxes: 0, inventory: 0,
  });

  const go = (next: Tab) => { setTab(next); setMenuOpen(false); };

  useEffect(() => {
    const fetchKPIs = async () => {
      try {
        const c: any = await sqlite.getFirstAsync("SELECT SUM(balance) as total FROM customers");
        const s: any = await sqlite.getFirstAsync("SELECT SUM(balance) as total FROM suppliers");
        const cb: any = await sqlite.getFirstAsync("SELECT SUM(balance) as total FROM cashboxes");
        const inv: any = await sqlite.getFirstAsync("SELECT SUM(stock_quantity * IFNULL(average_cost, 0)) as total FROM items");
        const sar: any = await sqlite.getFirstAsync("SELECT exchange_rate FROM currencies WHERE code = 'SAR'");
        
        setKpis({
          customers: Number(c?.total) || 0,
          suppliers: Number(s?.total) || 0,
          cashboxes: Number(cb?.total) || 0,
          inventory: Number(inv?.total) || 0,
        });
        if (sar?.exchange_rate) setSarRate(Number(sar.exchange_rate) || 140);
      } catch (e) { console.log("KPI error", e); }
    };
    fetchKPIs();
  }, [tab]);

  useEffect(() => {
    const onBackPress = () => {
      if (menuOpen) { setMenuOpen(false); return true; }
      if (tab !== "home") { setTab("home"); return true; }
      return false;
    };
    const sub = BackHandler.addEventListener("hardwareBackPress", onBackPress);
    return () => sub.remove();
  }, [tab, menuOpen]);

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <Image source={require("../assets/images/flux-logo.png")} style={styles.logo} resizeMode="contain" />
          <View style={styles.brandTextWrap}>
            <Text style={styles.brandName}>فلوكس</Text>
            <Text style={styles.brandSub}>لأنابيب أكثر نظافة</Text>
          </View>
        </View>
      </View>

      <View style={styles.nav}>
        <Pressable style={styles.menuButton} onPress={() => setMenuOpen((v) => !v)}>
          <Text style={styles.menuText}>☰</Text>
        </Pressable>
        <View style={styles.navTabs}>
          {sections.map(([key, label]) => (
            <Pressable key={key} onPress={() => go(key)} style={[styles.navItem, tab === key && styles.navActive]}>
              <Text style={tab === key ? styles.navTextActive : styles.navText}>{label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {menuOpen && (
        <View style={styles.dropdown}>
          {sections.map(([key, label]) => (
            <Pressable key={key} onPress={() => go(key)} style={styles.dropdownItem}>
              <Text style={styles.dropdownText}>{label}</Text>
            </Pressable>
          ))}
        </View>
      )}

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {tab === "home" && (
          <>
            <Text style={styles.title}>لوحة التحكم</Text>
            <Text style={styles.hint}>نظرة سريعة على أرصدة المصنع</Text>

            <View style={styles.kpiGrid}>
              <View style={[styles.kpiCard, { backgroundColor: "#F0FDF4" }]}>
                <View style={styles.kpiHeader}>
                  <View style={[styles.iconCircle, { backgroundColor: "#DCFCE7" }]}><MaterialCommunityIcons name="account-group" size={22} color="#059669" /></View>
                  <Text style={styles.kpiTitle}>العملاء (مدينون)</Text>
                </View>
                <Text style={styles.kpiValue}>{kpis.customers.toFixed(2)} <Text style={styles.kpiCur}>YER</Text></Text>
                <Text style={styles.kpiSub}>≈ {(kpis.customers / sarRate).toFixed(2)} SAR</Text>
              </View>

              <View style={[styles.kpiCard, { backgroundColor: "#FEF2F2" }]}>
                <View style={styles.kpiHeader}>
                  <View style={[styles.iconCircle, { backgroundColor: "#FEE2E2" }]}><MaterialCommunityIcons name="truck-delivery" size={22} color="#DC2626" /></View>
                  <Text style={styles.kpiTitle}>الموردون (دائنون)</Text>
                </View>
                <Text style={styles.kpiValue}>{kpis.suppliers.toFixed(2)} <Text style={styles.kpiCur}>YER</Text></Text>
                <Text style={styles.kpiSub}>≈ {(kpis.suppliers / sarRate).toFixed(2)} SAR</Text>
              </View>

              <View style={[styles.kpiCard, { backgroundColor: "#EFF6FF" }]}>
                <View style={styles.kpiHeader}>
                  <View style={[styles.iconCircle, { backgroundColor: "#DBEAFE" }]}><MaterialCommunityIcons name="wallet" size={22} color="#2563EB" /></View>
                  <Text style={styles.kpiTitle}>إجمالي الصناديق</Text>
                </View>
                <Text style={styles.kpiValue}>{kpis.cashboxes.toFixed(2)} <Text style={styles.kpiCur}>YER</Text></Text>
                <Text style={styles.kpiSub}>≈ {(kpis.cashboxes / sarRate).toFixed(2)} SAR</Text>
              </View>

              <View style={[styles.kpiCard, { backgroundColor: "#FFF7ED" }]}>
                <View style={styles.kpiHeader}>
                  <View style={[styles.iconCircle, { backgroundColor: "#FFEDD5" }]}><MaterialCommunityIcons name="package-variant" size={22} color="#F97316" /></View>
                  <Text style={styles.kpiTitle}>قيمة المخزون</Text>
                </View>
                <Text style={styles.kpiValue}>{kpis.inventory.toFixed(2)} <Text style={styles.kpiCur}>YER</Text></Text>
                <Text style={styles.kpiSub}>≈ {(kpis.inventory / sarRate).toFixed(2)} SAR</Text>
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>إجراءات سريعة</Text>
              <Action label="المحاسبة والإدارة" sub="العملاء · الموردون · الفواتير · السندات · التقارير" onPress={() => go("accounting")} />
              <Action label="إعدادات النظام" sub="ترويسة التقرير واللوجو والتذييل" onPress={() => go("settings")} />
            </View>
          </>
        )}

        {tab === "accounting" && (
          <>
            <Text style={styles.title}>المحاسبة والإدارة</Text>
            <AccountingModule />
          </>
        )}

        {tab === "settings" && (
          <>
            <Text style={styles.title}>الإعدادات</Text>
            <SettingsModule onBack={() => go("home")} />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Action({ label, sub, onPress }: { label: string; sub: string; onPress: () => void; }) {
  return (
    <Pressable onPress={onPress} style={styles.action}>
      <View style={styles.actionTextWrap}>
        <Text style={styles.actionLabel}>{label}</Text>
        <Text style={styles.small}>{sub}</Text>
      </View>
      <View style={styles.actionIconWrap}>
        <MaterialCommunityIcons name="chevron-left" size={24} color="#F97316" />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  header: { backgroundColor: COLORS.navy, paddingHorizontal: 18, paddingVertical: 20, paddingTop: 26 },
  brandRow: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between" },
  brandTextWrap: { alignItems: "flex-end" },
  brandName: { fontFamily: FONTS.heading, color: "#FFF", fontSize: 22, textAlign: "right" },
  brandSub: { fontFamily: "Alexandria-Regular", color: "#94A3B8", fontSize: 11, textAlign: "right", marginTop: -2 },
  logo: { width: 90, height: 70 },
  content: { backgroundColor: "#ffffff", marginHorizontal: 16, marginVertical: 16, borderRadius: 16, padding: 20, paddingBottom: 40 },
  title: { color: COLORS.text, fontSize: 24, textAlign: "right", marginTop: 7, fontFamily: "CodecBold", width: "100%" },
  hint: { color: COLORS.textMuted, fontSize: 12, textAlign: "right", marginVertical: 8, width: "100%" },
  kpiGrid: { flexDirection: "row-reverse", flexWrap: "wrap", justifyContent: "space-between", marginTop: 10, marginBottom: 20 },
  kpiCard: { width: "48%", borderRadius: 16, padding: 14, marginBottom: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 3 },
  kpiHeader: { flexDirection: "row-reverse", alignItems: "center", gap: 8, marginBottom: 10 },
  iconCircle: { width: 36, height: 36, borderRadius: 18, justifyContent: "center", alignItems: "center" },
  kpiTitle: { fontSize: 12, color: "#475569", fontWeight: "700", textAlign: "right", flex: 1 },
  kpiValue: { fontSize: 18, fontWeight: "800", color: "#0F172A", textAlign: "right", writingDirection: "rtl" },
  kpiCur: { fontSize: 10, color: "#94A3B8", fontWeight: "normal" },
  kpiSub: { fontSize: 11, color: "#64748B", fontWeight: "600", textAlign: "right", marginTop: 4 },
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
  card: { backgroundColor: COLORS.surface, borderRadius: 16, padding: 16, marginTop: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  cardTitle: { fontSize: 16, fontFamily: "CodecBold", color: COLORS.text, textAlign: "right", marginBottom: 15, width: "100%" },
  action: { flexDirection: "row", alignItems: "center", paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: "#E2E8F0" },
  actionTextWrap: { flex: 1, alignItems: "flex-end", paddingRight: 10 },
  actionIconWrap: { width: 36, height: 36, borderRadius: 10, backgroundColor: "#FFF7ED", justifyContent: "center", alignItems: "center" },
  actionArrow: { color: "#F97316", fontSize: 18, fontWeight: "bold" },
  actionLabel: { fontSize: 16, fontFamily: "CodecBold", color: "#0F172A", textAlign: "right" },
  small: { fontSize: 12, color: "#64748B", textAlign: "right", marginTop: 4 },
});
