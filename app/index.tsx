import TelegramSettings from '../src/ui/components/TelegramSettings';
import { useEffect, useState, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Animated } from "react-native";
import { BackHandler, Image, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View, Dimensions, useWindowDimensions } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { LineChart } from "react-native-chart-kit";
import AccountingModule from "../src/ui/AccountingModule";
import SettingsModule from "../src/ui/SettingsModule";
import GlobalSearchModal from "../src/ui/components/GlobalSearchModal";
import PromoCarousel from "../src/ui/components/PromoCarousel";
import { COLORS, FONTS } from "../src/ui/theme";
import { sqlite } from "../src/db/local";
import { useTheme } from "../src/ui/ThemeContext";

type Tab = "home" | "accounting" | "settings";

const sections: Array<[Tab, string]> = [
  ["home", "الرئيسية"],
  ["accounting", "المحاسبة"],
  ["settings", "الإعدادات"],
];

export default function HomeScreen() {
  const { colors } = useTheme();
  const { width } = useWindowDimensions(); // 🚀 مراقبة عرض الشاشة
  const isDesktop = width >= 768; // إذا كان العرض كبيراً (تلفاز / DeX)

  const [tab, setTab] = useState<Tab>("home");
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [pinNavbar, setPinNavbar] = useState(false);
  const scrollY = useRef(new Animated.Value(0)).current;
  const [sarRate, setSarRate] = useState(140);

  const [kpis, setKpis] = useState({
    customers: 0, suppliers: 0, cashboxes: 0, inventory: 0,
  });

  const [chartData, setChartData] = useState({
    labels: [] as string[],
    datasets: [{ data: [0] }]
  });

  const go = (next: Tab) => { setTab(next); setMenuOpen(false); };

  useEffect(() => {
    // قراءة إعداد تثبيت الشريط
    AsyncStorage.getItem("flux_settings_v1").then(raw => {
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.pinNavbar !== undefined) setPinNavbar(parsed.pinNavbar);
      }
    });
  }, [tab]);

  useEffect(() => {
    const fetchKPIs = async () => {
      try {
        const c: any = await sqlite.getFirstAsync("SELECT SUM(balance) as total FROM customers");
        const s: any = await sqlite.getFirstAsync("SELECT SUM(balance) as total FROM suppliers");
        const cb: any = await sqlite.getFirstAsync("SELECT SUM(balance) as total FROM cashboxes");
        const inv: any = await sqlite.getFirstAsync("SELECT SUM(IFNULL(stock_quantity,0) * IFNULL(average_cost, 0)) as total FROM items");
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

    const fetchChartData = async () => {
      try {
        const labels: string[] = [];
        const data: number[] = [];
        const today = new Date();

        for (let i = 6; i >= 0; i--) {
          const d = new Date(today);
          d.setDate(today.getDate() - i);
          const dateStr = d.toISOString().slice(0, 10);
          labels.push(d.toLocaleDateString("ar-EG", { weekday: 'short' }));
          
          const start = new Date(dateStr + "T00:00:00").getTime();
          const end = new Date(dateStr + "T23:59:59").getTime();
          
          const res: any = await sqlite.getFirstAsync(
            "SELECT SUM(total) as total FROM invoices WHERE invoice_type = 'sales' AND created_at BETWEEN ? AND ?",
            [start, end]
          );
          data.push(Number(res?.total) || 0);
        }
        
        setChartData({ labels, datasets: [{ data }] });
      } catch (e) { console.log("Chart error", e); }
    };

    fetchKPIs();
    fetchChartData();
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

  // إعداد حركة الإخفاء (Clamp يمنع الشريط من الخروج عن الحدود)
  const diffClamp = Animated.diffClamp(scrollY, 0, 80);
  const translateY = diffClamp.interpolate({
    inputRange: [0, 80],
    outputRange: [0, -80], // يختفي للأعلى بمقدار 80 بكسل
  });

  // إذا كان الإعداد "تثبيت" فارغة (لا حركة)، وإلا نطبق الحركة
  const navAnimatedStyle = pinNavbar ? {} : { transform: [{ translateY }] };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.bg }]}>
      <View style={[styles.header, { backgroundColor: colors.navy }]}>
        <View style={styles.brandRow}>
          <Image source={require("../assets/images/flux-logo.png")} style={styles.logo} resizeMode="contain" />
          
          
          
          <View style={styles.brandTextWrap}>
            <Text style={styles.brandName}>فلوكس</Text>
            <Text style={styles.brandSub}>لأنابيب أكثر نظافة</Text>
          </View>
        </View>
      </View>

      <Animated.View style={[styles.nav, { backgroundColor: colors.surface, borderBottomColor: colors.border, position: "absolute", top: 115, left: 0, right: 0, zIndex: 1 }, navAnimatedStyle]}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Pressable style={styles.searchBtn} onPress={() => setSearchOpen(true)}>
            <MaterialCommunityIcons name="magnify" size={24} color={colors.text} />
          </Pressable>

        </View>
        
        <View style={styles.navTabs}>
          {sections.map(([key, label]) => {
            const active = tab === key;
            return (
              <Pressable key={key} onPress={() => go(key)} style={[styles.navItem, active && { backgroundColor: colors.isDark ? 'rgba(249, 115, 22, 0.15)' : 'rgba(249, 115, 22, 0.08)' }]}>
                <MaterialCommunityIcons 
                  name={key === 'home' ? 'home-outline' : key === 'accounting' ? 'calculator-variant-outline' : 'cog-outline'} 
                  size={18} // ✅ تصغير الأيقونة
                  color={active ? colors.orange : colors.textMuted} 
                  style={{ marginBottom: 2 }} // ✅ تقليل المسافة بين الأيقونة والنص
                />
                <Text style={active ? [styles.navTextActive, { color: colors.orange, fontSize: 12 }] : [styles.navText, { color: colors.textMuted, fontSize: 12 }]}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Animated.View>

      {menuOpen && <Pressable style={styles.overlay} onPress={() => setMenuOpen(false)} />}

      {menuOpen && (
        <View style={[styles.dropdown, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {sections.map(([key, label]) => (
            <Pressable key={key} onPress={() => go(key)} style={[styles.dropdownItem, { borderBottomColor: colors.bg }]}>
              <Text style={[styles.dropdownText, { color: colors.text }]}>{label}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {/* 🚀 تطبيق التصميم المتجاوب على المحتوى */}
      <Animated.ScrollView 
        contentContainerStyle={[styles.scrollBackground, isDesktop && styles.desktopContent, { paddingTop: 75 }]} 
        keyboardShouldPersistTaps="handled"
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
        scrollEventThrottle={16}
      >
        
        {tab === "home" && (
          <View style={[styles.whiteCard, { backgroundColor: colors.surface }, isDesktop && { padding: 40 }]}>
            <Text style={[styles.title, { color: colors.text }]}>لوحة التحكم</Text>
            <Text style={[styles.hint, { color: colors.textMuted }]}>نظرة سريعة على أرصدة المصنع</Text>

            {/* ✅ شاشة العرض (البانر الإعلاني) */}
            <PromoCarousel />

            

            <View style={styles.quickActionsGrid}>
              <Pressable style={[styles.quickActionCard, { backgroundColor: colors.isDark ? "#1E293B" : "#EFF6FF" }, isDesktop && { width: "23.5%", aspectRatio: 1.5 }]} onPress={() => go("accounting")}>
                <View style={[styles.iconCircle, { backgroundColor: colors.isDark ? "#334155" : "#DBEAFE", width: 56, height: 56, borderRadius: 28, marginBottom: 12 }]}>
                  <MaterialCommunityIcons name="pencil" size={32} color="#2563EB" />
                </View>
                <Text style={[styles.quickActionText, { color: colors.text }]}>المحاسبة</Text>
              </Pressable>

              <Pressable style={[styles.quickActionCard, { backgroundColor: colors.isDark ? "#1E293B" : "#F8FAFC" }, isDesktop && { width: "23.5%", aspectRatio: 1.5 }]} onPress={() => go("settings")}>
                <View style={[styles.iconCircle, { backgroundColor: colors.isDark ? "#334155" : "#E2E8F0", width: 56, height: 56, borderRadius: 28, marginBottom: 12 }]}>
                  <MaterialCommunityIcons name="cog" size={32} color="#475569" />
                </View>
                <Text style={[styles.quickActionText, { color: colors.text }]}>الإعدادات</Text>
              </Pressable>
            </View>
          </View>
        )}

        {tab === "accounting" && (
          <View style={styles.transparentScreen}>
            <Text style={[styles.title, { color: colors.text, paddingHorizontal: 8, marginBottom: 16 }]}>المحاسبة والإدارة</Text>
            <AccountingModule />
          </View>
        )}

        {tab === "settings" && (
          <View style={styles.transparentScreen}>
            <Text style={[styles.title, { color: colors.text, paddingHorizontal: 8, marginBottom: 16 }]}>الإعدادات</Text>
            <SettingsModule onBack={() => go("home")} />
            <TelegramSettings />
          </View>
        )}

      </Animated.ScrollView>

      <GlobalSearchModal visible={searchOpen} onClose={() => setSearchOpen(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 20, paddingVertical: 20, paddingTop: 35, borderBottomLeftRadius: 20, borderBottomRightRadius: 20, elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 5, zIndex: 10 },
  brandRow: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", width: "100%" },
  brandTextWrap: { alignItems: "flex-end" },
  brandName: { fontFamily: FONTS.heading, color: "#FFF", fontSize: 20, textAlign: "left" },
  brandSub: { fontFamily: "Alexandria-Regular", color: "#94A3B8", fontSize: 11, textAlign: "left", marginTop: 2 },
  logo: { width: 100, height: 75 },
  searchBtn: { padding: 8, marginHorizontal: 10 },
  scrollBackground: { paddingVertical: 16, paddingHorizontal: 16, paddingBottom: 40 },
  desktopContent: { maxWidth: 1200, alignSelf: "center", width: "100%" }, // 🚀 تحديد أقصى عرض للتلفاز
  whiteCard: { borderRadius: 16, padding: 20 },
  transparentScreen: { backgroundColor: "transparent", paddingHorizontal: 4 },
  title: { fontSize: 24, textAlign: "left", marginTop: 7, fontFamily: "CodecBold", width: "100%" },
  hint: { fontSize: 12, textAlign: "left", marginVertical: 8, width: "100%" },
  chartContainer: { marginTop: 16, borderRadius: 16, paddingTop: 12, paddingBottom: 4, alignItems: "center" },
  chartTitle: { fontSize: 13, fontWeight: "700", marginBottom: 8, textAlign: "right", width: "100%", paddingHorizontal: 20 },
  kpiGrid: { flexDirection: "row-reverse", flexWrap: "wrap", justifyContent: "space-between", marginTop: 20, marginBottom: 20 },
  kpiCard: { width: "48%", borderRadius: 16, padding: 14, marginBottom: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 3 },
  kpiHeader: { flexDirection: "row-reverse", alignItems: "center", gap: 8, marginBottom: 10 },
  iconCircle: { width: 36, height: 36, borderRadius: 18, justifyContent: "center", alignItems: "center" },
  kpiTitle: { fontSize: 12, fontWeight: "700", textAlign: "right", flex: 1 },
  kpiValue: { fontSize: 18, fontWeight: "800", textAlign: "right", writingDirection: "rtl" },
  kpiCur: { fontSize: 10, color: "#94A3B8", fontWeight: "normal" },
  kpiSub: { fontSize: 11, color: "#64748B", fontWeight: "600", textAlign: "right", marginTop: 4 },
  quickActionsGrid: { flexDirection: "row-reverse", justifyContent: "space-between", marginTop: 10 },
  quickActionCard: { width: "48%", borderRadius: 16, padding: 20, alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 3, aspectRatio: 1 },
  quickActionText: { fontSize: 16, fontFamily: "CodecBold" },
  nav: { flexDirection: "row", borderBottomWidth: 1, paddingVertical: 8, alignItems: "center", paddingHorizontal: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2, zIndex: 5 },
  navTabs: { flex: 1, flexDirection: "row-reverse", justifyContent: "space-around" },
  menuButton: { padding: 8, marginLeft: 8 },
  navItem: { alignItems: "center", justifyContent: "center", paddingVertical: 8, paddingHorizontal: 16, borderRadius: 12, marginHorizontal: 4, flexDirection: "column" },
  navText: { fontSize: 14, fontFamily: "Alexandria-Regular" },
  navTextActive: { fontSize: 14, fontFamily: "CodecBold" },
  activeIndicator: { position: "absolute", bottom: -8, height: 3, width: 30, borderRadius: 2 },
  overlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 10, elevation: 10, backgroundColor: "transparent" },
  dropdown: { position: "absolute", top: 130, left: 10, zIndex: 20, elevation: 11, borderWidth: 1, borderRadius: 12, width: 200 },
  dropdownItem: { padding: 13, borderBottomWidth: 1 },
  dropdownText: { textAlign: "right", fontWeight: "700" },
});
