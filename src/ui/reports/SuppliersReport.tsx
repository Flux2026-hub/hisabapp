import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { sqlite } from "../../db/local";
import ReportHeader from "./components/ReportHeader";
import ReportSummary from "./components/ReportSummary";
import DateRangePicker from "./components/DateRangePicker";
import ReportActions, { exportCsv, exportPdf } from "./components/ReportActions";
import { useTheme } from "../ThemeContext";

type Row = any;
type BalanceFilter = "all" | "positive" | "negative";

export default function SuppliersReport({ onBack }: { onBack: () => void }) {
  const { colors } = useTheme();
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(today.slice(0, 4) + "-01-01");
  const [to, setTo] = useState(today);
  const [suppliers, setSuppliers] = useState<Row[]>([]);
  const [selected, setSelected] = useState<Row | null>(null);
  const [statement, setStatement] = useState<Row[]>([]);
  const [baseCurrency, setBaseCurrency] = useState<Row | null>(null);
  const [balanceFilter, setBalanceFilter] = useState<BalanceFilter>("all");

  useEffect(() => {
    (async () => {
      try {
        const base: any = await sqlite.getFirstAsync("SELECT id, code, symbol FROM currencies WHERE is_base = 1 LIMIT 1");
        setBaseCurrency(base);
        await loadSuppliers();
      } catch (e) { Alert.alert("تعذر التحميل", String(e)); }
    })();
  }, []);

  const baseSymbol = baseCurrency?.symbol || "ر.ي";

  const loadSuppliers = async () => {
    const rows: any = await sqlite.getAllAsync("SELECT id, code, name, phone, balance FROM suppliers ORDER BY name");
    setSuppliers(rows || []);
  };

  const filteredSuppliers = useMemo(() => {
    return suppliers.filter((s) => {
      const bal = Number(s.balance) || 0;
      if (balanceFilter === "positive") return bal > 0;
      if (balanceFilter === "negative") return bal < 0;
      return true;
    });
  }, [suppliers, balanceFilter]);

  const loadStatement = async (supplier: Row) => {
    try {
      const fromTs = new Date(from + "T00:00:00").getTime() || 0;
      const toTs = new Date(to + "T23:59:59").getTime() || Date.now();

      const invoices: any = await sqlite.getAllAsync(
        "SELECT 'invoice' as kind, invoice_no as ref, total as amount, created_at, invoice_type FROM invoices WHERE party_id = ? AND created_at BETWEEN ? AND ? ORDER BY created_at ASC",
        [supplier.id, fromTs, toTs]
      );
      const vouchers: any = await sqlite.getAllAsync(
        "SELECT 'voucher' as kind, voucher_no as ref, amount, created_at, voucher_type as invoice_type FROM vouchers WHERE party_type = 'supplier' AND party_id = ? AND created_at BETWEEN ? AND ? ORDER BY created_at ASC",
        [supplier.id, fromTs, toTs]
      );

      const all = [...(invoices || []), ...(vouchers || [])].sort((a: any, b: any) => a.created_at - b.created_at);

      let running = 0;
      const withBalance = all.map((m: any) => {
        const amount = Number(m.amount) || 0;
        let debit = 0; let credit = 0; let desc = "";

        if (m.kind === "invoice") {
          credit = amount; desc = m.invoice_type === "purchase" ? "فاتورة مشتريات" : "فاتورة مبيعات";
        } else if (m.kind === "voucher") {
          if (m.invoice_type === "payment") { debit = amount; desc = "سند دفع"; }
          else { credit = amount; desc = "سند قبض"; }
        }

        running += credit - debit;
        return { ...m, debit, credit, desc, balance: running };
      });

      setStatement(withBalance);
      setSelected(supplier);
    } catch (e) { Alert.alert("تعذر تحميل كشف الحساب", String(e)); }
  };

  const totalDebit = useMemo(() => statement.reduce((s, r) => s + (r.debit || 0), 0), [statement]);
  const totalCredit = useMemo(() => statement.reduce((s, r) => s + (r.credit || 0), 0), [statement]);

  const goBack = () => {
    if (selected) { setSelected(null); setStatement([]); }
    else { onBack(); }
  };

  const buildPdfHtml = () => {
    const rowsData = statement.map((m: any) => {
      const type = m.credit > 0 ? "دائن" : "مدين";
      const color = m.credit > 0 ? "#059669" : "#DC2626";
      return "<tr><td>" + new Date(m.created_at).toLocaleDateString("ar-EG") + "</td><td>" + m.desc + "</td><td>" + m.ref + "</td><td style='color:" + color + ";font-weight:700;'>" + type + "</td><td style='font-weight:700;color:" + color + ";'>" + (m.debit || m.credit).toFixed(2) + "</td></tr>";
    }).join("");

    return "<!DOCTYPE html><html lang='ar' dir='rtl'><head><meta charset='utf-8'/><style>@page{size:A4;margin:12mm;}body{font-family:Arial,Tahoma;direction:rtl;color:#0F172A;font-size:13px;}table{width:100%;border-collapse:collapse;margin-top:16px;}th{background:#0B2545;color:#FFF;padding:10px;text-align:right;}td{padding:9px;border-bottom:1px solid #E2E8F0;text-align:right;}.head{text-align:center;border-bottom:3px solid #F97316;padding-bottom:14px;}</style></head><body><div class='head'><h2>فلوكس</h2><h3>كشف حساب مورد: " + selected?.name + "</h3><p>الفترة: " + from + " إلى " + to + "</p></div><table><thead><tr><th>التاريخ</th><th>البيان</th><th>المرجع</th><th>النوع</th><th>المبلغ</th></tr></thead><tbody>" + rowsData + "</tbody></table></body></html>";
  };

  return (
    <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
      
      <View style={styles.backWrap}>
        <Text style={[styles.back, { color: colors.blue }]} onPress={goBack}>‹ {selected ? "العودة إلى القائمة" : "العودة إلى التقارير"}</Text>
      </View>

      <ReportHeader title={selected ? `كشف حساب: ${selected.name}` : "تقرير الموردين"} subtitle={selected ? "الحركات والأرصدة" : "قائمة الموردين وأرصدتهم"} from={from} to={to} currencySymbol={baseSymbol} />
      <DateRangePicker from={from} to={to} onFromChange={setFrom} onToChange={setTo} />

      {!selected && (
        <>
          <Text style={[styles.filterLabel, { color: colors.textMuted }]}>الفلتر</Text>
          <View style={styles.filterRow}>
            {[ { key: "all", label: `الكل (${suppliers.length})` }, { key: "positive", label: `لهم رصيد` }, { key: "negative", label: `عليهم رصيد` } ].map((o) => (
              <Pressable android_ripple={{ color: "rgba(0,0,0,0.1)" }} key={o.key} onPress={() => setBalanceFilter(o.key as BalanceFilter)} style={[styles.chip, { backgroundColor: colors.surface, borderColor: colors.border }, balanceFilter === o.key && { backgroundColor: colors.blue, borderColor: colors.blue }]}>
                <Text style={[styles.chipText, { color: colors.text }, balanceFilter === o.key && { color: "#FFF" }]}>{o.label}</Text>
              </Pressable>
            ))}
          </View>
        </>
      )}

      <ReportActions
        onRefresh={() => (selected ? loadStatement(selected) : loadSuppliers())}
        onExportPdf={() => exportPdf(buildPdfHtml(), `كشف-مورد-${selected?.name}.pdf`)}
        onExportCsv={() => {
          const header = "التاريخ,البيان,المرجع,مدين,دائن,الرصيد\n";
          const body = statement.map((m: any) => [ new Date(m.created_at).toLocaleDateString("ar-EG"), m.desc, m.ref, Number(m.debit||0).toFixed(2), Number(m.credit||0).toFixed(2), m.balance.toFixed(2) ].join(",")).join("\n");
          exportCsv(header + body, `كشف-مورد-${selected?.name}.csv`);
        }}
      />

      {!selected ? (
        <>
          <Text style={[styles.sectionTitle, { color: colors.blue }]}>قائمة الموردين ({filteredSuppliers.length})</Text>
          {filteredSuppliers.map((s) => {
            const bal = Number(s.balance || 0);
            const balColor = bal > 0 ? colors.danger : bal < 0 ? colors.success : colors.textMuted;
            return (
              <Pressable android_ripple={{ color: "rgba(0,0,0,0.1)" }} key={s.id} style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => loadStatement(s)}>
                <View style={styles.rowRight}>
                  <Text style={[styles.amount, { color: balColor }]}>{Math.abs(bal).toFixed(2)} {baseSymbol}</Text>
                </View>
                <View style={styles.rowInfo}>
                  <Text style={[styles.rowName, { color: colors.text }]}>{s.name}</Text>
                  <Text style={[styles.rowMeta, { color: colors.textMuted }]}>{s.code} · {s.phone || "—"}</Text>
                </View>
              </Pressable>
            );
          })}
        </>
      ) : (
        <>
          <ReportSummary items={[ { label: "إجمالي المدين", value: totalDebit.toFixed(2), color: colors.danger }, { label: "إجمالي الدائن", value: totalCredit.toFixed(2), color: colors.success }, { label: "الرصيد", value: Number(selected.balance || 0).toFixed(2), color: colors.blue } ]} />
          <Text style={[styles.sectionTitle, { color: colors.blue }]}>حركات الحساب ({statement.length})</Text>
          {statement.map((m: any, i: number) => (
            <View key={i} style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.rowRight}>
                <Text style={[styles.amountSmall, { color: m.credit > 0 ? colors.success : colors.danger }]}>{m.credit > 0 ? "+" : "−"}{(m.debit || m.credit).toFixed(2)}</Text>
              </View>
              <View style={styles.rowInfo}>
                <Text style={[styles.rowName, { color: colors.text }]}>{m.desc}</Text>
                <Text style={[styles.rowMeta, { color: colors.textMuted }]}>{m.ref} · {new Date(m.created_at).toLocaleDateString("ar-EG")}</Text>
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
  filterLabel: { fontSize: 12, textAlign: "left", marginTop: 10, marginBottom: 6, fontWeight: "700" },
  filterRow: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 6, marginBottom: 8 },
  chip: { borderWidth: 1.2, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  chipText: { fontSize: 12, fontWeight: "700" },
  sectionTitle: { fontSize: 15, marginTop: 16, marginBottom: 8, textAlign: "left", width: "100%", fontFamily: "CodecBold" },
  row: { borderWidth: 1.2, borderRadius: 10, padding: 12, flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  rowInfo: { flex: 1, alignItems: "flex-end" },
  rowRight: { alignItems: "flex-end" },
  rowName: { fontWeight: "700", fontSize: 14, textAlign: "right", width: "100%" },
  rowMeta: { fontSize: 11, marginTop: 2, textAlign: "right" },
  amount: { fontWeight: "800", fontSize: 15 },
  amountSmall: { fontWeight: "800", fontSize: 14 },
});
