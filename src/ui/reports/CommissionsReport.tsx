import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { sqlite } from "../../db/local";
import { printHtml } from "../../utils/printDocument";

type RepSummary = { id: string; name: string; code: string; rate: number; invoiceCount: number; totalSales: number; totalCommission: number; };

export default function CommissionsReport({ onBack }: { onBack: () => void }) {
  const [summaries, setSummaries] = useState<RepSummary[]>([]);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedRep, setSelectedRep] = useState<RepSummary | null>(null);
  const [details, setDetails] = useState<any[]>([]);

  const parseDate = (s: string, endOfDay = false): number | null => {
    if (!s.trim()) return null;
    const parts = s.trim().split("-");
    if (parts.length !== 3) return null;
    const [y, m, d] = parts.map(Number);
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d, endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0).getTime();
  };

  const load = async () => {
    setLoading(true);
    try {
      const fromTs = parseDate(fromDate);
      const toTs = parseDate(toDate, true);
      let where = "WHERE invoice_type = 'sales' AND sales_rep_id IS NOT NULL";
      const params: any[] = [];
      if (fromTs) { where += " AND created_at >= ?"; params.push(fromTs); }
      if (toTs) { where += " AND created_at <= ?"; params.push(toTs); }
      const rows: any = await sqlite.getAllAsync(`SELECT sales_rep_id AS id, sales_rep_name AS name, SUM(commission_amount) AS totalCommission, SUM(total) AS totalSales, COUNT(*) AS invoiceCount, MAX(commission_rate) AS rate FROM invoices ${where} GROUP BY sales_rep_id ORDER BY totalCommission DESC`, params);
      const reps: any = await sqlite.getAllAsync("SELECT id, name, code, commission_rate FROM sales_reps");
      const repMap = new Map<string, any>();
      (reps || []).forEach((r: any) => repMap.set(r.id, r));
      setSummaries((rows || []).map((row: any) => {
        const rep = repMap.get(row.id);
        return { id: row.id, name: row.name || rep?.name || "—", code: rep?.code || "—", rate: Number(row.rate || rep?.commission_rate || 0), invoiceCount: Number(row.invoiceCount) || 0, totalSales: Number(row.totalSales) || 0, totalCommission: Number(row.totalCommission) || 0 };
      }));
    } catch (e) { Alert.alert("تعذر التحميل", String(e)); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const loadDetails = async (repId: string) => {
    setLoading(true);
    try {
      const fromTs = parseDate(fromDate);
      const toTs = parseDate(toDate, true);
      let where = "WHERE invoice_type = 'sales' AND sales_rep_id = ?";
      const params: any[] = [repId];
      if (fromTs) { where += " AND created_at >= ?"; params.push(fromTs); }
      if (toTs) { where += " AND created_at <= ?"; params.push(toTs); }
      
      const rows: any = await sqlite.getAllAsync(
        `SELECT invoice_no, party_name, total, commission_amount, commission_rate, created_at FROM invoices ${where} ORDER BY created_at ASC`,
        params
      );
      setDetails(rows || []);
    } catch (e) { Alert.alert("تعذر التحميل", String(e)); }
    finally { setLoading(false); }
  };

  const goBack = () => {
    setSelectedRep(null);
    setDetails([]);
  };

  const grandTotalSales = summaries.reduce((s, x) => s + x.totalSales, 0);
  const grandTotalCommission = summaries.reduce((s, x) => s + x.totalCommission, 0);
  const clearFilter = () => { setFromDate(""); setToDate(""); setTimeout(load, 50); };

  const buildRepHtml = async () => {
    if (!selectedRep) return "";
    const rows = details.map(d => `
      <tr>
        <td>${new Date(d.created_at).toLocaleDateString("ar-EG")}</td>
        <td>${d.invoice_no}</td>
        <td>${d.party_name || "—"}</td>
        <td>${Number(d.total).toFixed(2)}</td>
        <td>${d.commission_rate}%</td>
        <td>${Number(d.commission_amount).toFixed(2)}</td>
      </tr>
    `).join("");

    return `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8"/><style>
      @page { size: A4; margin: 12mm; }
      body { font-family: Arial, Tahoma; direction: rtl; color: #0F172A; font-size: 14px; padding: 0; margin: 0; }
      .header { text-align: center; border-bottom: 3px solid #F97316; padding-bottom: 12px; margin-bottom: 16px; }
      .brand { font-size: 24px; font-weight: 800; color: #1E40AF; }
      .info { margin-bottom: 16px; display: flex; justify-content: space-between; background: #EFF6FF; padding: 12px; border-radius: 8px; border: 1px solid #D6E3F8; }
      .info div { font-weight: 700; }
      table { width: 100%; border-collapse: collapse; margin-top: 12px; }
      th { background: #1E40AF; color: #FFF; padding: 10px; text-align: right; font-size: 13px; }
      td { padding: 9px; border-bottom: 1px solid #E2E8F0; text-align: right; font-size: 13px; }
      tr:nth-child(even) td { background: #F8FAFC; }
      .summary { margin-top: 20px; display: flex; justify-content: space-between; background: #EFF6FF; padding: 15px; border-radius: 8px; font-weight: 800; font-size: 16px; border: 1px solid #D6E3F8; }
      .footer { margin-top: 30px; text-align: center; font-size: 10px; color: #8494B0; }
    </style></head><body>
      <div class="header">
        <div class="brand">فلوكس</div>
        <div style="font-size: 14px; color: #64748B;">كشف حساب مندوب مبيعات</div>
      </div>
      <div class="info">
        <div>المندوب: ${selectedRep.name}</div>
        <div>الكود: ${selectedRep.code}</div>
        <div>الفترة: ${fromDate || "البداية"} إلى ${toDate || "اليوم"}</div>
      </div>
      <table>
        <thead><tr><th>التاريخ</th><th>الفاتورة</th><th>العميل</th><th>المبلغ</th><th>النسبة</th><th>العمولة</th></tr></thead>
        <tbody>${rows || "<tr><td colspan='6' style='text-align:center;'>لا توجد فواتير</td></tr>"}</tbody>
      </table>
      <div class="summary">
        <span>إجمالي المبيعات: ${selectedRep.totalSales.toFixed(2)}</span>
        <span>إجمالي العمولات: ${selectedRep.totalCommission.toFixed(2)}</span>
      </div>
      <div class="footer">تم إنشاء هذا الكشف من نظام فلوكس المحاسبي</div>
    </body></html>`;
  };

  const printStatement = async () => {
    const html = await buildRepHtml();
    printHtml(html);
  };

  if (selectedRep) {
    return (
      <ScrollView contentContainerStyle={{ backgroundColor: "#ffffff", marginHorizontal: 16, marginTop: 16, marginBottom: 16, borderRadius: 16, padding: 20, paddingBottom: 40 }}>
        <Pressable style={styles.back} onPress={goBack}>
          <Text style={styles.backText}>{"&gt;"} العودة للقائمة</Text>
        </Pressable>

        <View style={styles.repCard}>
          <View style={styles.repHeader}>
            <Text style={styles.repName}>{selectedRep.name}</Text>
            <Text style={styles.repRate}>{selectedRep.rate}%</Text>
          </View>
          <Text style={styles.repCode}>الكود: {selectedRep.code}</Text>
          <View style={styles.repStats}>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>إجمالي المبيعات</Text>
              <Text style={styles.statValue}>{selectedRep.totalSales.toFixed(2)}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>إجمالي العمولة</Text>
              <Text style={[styles.statValue, { color: "#F97316" }]}>{selectedRep.totalCommission.toFixed(2)}</Text>
            </View>
          </View>
        </View>

        <Pressable style={[styles.primary, { marginBottom: 16 }]} onPress={printStatement}>
          <Text style={styles.primaryText}>طباعة الكشف (PDF)</Text>
        </Pressable>

        <Text style={styles.sectionTitle}>الفواتير ({details.length})</Text>

        {details.length === 0 ? (
          <Text style={styles.empty}>لا توجد فواتير لهذا المندوب في هذه الفترة</Text>
        ) : (
          details.map((d, idx) => (
            <View key={idx} style={styles.detailRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.detailName}>{d.party_name || "—"}</Text>
                <Text style={styles.detailMeta}>{d.invoice_no} · {new Date(d.created_at).toLocaleDateString("ar-EG")}</Text>
              </View>
              <View style={{ alignItems: "flex-start" }}>
                <Text style={styles.detailValue}>{Number(d.total).toFixed(2)}</Text>
                <Text style={styles.detailCommission}>عمولة: {Number(d.commission_amount).toFixed(2)}</Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ backgroundColor: "#ffffff", marginHorizontal: 16, marginTop: 16, marginBottom: 16, borderRadius: 16, padding: 20, paddingBottom: 40 }}>
      <Pressable style={styles.back} onPress={onBack}>
        <Text style={styles.backText}>{"&gt;"} العودة إلى التقارير</Text>
      </Pressable>

      <Text style={styles.screenTitle}>تقرير العمولات</Text>
      <Text style={styles.hint}>إجمالي مبيعات وعمولات كل مندوب في الفترة المحددة.</Text>

      <View style={styles.filterBox}>
        <Text style={styles.label}>من تاريخ (YYYY-MM-DD)</Text>
        <TextInput style={styles.input} value={fromDate} onChangeText={setFromDate} placeholder="2025-01-01" placeholderTextColor="#8494B0" keyboardType="numbers-and-punctuation" />
        <Text style={styles.label}>إلى تاريخ (YYYY-MM-DD)</Text>
        <TextInput style={styles.input} value={toDate} onChangeText={setToDate} placeholder="2025-12-31" placeholderTextColor="#8494B0" keyboardType="numbers-and-punctuation" />
        <View style={styles.buttons}>
          <Pressable style={styles.primary} onPress={load} disabled={loading}>
            <Text style={styles.primaryText}>{loading ? "..." : "تطبيق الفلتر"}</Text>
          </Pressable>
          <Pressable style={styles.cancel} onPress={clearFilter}>
            <Text style={styles.cancelText}>مسح</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.totalsBox}>
        <View style={styles.totalItem}>
          <Text style={styles.totalLabel}>إجمالي المبيعات</Text>
          <Text style={styles.totalValue}>{grandTotalSales.toFixed(2)}</Text>
        </View>
        <View style={styles.totalItem}>
          <Text style={styles.totalLabel}>إجمالي العمولات</Text>
          <Text style={[styles.totalValue, { color: "#F97316" }]}>{grandTotalCommission.toFixed(2)}</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>التفاصيل ({summaries.length})</Text>

      {summaries.length === 0 ? (
        <Text style={styles.empty}>لا توجد فواتير مرتبطة بمناديب في هذه الفترة</Text>
      ) : (
        summaries.map((s) => (
          <Pressable key={s.id} style={styles.repCard} onPress={() => { setSelectedRep(s); loadDetails(s.id); }}>
            <View style={styles.repHeader}>
              <Text style={styles.repName}>{s.name}</Text>
              <Text style={styles.repRate}>{s.rate}%</Text>
            </View>
            <Text style={styles.repCode}>الكود: {s.code}</Text>
            <View style={styles.repStats}>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>عدد الفواتير</Text>
                <Text style={styles.statValue}>{s.invoiceCount}</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>إجمالي المبيعات</Text>
                <Text style={styles.statValue}>{s.totalSales.toFixed(2)}</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>العمولة</Text>
                <Text style={[styles.statValue, { color: "#F97316" }]}>{s.totalCommission.toFixed(2)}</Text>
              </View>
            </View>
          </Pressable>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  back: {  paddingVertical: 10, alignSelf: "flex-end", marginBottom: 8 },
  backText: {  color: "#1E40AF", textAlign: "right", fontWeight: "700" },
  screenTitle: {fontSize: 22,  color: "#0F172A",  marginBottom: 6,  textAlign: "right", writingDirection: "rtl", width: "100%", fontFamily: "CodecBold"},
  hint: {fontSize: 12, color: "#8494B0",  marginBottom: 14, lineHeight: 18, textAlign: "right", writingDirection: "rtl", width: "100%"},
  filterBox: { backgroundColor: "#EFF6FF", padding: 14, borderRadius: 12, marginBottom: 16, borderWidth: 1, borderColor: "#D6E3F8" },
  label: {fontSize: 13, color: "#0F172A", marginTop: 8, marginBottom: 4, fontWeight: "700",textAlign: "right", writingDirection: "rtl", width: "100%"},
  input: {backgroundColor: "#ffffff", borderWidth: 1, borderColor: "#D6E3F8", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 9, fontSize: 15, color: "#0F172A",textAlign: "right", writingDirection: "rtl", width: "100%"},
  buttons: { flexDirection: "row-reverse", gap: 8, marginTop: 16 },
  primary: { backgroundColor: "#F97316", padding: 14, borderRadius: 10, flex: 1 },
  primaryText: { color: "#fff", fontWeight: "700", textAlign: "center" },
  cancel: { borderWidth: 1, borderColor: "#d1d5db", padding: 13, borderRadius: 10, flex: 1 },
  cancelText: { color: "#0F172A", textAlign: "center", fontWeight: "700" },
  totalsBox: { flexDirection: "row-reverse", gap: 8, marginBottom: 16 },
  totalItem: { flex: 1, backgroundColor: "#ffffff", borderWidth: 1, borderColor: "#D6E3F8", borderRadius: 12, padding: 12 },
  totalLabel: { fontSize: 12, color: "#8494B0", marginBottom: 4, textAlign: "right" },
  totalValue: { fontSize: 18, fontWeight: "800", color: "#0F172A", textAlign: "right" },
  sectionTitle: {fontSize: 16,  color: "#0F172A",  marginTop: 8, marginBottom: 8 ,  textAlign: "right", writingDirection: "rtl", width: "100%", fontFamily: "CodecBold"},
  empty: { textAlign: "center", color: "#8494B0", padding: 20 },
  repCard: { backgroundColor: "#ffffff", borderWidth: 1, borderColor: "#D6E3F8", borderRadius: 12, padding: 14, marginBottom: 10 },
  repHeader: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center" },
  repName: { fontSize: 16, fontWeight: "800", color: "#0F172A", textAlign: "right", flex: 1 },
  repRate: { fontSize: 13, fontWeight: "800", color: "#F97316", backgroundColor: "#FFF7ED", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  repCode: { fontSize: 12, color: "#8494B0", marginTop: 4, marginBottom: 10, textAlign: "right" },
  repStats: { flexDirection: "row-reverse", gap: 8 },
  statItem: { flex: 1, backgroundColor: "#EFF6FF", padding: 10, borderRadius: 8 },
  statLabel: { fontSize: 11, color: "#8494B0", marginBottom: 3, textAlign: "right" },
  statValue: { fontSize: 14, fontWeight: "700", color: "#0F172A", textAlign: "right" },
  detailRow: { backgroundColor: "#ffffff", borderWidth: 1, borderColor: "#D6E3F8", borderRadius: 10, padding: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  detailName: { fontWeight: "700", fontSize: 14, color: "#0F172A", textAlign: "right" },
  detailMeta: { fontSize: 11, color: "#8494B0", marginTop: 2, textAlign: "right" },
  detailValue: { fontWeight: "800", fontSize: 15, color: "#0F172A", textAlign: "left" },
  detailCommission: { fontSize: 11, color: "#F97316", marginTop: 2, textAlign: "left", fontWeight: "700" },
});
