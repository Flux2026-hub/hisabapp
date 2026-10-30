import { useEffect, useState } from "react";
import {
  Alert, BackHandler, Pressable, ScrollView, StyleSheet, Text, View,
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

type MenuItem = { mode: Mode; label: string; icon: string; section: string; color: string };

// 🚀 إضافة الألوان المخصصة لكل أيقونة
const MENU: MenuItem[] = [
  { section: "البيانات الأساسية", mode: "customers", label: "العملاء", icon: "account-multiple", color: "#059669" },
  { section: "البيانات الأساسية", mode: "suppliers", label: "الموردون", icon: "truck", color: "#DC2626" },
  { section: "البيانات الأساسية", mode: "cashboxes", label: "الصناديق", icon: "wallet", color: "#2563EB" },
  { section: "البيانات الأساسية", mode: "accounts", label: "الحسابات الرئيسية", icon: "file-tree", color: "#7C3AED" },
  { section: "المخزون والإنتاج", mode: "items", label: "الأصناف", icon: "package-variant", color: "#F97316" },
  { section: "المخزون والإنتاج", mode: "currencies", label: "العملات", icon: "cash", color: "#F59E0B" },
  { section: "المخزون والإنتاج", mode: "recipe", label: "التركيبة", icon: "clipboard-list", color: "#8B5CF6" },
  { section: "المخزون والإنتاج", mode: "production", label: "أمر الإنتاج", icon: "factory", color: "#EC4899" },
  { section: "البيانات الأساسية", mode: "salesReps", label: "مناديب المبيعات", icon: "account-tie", color: "#0EA5E9" },
  { section: "العمليات", mode: "salesInvoice", label: "فاتورة مبيعات", icon: "receipt", color: "#10B981" },
  { section: "العمليات", mode: "purchaseInvoice", label: "فاتورة مشتريات", icon: "file-document-multiple", color: "#EF4444" },
  { section: "العمليات", mode: "voucher", label: "سند قبض/دفع", icon: "swap-horizontal-bold", color: "#6366F1" },
  { section: "العمليات", mode: "journal", label: "قيد يومية", icon: "book-open-page-variant", color: "#14B8A6" },
  { section: "العمليات", mode: "transfer", label: "تحويل بين الصناديق", icon: "bank-transfer", color: "#F43F5E" },
  { section: "التقارير", mode: "reports", label: "التقارير", icon: "chart-box", color: "#475569" },
];

export default function AccountingModule() {
  const { colors } = useTheme();
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
    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets={true}>
      <View style={[styles.syncBar, { backgroundColor: colors.isDark ? "#1E293B" : "#EFF6FF" }]}>
        <View style={styles.syncLeft}>
          <MaterialCommunityIcons name="clock-outline" size={16} color={colors.orange} />
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
            <Text style={[styles.sectionLabel, { color: colors.blue }]}>{sectionName}</Text>
          </View>
          <View style={[styles.sectionDivider, { backgroundColor: colors.orange }]} />
          <View style={styles.grid}>
            {MENU.filter((m) => m.section === sectionName).map((item) => (
              <Pressable key={item.mode} onPress={() => setMode(item.mode)} style={[styles.tile, { backgroundColor: colors.surface }]}>
                {/* 🚀 الأيقونة داخل دائرة ملونة */}
                <View style={[styles.iconCircle, { backgroundColor: item.color + '15' }]}> 
                  <MaterialCommunityIcons name={item.icon as any} size={22} color={item.color} />
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
  syncBar: { flexDirection: "row-reverse", alignItems: "center", paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, marginBottom: 12, gap: 8 },
  syncLeft: { flex: 1, flexDirection: "row-reverse", alignItems: "center", gap: 6 },
  pendingText: { fontSize: 12, fontWeight: "700" },
  syncButton: { flexDirection: "row-reverse", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  syncButtonText: { color: "#FFF", fontSize: 12, fontWeight: "800" },
  hint: { fontSize: 12, marginBottom: 14, lineHeight: 18, paddingHorizontal: 4, textAlign: "left", width: "100%" },
  sectionBlock: { width: "100%", marginTop: 14 },
  grid: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 8, marginBottom: 4 },
  tile: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 10, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 12, minWidth: 105, flexGrow: 1, flexBasis: "30%", shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 3 },
  iconCircle: { width: 36, height: 36, borderRadius: 18, justifyContent: "center", alignItems: "center" },
  tileText: { fontSize: 13, fontFamily: "CodecBold", textAlign: "right" },
  sectionLabel: { fontSize: 16, fontFamily: "CodecBold", textAlign: "left", width: "100%", marginTop: 10, marginBottom: 8 },
  sectionDivider: { marginTop: 5, marginBottom: 15, height: 2, width: "100%", borderRadius: 1 },
});
