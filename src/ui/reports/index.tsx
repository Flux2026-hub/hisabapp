import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import SalesReport from "./SalesReport";
import PurchaseReport from "./PurchaseReport";
import InventoryReport from "./InventoryReport";
import CustomersReport from "./CustomersReport";
import SuppliersReport from "./SuppliersReport";
import CashboxesReport from "./CashboxesReport";
import AccountsReport from "./AccountsReport";
import TrialBalanceScreen from "./TrialBalanceScreen";
import CommissionsReport from "./CommissionsReport";
import ProfitLossReport from "./ProfitLossReport"; // 🚀 استدعاء التقرير الجديد
import { useTheme } from "../ThemeContext";

type ReportKey = "menu" | "sales" | "purchase" | "inventory" | "customers" | "suppliers" | "cashboxes" | "accounts" | "commissions" | "trial" | "profitLoss";

const MENU: { key: ReportKey; label: string; desc: string; color: string }[] = [
  { key: "sales", label: "تقرير المبيعات", desc: "كل فواتير المبيعات في الفترة", color: "#0b806c" },
  { key: "purchase", label: "تقرير المشتريات", desc: "كل فواتير المشتريات في الفترة", color: "#92400e" },
  { key: "inventory", label: "تقرير المخزون", desc: "أرصدة الأصناف وقيمة المخزون", color: "#1E40AF" },
  { key: "customers", label: "تقرير العملاء", desc: "قائمة العملاء + كشف حساب", color: "#059669" },
  { key: "suppliers", label: "تقرير الموردين", desc: "قائمة الموردين + كشف حساب", color: "#7c2d12" },
  { key: "cashboxes", label: "تقرير الصناديق", desc: "أرصدة وحركات كل صندوق", color: "#1e40af" },
  { key: "accounts", label: "تقرير الحسابات", desc: "شجرة الحسابات والأرصدة", color: "#7c3aed" },
  { key: "trial", label: "ميزان المراجعة", desc: "ملخص مدين ودائن لجميع الحسابات", color: "#0F172A" },
  { key: "commissions", label: "تقرير العمولات", desc: "مبيعات وعمولات مناديب البيع", color: "#c2410c" },
  { key: "profitLoss", label: "الأرباح والخسائر", desc: "ملخص الإيرادات والمصروفات وصافي الربح", color: "#059669" }, // 🚀 التقرير الجديد
];

export default function ReportsIndex({ onBack }: { onBack: () => void }) {
  const { colors } = useTheme();
  const [key, setKey] = useState<ReportKey>("menu");
  const goMenu = () => setKey("menu");

  if (key === "sales") return <SalesReport onBack={goMenu} />;
  if (key === "purchase") return <PurchaseReport onBack={goMenu} />;
  if (key === "inventory") return <InventoryReport onBack={goMenu} />;
  if (key === "customers") return <CustomersReport onBack={goMenu} />;
  if (key === "suppliers") return <SuppliersReport onBack={goMenu} />;
  if (key === "cashboxes") return <CashboxesReport onBack={goMenu} />;
  if (key === "accounts") return <AccountsReport onBack={goMenu} />;
  if (key === "trial") return <TrialBalanceScreen onBack={goMenu} />;
  if (key === "commissions") return <CommissionsReport onBack={goMenu} />;
  if (key === "profitLoss") return <ProfitLossReport onBack={goMenu} />; // 🚀 تفعيل التقرير الجديد

  return (
    <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
      <Pressable style={styles.back} onPress={onBack}>
        <Text style={[styles.backText, { color: colors.blue }]}>‹ العودة إلى الوحدات المحاسبية</Text>
      </Pressable>

      <Text style={[styles.screenTitle, { color: colors.text }]}>التقارير</Text>
      <Text style={[styles.hint, { color: colors.textMuted }]}>اختر التقرير المطلوب. جميع التقارير محلية وتعمل بدون إنترنت.</Text>

      <View style={styles.grid}>
        {MENU.map((m) => (
          <Pressable key={m.key} onPress={() => setKey(m.key)} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, { borderRightColor: m.color, borderRightWidth: 5 }]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>{m.label}</Text>
            <Text style={[styles.cardDesc, { color: colors.textMuted }]}>{m.desc}</Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: { backgroundColor: "transparent", paddingHorizontal: 8, paddingTop: 16, paddingBottom: 40 },
  back: { paddingVertical: 10, alignSelf: "flex-start", marginBottom: 8 },
  backText: { textAlign: "left", fontWeight: "700" },
  screenTitle: { fontSize: 22, marginBottom: 6, textAlign: "left", width: "100%", fontFamily: "CodecBold" },
  hint: { fontSize: 12, marginBottom: 14, lineHeight: 18, textAlign: "left", width: "100%" },
  grid: { gap: 10 },
  card: { borderWidth: 1, borderRadius: 12, padding: 16 },
  cardTitle: { fontSize: 16, fontWeight: "800", textAlign: "right", width: "100%", fontFamily: "CodecBold" },
  cardDesc: { fontSize: 12, textAlign: "right", marginTop: 6 },
});
