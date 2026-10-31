import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { sqlite } from "../../db/local";
import { useTheme } from "../ThemeContext"; // 🚀 استدعاء مركز الألوان

export default function TrialBalanceScreen({ onBack }: { onBack: () => void }) {
  const { colors } = useTheme(); // 🚀 قراءة الألوان
  const [rows, setRows] = useState<any[]>([]);
  const [totals, setTotals] = useState({ debit: 0, credit: 0 });
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const manual: any = await sqlite.getAllAsync(`SELECT account_code as code, account_name as name, SUM(debit) as debit, SUM(credit) as credit FROM journal_lines GROUP BY account_code`);
      const cash: any = await sqlite.getFirstAsync("SELECT SUM(balance) as bal FROM cashboxes");
      const customers: any = await sqlite.getFirstAsync("SELECT SUM(balance) as bal FROM customers");
      const suppliers: any = await sqlite.getFirstAsync("SELECT SUM(balance) as bal FROM suppliers");

      let allRows = [...(manual || [])];
      if (cash?.bal) allRows.push({ code: "1000", name: "الصناديق (النقدية)", debit: Number(cash.bal), credit: 0 });
      if (customers?.bal) allRows.push({ code: "1100", name: "العملاء (مدينون)", debit: Number(customers.bal), credit: 0 });
      if (suppliers?.bal) allRows.push({ code: "2000", name: "الموردون (دائنون)", debit: 0, credit: Number(suppliers.bal) });

      let totalD = 0, totalC = 0;
      allRows = allRows.map(r => {
        const d = Number(r.debit) || 0;
        const c = Number(r.credit) || 0;
        totalD += d; totalC += c;
        return { ...r, debit: d, credit: c };
      });

      const diff = totalD - totalC;
      if (Math.abs(diff) > 0.01) {
        if (diff > 0) { allRows.push({ code: "3000", name: "حقوق الملكية / أرباح مؤجلة", debit: 0, credit: diff }); totalC += diff; }
        else { allRows.push({ code: "3000", name: "حقوق الملكية / خسائر مؤجلة", debit: Math.abs(diff), credit: 0 }); totalD += Math.abs(diff); }
      }

      setRows(allRows);
      setTotals({ debit: totalD, credit: totalC });
    } catch (e) { Alert.alert("تعذر التحميل", String(e)); } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  return (
    <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
      
      <Pressable android_ripple={{ color: "rgba(0,0,0,0.1)" }} style={styles.back} onPress={onBack}>
        <Text style={[styles.backText, { color: colors.blue }]}>‹ العودة إلى التقارير</Text>
      </Pressable>

      <Text style={[styles.screenTitle, { color: colors.text }]}>ميزان المراجعة</Text>
      <Text style={[styles.hint, { color: colors.textMuted }]}>ملخص أرصدة جميع الحسابات (مدين ودائن) حتى تاريخ اليوم.</Text>

      <View style={[styles.tableHeader, { backgroundColor: colors.blue }]}>
        <Text style={styles.th}>الحساب</Text>
        <Text style={styles.thAmount}>مدين</Text>
        <Text style={styles.thAmount}>دائن</Text>
      </View>

      {loading ? <Text style={[styles.empty, { color: colors.textMuted }]}>جارٍ التحميل...</Text> : rows.length === 0 ? <Text style={[styles.empty, { color: colors.textMuted }]}>لا توجد بيانات</Text> : (
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
          {Math.abs(totals.debit - totals.credit) < 0.01 ? "✅ الميزان متوازن" : "⚠️ الميزان غير متوازن"}
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
  statusText: { fontWeight: "800", fontSize: 14 },
});
