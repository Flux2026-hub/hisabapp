import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { sqlite } from "../../db/local";
import { useTheme } from "../ThemeContext";
import DateRangePicker from "./components/DateRangePicker";

export default function TrialBalanceScreen({ onBack }: { onBack: () => void }) {
  const { colors } = useTheme();
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(new Date().getFullYear() + "-01-01");
  const [to, setTo] = useState(today);
  
  const [rows, setRows] = useState<any[]>([]);
  const [totals, setTotals] = useState({ debit: 0, credit: 0 });
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const fromTs = new Date(from + "T00:00:00").getTime();
      const toTs = new Date(to + "T23:59:59").getTime();

      // ✅ الاعتماد فقط على القيود اليومية ضمن الفترة المحددة
      const data: any = await sqlite.getAllAsync(`
        SELECT a.code, a.name, a.account_type,
               SUM(jl.debit) as debit, SUM(jl.credit) as credit
        FROM journal_lines jl
        JOIN journal_entries je ON je.id = jl.entry_id
        JOIN accounts a ON a.code = jl.account_code
        WHERE je.created_at BETWEEN ? AND ?
        GROUP BY a.code, a.name, a.account_type
        ORDER BY a.code
      `, [fromTs, toTs]);

      let totalD = 0, totalC = 0;
      const processedRows = (data || []).map((r: any) => {
        const d = Number(r.debit) || 0;
        const c = Number(r.credit) || 0;
        totalD += d;
        totalC += c;
        return { ...r, debit: d, credit: c };
      });

      setRows(processedRows);
      setTotals({ debit: totalD, credit: totalC });
    } catch (e) { Alert.alert("تعذر التحميل", String(e)); } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [from, to]);

  return (
    <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
      <Pressable android_ripple={{ color: "rgba(0,0,0,0.1)" }} style={styles.back} onPress={onBack}>
        <Text style={[styles.backText, { color: colors.blue }]}>‹ العودة إلى التقارير</Text>
      </Pressable>

      <Text style={[styles.screenTitle, { color: colors.text }]}>ميزان المراجعة</Text>
      <Text style={[styles.hint, { color: colors.textMuted }]}>ملخص أرصدة الحسابات (مدين ودائن) بناءً على القيود اليومية للفترة المحددة.</Text>

      <DateRangePicker from={from} to={to} onFromChange={setFrom} onToChange={setTo} />

      <View style={[styles.tableHeader, { backgroundColor: colors.blue, marginTop: 16 }]}>
        <Text style={styles.th}>الحساب</Text>
        <Text style={styles.thAmount}>مدين</Text>
        <Text style={styles.thAmount}>دائن</Text>
      </View>

      {loading ? <Text style={[styles.empty, { color: colors.textMuted }]}>جارٍ التحميل...</Text> : rows.length === 0 ? <Text style={[styles.empty, { color: colors.textMuted }]}>لا توجد حركات في هذه الفترة</Text> : (
        rows.map((r, i) => (
          <View key={i} style={[styles.row, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
            <View style={{ flex: 2, alignItems: "flex-end" }}>
              <Text style={[styles.rowName, { color: colors.text }]}>{r.name}</Text>
              <Text style={[styles.rowCode, { color: colors.textMuted }]}>{r.code}</Text>
            </View>
            <Text style={[styles.amount, { color: colors.text }]}>{r.debit > 0 ? r.debit.toFixed(2) : "-"}</Text>
            <Text style={[styles.amount, { color: colors.text }]}>{r.credit > 0 ? r.credit.toFixed(2) : "-"}</Text>
          </View>
        ))
      )}

      <View style={[styles.totalRow, { backgroundColor: colors.isDark ? "#1E3A8A" : "#EFF6FF", borderColor: colors.blue }]}>
        <Text style={[styles.totalLabel, { color: colors.blue }]}>الإجمالي</Text>
        <Text style={[styles.totalAmount, { color: colors.blue }]}>{totals.debit.toFixed(2)}</Text>
        <Text style={[styles.totalAmount, { color: colors.blue }]}>{totals.credit.toFixed(2)}</Text>
      </View>

      <View style={[styles.statusBox, { backgroundColor: colors.surface }]}>
        <Text style={[styles.statusText, { color: Math.abs(totals.debit - totals.credit) < 0.01 ? colors.success : colors.danger }]}>
          {Math.abs(totals.debit - totals.credit) < 0.01 ? "✅ الميزان متوازن" : "⚠️ الميزان غير متوازن (تأكد من تسجيل جميع العمليات في القيود)"}
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: { backgroundColor: "transparent", paddingHorizontal: 8, paddingTop: 16, paddingBottom: 40 },
  back: { paddingVertical: 10, alignSelf: "flex-start", marginBottom: 8 },
  backText: { textAlign: "left", fontWeight: "700" },
  screenTitle: { fontSize: 22, marginBottom: 6, textAlign: "left", width: "100%", fontFamily: "CodecBold" },
  hint: { fontSize: 12, marginBottom: 14, textAlign: "left", width: "100%" },
  tableHeader: { flexDirection: "row-reverse", padding: 10, borderTopLeftRadius: 8, borderTopRightRadius: 8 },
  th: { flex: 2, color: "#FFF", fontWeight: "700", textAlign: "right" },
  thAmount: { flex: 1, color: "#FFF", fontWeight: "700", textAlign: "center" },
  row: { flexDirection: "row-reverse", padding: 10, borderBottomWidth: 1 },
  rowName: { fontWeight: "700", fontSize: 14, textAlign: "right" },
  rowCode: { fontSize: 11, marginTop: 2, textAlign: "right" },
  amount: { flex: 1, textAlign: "center", fontSize: 14, alignSelf: "center" },
  totalRow: { flexDirection: "row-reverse", padding: 12, borderBottomLeftRadius: 8, borderBottomRightRadius: 8, borderWidth: 1, borderTopWidth: 0, marginTop: -1 },
  totalLabel: { flex: 2, fontWeight: "800", fontSize: 16, textAlign: "right" },
  totalAmount: { flex: 1, fontWeight: "800", fontSize: 16, textAlign: "center" },
  empty: { textAlign: "center", padding: 20 },
  statusBox: { marginTop: 16, padding: 12, borderRadius: 8, alignItems: "center" },
  statusText: { fontWeight: "800", fontSize: 14, textAlign: "center" },
});
