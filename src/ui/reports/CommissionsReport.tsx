import { useEffect, useState } from "react";
import {
  Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from "react-native";
import { sqlite } from "../../db/local";

type Row = any;

type RepSummary = {
  id: string;
  name: string;
  code: string;
  rate: number;
  invoiceCount: number;
  totalSales: number;
  totalCommission: number;
};

export default function CommissionsReport({ onBack }: { onBack: () => void }) {
  const [summaries, setSummaries] = useState<RepSummary[]>([]);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [loading, setLoading] = useState(false);

  const parseDate = (s: string, endOfDay = false): number | null => {
    if (!s.trim()) return null;
    const parts = s.trim().split("-");
    if (parts.length !== 3) return null;
    const [y, m, d] = parts.map(Number);
    if (!y || !m || !d) return null;
    const date = new Date(y, m - 1, d, endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0);
    return date.getTime();
  };

  const load = async () => {
    setLoading(true);
    try {
      const fromTs = parseDate(fromDate);
      const toTs = parseDate(toDate, true);

      let where = "WHERE invoice_type = 'sales' AND sales_rep_id IS NOT NULL";
      const params: any[] = [];
      if (fromTs) { where += " AND created_at >= ?"; params.push(fromTs); }
      if (toTs)   { where += " AND created_at <= ?"; params.push(toTs); }

      const rows: any = await sqlite.getAllAsync(
        `SELECT
           sales_rep_id AS id,
           sales_rep_name AS name,
           SUM(commission_amount) AS totalCommission,
           SUM(total) AS totalSales,
           COUNT(*) AS invoiceCount,
           MAX(commission_rate) AS rate
         FROM invoices
         ${where}
         GROUP BY sales_rep_id
         ORDER BY totalCommission DESC`,
        params
      );

      const reps: any = await sqlite.getAllAsync("SELECT id, name, code, commission_rate FROM sales_reps");
      const repMap = new Map<string, any>();
      (reps || []).forEach((r: any) => repMap.set(r.id, r));

      const result: RepSummary[] = (rows || []).map((row: any) => {
        const rep = repMap.get(row.id);
        return {
          id: row.id,
          name: row.name || rep?.name || "—",
          code: rep?.code || "—",
          rate: Number(row.rate || rep?.commission_rate || 0),
          invoiceCount: Number(row.invoiceCount) || 0,
          totalSales: Number(row.totalSales) || 0,
          totalCommission: Number(row.totalCommission) || 0,
        };
      });

      setSummaries(result);
    } catch (e) {
      Alert.alert("تعذر التحميل", String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const grandTotalSales = summaries.reduce((s, x) => s + x.totalSales, 0);
  const grandTotalCommission = summaries.reduce((s, x) => s + x.totalCommission, 0);

  const clearFilter = () => {
    setFromDate("");
    setToDate("");
    setTimeout(load, 50);
  };

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 40, paddingHorizontal: 4 }}>
      <Pressable style={styles.back} onPress={onBack}>
        <Text style={styles.backText}>← العودة</Text>
      </Pressable>

      <Text style={styles.screenTitle}>تقرير العمولات</Text>
      <Text style={styles.hint}>
        إجمالي مبيعات وعمولات كل مندوب.
      </Text>

      <View style={styles.filterBox}>
        <Text style={styles.label}>من تاريخ (YYYY-MM-DD)</Text>
        <TextInput
          style={styles.input}
          value={fromDate}
          onChangeText={setFromDate}
          placeholder="2025-01-01"
          placeholderTextColor="#888"
          keyboardType="numbers-and-punctuation"
        />

        <Text style={styles.label}>إلى تاريخ (YYYY-MM-DD)</Text>
        <TextInput
          style={styles.input}
          value={toDate}
          onChangeText={setToDate}
          placeholder="2025-12-31"
          placeholderTextColor="#888"
          keyboardType="numbers-and-punctuation"
        />

        <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
          <Pressable style={styles.applyBtn} onPress={load} disabled={loading}>
            <Text style={styles.applyBtnText}>{loading ? "..." : "تطبيق الفلتر"}</Text>
          </Pressable>
          <Pressable style={styles.clearBtn} onPress={clearFilter}>
            <Text style={styles.clearBtnText}>مسح</Text>
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
          <Text style={[styles.totalValue, { color: "#c2410c" }]}>
            {grandTotalCommission.toFixed(2)}
          </Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>التفاصيل ({summaries.length})</Text>

      {summaries.length === 0 ? (
        <Text style={styles.empty}>لا توجد فواتير مرتبطة بمناديب في هذه الفترة</Text>
      ) : (
        summaries.map((s) => (
          <View key={s.id} style={styles.repCard}>
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
                <Text style={[styles.statValue, { color: "#c2410c", fontWeight: "700" }]}>
                  {s.totalCommission.toFixed(2)}
                </Text>
              </View>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  back: { paddingVertical: 10 },
  backText: { color: "#0a7ea4", fontSize: 14 },
  screenTitle: { fontSize: 22, fontWeight: "700", marginTop: 8, marginBottom: 4, color: "#111" },
  hint: { color: "#666", fontSize: 13, marginBottom: 16 },
  filterBox: { backgroundColor: "#f5f5f5", padding: 12, borderRadius: 10, marginBottom: 16 },
  label: { fontSize: 13, color: "#333", marginTop: 8, marginBottom: 4, fontWeight: "600" },
  input: {
    backgroundColor: "#fff", borderWidth: 1, borderColor: "#ddd",
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 15,
  },
  applyBtn: { flex: 1, backgroundColor: "#0a7ea4", padding: 10, borderRadius: 8, alignItems: "center" },
  applyBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  clearBtn: { flex: 1, backgroundColor: "#eee", padding: 10, borderRadius: 8, alignItems: "center" },
  clearBtnText: { color: "#333", fontWeight: "600", fontSize: 14 },
  totalsBox: { flexDirection: "row", gap: 8, marginBottom: 16 },
  totalItem: { flex: 1, backgroundColor: "#fff", borderWidth: 1, borderColor: "#e5e5e5", borderRadius: 10, padding: 12 },
  totalLabel: { fontSize: 12, color: "#666", marginBottom: 4 },
  totalValue: { fontSize: 18, fontWeight: "700", color: "#111" },
  sectionTitle: { fontSize: 16, fontWeight: "700", marginTop: 8, marginBottom: 8, color: "#111" },
  empty: { textAlign: "center", color: "#888", padding: 20 },
  repCard: {
    backgroundColor: "#fff", borderWidth: 1, borderColor: "#e5e5e5",
    borderRadius: 10, padding: 12, marginBottom: 10,
  },
  repHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  repName: { fontSize: 16, fontWeight: "700", color: "#111" },
  repRate: { fontSize: 14, fontWeight: "700", color: "#0a7ea4", backgroundColor: "#e0f2fe", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  repCode: { fontSize: 12, color: "#666", marginTop: 2, marginBottom: 8 },
  repStats: { flexDirection: "row", gap: 8 },
  statItem: { flex: 1, backgroundColor: "#fafafa", padding: 8, borderRadius: 6 },
  statLabel: { fontSize: 11, color: "#666", marginBottom: 2 },
  statValue: { fontSize: 14, fontWeight: "600", color: "#111" },
});
