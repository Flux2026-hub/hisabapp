import { useEffect, useMemo, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { sqlite } from "../../db/local";
import ReportHeader from "./components/ReportHeader";
import ReportSummary from "./components/ReportSummary";
import ReportActions, { exportCsv, exportPdf } from "./components/ReportActions";

type Row = any;

const TYPE_LABEL: Record<string, string> = {
  asset: "أصول",
  liability: "خصوم",
  income: "إيرادات",
  expense: "مصروفات",
};

export default function AccountsReport({ onBack }: { onBack: () => void }) {
  const today = new Date().toISOString().slice(0, 10);
  const [from] = useState(today.slice(0, 8) + "01");
  const [to] = useState(today);
  const [accounts, setAccounts] = useState<Row[]>([]);
  const [baseSymbol, setBaseSymbol] = useState("ر.ي");

  useEffect(() => {
    (async () => {
      try {
        const base: any = await sqlite.getFirstAsync(
          "SELECT symbol, code FROM currencies WHERE is_base = 1 LIMIT 1"
        );
        if (base) setBaseSymbol(base.symbol || base.code);
        await load();
      } catch (e) {
        Alert.alert("تعذر التحميل", String(e));
      }
    })();
  }, []);

  const load = async () => {
    const rows: any = await sqlite.getAllAsync(
      "SELECT id, code, name, account_type, parent_code, balance FROM accounts ORDER BY code"
    );
    setAccounts(rows || []);
  };

  const grouped = useMemo(() => {
    const g: Record<string, Row[]> = {
      asset: [],
      liability: [],
      income: [],
      expense: [],
    };
    for (const a of accounts) {
      const t = String(a.account_type || "");
      if (g[t]) g[t].push(a);
    }
    return g;
  }, [accounts]);

  const totals = useMemo(() => {
    const t: Record<string, number> = {
      asset: 0,
      liability: 0,
      income: 0,
      expense: 0,
    };
    for (const a of accounts) {
      const type = String(a.account_type || "");
      if (t[type] !== undefined) t[type] += Number(a.balance || 0);
    }
    return t;
  }, [accounts]);

  const buildHtml = () => {
    const sections = ["asset", "liability", "income", "expense"]
      .map((type) => {
        const rows = grouped[type]
          .map(
            (a) => "<tr><td>" + (a.code || "") + "</td><td>" + (a.name || "") + "</td><td>" + (a.parent_code || "—") + "</td><td>" + Number(a.balance || 0).toFixed(2) + "</td></tr>"
          )
          .join("");

        return (
          "<h2>" + TYPE_LABEL[type] + " (" + grouped[type].length + ")</h2>" +
          "<table><thead><tr><th style='width:100px'>الرمز</th><th>الاسم</th><th style='width:100px'>الحساب الأب</th><th style='width:130px'>الرصيد</th></tr></thead><tbody>" +
          (rows || "<tr><td colspan='4' style='text-align:center;color:#999'>لا توجد حسابات</td></tr>") +
          "</tbody><tfoot><tr style='background:#EFF6FF;font-weight:800'><td colspan='3' style='text-align:right'>إجمالي " + TYPE_LABEL[type] + "</td><td>" + totals[type].toFixed(2) + " " + baseSymbol + "</td></tr></tfoot></table>"
        );
      })
      .join("");

    return "<!DOCTYPE html><html dir='rtl'><head><meta charset='utf-8'/><style>body{font-family:Arial,Tahoma;padding:24px;direction:rtl;color:#0F172A}.head{text-align:center;border-bottom:2px solid #F97316;padding-bottom:12px;margin-bottom:16px}.brand{font-size:22px;font-weight:800;color:#1E40AF}h1{font-size:18px;margin:12px 0}h2{font-size:14px;margin:18px 0 8px;color:#1E40AF}table{width:100%;border-collapse:collapse;margin-top:6px}th,td{border:1px solid #D6E3F8;padding:7px;text-align:right;font-size:12px}th{background:#1E40AF;color:#fff}</style></head><body><div class='head'><div class='brand'>فلوكس</div><div style='font-size:12px;color:#8494B0'>منتج تسليك المجاري</div></div><h1>تقرير الحسابات</h1><div style='color:#526078;font-size:11px'>إجمالي الحسابات: " + accounts.length + " | العملة: " + baseSymbol + "</div>" + sections + "</body></html>";
  };

  const csvContent = useMemo(() => {
    const header = "النوع,الرمز,الاسم,الحساب الأب,الرصيد\n";
    return (
      header +
      accounts
        .map(
          (a) => (TYPE_LABEL[a.account_type] || a.account_type) + "," + (a.code || "") + "," + (a.name || "") + "," + (a.parent_code || "") + "," + Number(a.balance || 0).toFixed(2)
        )
        .join("\n")
    );
  }, [accounts]);

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 40, paddingHorizontal: 4 }}>
      <View style={styles.backWrap}>
        <Text style={styles.back} onPress={onBack}>
          {"->"} العودة إلى التقارير
        </Text>
      </View>

      <ReportHeader
        title="تقرير الحسابات"
        subtitle="شجرة الحسابات والأرصدة"
        from={from}
        to={to}
        currencySymbol={baseSymbol}
      />

      <ReportActions
        onRefresh={load}
        onExportPdf={() => exportPdf(buildHtml(), "تقرير-الحسابات-" + from + "-" + to + ".pdf")}
        onExportCsv={() => exportCsv(csvContent, "تقرير-الحسابات.csv")}
      />

      <ReportSummary
        items={[
          { label: "عدد الحسابات", value: String(accounts.length) },
          { label: "إجمالي الأصول (" + baseSymbol + ")", value: totals.asset.toFixed(2) },
          { label: "إجمالي الخصوم (" + baseSymbol + ")", value: totals.liability.toFixed(2) },
          { label: "إجمالي الإيرادات (" + baseSymbol + ")", value: totals.income.toFixed(2) },
          { label: "إجمالي المصروفات (" + baseSymbol + ")", value: totals.expense.toFixed(2) },
        ]}
      />

      {(["asset", "liability", "income", "expense"] as const).map((type) => (
        <View key={type}>
          <Text style={styles.sectionTitle}>
            {TYPE_LABEL[type]} ({grouped[type].length})
          </Text>
          {grouped[type].length === 0 ? (
            <Text style={styles.empty}>لا توجد حسابات</Text>
          ) : (
            grouped[type].map((a) => (
              <View key={a.id} style={styles.row}>
                <Text
                  style={[
                    styles.value,
                    {
                      color: Number(a.balance || 0) > 0 ? "#059669" : Number(a.balance || 0) < 0 ? "#dc2626" : "#8494B0",
                    },
                  ]}
                >
                  {Number(a.balance || 0).toFixed(2)} {baseSymbol}
                </Text>
                <View style={styles.rowInfo}>
                  <Text style={styles.rowName}>{a.name}</Text>
                  <Text style={styles.rowMeta}>
                    {a.code}
                    {a.parent_code ? " · تحت " + a.parent_code : ""}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  backWrap: { paddingVertical: 8 },
  back: { color: "#1E40AF", fontWeight: "700", textAlign: "right" },
  sectionTitle: { fontSize: 15,  color: "#1E40AF", textAlign: "right", marginTop: 14, marginBottom: 8 },
  empty: { textAlign: "right", color: "#8494B0", fontSize: 12, padding: 10 },
  row: { backgroundColor: "#f8fafc", borderWidth: 1, borderColor: "#D6E3F8", borderRadius: 10, padding: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  rowInfo: { flex: 1, alignItems: "flex-end" },
  rowName: { fontWeight: "700", color: "#0F172A", textAlign: "right", fontSize: 14 },
  rowMeta: { fontSize: 11, color: "#8494B0", marginTop: 2, textAlign: "right" },
  value: { fontWeight: "800", fontSize: 14 },
});
