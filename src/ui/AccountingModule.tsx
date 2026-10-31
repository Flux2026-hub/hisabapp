import { useEffect, useState } from "react";
import {
  Alert, BackHandler, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import ReportsIndex from "./reports";
import CustomersScreen from "./CustomersScreen";
import CurrenciesScreen from "./CurrenciesScreen";
import ItemsScreen from "./ItemsScreen";
import ProductRecipeScreen from "./ProductRecipeScreen";
import ProductionOrderScreen from "./ProductionOrderScreen";
import CashboxesScreen from "./CashboxesScreen";
import AccountsScreen from "./AccountsScreen";
import SalesInvoiceScreen from "./SalesInvoiceScreen";
import PurchaseInvoiceScreen from "./PurchaseInvoiceScreen";
import VouchersScreen from "./VouchersScreen";
import JournalScreen from "./JournalScreen";
import TransfersScreen from "./TransfersScreen";
import SalesRepsScreen from "./SalesRepsScreen";
import { getPendingSyncCount, processSyncQueue } from "../sync/queue";
import { useTheme } from "./ThemeContext";

type Mode =
  | "menu" | "customers" | "suppliers" | "cashboxes" | "accounts" | "items" | "currencies"
  | "recipe" | "production" | "salesInvoice" | "salesReps" | "purchaseInvoice" | "voucher"
  | "journal" | "transfer" | "reports";

type MenuItem = { mode: Mode; label: string; icon: string; section: string };

const MENU: MenuItem[] = [
  { section: "البيانات الأساسية", mode: "customers", label: "العملاء", icon: "account-multiple" },
  { section: "البيانات الأساسية", mode: "suppliers", label: "الموردون", icon: "truck" },
  { section: "البيانات الأساسية", mode: "cashboxes", label: "الصناديق", icon: "wallet" },
  { section: "البيانات الأساسية", mode: "accounts", label: "الحسابات الرئيسية", icon: "file-tree" },
  { section: "المخزون والإنتاج", mode: "items", label: "الأصناف", icon: "package-variant" },
  { section: "المخزون والإنتاج", mode: "currencies", label: "العملات", icon: "cash" },
  { section: "المخزون والإنتاج", mode: "recipe", label: "التركيبة", icon: "clipboard-list" },
  { section: "المخزون والإنتاج", mode: "production", label: "أمر الإنتاج", icon: "factory" },
  { section: "البيانات الأساسية", mode: "salesReps", label: "مناديب المبيعات", icon: "account-tie" },
  { section: "العمليات", mode: "salesInvoice", label: "فاتورة مبيعات", icon: "receipt" },
  { section: "العمليات", mode: "purchaseInvoice", label: "فاتورة مشتريات", icon: "file-document-multiple" },
  { section: "العمليات", mode: "voucher", label: "سند قبض/دفع", icon: "swap-horizontal-bold" },
  { section: "العمليات", mode: "journal", label: "قيد يومية", icon: "book-open-page-variant" },
  { section: "العمليات", mode: "transfer", label: "تحويل بين الصناديق", icon: "bank-transfer" },
  { section: "التقارير", mode: "reports", label: "التقارير", icon: "chart-box" },
];

export default function AccountingModule() {
  const { colors } = useTheme();
  const { width } = useWindowDimensions(); // 🚀 مراقبة الشاشة
  const isDesktop = width >= 768;

  const [mode, setMode] = useState<Mode>("menu");
  const [pending, setPending] = useState(0);

  useEffect(() => {
    getPendingSyncCount().then(setPending).catch(() => {});
  }, [mode]);

  const goMenu = () => setMode("menu");

  const syncNow = async () => {
    try {
      const base = process.env.EXPO_PUBLIC_API_URL || process.env.EXPO_PUBLIC_API_BASE_URL || "http://10.0.2.2:3000";
      await processSyncQueue(base);
      setPending(await getPendingSyncCount());
      Alert.alert("المزامنة", "اكتملت محاولة مزامنة العمليات المحلية");
    } catch (e) { Alert.alert("تعذر المزامنة", String(e)); }
  };

  useEffect(() => {
    const onBackPress = () => {
      if (mode !== "menu") { setMode("menu"); return true; }
      return false;
    };
    const sub = BackHandler.addEventListener("hardwareBackPress", onBackPress);
    return () => sub.remove();
  }, [mode]);

  if (mode === "customers" || mode === "suppliers") return <CustomersScreen kind={mode} onBack={goMenu} />;
  if (mode === "currencies") return <CurrenciesScreen onBack={goMenu} />;
  if (mode === "items") return <ItemsScreen onBack={goMenu} />;
  if (mode === "recipe") return <ProductRecipeScreen onBack={goMenu} />;
  if (mode === "production") return <ProductionOrderScreen onBack={goMenu} />;
  if (mode === "cashboxes") return <CashboxesScreen onBack={goMenu} />;
  if (mode === "accounts") return <AccountsScreen onBack={goMenu} />;
  if (mode === "salesReps") return <SalesRepsScreen onBack={goMenu} />;
  if (mode === "salesInvoice") return <SalesInvoiceScreen onBack={goMenu} />;
  if (mode === "purchaseInvoice") return <PurchaseInvoiceScreen onBack={goMenu} />;
  if (mode === "voucher") return <VouchersScreen onBack={goMenu} />;
  if (mode === "journal") return <JournalScreen onBack={goMenu} />;
  if (mode === "transfer") return <TransfersScreen onBack={goMenu} />;
  if (mode === "reports") return <ReportsIndex onBack={goMenu} />;

  const sections = Array.from(new Set(MENU.map((m) => m.section)));

  return (
    <ScrollView contentContainerStyle={[styles.scrollContent, isDesktop && styles.desktopContent]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets={true}>
      
      <View style={[styles.syncBar, { backgroundColor: colors.isDark ? "#1E293B" : "#F8FAFC", borderColor: colors.border }]}>
        <View style={styles.syncLeft}>
          <MaterialCommunityIcons name="clock-outline" size={16} color={colors.textMuted} />
          <Text style={[styles.pendingText, { color: colors.text }]}>عمليات معلقة: {pending}</Text>
        </View>
        <Pressable style={[styles.syncButton, { backgroundColor: colors.blue }]} onPress={syncNow}>
          <MaterialCommunityIcons name="sync" size={14} color="#FFF" />
          <Text style={styles.syncButtonText}>مزامنة الآن</Text>
        </Pressable>
      </View>

      <Text style={[styles.hint, { color: colors.textMuted }]}>اختر الشاشة المطلوبة من القائمة أدناه. جميع العمليات تُحفظ محلياً وتعمل بدون إنترنت.</Text>

      {sections.map((sectionName) => (
        <View key={sectionName} style={styles.sectionBlock}>
          <View style={{ width: "100%" }}>
            <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>{sectionName}</Text>
          </View>
          <View style={[styles.sectionDivider, { backgroundColor: colors.border }]} />
          <View style={styles.grid}>
            {MENU.filter((m) => m.section === sectionName).map((item) => (
              <Pressable 
                key={item.mode} 
                onPress={() => setMode(item.mode)} 
                // 🚀 تعديل العرض في التلفاز ليكون 5 أعمدة
                style={[styles.tile, { backgroundColor: colors.isDark ? "#1E293B" : "#F8FAFC" }, isDesktop && { flexBasis: "18%" }]} 
              >
                <View style={[styles.iconCircle, { backgroundColor: colors.isDark ? "#334155" : "#E2E8F0" }]}>
                  <MaterialCommunityIcons name={item.icon as any} size={26} color={colors.blue} />
                </View>
                <Text style={[styles.tileText, { color: colors.text }]}>{item.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: { paddingBottom: 40, paddingHorizontal: 12 },
  desktopContent: { maxWidth: 1200, alignSelf: "center", width: "100%" }, // 🚀 تحديد أقصى عرض للتلفاز
  syncBar: { flexDirection: "row-reverse", alignItems: "center", paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, marginBottom: 12, gap: 8, borderWidth: 1 },
  syncLeft: { flex: 1, flexDirection: "row-reverse", alignItems: "center", gap: 6 },
  pendingText: { fontSize: 12, fontWeight: "700" },
  syncButton: { flexDirection: "row-reverse", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  syncButtonText: { color: "#FFF", fontSize: 12, fontWeight: "700" },
  hint: { fontSize: 12, marginBottom: 14, lineHeight: 18, paddingHorizontal: 4, textAlign: "left", width: "100%" },
  sectionBlock: { width: "100%", marginTop: 20 },
  grid: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 10, marginBottom: 4 },
  tile: { flexDirection: "column", alignItems: "center", justifyContent: "center", borderRadius: 16, paddingVertical: 20, paddingHorizontal: 10, minWidth: "30%", flexGrow: 1, flexBasis: "30%", shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 3 },
  iconCircle: { width: 56, height: 56, borderRadius: 28, justifyContent: "center", alignItems: "center", marginBottom: 12 },
  tileText: { fontSize: 13, fontFamily: "CodecBold", textAlign: "center" },
  sectionLabel: { fontSize: 13, fontFamily: "CodecBold", textAlign: "left", width: "100%", marginBottom: 8 },
  sectionDivider: { marginBottom: 15, height: 1, width: "100%" },
});
