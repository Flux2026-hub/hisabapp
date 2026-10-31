import { useEffect, useMemo, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View, Pressable } from "react-native";
import { sqlite } from "../../db/local";
import ReportHeader from "./components/ReportHeader";
import DateRangePicker from "./components/DateRangePicker";
import ReportActions, { exportCsv, exportPdf } from "./components/ReportActions";
import { useTheme } from "../ThemeContext";

export default function ProfitLossReport({ onBack }: { onBack: () => void }) {
  const { colors } = useTheme();
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(today.slice(0, 8) + "01");
  const [to, setTo] = useState(today);
  
  const [revenues, setRevenues] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [baseSymbol, setBaseSymbol] = useState("ر.ي");

  const load = async () => {
    try {
      const base: any = await sqlite.getFirstAsync("SELECT symbol FROM currencies WHERE is_base = 1 LIMIT 1");
      if (base) setBaseSymbol(base.symbol || "ر.ي");

      // جلب الإيرادات من دليل الحسابات
      const rev: any = await sqlite.getAllAsync(
        "SELECT code, name, balance FROM accounts WHERE account_type = 'revenue' AND balance != 0 ORDER BY code"
      );
      // جلب المصروفات من دليل الحسابات
      const exp: any = await sqlite.getAllAsync(
        "SELECT code, name, balance FROM accounts WHERE account_type = 'expense' AND balance != 0 ORDER BY code"
      );

      setRevenues(rev || []);
      setExpenses(exp || []);
    } catch (e) { Alert.alert("تعذر التحميل", String(e)); }
  };

  useEffect(() => { load(); }, []);

  const totalRevenue = useMemo(() => revenues.reduce((s, r) => s + Number(r.balance || 0), 0), [revenues]);
  const totalExpense = useMemo(() => expenses.reduce((s, e) => s + Number(e.balance || 0), 0), [expenses]);
  const netProfit = totalRevenue - totalExpense;

  const buildHtml = () => {
    const revRows = revenues.map(r => `<tr><td>${r.code}</td><td>${r.name}</td><td>${Number(r.balance).toFixed(2)}</td></tr>`).join("");
    const expRows = expenses.map(e => `<tr><td>${e.code}</td><td>${e.name}</td><td>${Number(e.balance).toFixed(2)}</td></tr>`).join("");

    return `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8"/>
    <style>
      body{font-family:Arial,Tahoma;padding:24px;color:#0F172A;direction:rtl}
      .head{text-align:center;border-bottom:2px solid #F97316;padding-bottom:12px;margin-bottom:16px}
      .brand{font-size:22px;font-weight:800;color:#1E40AF}
      h2{font-size:18px;margin:12px 0;border-bottom:1px solid #ccc;padding-bottom:4px;}
      table{width:100%;border-collapse:collapse;margin-top:12px;margin-bottom:20px;}
      th,td{border:1px solid #D6E3F8;padding:7px;text-align:right;font-size:14px}
      th{background:#1E40AF;color:#fff}
      .total-row td { font-weight: bold; background: #f0fdf4; }
      .profit-box { padding: 15px; background: #EFF6FF; border-radius: 8px; margin-top: 20px; font-size: 18px; font-weight: bold; text-align: center; }
    </style></head><body>
      <div class="head"><div class="brand">فلوكس</div><div style="font-size:12px;color:#8494B0">منتج تسليك المجاري</div></div>
      <h1>تقرير الأرباح والخسائر</h1>
      <div style="color:#526078;font-size:12px">الفترة: ${from} → ${to} | العملة الأساسية: ${baseSymbol}</div>
      
      <h2>الإيرادات</h2>
      <table><thead><tr><th>الرمز</th><th>الحساب</th><th>المبلغ</th></tr></thead><tbody>
        ${revRows || "<tr><td colspan='3' style='text-align:center'>لا توجد إيرادات</td></tr>"}
        <tr class="total-row"><td colspan="2">إجمالي الإيرادات</td><td>${totalRevenue.toFixed(2)} ${baseSymbol}</td></tr>
      </tbody></table>

      <h2>المصروفات</h2>
      <table><thead><tr><th>الرمز</th><th>الحساب</th><th>المبلغ</th></tr></thead><tbody>
        ${expRows || "<tr><td colspan='3' style='text-align:center'>لا توجد مصروفات</td></tr>"}
        <tr class="total-row"><td colspan="2">إجمالي المصروفات</td><td>${totalExpense.toFixed(2)} ${baseSymbol}</td></tr>
      </tbody></table>

      <div class="profit-box" style="color:${netProfit >= 0 ? '#059669' : '#DC2626'};">
        ${netProfit >= 0 ? "صافي الربح" : "صافي الخسارة"}: ${Math.abs(netProfit).toFixed(2)} ${baseSymbol}
      </div>
    </body></html>`;
  };

  return (
    <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
      <Pressable android_ripple={{ color: "rgba(0,0,0,0.1)" }} style={styles.backWrap} onPress={onBack}>
        <Text style={[styles.back, { color: colors.blue }]}>‹ العودة إلى التقارير</Text>
      </Pressable>

      <ReportHeader title="الأرباح والخسائر" subtitle="ملخص الإيرادات والمصروفات" from={from} to={to} currencySymbol={baseSymbol} />
      <DateRangePicker from={from} to={to} onFromChange={setFrom} onToChange={setTo} />

      <ReportActions
        onRefresh={load}
        onExportPdf={() => exportPdf(buildHtml(), `الأرباح-والخسائر-${from}.pdf`)}
        onExportCsv={() => {
          let csv = "النوع,الرمز,الحساب,المبلغ\n";
          revenues.forEach(r => csv += `إيراد,${r.code},${r.name},${Number(r.balance).toFixed(2)}\n`);
          expenses.forEach(e => csv += `مصروف,${e.code},${e.name},${Number(e.balance).toFixed(2)}\n`);
          csv += `\nصافي الربح/الخسارة,,,${netProfit.toFixed(2)}\n`;
          exportCsv(csv, `الأرباح-والخسائر-${from}.csv`);
        }}
      />

      <View style={[styles.summaryBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.summaryRow}>
          <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>إجمالي الإيرادات</Text>
          <Text style={[styles.summaryValue, { color: colors.success }]}>{totalRevenue.toFixed(2)} {baseSymbol}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>إجمالي المصروفات</Text>
          <Text style={[styles.summaryValue, { color: colors.danger }]}>{totalExpense.toFixed(2)} {baseSymbol}</Text>
        </View>
        <View style={[styles.summaryRow, { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10, marginTop: 10 }]}>
          <Text style={[styles.totalLabel, { color: colors.text }]}>صافي {netProfit >= 0 ? "الربح" : "الخسارة"}</Text>
          <Text style={[styles.totalValue, { color: netProfit >= 0 ? colors.success : colors.danger }]}>
            {Math.abs(netProfit).toFixed(2)} {baseSymbol}
          </Text>
        </View>
      </View>

      <Text style={[styles.sectionTitle, { color: colors.blue }]}>تفاصيل الإيرادات</Text>
      {revenues.map((r) => (
        <View key={r.code} style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.amount, { color: colors.success }]}>{Number(r.balance).toFixed(2)}</Text>
          <View style={styles.rowInfo}>
            <Text style={[styles.rowName, { color: colors.text }]}>{r.name}</Text>
            <Text style={[styles.rowCode, { color: colors.textMuted }]}>{r.code}</Text>
          </View>
        </View>
      ))}

      <Text style={[styles.sectionTitle, { color: colors.blue }]}>تفاصيل المصروفات</Text>
      {expenses.map((e) => (
        <View key={e.code} style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.amount, { color: colors.danger }]}>{Number(e.balance).toFixed(2)}</Text>
          <View style={styles.rowInfo}>
            <Text style={[styles.rowName, { color: colors.text }]}>{e.name}</Text>
            <Text style={[styles.rowCode, { color: colors.textMuted }]}>{e.code}</Text>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: { backgroundColor: "transparent", paddingHorizontal: 8, paddingTop: 16, paddingBottom: 40 },
  backWrap: { paddingVertical: 8 },
  back: { alignSelf: "flex-start", fontWeight: "700", textAlign: "left" },
  summaryBox: { borderWidth: 1, borderRadius: 16, padding: 16, marginTop: 16 },
  summaryRow: { flexDirection: "row-reverse", justifyContent: "space-between", marginBottom: 8 },
  summaryLabel: { fontSize: 14, fontWeight: "600" },
  summaryValue: { fontSize: 16, fontWeight: "800" },
  totalLabel: { fontSize: 16, fontWeight: "800" },
  totalValue: { fontSize: 20, fontWeight: "900" },
  sectionTitle: { fontSize: 15, marginTop: 20, marginBottom: 8, textAlign: "left", width: "100%", fontFamily: "CodecBold" },
  row: { borderWidth: 1, borderRadius: 10, padding: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  rowInfo: { flex: 1, alignItems: "flex-end", paddingRight: 10 },
  rowName: { fontWeight: "700", fontSize: 14, textAlign: "right", width: "100%" },
  rowCode: { fontSize: 11, marginTop: 2, textAlign: "right" },
  amount: { fontWeight: "800", fontSize: 16, textAlign: "left" },
});
