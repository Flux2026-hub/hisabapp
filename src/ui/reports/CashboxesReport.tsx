import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { sqlite } from "../../db/local";
import ReportHeader from "./components/ReportHeader";
import ReportSummary from "./components/ReportSummary";
import ReportActions, { exportCsv, exportPdf } from "./components/ReportActions";

type Row = any;

export default function CashboxesReport({ onBack }: { onBack: () => void }) {
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(today.slice(0, 8) + "01");
  const [to, setTo] = useState(today);
  const [cashboxes, setCashboxes] = useState<Row[]>([]);
  const [selected, setSelected] = useState<Row | null>(null);
  const [movements, setMovements] = useState<Row[]>([]);
  const [baseSymbol, setBaseSymbol] = useState("ر.ي");

  useEffect(() => {
    (async () => {
      try {
        const base: any = await sqlite.getFirstAsync(
          "SELECT symbol, code FROM currencies WHERE is_base = 1 LIMIT 1"
        );
        if (base) setBaseSymbol(base.symbol || base.code);
        await loadCashboxes();
      } catch (e) {
        Alert.alert("تعذر التحميل", String(e));
      }
    })();
  }, []);

  const loadCashboxes = async () => {
    const rows: any = await sqlite.getAllAsync(
      "SELECT id, code, name, cashbox_type, balance FROM cashboxes ORDER BY name"
    );
    setCashboxes(rows || []);
  };

  const loadMovements = async (cashbox: Row) => {
    try {
      const fromTs = new Date(from + "T00:00:00").getTime() || 0;
      const toTs = new Date(to + "T23:59:59").getTime() || Date.now();

      const vouchers: any = await sqlite.getAllAsync(
        "SELECT 'voucher' as kind, voucher_no as ref, amount, voucher_type, party_name, description, created_at, exchange_rate, currency_code FROM vouchers WHERE cashbox_id = ? AND created_at BETWEEN ? AND ? ORDER BY created_at ASC",
        [cashbox.id, fromTs, toTs]
      );

      const invoices: any = await sqlite.getAllAsync(
        "SELECT 'invoice' as kind, invoice_no as ref, total as amount, invoice_type, party_name, NULL as description, created_at, exchange_rate, currency_code, payment_type FROM invoices WHERE cashbox_id = ? AND payment_type = 'cash' AND created_at BETWEEN ? AND ? ORDER BY created_at ASC",
        [cashbox.id, fromTs, toTs]
      );

      const transfersOut: any = await sqlite.getAllAsync(
        "SELECT 'transfer_out' as kind, transfer_no as ref, amount, NULL as voucher_type, to_account as party_name, description, created_at, NULL as exchange_rate, NULL as currency_code FROM account_transfers WHERE from_account = ? AND created_at BETWEEN ? AND ?",
        [cashbox.name, fromTs, toTs]
      );

      const transfersIn: any = await sqlite.getAllAsync(
        "SELECT 'transfer_in' as kind, transfer_no as ref, amount, NULL as voucher_type, from_account as party_name, description, created_at, NULL as exchange_rate, NULL as currency_code FROM account_transfers WHERE to_account = ? AND created_at BETWEEN ? AND ?",
        [cashbox.name, fromTs, toTs]
      );

      const all = [...(vouchers || []), ...(invoices || []), ...(transfersOut || []), ...(transfersIn || [])].sort(
        (a: any, b: any) => a.created_at - b.created_at
      );

      let running = 0;
      const withBalance = all.map((m: any) => {
        const amount = Number(m.amount) || 0;
        let debit = 0;
        let credit = 0;
        let desc = "";

        if (m.kind === "voucher") {
          if (m.voucher_type === "receipt") {
            debit = amount;
            desc = "سند قبض";
          } else {
            credit = amount;
            desc = "سند دفع";
          }
        } else if (m.kind === "invoice") {
          if (m.invoice_type === "sales") {
            debit = amount;
            desc = "فاتورة مبيعات نقدية";
          } else {
            credit = amount;
            desc = "فاتورة مشتريات نقدية";
          }
        } else if (m.kind === "transfer_out") {
          credit = amount;
          desc = "تحويل إلى " + m.party_name;
        } else if (m.kind === "transfer_in") {
          debit = amount;
          desc = "تحويل من " + m.party_name;
        }

        running += debit - credit;
        return { ...m, debit, credit, desc, balance: running };
      });

      setMovements(withBalance);
      setSelected(cashbox);
    } catch (e) {
      Alert.alert("تعذر التحميل", String(e));
    }
  };

  const totalDebit = useMemo(
    () => movements.reduce((s, r) => s + (r.debit || 0), 0),
    [movements]
  );
  const totalCredit = useMemo(
    () => movements.reduce((s, r) => s + (r.credit || 0), 0),
    [movements]
  );

  const buildHtml = () => {
    if (selected) {
      const rows = movements
        .map(
          (m) => "<tr><td>" + new Date(m.created_at).toLocaleDateString("ar-EG") + "</td><td>" + m.desc + "</td><td>" + m.ref + "</td><td>" + Number(m.debit || 0).toFixed(2) + "</td><td>" + Number(m.credit || 0).toFixed(2) + "</td><td>" + Number(m.balance || 0).toFixed(2) + "</td></tr>"
        )
        .join("");

      return "<!DOCTYPE html><html dir='rtl'><head><meta charset='utf-8'/><style>body{font-family:Arial,Tahoma;padding:24px;direction:rtl;color:#172033}.head{text-align:center;border-bottom:2px solid #10a88a;padding-bottom:12px;margin-bottom:16px}.brand{font-size:22px;font-weight:800;color:#087f68}h1{font-size:18px;margin:12px 0}table{width:100%;border-collapse:collapse;margin-top:12px}th,td{border:1px solid #dfe5ed;padding:7px;text-align:right;font-size:12px}th{background:#0b1220;color:#fff}.sum{margin:14px 0;padding:12px;background:#eef6ff;border-radius:8px}.sum div{margin:4px 0;font-weight:700;color:#315b85}</style></head><body><div class='head'><div class='brand'>فلوكس</div><div style='font-size:12px;color:#758298'>منتج تسليك المجاري</div></div><h1>حركة الصندوق: " + selected.name + "</h1><div style='color:#526078;font-size:11px'>الفترة: " + from + " -> " + to + " | العملة: " + baseSymbol + "</div><div class='sum'><div>إجمالي الوارد: " + totalDebit.toFixed(2) + " " + baseSymbol + "</div><div>إجمالي الصادر: " + totalCredit.toFixed(2) + " " + baseSymbol + "</div><div>الرصيد الحالي: " + Number(selected.balance || 0).toFixed(2) + " " + baseSymbol + "</div></div><table><thead><tr><th>التاريخ</th><th>البيان</th><th>المرجع</th><th>وارد</th><th>صادر</th><th>الرصيد</th></tr></thead><tbody>" + rows + "</tbody></table></body></html>";
    }

    const rows = cashboxes
      .map(
        (c) => "<tr><td>" + (c.code || "") + "</td><td>" + (c.name || "") + "</td><td>" + (c.cashbox_type || "") + "</td><td>" + Number(c.balance || 0).toFixed(2) + " " + baseSymbol + "</td></tr>"
      )
      .join("");

    return "<!DOCTYPE html><html dir='rtl'><head><meta charset='utf-8'/><style>body{font-family:Arial,Tahoma;padding:24px;direction:rtl;color:#172033}.head{text-align:center;border-bottom:2px solid #10a88a;padding-bottom:12px;margin-bottom:16px}.brand{font-size:22px;font-weight:800;color:#087f68}h1{font-size:18px;margin:12px 0}table{width:100%;border-collapse:collapse;margin-top:12px}th,td{border:1px solid #dfe5ed;padding:7px;text-align:right;font-size:12px}th{background:#0b1220;color:#fff}</style></head><body><div class='head'><div class='brand'>فلوكس</div><div style='font-size:12px;color:#758298'>منتج تسليك المجاري</div></div><h1>أرصدة الصناديق</h1><div style='color:#526078;font-size:11px'>عدد الصناديق: " + cashboxes.length + " | العملة: " + baseSymbol + "</div><table><thead><tr><th>الرمز</th><th>الاسم</th><th>النوع</th><th>الرصيد</th></tr></thead><tbody>" + rows + "</tbody></table></body></html>";
  };

  const csvContent = useMemo(() => {
    if (selected) {
      const header = "التاريخ,البيان,المرجع,وارد,صادر,الرصيد\n";
      return (
        header +
        movements
          .map(
            (m) =>
              new Date(m.created_at).toLocaleDateString("ar-EG") + "," + m.desc + "," + m.ref + "," + Number(m.debit || 0).toFixed(2) + "," + Number(m.credit || 0).toFixed(2) + "," + Number(m.balance || 0).toFixed(2)
          )
          .join("\n")
      );
    }
    const header = "الرمز,الاسم,النوع,الرصيد\n";
    return (
      header +
      cashboxes
        .map(
          (c) => (c.code || "") + "," + (c.name || "") + "," + (c.cashbox_type || "") + "," + Number(c.balance || 0).toFixed(2)
        )
        .join("\n")
    );
  }, [selected, movements, cashboxes]);

  const totalBalance = useMemo(
    () => cashboxes.reduce((s, c) => s + Number(c.balance || 0), 0),
    [cashboxes]
  );

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 40, paddingHorizontal: 4 }}>
      <View style={styles.backWrap}>
        <Text style={styles.back} onPress={() => (selected ? setSelected(null) : onBack())}>
          {"<-"} {selected ? "العودة إلى القائمة" : "العودة إلى التقارير"}
        </Text>
      </View>

      <ReportHeader
        title={selected ? "حركة: " + selected.name : "تقرير الصناديق"}
        subtitle={selected ? "الحركات والأرصدة" : "أرصدة الصناديق"}
        from={from}
        to={to}
        currencySymbol={baseSymbol}
      />

      <ReportActions
        onRefresh={() => (selected ? loadMovements(selected) : loadCashboxes())}
        onExportPdf={() =>
          exportPdf(
            buildHtml(),
            selected ? "حركة-" + selected.name + "-" + from + "-" + to + ".pdf" : "تقرير-الصناديق-" + from + "-" + to + ".pdf"
          )
        }
        onExportCsv={() =>
          exportCsv(
            csvContent,
            selected ? "حركة-" + selected.name + ".csv" : "تقرير-الصناديق.csv"
          )
        }
      />

      {!selected && (
        <ReportSummary
          items={[
            { label: "عدد الصناديق", value: String(cashboxes.length) },
            { label: "إجمالي الأرصدة (" + baseSymbol + ")", value: totalBalance.toFixed(2) },
          ]}
        />
      )}

      {selected && (
        <ReportSummary
          items={[
            { label: "عدد الحركات", value: String(movements.length) },
            { label: "إجمالي الوارد (" + baseSymbol + ")", value: totalDebit.toFixed(2), color: "#059669" },
            { label: "إجمالي الصادر (" + baseSymbol + ")", value: totalCredit.toFixed(2), color: "#dc2626" },
            {
              label: "الرصيد (" + baseSymbol + ")",
              value: Number(selected.balance || 0).toFixed(2),
              color: Number(selected.balance || 0) > 0 ? "#059669" : "#dc2626",
            },
          ]}
        />
      )}

      {!selected ? (
        <>
          <Text style={styles.sectionTitle}>قائمة الصناديق</Text>
          {cashboxes.length === 0 ? (
            <Text style={styles.empty}>لا توجد صناديق</Text>
          ) : (
            cashboxes.map((c) => (
              <Pressable key={c.id} style={styles.row} onPress={() => loadMovements(c)}>
                <Text style={[styles.value, { color: "#315b85" }]}>
                  {Number(c.balance || 0).toFixed(2)} {baseSymbol}
                </Text>
                <View style={styles.rowInfo}>
                  <Text style={styles.rowName}>{c.name}</Text>
                  <Text style={styles.rowMeta}>{c.code} · {c.cashbox_type}</Text>
                </View>
              </Pressable>
            ))
          )}
        </>
      ) : (
        <>
          <Text style={styles.sectionTitle}>حركات الصندوق</Text>
          {movements.length === 0 ? (
            <Text style={styles.empty}>لا توجد حركات في هذه الفترة</Text>
          ) : (
            movements.map((m: any, i: number) => (
              <View key={i} style={styles.row}>
                <View style={styles.rowRight}>
                  <Text style={styles.valueSmall}>{Number(m.balance || 0).toFixed(2)}</Text>
                </View>
                <View style={styles.rowInfo}>
                  <Text style={styles.rowName}>{m.desc}</Text>
                  <Text style={styles.rowMeta}>{m.ref} · {new Date(m.created_at).toLocaleDateString("ar-EG")}</Text>
                  <Text style={{ fontSize: 11, marginTop: 3, textAlign: "right", color: m.debit > 0 ? "#059669" : "#dc2626" }}>
                    {m.debit > 0 ? "وارد: " + m.debit.toFixed(2) : "صادر: " + m.credit.toFixed(2)}
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
  sectionTitle: { fontSize: 15, fontWeight: "800", color: "#315b85", textAlign: "right", marginTop: 14, marginBottom: 8 },
  empty: { textAlign: "right", color: "#758298", fontSize: 12, padding: 10 },
  row: { backgroundColor: "#f8fafc", borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 10, padding: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  rowInfo: { flex: 1, alignItems: "flex-end" },
  rowRight: { alignItems: "flex-start" },
  rowName: { fontWeight: "700", color: "#172033", textAlign: "right", fontSize: 14 },
  rowMeta: { fontSize: 11, color: "#758298", marginTop: 2, textAlign: "right" },
  value: { fontWeight: "800", fontSize: 14 },
  valueSmall: { fontWeight: "700", fontSize: 13, color: "#315b85" },
});
