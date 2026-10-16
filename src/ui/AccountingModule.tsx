import { useEffect, useState } from "react";
import {
  Alert,
  BackHandler,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
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
import { COLORS } from "./theme";

type Mode =
  | "menu"
  | "customers"
  | "suppliers"
  | "cashboxes"
  | "accounts"
  | "items"
  | "currencies"
  | "recipe"
  | "production"
  | "salesInvoice"
  | "salesReps"
  | "purchaseInvoice"
  | "voucher"
  | "journal"
  | "transfer"
  | "reports";

type MenuItem = {
  mode: Mode;
  label: string;
  icon: string;
  section: string;
};

const MENU: MenuItem[] = [
  { section: "البيانات الأساسية", mode: "customers", label: "العملاء", icon: "account-group" },
  { section: "البيانات الأساسية", mode: "suppliers", label: "الموردون", icon: "truck-delivery" },
  { section: "البيانات الأساسية", mode: "cashboxes", label: "الصناديق", icon: "wallet-outline" },
  { section: "البيانات الأساسية", mode: "accounts", label: "الحسابات الرئيسية", icon: "file-document-outline" },
  { section: "المخزون والإنتاج", mode: "items", label: "الأصناف", icon: "package-variant-closed" },
  { section: "المخزون والإنتاج", mode: "currencies", label: "العملات", icon: "cash-multiple" },
  { section: "المخزون والإنتاج", mode: "recipe", label: "التركيبة", icon: "cog-outline" },
  { section: "المخزون والإنتاج", mode: "production", label: "أمر الإنتاج", icon: "factory" },
  { section: "البيانات الأساسية", mode: "salesReps", label: "مناديب المبيعات", icon: "account-tie" },
  { section: "العمليات", mode: "salesInvoice", label: "فاتورة مبيعات", icon: "file-document-outline" },
  { section: "العمليات", mode: "purchaseInvoice", label: "فاتورة مشتريات", icon: "file-document-multiple-outline" },
  { section: "العمليات", mode: "voucher", label: "سند قبض/دفع", icon: "swap-horizontal" },
  { section: "العمليات", mode: "journal", label: "قيد يومية", icon: "clipboard-text-outline" },
  { section: "العمليات", mode: "transfer", label: "تحويل بين الصناديق", icon: "swap-horizontal-bold" },
  { section: "التقارير", mode: "reports", label: "التقارير", icon: "chart-bar" },
];

export default function AccountingModule() {
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
    } catch (e) {
      Alert.alert("تعذر المزامنة", String(e));
    }
  };

  useEffect(() => {
    const onBackPress = () => {
      if (mode !== "menu") {
        setMode("menu");
        return true;
      }
      return false;
    };
    const sub = BackHandler.addEventListener("hardwareBackPress", onBackPress);
    return () => sub.remove();
  }, [mode]);

  if (mode === "customers" || mode === "suppliers")
    return <CustomersScreen kind={mode} onBack={goMenu} />;
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
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets={true}
    >
      <View style={styles.syncBar}>
        <View style={styles.syncLeft}>
          <MaterialCommunityIcons name="clock-outline" size={16} color={COLORS.orange} />
          <Text style={styles.pendingText}>عمليات معلقة: {pending}</Text>
        </View>
        <Pressable style={styles.syncButton} onPress={syncNow}>
          <MaterialCommunityIcons name="sync" size={14} color="#FFF" />
          <Text style={styles.syncButtonText}>مزامنة الآن</Text>
        </Pressable>
      </View>

      <Text style={styles.hint}>
        اختر الشاشة المطلوبة من القائمة أدناه. جميع العمليات تُحفظ محلياً وتعمل بدون إنترنت.
      </Text>

      {sections.map((sectionName) => (
        <View key={sectionName} style={styles.sectionBlock}>
          <View style={styles.sectionTitleRow}>
            <View style={styles.sectionAccent} />
            <Text style={styles.sectionLabel}>{sectionName}</Text>
          </View>
          <View style={styles.grid}>
            {MENU.filter((m) => m.section === sectionName).map((item) => (
              <Pressable
                key={item.mode}
                onPress={() => setMode(item.mode)}
                style={styles.tile}
              >
                <MaterialCommunityIcons
                  name={item.icon as any}
                  size={22}
                  color={COLORS.orange}
                />
                <Text style={styles.tileText}>{item.label}</Text>
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
  syncBar: {
    flexDirection: "row-reverse",
    alignItems: "center",
    backgroundColor: COLORS.bluePale,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    marginBottom: 12,
    gap: 8,
  },
  syncLeft: {
    flex: 1,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 6,
  },
  pendingText: { color: COLORS.blue, fontSize: 12, fontWeight: "700" },
  syncButton: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 5,
    backgroundColor: COLORS.blue,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  syncButtonText: { color: "#FFF", fontSize: 12, fontWeight: "800" },
  hint: {
    color: COLORS.textMuted,
    fontSize: 12,
    textAlign: "right",
    marginBottom: 14,
    lineHeight: 18,
    paddingHorizontal: 4,
  },
  sectionBlock: { width: "100%", marginTop: 14 },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "stretch",
    marginBottom: 8,
    gap: 8,
  },
  sectionAccent: {
    width: 4,
    height: 20,
    backgroundColor: COLORS.orange,
    borderRadius: 2,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: "800",
    color: COLORS.blue,
    textAlign: "right",
  },
  grid: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 4,
  },
  tile: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: COLORS.surface,
    borderWidth: 1.2,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 14,
    minWidth: 105,
    flexGrow: 1,
    flexBasis: "30%",
  },
  tileText: {
    fontSize: 13,
    color: COLORS.text,
    fontWeight: "700",
    textAlign: "right",
  },
});
