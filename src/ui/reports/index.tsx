import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import SalesReport from "./SalesReport";
import PurchaseReport from "./PurchaseReport";
import InventoryReport from "./InventoryReport";
import CustomersReport from "./CustomersReport";
import SuppliersReport from "./SuppliersReport";
import CashboxesReport from "./CashboxesReport";
import AccountsReport from "./AccountsReport";
import CommissionsReport from "./CommissionsReport";

type ReportKey = "menu" | "sales" | "purchase" | "inventory" | "customers" | "suppliers" | "cashboxes" | "accounts" | "commissions";

const MENU: { key: ReportKey; label: string; desc: string; color: string }[] = [
  { key: "sales", label: "تقرير المبيعات", desc: "كل فواتير المبيعات في الفترة", color: "#0b806c" },
  { key: "purchase", label: "تقرير المشتريات", desc: "كل فواتير المشتريات في الفترة", color: "#92400e" },
  { key: "inventory", label: "تقرير المخزون", desc: "أرصدة الأصناف وقيمة المخزون", color: "#1E40AF" },
  { key: "customers", label: "تقرير العملاء", desc: "قائمة العملاء + كشف حساب", color: "#059669" },
  { key: "suppliers", label: "تقرير الموردين", desc: "قائمة الموردين + كشف حساب", color: "#7c2d12" },
  { key: "cashboxes", label: "تقرير الصناديق", desc: "أرصدة وحركات كل صندوق", color: "#1e40af" },
  { key: "accounts", label: "تقرير الحسابات", desc: "شجرة الحسابات والأرصدة", color: "#7c3aed" },
  { key: "commissions", label: "تقرير العمولات", desc: "مبيعات وعمولات مناديب البيع", color: "#c2410c" },
];

export default function ReportsIndex({ onBack }: { onBack: () => void }) {
  const [key, setKey] = useState<ReportKey>("menu");
  const goMenu = () => setKey("menu");

  if (key === "sales") return <SalesReport onBack={goMenu} />;
  if (key === "purchase") return <PurchaseReport onBack={goMenu} />;
  if (key === "inventory") return <InventoryReport onBack={goMenu} />;
  if (key === "customers") return <CustomersReport onBack={goMenu} />;
  if (key === "suppliers") return <SuppliersReport onBack={goMenu} />;
  if (key === "cashboxes") return <CashboxesReport onBack={goMenu} />;
  if (key === "accounts") return <AccountsReport onBack={goMenu} />;
  if (key === "commissions") return <CommissionsReport onBack={goMenu} />;

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 40, paddingHorizontal: 4 }}>
      <Pressable style={styles.back} onPress={onBack}>
        <Text style={styles.backText}>{"->"} العودة إلى الوحدات المحاسبية</Text>
      </Pressable>

      <Text style={styles.screenTitle}>التقارير</Text>
      <Text style={styles.hint}>اختر التقرير المطلوب. جميع التقارير محلية وتعمل بدون إنترنت.</Text>

      <View style={styles.grid}>
        {MENU.map((m) => (
          <Pressable
            key={m.key}
            onPress={() => setKey(m.key)}
            style={[styles.card, { borderRightColor: m.color, borderRightWidth: 5 }]}
          >
            <Text style={styles.cardTitle}>{m.label}</Text>
            <Text style={styles.cardDesc}>{m.desc}</Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  back: {  paddingVertical: 10, alignSelf: "flex-end", marginBottom: 8 },
  backText: {  color: "#1E40AF", textAlign: "right", fontWeight: "700" },
  screenTitle: {fontSize: 22,  color: "#0F172A", textAlign: "right", marginBottom: 6, fontFamily: "CodecBold"},
  hint: { fontSize: 12, color: "#8494B0", textAlign: "right", marginBottom: 14, lineHeight: 18 },
  grid: { gap: 10 },
  card: { backgroundColor: "#ffffff", borderWidth: 1, borderColor: "#D6E3F8", borderRadius: 12, padding: 16 },
  cardTitle: { fontSize: 16, fontWeight: "800", color: "#0F172A", textAlign: "right" },
  cardDesc: { fontSize: 12, color: "#8494B0", textAlign: "right", marginTop: 6 },
});
