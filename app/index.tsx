import TelegramSettings from '../src/ui/components/TelegramSettings';
import { useEffect, useState, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Animated } from "react-native";
import { BackHandler, Image, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
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
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const [tab, setTab] = useState<Tab>("home");
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [pinNavbar, setPinNavbar] = useState(false);
  const scrollY = useRef(new Animated.Value(0)).current;
  const [sarRate, setSarRate] = useState(140);

  const [kpis, setKpis] = useState({
    customers: 0, suppliers: 0, cashboxes: 0, inventory: 0,
  });

  const go = (next: Tab) => { setTab(next); setMenuOpen(false); };

  useEffect(() => {
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

  // ✅ استخدام متغير حركة مستقل بدلاً من diffClamp
  const navTranslateY = useRef(new Animated.Value(0)).current;
  const lastScrollY = useRef(0);

  const handleScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    {
      useNativeDriver: true,
      listener: (event: any) => {
        const currentY = event.nativeEvent.contentOffset.y;
        const diff = currentY - lastScrollY.current;

        if (pinNavbar) {
          navTranslateY.setValue(0);
          return;
        }

        // إذا كنا في أعلى الصفحة، أظهر الشريط دائماً
        if (currentY <= 0) {
          Animated.timing(navTranslateY, { toValue: 0, duration: 200, useNativeDriver: true }).start();
        } 
        // التمرير للأسفل (النزول)
        else if (diff > 10 && currentY > 60) {
          Animated.timing(navTranslateY, { toValue: -130, duration: 200, useNativeDriver: true }).start();
        } 
        // التمرير للأعلى (الصعود)
        else if (diff < -10) {
          Animated.timing(navTranslateY, { toValue: 0, duration: 200, useNativeDriver: true }).start();
        }
        lastScrollY.current = currentY;
      }
    }
  );

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.bg }]}>
      
      <LinearGradient
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
      </LinearGradient>

      {/* شريط التنقل */}
      <Animated.View style={[styles.nav, { backgroundColor: colors.surface, borderBottomColor: colors.border, position: "absolute", top: 120, left: 0, right: 0, zIndex: 1, transform: [{ translateY: navTranslateY }] }]}>
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
                  size={18}
                  color={active ? colors.orange : colors.textMuted}
                  style={{ marginBottom: 2 }}
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

      <Animated.ScrollView
        contentContainerStyle={[styles.scrollBackground, isDesktop && styles.desktopContent, { paddingTop: 70 }]}
        keyboardShouldPersistTaps="handled"
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        {tab === "home" && (
          <View style={{ marginHorizontal: -16, marginTop: -16 }}> 
            <PromoCarousel />

            <View style={{ paddingHorizontal: 16, marginTop: 10 }}>
              <View style={styles.kpiGrid}>
                <View style={[styles.kpiCard, { backgroundColor: colors.isDark ? "#064E3B" : "#F0FDF4" }, isDesktop && { width: "23.5%" }]}>
                  <View style={styles.kpiHeader}>
                    <View style={[styles.iconCircle, { backgroundColor: colors.isDark ? "#065F46" : "#DCFCE7", width: 36, height: 36, borderRadius: 18 }]}><MaterialCommunityIcons name="account-group" size={22} color="#059669" /></View>
                    <Text style={[styles.kpiTitle, { color: colors.textMuted }]}>العملاء (مدينون)</Text>
                  </View>
                  <Text style={[styles.kpiValue, { color: colors.text }]}>{kpis.customers.toFixed(2)} <Text style={styles.kpiCur}>YER</Text></Text>
                  <Text style={styles.kpiSub}>≈ {(kpis.customers / sarRate).toFixed(2)} SAR</Text>
                </View>

                <View style={[styles.kpiCard, { backgroundColor: colors.isDark ? "#7F1D1D" : "#FEF2F2" }, isDesktop && { width: "23.5%" }]}>
                  <View style={styles.kpiHeader}>
                    <View style={[styles.iconCircle, { backgroundColor: colors.isDark ? "#991B1B" : "#FEE2E2", width: 36, height: 36, borderRadius: 18 }]}><MaterialCommunityIcons name="truck-delivery" size={22} color="#DC2626" /></View>
                    <Text style={[styles.kpiTitle, { color: colors.textMuted }]}>الموردون (دائنون)</Text>
                  </View>
                  <Text style={[styles.kpiValue, { color: colors.text }]}>{kpis.suppliers.toFixed(2)} <Text style={styles.kpiCur}>YER</Text></Text>
                  <Text style={styles.kpiSub}>≈ {(kpis.suppliers / sarRate).toFixed(2)} SAR</Text>
                </View>

                <View style={[styles.kpiCard, { backgroundColor: colors.isDark ? "#1E3A8A" : "#EFF6FF" }, isDesktop && { width: "23.5%" }]}>
                  <View style={styles.kpiHeader}>
                    <View style={[styles.iconCircle, { backgroundColor: colors.isDark ? "#1E40AF" : "#DBEAFE", width: 36, height: 36, borderRadius: 18 }]}><MaterialCommunityIcons name="wallet" size={22} color="#2563EB" /></View>
                    <Text style={[styles.kpiTitle, { color: colors.textMuted }]}>إجمالي الصناديق</Text>
                  </View>
                  <Text style={[styles.kpiValue, { color: colors.text }]}>{kpis.cashboxes.toFixed(2)} <Text style={styles.kpiCur}>YER</Text></Text>
                  <Text style={styles.kpiSub}>≈ {(kpis.cashboxes / sarRate).toFixed(2)} SAR</Text>
                </View>

                <View style={[styles.kpiCard, { backgroundColor: colors.isDark ? "#78350F" : "#FEF3C7" }, isDesktop && { width: "23.5%" }]}>
                  <View style={styles.kpiHeader}>
                    <View style={[styles.iconCircle, { backgroundColor: colors.isDark ? "#92400E" : "#FDE68A", width: 36, height: 36, borderRadius: 18 }]}><MaterialCommunityIcons name="package-variant" size={22} color="#D97706" /></View>
                    <Text style={[styles.kpiTitle, { color: colors.textMuted }]}>قيمة المخزون</Text>
                  </View>
                  <Text style={[styles.kpiValue, { color: colors.text }]}>{kpis.inventory.toFixed(2)} <Text style={styles.kpiCur}>YER</Text></Text>
                  <Text style={styles.kpiSub}>≈ {(kpis.inventory / sarRate).toFixed(2)} SAR</Text>
                </View>
              </View>

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
  header: { paddingHorizontal: 20, paddingVertical: 20, paddingTop: 40, borderBottomLeftRadius: 20, borderBottomRightRadius: 20, elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 5, zIndex: 10 },
  brandRow: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", width: "100%" },
  brandTextWrap: { alignItems: "flex-end" },
  brandName: { fontFamily: FONTS.heading, color: "#FFF", fontSize: 22, textAlign: "left" },
  brandSub: { fontFamily: "Alexandria-Regular", color: "#94A3B8", fontSize: 13, textAlign: "left", marginTop: 2 },
  logo: { width: 100, height: 75 },
  searchBtn: { padding: 8, marginHorizontal: 10 },
  scrollBackground: { paddingVertical: 16, paddingHorizontal: 16, paddingBottom: 40 },
  desktopContent: { maxWidth: 1200, alignSelf: "center", width: "100%" }, 
  transparentScreen: { backgroundColor: "transparent", paddingHorizontal: 4 },
  title: { fontSize: 24, textAlign: "left", marginTop: 7, fontFamily: "CodecBold", width: "100%" },
  hint: { fontSize: 12, textAlign: "left", marginVertical: 8, width: "100%" },
  kpiGrid: { flexDirection: "row-reverse", flexWrap: "wrap", justifyContent: "space-between", marginTop: 10, marginBottom: 20 },
  kpiCard: { width: "48%", borderRadius: 16, padding: 14, marginBottom: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 3 },
  kpiHeader: { flexDirection: "row-reverse", alignItems: "center", gap: 8, marginBottom: 10 },
  iconCircle: { justifyContent: "center", alignItems: "center" },
  kpiTitle: { fontSize: 12, fontWeight: "700", textAlign: "right", flex: 1 },
  kpiValue: { fontSize: 18, fontWeight: "800", textAlign: "right", writingDirection: "rtl" },
  kpiCur: { fontSize: 10, color: "#94A3B8", fontWeight: "normal" },
  kpiSub: { fontSize: 11, color: "#64748B", fontWeight: "600", textAlign: "right", marginTop: 4 },
  quickActionsGrid: { flexDirection: "row-reverse", justifyContent: "space-between", marginTop: 10 },
  quickActionCard: { width: "48%", borderRadius: 16, padding: 20, alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 3, aspectRatio: 1 },
  quickActionText: { fontSize: 16, fontFamily: "CodecBold" },
  nav: { flexDirection: "row", borderBottomWidth: 1, paddingVertical: 8, alignItems: "center", paddingHorizontal: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1, zIndex: 1 },
  navTabs: { flex: 1, flexDirection: "row-reverse", justifyContent: "space-around" },
  navItem: { alignItems: "center", justifyContent: "center", paddingVertical: 8, paddingHorizontal: 16, borderRadius: 12, marginHorizontal: 4, flexDirection: "column" },
  navText: { fontSize: 14, fontFamily: "Alexandria-Regular" },
  navTextActive: { fontSize: 14, fontFamily: "CodecBold" },
  overlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 10, elevation: 10, backgroundColor: "transparent" },
});
