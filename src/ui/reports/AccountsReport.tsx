import { useEffect, useMemo, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View, Pressable } from "react-native";
import { sqlite } from "../../db/local";
import ReportHeader from "./components/ReportHeader";
import ReportActions, { exportCsv, exportPdf } from "./components/ReportActions";
import { useTheme } from "../ThemeContext";

export default function AccountsReport({ onBack }: { onBack: () => void }) {
  const { colors } = useTheme();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [filter, setFilter] = useState<string>("all");

  const load = async () => {
    try {
      const rows: any = await sqlite.getAllAsync("SELECT * FROM accounts ORDER BY code ASC");
      setAccounts(rows || []);
    } catch (e) { Alert.alert("تعذر التحميل", String(e)); }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    if (filter === "all") return accounts;
    return accounts.filter(a => a.account_type === filter);
  }, [accounts, filter]);

  const buildHtml = () => {
    const rows = filtered.map(a => `<tr>
      <td>${a.code}</td>
      <td>${a.name}</td>
      <td>${a.account_type}</td>
      <td>${Number(a.balance || 0).toFixed(2)}</td>
    </tr>`).join("");

    return `<!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8"/><style>body{font-family:Arial;padding:24px;}table{width:100%;border-collapse:collapse;}th,td{border:1px solid #ccc;padding:8px;text-align:right;}th{background:#1E40AF;color:#fff;}</style></head><body><h2>دليل الحسابات والأرصدة</h2><table><thead><tr><th>الرمز</th><th>الاسم</th><th>النوع</th><th>الرصيد</th></tr></thead><tbody>${rows}</tbody></table></body></html>`;
  };

  const typeName = (t: string) => {
    if (t === 'asset') return 'أصول';
    if (t === 'liability') return 'خصوم';
    if (t === 'equity') return 'حقوق ملكية';
    if (t === 'revenue') return 'إيرادات';
    if (t === 'expense') return 'مصروفات';
    return t;
  };

  return (
    <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
      
      <Pressable android_ripple={{ color: "rgba(0,0,0,0.1)" }} style={styles.backWrap} onPress={onBack}>
        <Text style={[styles.back, { color: colors.blue }]}>‹ العودة إلى التقارير</Text>
      </Pressable>

      <ReportHeader title="دليل الحسابات" subtitle="شجرة الحسابات والأرصدة الحالية" from="—" to="—" currencySymbol="" />

      <View style={styles.filterRow}>
        {[["all", "الكل"], ["asset", "أصول"], ["liability", "خصوم"], ["revenue", "إيرادات"], ["expense", "مصروفات"]].map(([key, label]) => (
          <Pressable android_ripple={{ color: "rgba(0,0,0,0.1)" }} key={key} onPress={() => setFilter(key)} style={[styles.chip, { backgroundColor: colors.surface, borderColor: colors.border }, filter === key && { backgroundColor: colors.blue, borderColor: colors.blue }]}>
            <Text style={[styles.chipText, { color: colors.text }, filter === key && { color: "#FFF" }]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      <ReportActions
        onRefresh={load}
        onExportPdf={() => exportPdf(buildHtml(), `دليل-الحسابات.pdf`)}
        onExportCsv={() => {
          const header = "الرمز,الاسم,النوع,الرصيد\n";
          const body = filtered.map(a => `${a.code},${a.name},${typeName(a.account_type)},${Number(a.balance||0).toFixed(2)}`).join("\n");
          exportCsv(header + body, `دليل-الحسابات.csv`);
        }}
      />

      <Text style={[styles.sectionTitle, { color: colors.blue }]}>الحسابات ({filtered.length})</Text>
      {filtered.map((a) => (
        <View key={a.id} style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border, paddingRight: 12 + (a.parent_code ? (a.code.length * 5) : 0) }]}>
          <View style={styles.rowRight}>
            <Text style={[styles.balance, { color: Number(a.balance) > 0 ? colors.success : colors.textMuted }]}>{Number(a.balance || 0).toFixed(2)}</Text>
          </View>
          <View style={styles.rowInfo}>
            <Text style={[styles.rowName, { color: colors.text }]}>{a.code} - {a.name}</Text>
            <Text style={[styles.rowMeta, { color: colors.textMuted }]}>{typeName(a.account_type)}</Text>
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
  filterRow: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 6, marginBottom: 12 },
  chip: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  chipText: { fontSize: 12, fontWeight: "600" },
  sectionTitle: { fontSize: 15, marginTop: 8, marginBottom: 8, textAlign: "left", width: "100%", fontFamily: "CodecBold" },
  row: { borderWidth: 1, borderRadius: 10, padding: 10, flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  rowInfo: { flex: 1, alignItems: "flex-end" },
  rowRight: { alignItems: "flex-end", paddingLeft: 10 },
  rowName: { fontWeight: "700", fontSize: 13, textAlign: "right", width: "100%" },
  rowMeta: { fontSize: 10, marginTop: 2, textAlign: "right" },
  balance: { fontWeight: "800", fontSize: 13 },
});
