import { useEffect, useMemo, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View, Pressable } from "react-native";
import { sqlite } from "../../db/local";
import ReportHeader from "./components/ReportHeader";
import ReportSummary from "./components/ReportSummary";
import ReportActions, { exportCsv, exportPdf } from "./components/ReportActions";
import { useTheme } from "../ThemeContext"; // 🚀 استدعاء مركز الألوان

type Category = "all" | "raw" | "packaging" | "finished";

export default function InventoryReport({ onBack }: { onBack: () => void }) {
  const { colors } = useTheme(); // 🚀 قراءة الألوان
  const today = new Date().toISOString().slice(0, 10);
  const [from] = useState(today.slice(0, 8) + "01");
  const [to] = useState(today);
  const [items, setItems] = useState<any[]>([]);
  const [filter, setFilter] = useState<Category>("all");
  const [baseSymbol, setBaseSymbol] = useState("ر.ي");

  const load = async () => {
    try {
      const base: any = await sqlite.getFirstAsync("SELECT symbol, code FROM currencies WHERE is_base = 1 LIMIT 1");
      if (base) setBaseSymbol(base.symbol || base.code);

      const rows: any = await sqlite.getAllAsync(`SELECT id, sku, name, item_type, unit, stock_quantity, average_cost FROM items ORDER BY item_type, name`);
      setItems(rows || []);
    } catch (e) {
      Alert.alert("تعذر التحميل", String(e));
    }
  };

  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => {
    if (filter === "all") return items;
    if (filter === "raw") return items.filter((i) => i.item_type === "raw_material" || i.item_type === "production_material");
    if (filter === "packaging") return items.filter((i) => i.item_type === "packaging");
    if (filter === "finished") return items.filter((i) => i.item_type === "compound_finished" || i.item_type === "finished_product");
    return items;
  }, [items, filter]);

  const stats = useMemo(() => {
    let totalValue = 0;
    let lowStock = 0;
    let outOfStock = 0;
    for (const it of filtered) {
      const q = Number(it.stock_quantity) || 0;
      const c = Number(it.average_cost) || 0;
      totalValue += q * c;
      if (q === 0) outOfStock++;
      else if (q < 10) lowStock++;
    }
    return { count: filtered.length, totalValue, lowStock, outOfStock };
  }, [filtered]);

  const buildHtml = () => {
    const rows = filtered
      .map(
        (it) => `<tr>
          <td>${it.sku || ""}</td>
          <td>${it.name || ""}</td>
          <td>${Number(it.stock_quantity || 0).toFixed(2)} ${it.unit || ""}</td>
          <td>${Number(it.average_cost || 0).toFixed(2)}</td>
          <td>${(Number(it.stock_quantity || 0) * Number(it.average_cost || 0)).toFixed(2)}</td>
        </tr>`
      )
      .join("");

    return `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8"/>
    <style>
      body{font-family:Arial,Tahoma;padding:24px;color:#0F172A;direction:rtl}
      .head{text-align:center;border-bottom:2px solid #F97316;padding-bottom:12px;margin-bottom:16px}
      .brand{font-size:22px;font-weight:800;color:#1E40AF}
      h1{font-size:18px;margin:12px 0}
      table{width:100%;border-collapse:collapse;margin-top:12px}
      th,td{border:1px solid #D6E3F8;padding:7px;text-align:right;font-size:14px}
      th{background:#1E40AF;color:#fff}
      .sum{margin:14px 0;padding:12px;background:#eef6ff;border-radius:8px}
      .sum div{margin:4px 0;font-weight:700;color:#1E40AF}
    </style></head><body>
      <div class="head"><div class="brand">فلوكس</div><div style="font-size:14px;color:#8494B0">منتج تسليك المجاري</div></div>
      <h1>تقرير المخزون</h1>
      <div style="color:#526078;font-size:11px">العملة الأساسية: ${baseSymbol}</div>
      <div class="sum">
        <div>عدد الأصناف: ${stats.count}</div>
        <div>قيمة المخزون (${baseSymbol}): ${stats.totalValue.toFixed(2)}</div>
        <div>أصناف قاربت على النفاد: ${stats.lowStock}</div>
        <div>أصناف نافذة: ${stats.outOfStock}</div>
      </div>
      <table>
        <thead><tr><th>الرمز</th><th>الاسم</th><th>الرصيد</th><th>التكلفة</th><th>القيمة</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </body></html>`;
  };

  const csvContent = useMemo(() => {
    const header = "الرمز,الاسم,الرصيد,الوحدة,التكلفة,القيمة\n";
    const lines = filtered
      .map(
        (it) =>
          `${it.sku || ""},${it.name || ""},${Number(it.stock_quantity || 0).toFixed(2)},${it.unit || ""},${Number(it.average_cost || 0).toFixed(2)},${(Number(it.stock_quantity || 0) * Number(it.average_cost || 0)).toFixed(2)}`
      )
      .join("\n");
    return header + lines;
  }, [filtered]);

  return (
    <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
      
      <Pressable android_ripple={{ color: "rgba(0,0,0,0.1)" }} style={styles.backWrap} onPress={onBack}>
        <Text style={[styles.back, { color: colors.blue }]}>‹ العودة إلى التقارير</Text>
      </Pressable>

      <ReportHeader title="تقرير المخزون" subtitle="أرصدة جميع الأصناف وقيمة المخزون" from={from} to={to} currencySymbol={baseSymbol} />

      <View style={styles.filterRow}>
        {([["all", "الكل"], ["raw", "مواد خام"], ["packaging", "عبوات"], ["finished", "منتجات نهائية"]] as [Category, string][]).map(([key, label]) => (
          <Pressable android_ripple={{ color: "rgba(0,0,0,0.1)" }} key={key} onPress={() => setFilter(key)} style={[styles.chip, { backgroundColor: colors.surface, borderColor: colors.border }, filter === key && { backgroundColor: colors.blue, borderColor: colors.blue }]}>
            <Text style={[styles.chipText, { color: colors.text }, filter === key && { color: "#FFF" }]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      <ReportActions
        onRefresh={load}
        onExportPdf={() => exportPdf(buildHtml(), `تقرير-المخزون-${new Date().toISOString().slice(0, 10)}.pdf`)}
        onExportCsv={() => exportCsv(csvContent, `تقرير-المخزون-${new Date().toISOString().slice(0, 10)}.csv`)}
      />

      <ReportSummary
        items={[
          { label: "عدد الأصناف", value: String(stats.count) },
          { label: `قيمة المخزون (${baseSymbol})`, value: stats.totalValue.toFixed(2) },
          { label: "قاربت على النفاد", value: String(stats.lowStock), color: colors.orange },
          { label: "نافذة", value: String(stats.outOfStock), color: colors.danger },
        ]}
      />

      <Text style={[styles.sectionTitle, { color: colors.blue }]}>تفاصيل الأصناف</Text>
      {filtered.length === 0 ? (
        <Text style={[styles.empty, { color: colors.textMuted }]}>لا توجد أصناف</Text>
      ) : (
        filtered.map((it) => {
          const q = Number(it.stock_quantity) || 0;
          const c = Number(it.average_cost) || 0;
          const value = q * c;
          const qtyColor = q === 0 ? colors.danger : q < 10 ? colors.orange : colors.success;
          
          return (
            <View key={it.id} style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.rowInfo}>
                <Text style={[styles.rowName, { color: colors.text }]}>{it.name}</Text>
                <Text style={[styles.rowMeta, { color: colors.textMuted }]}>{it.sku}</Text>
                <Text style={[styles.qty, { color: qtyColor }]}>الرصيد: {q.toFixed(2)} {it.unit}</Text>
              </View>
              <View style={styles.rowValues}>
                <Text style={[styles.value, { color: colors.blue }]}>{value.toFixed(2)} {baseSymbol}</Text>
                <Text style={[styles.cost, { color: colors.textMuted }]}>تكلفة: {c.toFixed(2)}</Text>
              </View>
            </View>
          );
        })
      )}
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  scrollContainer: { backgroundColor: "transparent", paddingHorizontal: 8, paddingTop: 16, paddingBottom: 40 },
  backWrap: { paddingVertical: 8 },
  back: { alignSelf: "flex-start", fontWeight: "700", textAlign: "left" },
  filterRow: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 6, marginTop: 8, marginBottom: 8 },
  chip: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  chipText: { fontSize: 12, fontWeight: "600" },
  sectionTitle: { fontSize: 15, marginTop: 14, marginBottom: 8, textAlign: "left", width: "100%", fontFamily: "CodecBold" },
  empty: { textAlign: "right", fontSize: 12, padding: 10 },
  row: { borderWidth: 1, borderRadius: 12, padding: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  rowInfo: { flex: 1, alignItems: "flex-end", paddingRight: 10 },
  rowValues: { alignItems: "flex-start", minWidth: 100 },
  rowName: { fontWeight: "700", fontSize: 14, textAlign: "right" },
  rowMeta: { fontSize: 11, marginTop: 2, textAlign: "right" },
  qty: { fontSize: 13, marginTop: 4, textAlign: "right", fontWeight: "700" },
  value: { fontWeight: "800", fontSize: 16, textAlign: "left" },
  cost: { fontSize: 12, marginTop: 2, textAlign: "left" },
});
