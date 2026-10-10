import { useState } from "react";
import {
  Pressable, ScrollView, StyleSheet, Text, View,
} from "react-native";
import SalesReport from "./SalesReport";
import PurchaseReport from "./PurchaseReport";
import InventoryReport from "./InventoryReport";

type ReportKey = "menu" | "sales" | "purchase" | "inventory";

const MENU: { key: ReportKey; label: string; desc: string; color: string }[] = [
  {
    key: "sales",
    label: "تقرير المبيعات",
    desc: "كل فواتير المبيعات في الفترة المحددة",
    color: "#0b806c",
  },
  {
    key: "purchase",
    label: "تقرير المشتريات",
    desc: "كل فواتير المشتريات في الفترة المحددة",
    color: "#92400e",
  },
  {
    key: "inventory",
    label: "تقرير المخزون",
    desc: "أرصدة الأصناف وقيمة المخزون",
    color: "#315b85",
  },
];

export default function ReportsIndex({ onBack }: { onBack: () => void }) {
  const [key, setKey] = useState<ReportKey>("menu");
  const goMenu = () => setKey("menu");

  if (key === "sales") return <SalesReport onBack={goMenu} />;
  if (key === "purchase") return <PurchaseReport onBack={goMenu} />;
  if (key === "inventory") return <InventoryReport onBack={goMenu} />;

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 40, paddingHorizontal: 4 }}>
      <Pressable style={styles.back} onPress={onBack}>
        <Text style={styles.backText}>← العودة إلى الوحدات المحاسبية</Text>
      </Pressable>

      <Text style={styles.screenTitle}>التقارير</Text>
      <Text style={styles.hint}>
        اختر التقرير المطلوب. جميع التقارير محلية وتعمل بدون إنترنت.
      </Text>

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
  back: { paddingVertical: 10, marginBottom: 8 },
  backText: { color: "#087f68", fontWeight: "700", textAlign: "right" },
  screenTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#172033",
    textAlign: "right",
    marginBottom: 6,
  },
  hint: {
    fontSize: 12,
    color: "#758298",
    textAlign: "right",
    marginBottom: 14,
    lineHeight: 18,
  },
  grid: { gap: 10 },
  card: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    padding: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#172033",
    textAlign: "right",
  },
  cardDesc: {
    fontSize: 12,
    color: "#758298",
    textAlign: "right",
    marginTop: 6,
  },
});