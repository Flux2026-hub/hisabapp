import { useEffect, useMemo, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View, Pressable, TextInput } from "react-native";
import { sqlite } from "../../db/local";
import ReportHeader from "./components/ReportHeader";
import ReportSummary from "./components/ReportSummary";
import ReportActions, { exportCsv, exportPdf } from "./components/ReportActions";
import { useTheme } from "../ThemeContext";

export default function CommissionsReport({ onBack }: { onBack: () => void }) {
  const { colors } = useTheme();
  const today = new Date().toISOString().slice(0, 10);
  
  // حقول الفلترة
  const [from, setFrom] = useState(today.slice(0, 8) + "01");
  const [to, setTo] = useState(today);
  const [activeFrom, setActiveFrom] = useState(from);
  const [activeTo, setActiveTo] = useState(to);

  const [data, setData] = useState<any[]>([]);
  const [baseSymbol, setBaseSymbol] = useState("ر.ي");
  
  // شاشة التفاصيل
  const [selectedRep, setSelectedRep] = useState<any | null>(null);
  const [repInvoices, setRepInvoices] = useState<any[]>([]);

  const load = async () => {
    try {
      const base: any = await sqlite.getFirstAsync("SELECT symbol FROM currencies WHERE is_base = 1 LIMIT 1");
      if (base) setBaseSymbol(base.symbol || "ر.ي");

      const fromTs = new Date(activeFrom + "T00:00:00").getTime() || 0;
      const toTs = new Date(activeTo + "T23:59:59").getTime() || Date.now();

      const rows: any = await sqlite.getAllAsync(`
        SELECT r.id, r.code, r.name, r.commission_rate,
               COUNT(i.id) as invoice_count,
               SUM(i.total) as total_sales,
               SUM(i.commission_amount) as total_commission
        FROM sales_reps r
        LEFT JOIN invoices i ON i.sales_rep_id = r.id AND i.invoice_type = 'sales' AND i.created_at BETWEEN ? AND ?
        GROUP BY r.id
        ORDER BY total_sales DESC
      `, [fromTs, toTs]);
      setData(rows || []);
    } catch (e) { Alert.alert("تعذر التحميل", String(e)); }
  };

  useEffect(() => { load(); }, [activeFrom, activeTo]);

  const applyFilter = () => {
    setActiveFrom(from);
    setActiveTo(to);
  };

  const clearFilter = () => {
    const firstDay = today.slice(0, 8) + "01";
    setFrom(firstDay); setTo(today);
    setActiveFrom(firstDay); setActiveTo(today);
  };

  const loadRepInvoices = async (rep: any) => {
    try {
      const fromTs = new Date(activeFrom + "T00:00:00").getTime() || 0;
      const toTs = new Date(activeTo + "T23:59:59").getTime() || Date.now();
      
      const invs: any = await sqlite.getAllAsync(`
        SELECT invoice_no, party_name, total, created_at, commission_amount
        FROM invoices
        WHERE sales_rep_id = ? AND invoice_type = 'sales' AND created_at BETWEEN ? AND ?
        ORDER BY created_at DESC
      `, [rep.id, fromTs, toTs]);
      
      setRepInvoices(invs || []);
      setSelectedRep(rep);
    } catch (e) { Alert.alert("تعذر التحميل", String(e)); }
  };

  const stats = data.reduce((acc, curr) => {
    acc.sales += Number(curr.total_sales) || 0;
    acc.commissions += Number(curr.total_commission) || 0;
    return acc;
  }, { sales: 0, commissions: 0 });

  const printRepStatement = (rep: any) => {
    const rows = repInvoices.map(inv => `<tr>
      <td>${inv.invoice_no}</td>
      <td>${inv.party_name}</td>
      <td>${new Date(inv.created_at).toLocaleDateString("ar-EG")}</td>
      <td>${Number(inv.total).toFixed(2)}</td>
      <td>${Number(inv.commission_amount).toFixed(2)}</td>
    </tr>`).join("");

    const html = `<!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8"/><style>body{font-family:Arial;padding:24px;}table{width:100%;border-collapse:collapse;margin-top:20px;}th,td{border:1px solid #ccc;padding:8px;text-align:right;}th{background:#1E40AF;color:#fff;}.header{text-align:center;border-bottom:2px solid #F97316;padding-bottom:10px;}</style></head><body>
      <div class="header"><h2>كشف عمولات المندوب: ${rep.name}</h2><p>الفترة: ${activeFrom} إلى ${activeTo}</p></div>
      <h3>الرمز: ${rep.code} | النسبة: ${rep.commission_rate}%</h3>
      <h3>إجمالي المبيعات: ${Number(rep.total_sales).toFixed(2)} ${baseSymbol} | إجمالي العمولة: ${Number(rep.total_commission).toFixed(2)} ${baseSymbol}</h3>
      <table><thead><tr><th>رقم الفاتورة</th><th>العميل</th><th>التاريخ</th><th>المبلغ</th><th>العمولة</th></tr></thead><tbody>${rows}</tbody></table>
    </body></html>`;
    
    exportPdf(html, `عمولات-${rep.name}.pdf`);
  };

  return (
    <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
      
      <Pressable style={styles.backWrap} onPress={() => selectedRep ? setSelectedRep(null) : onBack()}>
        <Text style={[styles.back, { color: colors.blue }]}>‹ {selectedRep ? "العودة للقائمة" : "العودة إلى التقارير"}</Text>
      </Pressable>

      <ReportHeader title="تقرير العمولات" subtitle="مبيعات وعمولات مناديب البيع" from={activeFrom} to={activeTo} currencySymbol={baseSymbol} />

      {!selectedRep ? (
        <>
          {/* شاشة القائمة الرئيسية */}
          <View style={[styles.filterBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.label, { color: colors.textMuted }]}>من تاريخ (YYYY-MM-DD)</Text>
            <TextInput style={[styles.input, { backgroundColor: colors.bg, borderColor: colors.border, color: colors.text }]} value={from} onChangeText={setFrom} textAlign="right" />
            
            <Text style={[styles.label, { color: colors.textMuted }]}>إلى تاريخ (YYYY-MM-DD)</Text>
            <TextInput style={[styles.input, { backgroundColor: colors.bg, borderColor: colors.border, color: colors.text }]} value={to} onChangeText={setTo} textAlign="right" />
            
            <View style={{ flexDirection: "row-reverse", gap: 8, marginTop: 12 }}>
              <Pressable style={[styles.btnPrimary, { backgroundColor: colors.orange }]} onPress={applyFilter}>
                <Text style={styles.btnPrimaryText}>تطبيق الفلتر</Text>
              </Pressable>
              <Pressable style={[styles.btnSecondary, { borderColor: colors.border, backgroundColor: colors.bg }]} onPress={clearFilter}>
                <Text style={[styles.btnSecondaryText, { color: colors.text }]}>مسح</Text>
              </Pressable>
            </View>
          </View>

          <View style={{ flexDirection: "row-reverse", gap: 10, marginBottom: 16 }}>
            <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>إجمالي المبيعات</Text>
              <Text style={[styles.statValue, { color: colors.text }]}>{stats.sales.toFixed(2)}</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>إجمالي العمولات</Text>
              <Text style={[styles.statValue, { color: colors.orange }]}>{stats.commissions.toFixed(2)}</Text>
            </View>
          </View>

          <Text style={[styles.sectionTitle, { color: colors.text }]}>التفاصيل ({data.length})</Text>
          {data.map((rep) => (
            <Pressable key={rep.id} style={[styles.repCard, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => loadRepInvoices(rep)}>
              <View style={styles.repHeader}>
                <View style={[styles.rateBadge, { backgroundColor: colors.isDark ? "#7C2D12" : "#FFF7ED" }]}>
                  <Text style={[styles.rateText, { color: colors.orange }]}>{rep.commission_rate}%</Text>
                </View>
                <View style={{ flex: 1, alignItems: "flex-end" }}>
                  <Text style={[styles.repName, { color: colors.text }]}>{rep.name}</Text>
                  <Text style={[styles.repCode, { color: colors.textMuted }]}>الكود: {rep.code}</Text>
                </View>
              </View>
              <View style={{ flexDirection: "row-reverse", gap: 8, marginTop: 12 }}>
                <View style={[styles.innerStat, { backgroundColor: colors.bg }]}>
                  <Text style={[styles.innerStatLabel, { color: colors.textMuted }]}>عدد الفواتير</Text>
                  <Text style={[styles.innerStatValue, { color: colors.text }]}>{rep.invoice_count}</Text>
                </View>
                <View style={[styles.innerStat, { backgroundColor: colors.bg }]}>
                  <Text style={[styles.innerStatLabel, { color: colors.textMuted }]}>إجمالي المبيعات</Text>
                  <Text style={[styles.innerStatValue, { color: colors.text }]}>{Number(rep.total_sales || 0).toFixed(2)}</Text>
                </View>
                <View style={[styles.innerStat, { backgroundColor: colors.bg }]}>
                  <Text style={[styles.innerStatLabel, { color: colors.textMuted }]}>العمولة</Text>
                  <Text style={[styles.innerStatValue, { color: colors.orange }]}>{Number(rep.total_commission || 0).toFixed(2)}</Text>
                </View>
              </View>
            </Pressable>
          ))}
        </>
      ) : (
        <>
          {/* شاشة التفاصيل للمندوب المحدد */}
          <View style={[styles.repCard, { backgroundColor: colors.surface, borderColor: colors.border, marginBottom: 16 }]}>
            <View style={styles.repHeader}>
              <View style={[styles.rateBadge, { backgroundColor: colors.isDark ? "#7C2D12" : "#FFF7ED" }]}>
                <Text style={[styles.rateText, { color: colors.orange }]}>{selectedRep.commission_rate}%</Text>
              </View>
              <View style={{ flex: 1, alignItems: "flex-end" }}>
                <Text style={[styles.repName, { color: colors.text }]}>{selectedRep.name}</Text>
                <Text style={[styles.repCode, { color: colors.textMuted }]}>الكود: {selectedRep.code}</Text>
              </View>
            </View>
            <View style={{ flexDirection: "row-reverse", gap: 8, marginTop: 12 }}>
              <View style={[styles.innerStat, { backgroundColor: colors.bg }]}>
                <Text style={[styles.innerStatLabel, { color: colors.textMuted }]}>إجمالي المبيعات</Text>
                <Text style={[styles.innerStatValue, { color: colors.text }]}>{Number(selectedRep.total_sales || 0).toFixed(2)}</Text>
              </View>
              <View style={[styles.innerStat, { backgroundColor: colors.bg }]}>
                <Text style={[styles.innerStatLabel, { color: colors.textMuted }]}>إجمالي العمولة</Text>
                <Text style={[styles.innerStatValue, { color: colors.orange }]}>{Number(selectedRep.total_commission || 0).toFixed(2)}</Text>
              </View>
            </View>
          </View>

          <Pressable style={[styles.btnPrimary, { backgroundColor: colors.orange, marginBottom: 20 }]} onPress={() => printRepStatement(selectedRep)}>
            <Text style={styles.btnPrimaryText}>طباعة الكشف (PDF)</Text>
          </Pressable>

          <Text style={[styles.sectionTitle, { color: colors.text }]}>الفواتير ({repInvoices.length})</Text>
          {repInvoices.map((inv, i) => (
            <View key={i} style={[styles.invoiceRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.invAmount, { color: colors.text }]}>{Number(inv.total).toFixed(2)}</Text>
              <View style={{ flex: 1, alignItems: "flex-end" }}>
                <Text style={[styles.invParty, { color: colors.text }]}>{inv.party_name}</Text>
                <Text style={[styles.invMeta, { color: colors.textMuted }]}>
                  {inv.invoice_no} · {new Date(inv.created_at).toLocaleDateString("ar-EG")} · عمولة: <Text style={{ color: colors.orange, fontWeight: "700" }}>{Number(inv.commission_amount).toFixed(2)}</Text>
                </Text>
              </View>
            </View>
          ))}
        </>
      )}
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  scrollContainer: { backgroundColor: "transparent", paddingHorizontal: 8, paddingTop: 16, paddingBottom: 40 },
  backWrap: { paddingVertical: 8 },
  back: { alignSelf: "flex-start", fontWeight: "700", textAlign: "left" },
  filterBox: { borderWidth: 1, borderRadius: 12, padding: 16, marginBottom: 16 },
  label: { fontSize: 12, marginTop: 8, marginBottom: 4, textAlign: "right", width: "100%", fontWeight: "700" },
  input: { borderWidth: 1, borderRadius: 8, padding: 10, fontSize: 14, textAlign: "right", width: "100%" },
  btnPrimary: { padding: 12, borderRadius: 8, flex: 1, alignItems: "center", justifyContent: "center" },
  btnPrimaryText: { color: "#fff", fontWeight: "800", fontSize: 14 },
  btnSecondary: { padding: 12, borderRadius: 8, borderWidth: 1, flex: 1, alignItems: "center", justifyContent: "center" },
  btnSecondaryText: { fontWeight: "800", fontSize: 14 },
  statCard: { flex: 1, borderWidth: 1, borderRadius: 12, padding: 16, alignItems: "flex-end" },
  statLabel: { fontSize: 12, fontWeight: "700", marginBottom: 4 },
  statValue: { fontSize: 20, fontWeight: "800" },
  sectionTitle: { fontSize: 15, marginTop: 8, marginBottom: 12, textAlign: "left", width: "100%", fontFamily: "CodecBold", fontWeight: "700" },
  repCard: { borderWidth: 1, borderRadius: 12, padding: 16, marginBottom: 12 },
  repHeader: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between" },
  rateBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  rateText: { fontSize: 14, fontWeight: "800" },
  repName: { fontSize: 18, fontWeight: "800", textAlign: "right" },
  repCode: { fontSize: 12, marginTop: 2, textAlign: "right" },
  innerStat: { flex: 1, padding: 10, borderRadius: 8, alignItems: "flex-end" },
  innerStatLabel: { fontSize: 10, marginBottom: 4 },
  innerStatValue: { fontSize: 14, fontWeight: "800" },
  invoiceRow: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 8 },
  invAmount: { fontSize: 16, fontWeight: "800" },
  invParty: { fontSize: 14, fontWeight: "700", textAlign: "right" },
  invMeta: { fontSize: 11, marginTop: 2, textAlign: "right" },
});
