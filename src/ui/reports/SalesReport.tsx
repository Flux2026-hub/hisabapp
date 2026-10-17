import { useEffect, useMemo, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { sqlite } from "../../db/local";
import ReportHeader from "./components/ReportHeader";
import ReportSummary from "./components/ReportSummary";
import DateRangePicker from "./components/DateRangePicker";
import ReportActions, { exportCsv, exportPdf } from "./components/ReportActions";

export default function SalesReport({ onBack }: { onBack: () => void }) {
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(today.slice(0, 8) + "01");
  const [to, setTo] = useState(today);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [baseSymbol, setBaseSymbol] = useState("ر.ي");

  const load = async () => {
    try {
      const base: any = await sqlite.getFirstAsync(
        "SELECT symbol, code FROM currencies WHERE is_base = 1 LIMIT 1"
      );
      if (base) setBaseSymbol(base.symbol || base.code);

      const fromTs = new Date(from + "T00:00:00").getTime() || 0;
      const toTs = new Date(to + "T23:59:59").getTime() || Date.now();

      const rows: any = await sqlite.getAllAsync(
        `SELECT i.id, i.invoice_no, i.party_name, i.total, i.currency_code, i.exchange_rate,
                i.payment_type, i.created_at,
                (SELECT is_base FROM currencies WHERE code = i.currency_code) as is_base
         FROM invoices i
         WHERE i.invoice_type = 'sales' AND i.created_at BETWEEN ? AND ?
         ORDER BY i.created_at DESC`,
        [fromTs, toTs]
      );
      setInvoices(rows || []);
    } catch (e) {
      Alert.alert("تعذر التحميل", String(e));
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stats = useMemo(() => {
    let totalBase = 0;
    let totalOriginal = 0;
    let cashCount = 0;
    let creditCount = 0;

    for (const inv of invoices) {
      const amount = Number(inv.total) || 0;
      const rate = Number(inv.exchange_rate) || 1;
      const isBase = !!inv.is_base;
      const baseAmount = isBase ? amount : amount * rate;

      totalBase += baseAmount;
      totalOriginal += amount;
      if (inv.payment_type === "cash") cashCount++;
      else creditCount++;
    }

    return {
      count: invoices.length,
      totalBase,
      totalOriginal,
      cashCount,
      creditCount,
      avg: invoices.length ? totalBase / invoices.length : 0,
    };
  }, [invoices]);

  const buildHtml = () => {
    const rows = invoices
      .map((inv) => {
        const amount = Number(inv.total) || 0;
        return `<tr>
          <td>${inv.invoice_no}</td>
          <td>${inv.party_name || "—"}</td>
          <td>${inv.payment_type === "cash" ? "نقدي" : "أجل"}</td>
          <td>${amount.toFixed(2)} ${inv.currency_code}</td>
          <td>${new Date(inv.created_at).toLocaleDateString("ar-EG")}</td>
        </tr>`;
      })
      .join("");

    return `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8"/>
    <style>
      body{font-family:Arial,Tahoma;padding:24px;color:#0F172A;direction:rtl}
      .head{text-align:center;border-bottom:2px solid #F97316;padding-bottom:12px;margin-bottom:16px}
      .brand{font-size:22px;font-weight:800;color:#1E40AF}
      h1{font-size:18px;margin:12px 0}
      table{width:100%;border-collapse:collapse;margin-top:12px}
      th,td{border:1px solid #D6E3F8;padding:7px;text-align:right;font-size:12px}
      th{background:#1E40AF;color:#fff}
      .sum{margin:14px 0;padding:12px;background:#EFF6FF;border-radius:8px}
      .sum div{margin:4px 0;font-weight:700;color:#1E40AF}
    </style></head><body>
      <div class="head"><div class="brand">فلوكس</div><div style="font-size:12px;color:#8494B0">منتج تسليك المجاري</div></div>
      <h1>تقرير المبيعات</h1>
      <div style="color:#526078;font-size:11px">الفترة: ${from} → ${to} | العملة الأساسية: ${baseSymbol}</div>
      <div class="sum">
        <div>عدد الفواتير: ${stats.count}</div>
        <div>إجمالي المبيعات (${baseSymbol}): ${stats.totalBase.toFixed(2)}</div>
        <div>فواتير نقدية: ${stats.cashCount} | فواتير آجلة: ${stats.creditCount}</div>
        <div>متوسط الفاتورة: ${stats.avg.toFixed(2)} ${baseSymbol}</div>
      </div>
      <table>
        <thead><tr><th>الرقم</th><th>العميل</th><th>الدفع</th><th>المبلغ</th><th>التاريخ</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </body></html>`;
  };

  const csvContent = useMemo(() => {
    const header = "رقم,العميل,الدفع,المبلغ,العملة,التاريخ\n";
    const lines = invoices
      .map(
        (inv) =>
          `${inv.invoice_no},${inv.party_name || ""},${
            inv.payment_type === "cash" ? "نقدي" : "أجل"
          },${Number(inv.total).toFixed(2)},${inv.currency_code},${new Date(
            inv.created_at
          ).toLocaleDateString("ar-EG")}`
      )
      .join("\n");
    return header + lines;
  }, [invoices]);

  return (
    <ScrollView
      contentContainerStyle={{ paddingBottom: 40, paddingHorizontal: 4 }}
    >
      <View style={styles.backWrap}>
        <Text style={styles.back} onPress={onBack}>
          العودة -> إلى التقارير
        </Text>
      </View>

      <ReportHeader
        title="تقرير المبيعات"
        subtitle="كل فواتير المبيعات في الفترة المحددة"
        from={from}
        to={to}
        currencySymbol={baseSymbol}
      />

      <DateRangePicker
        from={from}
        to={to}
        onFromChange={setFrom}
        onToChange={setTo}
      />

      <ReportActions
        onRefresh={load}
        onExportPdf={() =>
          exportPdf(buildHtml(), `تقرير-المبيعات-${from}-${to}.pdf`)
        }
        onExportCsv={() =>
          exportCsv(csvContent, `تقرير-المبيعات-${from}-${to}.csv`)
        }
      />

      <ReportSummary
        items={[
          { label: "عدد الفواتير", value: String(stats.count) },
          {
            label: `إجمالي المبيعات (${baseSymbol})`,
            value: stats.totalBase.toFixed(2),
          },
          { label: "فواتير نقدية", value: String(stats.cashCount) },
          { label: "فواتير آجلة", value: String(stats.creditCount) },
          {
            label: `متوسط الفاتورة (${baseSymbol})`,
            value: stats.avg.toFixed(2),
          },
        ]}
      />

      <Text style={styles.sectionTitle}>تفاصيل الفواتير</Text>
      {invoices.length === 0 ? (
        <Text style={styles.empty}>لا توجد فواتير في هذه الفترة</Text>
      ) : (
        invoices.map((inv) => (
          <View key={inv.id} style={styles.row}>
            <View style={styles.rowRight}>
              <Text style={styles.amount}>
                {Number(inv.total).toFixed(2)} {inv.currency_code}
              </Text>
              <Text style={styles.payTag}>
                {inv.payment_type === "cash" ? "نقدي" : "أجل"}
              </Text>
            </View>
            <View style={styles.rowInfo}>
              <Text style={styles.rowName}>{inv.party_name || "—"}</Text>
              <Text style={styles.rowMeta}>{inv.invoice_no}</Text>
              <Text style={styles.rowDate}>
                {new Date(inv.created_at).toLocaleString("ar-EG")}
              </Text>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  backWrap: { paddingVertical: 8 },
  back: { color: "#1E40AF", fontWeight: "700", textAlign: "right" },
  sectionTitle: {
    fontSize: 15,
    
    color: "#1E40AF",
    textAlign: "right",
    marginTop: 14,
    marginBottom: 8,
  },
  empty: {
    textAlign: "right",
    color: "#8494B0",
    fontSize: 12,
    padding: 10,
  },
  row: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#D6E3F8",
    borderRadius: 10,
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  rowInfo: { flex: 1, alignItems: "flex-end" },
  rowRight: { alignItems: "flex-start" },
  rowName: {
    fontWeight: "700",
    color: "#0F172A",
    textAlign: "right",
    fontSize: 14,
  },
  rowMeta: {
    fontSize: 11,
    color: "#1E40AF",
    marginTop: 2,
    textAlign: "right",
    fontWeight: "600",
  },
  rowDate: {
    fontSize: 10,
    color: "#8494B0",
    marginTop: 2,
    textAlign: "right",
  },
  amount: { color: "#0b806c", fontWeight: "800", fontSize: 14 },
  payTag: { color: "#8494B0", fontSize: 10, marginTop: 2 },
});