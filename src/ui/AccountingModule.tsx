import { useEffect, useState } from "react";
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
import { getPendingSyncCount, processSyncQueue } from "../sync/queue";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

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
  | "purchaseInvoice"
  | "reports"
  | "voucher"
  | "journal"
  | "transfer";

const modes: Array<[Mode, string]> = [
  ["customers", "العملاء"],
  ["suppliers", "الموردون"],
  ["cashboxes", "الصناديق"],
  ["accounts", "الحسابات الرئيسية"],
  ["items", "الأصناف"],
  ["currencies", "العملات"],
  ["recipe", "التركيبة"],
  ["production", "أمر الإنتاج"],
  ["salesInvoice", "فاتورة مبيعات"],
  ["purchaseInvoice", "فاتورة مشتريات"],
  ["voucher", "سند قبض/دفع"],
  ["journal", "قيد يومية"],
  ["transfer", "تحويل بين الصناديق"],
  ["reports", "التقارير"],
];

export default function AccountingModule() {
  const [mode, setMode] = useState<Mode>("menu");
  const [pending, setPending] = useState(0);

  useEffect(() => {
    getPendingSyncCount().then(setPending);
  }, []);

  useEffect(() => {
    getPendingSyncCount().then(setPending);
  }, [mode]);

  const syncNow = async () => {
    try {
      const base =
        process.env.EXPO_PUBLIC_API_URL ||
        process.env.EXPO_PUBLIC_API_BASE_URL ||
        "http://10.0.2.2:3000";
      await processSyncQueue(base);
      setPending(await getPendingSyncCount());
      Alert.alert("المزامنة", "اكتملت محاولة مزامنة العمليات المحلية");
    } catch (e) {
      Alert.alert("تعذر المزامنة", String(e));
    }
  };

  const goMenu = () => setMode("menu");

  if (mode === "customers" || mode === "suppliers")
    return <CustomersScreen kind={mode} onBack={goMenu} />;
  if (mode === "currencies") return <CurrenciesScreen onBack={goMenu} />;
  if (mode === "items") return <ItemsScreen onBack={goMenu} />;
  if (mode === "recipe") return <ProductRecipeScreen onBack={goMenu} />;
  if (mode === "production") return <ProductionOrderScreen onBack={goMenu} />;
  if (mode === "cashboxes") return <CashboxesScreen onBack={goMenu} />;
  if (mode === "accounts") return <AccountsScreen onBack={goMenu} />;
  if (mode === "salesInvoice") return <SalesInvoiceScreen onBack={goMenu} />;
  if (mode === "purchaseInvoice") return <PurchaseInvoiceScreen onBack={goMenu} />;
  if (mode === "voucher") return <VouchersScreen onBack={goMenu} />;
  if (mode === "journal") return <JournalScreen onBack={goMenu} />;
  if (mode === "transfer") return <TransfersScreen onBack={goMenu} />;
  if (mode === "reports") return <ReportsIndex onBack={goMenu} />;

  return (
    <View style={styles.container}>
      <View style={styles.syncBar}>
        <Text style={styles.syncText}>عمليات معلقة: {pending}</Text>
        <Pressable style={styles.syncButton} onPress={syncNow}>
          <Text style={styles.syncButtonText}>مزامنة الآن</Text>
        </Pressable>
      </View>

      <Text style={styles.hint}>
        اختر الشاشة المطلوبة من القائمة أدناه. جميع العمليات تُحفظ محلياً
        وتعمل بدون إنترنت.
      </Text>

      <Text style={styles.sectionLabel}>البيانات الأساسية</Text>
      <View style={styles.tabs}>
        {modes.slice(0, 4).map(([key, label]) => (
          <Pressable key={key} onPress={() => setMode(key)} style={styles.tab}>
            <Text style={styles.tabText}>{label}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.sectionLabel}>المخزون والإنتاج</Text>
      <View style={styles.tabs}>
        {modes.slice(4, 8).map(([key, label]) => (
          <Pressable key={key} onPress={() => setMode(key)} style={styles.tab}>
            <Text style={styles.tabText}>{label}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.sectionLabel}>العمليات</Text>
      <View style={styles.tabs}>
        {modes.slice(8, 13).map(([key, label]) => (
          <Pressable key={key} onPress={() => setMode(key)} style={styles.tab}>
            <Text style={styles.tabText}>{label}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.sectionLabel}>التقارير</Text>
      <View style={styles.tabs}>
        {modes.slice(13).map(([key, label]) => (
          <Pressable key={key} onPress={() => setMode(key)} style={styles.tab}>
            <Text style={styles.tabText}>{label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 4 },
  hint: {
    color: "#758298",
    fontSize: 12,
    textAlign: "right",
    marginBottom: 12,
    lineHeight: 18,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "800",
    color: "#087f68",
    textAlign: "right",
    marginTop: 10,
    marginBottom: 6,
    paddingRight: 4,
  },
  tabs: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 6 },
  tab: {
    borderWidth: 1,
    borderColor: "#dfe5ed",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#ffffff",
  },
  tabText: { fontSize: 12, color: "#172033", fontWeight: "600" },
  syncBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#eef6ff",
    padding: 10,
    borderRadius: 10,
    marginBottom: 10,
  },
  syncText: { color: "#315b85", fontSize: 12 },
  syncButton: {
    backgroundColor: "#315b85",
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 7,
  },
  syncButtonText: { color: "#fff", fontSize: 12, fontWeight: "700" },
});
