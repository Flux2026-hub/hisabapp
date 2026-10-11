import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { sqlite } from "../../db/local";
import ReportHeader from "./components/ReportHeader";
import ReportSummary from "./components/ReportSummary";
import ReportActions, { exportCsv, exportPdf } from "./components/ReportActions";

type Row = any;

export default function CustomersReport({ onBack }: { onBack: () => void }) {
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(today.slice(0, 8) + "01");
  const [to, setTo] = useState(today);
  const [customers, setCustomers] = useState<Row[]>([]);
  const [selected, setSelected] = useState<Row | null>(null);
  const [statement, setStatement] = useState<Row[]>([]);
  const [baseSymbol, setBaseSymbol] = useState("ر.ي");

  useEffect(() => {
    (async () => {
      try {
        const base: any = await sqlite.getFirstAsync(
          "SELECT symbol, code FROM currencies WHERE is_base = 1 LIMIT 1"
        );
        if (base) setBaseSymbol(base.symbol || base.code);
        await loadCustomers();
      } catch (e) {
        Alert.alert("تعذر التحميل", String(e));
      }
    })();
  }, []);

  const loadCustomers = async () => {
    const rows: any = await sqlite.getAllAsync(
      "SELECT id, code, name, phone, balance FROM customers ORDER BY name"
    );
    setCustomers(rows || []);
  };

  const loadStatement = async (customer: Row) => {
    try {
      const fromTs = new Date(from + "T00:00:00").getTime() || 0;
      const toTs = new Date(to + "T23:59:59").getTime() || Date.now();

      const invoices: any = await sqlite.getAllAsync(
        "SELECT 'invoice' as kind, invoice_no as ref, total as amount, currency_code, exchange_rate, payment_type, created_at, invoice_type FROM invoices WHERE party_id = ? AND created_at BETWEEN ? AND ? ORDER BY created_at ASC",
        [customer.id, fromTs, toTs]
      );

      const vouchers: any = await sqlite.getAllAsync(
        "SELECT 'voucher' as kind, voucher_no as ref, amount, currency_code, exchange_rate, voucher_type as payment_type, created_at, NULL as invoice_type FROM vouchers WHERE party_type = 'customer' AND party_id = ? AND created_at BETWEEN ? AND ? ORDER BY created_at ASC",
        [customer.id, fromTs, toTs]
      );

      const all = [...(invoices || []), ...(vouchers || [])].sort(
        (a: any, b: any) => a.created_at - b.created_at
      );

      let running = 0;
      const withBalance = all.map((m: any) => {
        const rate = Number(m.exchange_rate) || 1;
        const amount = Number(m.amount) || 0;
        const baseAmount = amount * rate;

        let debit = 0;
        let credit = 0;
        let desc = "";

        if (m.kind === "invoice") {
          debit = baseAmount;
          desc = m.invoice_type === "sales" ? "فاتورة مبيعات" : "فاتورة مشتريات";
        } else if (m.kind === "voucher") {
          if (m.payment_type === "receipt") {
            credit = baseAmount;
            desc = "سند قبض";
          } else {
            debit = baseAmount;
            desc = "سند دفع";
          }
        }

        running += debit - credit;
        return { ...m, debit, credit, desc, balance: running };
      });

      setStatement(withBalance);
      setSelected(customer);
    } catch (e) {
      Alert.alert("تعذر تحميل كشف الحساب", String(e));
    }
  };

  const totalDebit = useMemo(
    () => statement.reduce((s, r) => s + (r.debit || 0), 0),
    [statement]
  );
  const totalCredit = useMemo(
    () => statement.reduce((s, r) => s + (r.credit || 0), 0),
    [statement]
  );

  const buildHtml = () => {
    if (selected) {
      const rows = statement
        .map(
          (m) => "<tr><td>" + new Date(m.created_at).toLocaleDateString("ar-EG") + "</td><td>" + m.desc + "</td><td>" + m.ref + "</td><td>" + Number(m.debit || 0).toFixed(2) + "</td><td>" + Number(m.credit || 0).toFixed(2) + "</td><td>" + Number(m.balance || 0).toFixed(2) + "</td></tr>"
        )
        .join("");

      return "<!DOCTYPE html><html dir='rtl'><head><meta charset='utf-8'/><style>body{font-family:Arial,Tahoma;padding:24px;direction:rtl;color:#172033}.head{text-align:center;border-bottom:2px solid #10a88a;padding-bottom:12px;margin-bottom:16px}.brand{font-size:22px;font-weight:800;color:#087f68}h1{font-size:18px;margin:12px 0}table{width:100%;border-collapse:collapse;margin-top:12px}th,td{border:1px solid #dfe5ed;padding:7px;text-align:right;font-size:12px}th{background:#0b1220;color:#fff}.sum{margin:14px 0;padding:12px;background:#eef6ff;border-radius:8px}.sum div{margin:4px 0;font-weight:700;color:#315b85}</style></head><body><div class='head'><div class='brand'>فلوكس</div><div style='font-size:12px;color:#758298'>منتج تسليك المجاري</div></div><h1>كشف حساب العميل: " + selected.name + "</h1><div style='color:#526078;font-size:11px'>الفترة: " + from + " -> " + to + " | العملة: " + baseSymbol + "</div><div class='sum'><div>إجمالي المدين: " + totalDebit.toFixed(2) + " " + baseSymbol + "</div><div>إجمالي الدائن: " + totalCredit.toFixed(2) + " " + baseSymbol + "</div><div>الرصيد الحالي: " + Number(selected.balance || 0).toFixed(2) + " " + baseSymbol + "</div></div><table><thead><tr><th>التاريخ</th><th>البيان</th><th>المرجع</th><th>مدين</th><th>دائن</th><th>الرصيد</th></tr></thead><tbody>" + rows + "</tbody></table></body></html>";
    }

    const rows = customers
      .map(
        (c) => "<tr><td>" + (c.code || "") + "</td><td>" + (c.name || "") + "</td><td>" + (c.phone || "") + "</td><td>" + Number(c.balance || 0).toFixed(2) + " " + baseSymbol + "</td></tr>"
      )
      .join("");

    return "<!DOCTYPE html><html dir='rtl'><head><meta charset='utf-8'/><style>body{font-family:Arial,Tahoma;padding:24px;direction:rtl;color:#172033}.head{text-align:center;border-bottom:2px solid #10a88a;padding-bottom:12px;margin-bottom:16px}.brand{font-size:22px;font-weight:800;color:#087f68}h1{font-size:18px;margin:12px 0}table{width:100%;border-collapse:collapse;margin-top:12px}th,td{border:1px solid #dfe5ed;padding:7px;text-align:right;font-size:12px}th{background:#0b1220;color:#fff}</style></head><body><div class='head'><div class='brand'>فلوكس</div><div style='font-size:12px;color:#758298'>منتج تسليك المجاري</div></div><h1>تقرير العملاء</h1><div style='color:#526078;font-size:11px'>عدد العملاء: " + customers.length + " | العملة: " + baseSymbol + "</div><table><thead><tr><th>الرمز</th><th>الاسم</th><th>الهاتف</th><th>الرصيد</th></tr></thead><tbody>" + rows + "</tbody></table></body></html>";
  };

  const csvContent = useMemo(() => {
    if (selected) {
      const header = "التاريخ,البيان,المرجع,مدين,دائن,الرصيد\n";
      const lines = statement
        .map(
          (m) =>
            new Date(m.created_at).toLocaleDateString("ar-EG") + "," + m.desc + "," + m.ref + "," + Number(m.debit || 0).toFixed(2) + "," + Number(m.credit || 0).toFixed(2) + "," + Number(m.balance || 0).toFixed(2)
        )
        .join("\n");
      return header + lines;
    }
    const header = "الرمز,الاسم,الهاتف,الرصيد\n";
    const lines = customers
      .map(
        (c) => (c.code || "") + "," + (c.name || "") + "," + (c.phone || "") + "," + Number(c.balance || 0).toFixed(2)
      )
      .join("\n");
    return header + lines;
  }, [selected, statement, customers]);

  const totalBalance = useMemo(
    () => customers.reduce((s, c) => s + Number(c.balance || 0), 0),
    [customers]
  );

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 40, paddingHorizontal: 4 }}>
      <View style={styles.backWrap}>
        <Text style={styles.back} onPress={() => (selected ? setSelected(null) : onBack())}>
          {"<-"} {selected ? "العودة إلى القائمة" : "العودة إلى التقارير"}
        </Text>
      </View>

      <ReportHeader
        title={selected ? "كشف حساب: " + selected.name : "تقرير العملاء"}
        subtitle={selected ? "الحركات والأرصدة" : "قائمة العملاء وأرصدتهم"}
        from={from}
        to={to}
        currencySymbol={baseSymbol}
      />

      <ReportActions
        onRefresh={() => (selected ? loadStatement(selected) : loadCustomers())}
        onExportPdf={() =>
          exportPdf(
            buildHtml(),
            selected ? "كشف-حساب-" + selected.name + "-" + from + "-" + to + ".pdf" : "تقرير-العملاء-" + from + "-" + to + ".pdf"
          )
        }
        onExportCsv={() =>
          exportCsv(
            csvContent,
            selected ? "كشف-حساب-" + selected.name + ".csv" : "تقرير-العملاء.csv"
          )
        }
      />

      {!selected && (
        <ReportSummary
          items={[
            { label: "عدد العملاء", value: String(customers.length) },
            { label: "إجمالي الأرصدة (" + baseSymbol + ")", value: totalBalance.toFixed(2) },
          ]}
        />
      )}

      {selected && (
        <ReportSummary
          items={[
            { label: "عدد الحركات", value: String(statement.length) },
            { label: "إجمالي المدين (" + baseSymbol + ")", value: totalDebit.toFixed(2), color: "#dc2626" },
            { label: "إجمالي الدائن (" + baseSymbol + ")", value: totalCredit.toFixed(2), color: "#059669" },
            {
              label: "الرصيد (" + baseSymbol + ")",
              value: Number(selected.balance || 0).toFixed(2),
              color: Number(selected.balance || 0) > 0 ? "#059669" : Number(selected.balance || 0) < 0 ? "#dc2626" : "#758298",
            },
          ]}
        />
      )}

      {!selected ? (
        <>
          <Text style={styles.sectionTitle}>قائمة العملاء</Text>
          {customers.length === 0 ? (
            <Text style={styles.empty}>لا يوجد عملاء</Text>
          ) : (
            customers.map((c) => (
              <Pressable key={c.id} style={styles.row} onPress={() => loadStatement(c)}>
                <Text
                  style={[
                    styles.value,
                    {
                      color: Number(c.balance || 0) > 0 ? "#059669" : Number(c.balance || 0) < 0 ? "#dc2626" : "#758298",
                    },
                  ]}
                >
                  {Number(c.balance || 0).toFixed(2)} {baseSymbol}
                </Text>
                <View style={styles.rowInfo}>
                  <Text style={styles.rowName}>{c.name}</Text>
                  <Text style={styles.rowMeta}>{c.code} · {c.phone || ""}</Text>
                </View>
              </Pressable>
            ))
          )}
        </>
      ) : (
        <>
          <Text style={styles.sectionTitle}>حركات الحساب</Text>
          {statement.length === 0 ? (
            <Text style={styles.empty}>لا توجد حركات في هذه الفترة</Text>
          ) : (
            statement.map((m: any, i: number) => (
              <View key={i} style={styles.row}>
                <View style={styles.rowRight}>
                  <Text style={styles.valueSmall}>{Number(m.balance || 0).toFixed(2)}</Text>
                </View>
                <View style={styles.rowInfo}>
                  <Text style={styles.rowName}>{m.desc} · {m.ref}</Text>
                  <Text style={styles.rowMeta}>{new Date(m.created_at).toLocaleDateString("ar-EG")}</Text>
                  <Text style={{ fontSize: 11, marginTop: 3, textAlign: "right", color: m.debit > 0 ? "#dc2626" : "#059669" }}>
                    {m.debit > 0 ? "مدين: " + m.debit.toFixed(2) : "دائن: " + m.credit.toFixed(2)}
                  </Text>
                </View>
              </View>
            ))
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  backWrap: { paddingVertical: 8 },
  back: { color: "#087f68", fontWeight: "700", textAlign: "right" },
  sectionTitle: { fontSize: 15, fontWeight: "800", color: "#087f68", textAlign: "right", marginTop: 14, marginBottom: 8 },
  empty: { textAlign: "right", color: "#758298", fontSize: 12, padding: 10 },
  row: { backgroundColor: "#f8fafc", borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 10, padding: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  rowInfo: { flex: 1, alignItems: "flex-end" },
  rowRight: { alignItems: "flex-start" },
  rowName: { fontWeight: "700", color: "#172033", textAlign: "right", fontSize: 14 },
  rowMeta: { fontSize: 11, color: "#758298", marginTop: 2, textAlign: "right" },
  value: { fontWeight: "800", fontSize: 14 },
  valueSmall: { fontWeight: "700", fontSize: 13, color: "#087f68" },
});
