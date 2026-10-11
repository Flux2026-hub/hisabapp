import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { sqlite } from "../../db/local";
import ReportHeader from "./components/ReportHeader";
import ReportSummary from "./components/ReportSummary";
import DateRangePicker from "./components/DateRangePicker";
import ReportActions, { exportCsv, exportPdf } from "./components/ReportActions";
import { COLORS } from "../theme";

type Row = any;
type BalanceFilter = "all" | "positive" | "negative" | "zero";

export default function CustomersReport({ onBack }: { onBack: () => void }) {
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(today.slice(0, 8) + "01");
  const [to, setTo] = useState(today);
  const [customers, setCustomers] = useState<Row[]>([]);
  const [selected, setSelected] = useState<Row | null>(null);
  const [statement, setStatement] = useState<Row[]>([]);
  const [baseCurrency, setBaseCurrency] = useState<Row | null>(null);
  const [currencies, setCurrencies] = useState<Row[]>([]);
  const [balanceFilter, setBalanceFilter] = useState<BalanceFilter>("all");

  useEffect(() => {
    (async () => {
      try {
        const curs: any = await sqlite.getAllAsync(
          "SELECT id, code, name, symbol, exchange_rate, is_base FROM currencies ORDER BY is_base DESC, code"
        );
        const normCur = (curs || []).map((x: any) => ({
          id: x.id,
          code: x.code,
          name: x.name,
          symbol: x.symbol,
          exchangeRate: Number(x.exchange_rate ?? x.exchangeRate ?? 1) || 1,
          isBase: !!(x.is_base ?? x.isBase),
        }));
        setCurrencies(normCur);
        const base = normCur.find((c: any) => c.isBase) || null;
        setBaseCurrency(base);
        await loadCustomers();
      } catch (e) {
        Alert.alert("تعذر التحميل", String(e));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const baseSymbol = baseCurrency?.symbol || "ر.ي";

  const loadCustomers = async () => {
    const rows: any = await sqlite.getAllAsync(
      "SELECT id, code, name, phone, balance FROM customers ORDER BY name"
    );
    setCustomers(rows || []);
  };

  // الفلترة
  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      const bal = Number(c.balance) || 0;
      if (balanceFilter === "positive") return bal > 0;
      if (balanceFilter === "negative") return bal < 0;
      if (balanceFilter === "zero") return bal === 0;
      return true;
    });
  }, [customers, balanceFilter]);

  // كشف حساب عميل
  const loadStatement = async (customer: Row) => {
    try {
      const fromTs = new Date(from + "T00:00:00").getTime() || 0;
      const toTs = new Date(to + "T23:59:59").getTime() || Date.now();

      const invoices: any = await sqlite.getAllAsync(
        `SELECT 'invoice' as kind, invoice_no as ref, total as amount, currency_code,
                exchange_rate, payment_type, created_at, invoice_type
         FROM invoices
         WHERE party_id = ? AND created_at BETWEEN ? AND ?
         ORDER BY created_at ASC`,
        [customer.id, fromTs, toTs]
      );

      const vouchers: any = await sqlite.getAllAsync(
        `SELECT 'voucher' as kind, voucher_no as ref, amount, currency_code,
                exchange_rate, voucher_type as payment_type, created_at, NULL as invoice_type
         FROM vouchers
         WHERE party_type = 'customer' AND party_id = ? AND created_at BETWEEN ? AND ?
         ORDER BY created_at ASC`,
        [customer.id, fromTs, toTs]
      );

      const all = [...(invoices || []), ...(vouchers || [])].sort(
        (a: any, b: any) => a.created_at - b.created_at
      );

      let running = 0;
      const withBalance = all.map((m: any) => {
        const rate = Number(m.exchange_rate) || 1;
        const amount = Number(m.amount) || 0;
        const baseAmount =
          m.currency_code === baseCurrency?.code ? amount : amount * rate;

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
        return { ...m, debit, credit, desc, balance: running, baseAmount };
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

  const totalBalance = useMemo(() => {
    return filteredCustomers.reduce((s, c) => s + Number(c.balance || 0), 0);
  }, [filteredCustomers]);

  const positiveCount = useMemo(
    () => customers.filter((c) => Number(c.balance) > 0).length,
    [customers]
  );
  const negativeCount = useMemo(
    () => customers.filter((c) => Number(c.balance) < 0).length,
    [customers]
  );

  // PDF
  const buildHtml = () => {
    if (selected) {
      const rows = statement
        .map(
          (m) => `<tr>
            <td>${new Date(m.created_at).toLocaleDateString("ar-EG")}</td>
            <td>${m.desc}</td>
            <td>${m.ref}</td>
            <td>${Number(m.debit || 0).toFixed(2)}</td>
            <td>${Number(m.credit || 0).toFixed(2)}</td>
            <td>${Number(m.balance || 0).toFixed(2)}</td>
          </tr>`
        )
        .join("");

      return `<!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8"/>
      <style>
        body{font-family:Arial,Tahoma;padding:24px;direction:rtl;color:#0F172A}
        .head{text-align:center;border-bottom:2px solid #1E40AF;padding-bottom:12px;margin-bottom:16px}
        .brand{font-size:22px;font-weight:800;color:#1E40AF}
        h1{font-size:18px;margin:12px 0}
        .sum{margin:14px 0;padding:12px;background:#EFF6FF;border-radius:8px}
        .sum div{margin:4px 0;font-weight:700;color:#1E40AF}
        table{width:100%;border-collapse:collapse;margin-top:12px}
        th,td{border:1px solid #D6E3F8;padding:7px;text-align:right;font-size:12px}
        th{background:#0B2545;color:#fff}
      </style></head><body>
        <div class="head"><div class="brand">فلوكس</div>
          <div style="font-size:12px;color:#8494B0">مسلك مجاري</div></div>
        <h1>كشف حساب العميل: ${selected.name}</h1>
        <div style="color:#8494B0;font-size:11px">الفترة: ${from} → ${to} | العملة: ${baseSymbol}</div>
        <div class="sum">
          <div>الرمز: ${selected.code || "—"}</div>
          <div>الهاتف: ${selected.phone || "—"}</div>
          <div>إجمالي المدين: ${totalDebit.toFixed(2)} ${baseSymbol}</div>
          <div>إجمالي الدائن: ${totalCredit.toFixed(2)} ${baseSymbol}</div>
          <div>الرصيد الحالي: ${Number(selected.balance || 0).toFixed(2)} ${baseSymbol}</div>
        </div>
        <table><thead><tr>
          <th>التاريخ</th><th>البيان</th><th>المرجع</th>
          <th>مدين</th><th>دائن</th><th>الرصيد</th>
        </tr></thead><tbody>${rows}</tbody></table>
      </body></html>`;
    }

    const rows = filteredCustomers
      .map(
        (c) => `<tr>
          <td>${c.code || ""}</td>
          <td>${c.name || ""}</td>
          <td>${c.phone || ""}</td>
          <td style="color:${Number(c.balance) > 0 ? "#059669" : Number(c.balance) < 0 ? "#DC2626" : "#8494B0"};font-weight:700">
            ${Number(c.balance || 0).toFixed(2)} ${baseSymbol}
          </td>
        </tr>`
      )
      .join("");

    const filterLabel =
      balanceFilter === "all"
        ? "الكل"
        : balanceFilter === "positive"
        ? "لهم رصيد (مدينون)"
        : balanceFilter === "negative"
        ? "عليهم رصيد (دائنون)"
        : "بدون رصيد";

    return `<!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8"/>
    <style>
      body{font-family:Arial,Tahoma;padding:24px;direction:rtl;color:#0F172A}
      .head{text-align:center;border-bottom:2px solid #1E40AF;padding-bottom:12px;margin-bottom:16px}
      .brand{font-size:22px;font-weight:800;color:#1E40AF}
      h1{font-size:18px;margin:12px 0}
      .sum{margin:14px 0;padding:12px;background:#EFF6FF;border-radius:8px}
      .sum div{margin:4px 0;font-weight:700;color:#1E40AF}
      table{width:100%;border-collapse:collapse;margin-top:12px}
      th,td{border:1px solid #D6E3F8;padding:7px;text-align:right;font-size:12px}
      th{background:#0B2545;color:#fff}
    </style></head><body>
      <div class="head"><div class="brand">فلوكس</div>
        <div style="font-size:12px;color:#8494B0">مسلك مجاري</div></div>
      <h1>تقرير العملاء</h1>
      <div style="color:#8494B0;font-size:11px">الفلتر: ${filterLabel} | العملة: ${baseSymbol}</div>
      <div class="sum">
        <div>عدد العملاء: ${filteredCustomers.length}</div>
        <div>لهم رصيد: ${positiveCount} | عليهم رصيد: ${negativeCount}</div>
        <div>إجمالي الأرصدة: ${totalBalance.toFixed(2)} ${baseSymbol}</div>
      </div>
      <table><thead><tr>
        <th>الرمز</th><th>الاسم</th><th>الهاتف</th><th>الرصيد</th>
      </tr></thead><tbody>${rows}</tbody></table>
    </body></html>`;
  };

  const csvContent = useMemo(() => {
    if (selected) {
      const header = "التاريخ,البيان,المرجع,مدين,دائن,الرصيد\n";
      return (
        header +
        statement
          .map((m) =>
            [
              new Date(m.created_at).toLocaleDateString("ar-EG"),
              m.desc,
              m.ref,
              Number(m.debit || 0).toFixed(2),
              Number(m.credit || 0).toFixed(2),
              Number(m.balance || 0).toFixed(2),
            ].join(",")
          )
          .join("\n")
      );
    }
    const header = "الرمز,الاسم,الهاتف,الرصيد\n";
    return (
      header +
      filteredCustomers
        .map((c) =>
          [
            c.code || "",
            c.name || "",
            c.phone || "",
            Number(c.balance || 0).toFixed(2),
          ].join(",")
        )
        .join("\n")
    );
  }, [selected, statement, filteredCustomers]);

  const filterOptions: { key: BalanceFilter; label: string; count?: number }[] = [
    { key: "all", label: "الكل", count: customers.length },
    { key: "positive", label: "لهم رصيد", count: positiveCount },
    { key: "negative", label: "عليهم رصيد", count: negativeCount },
  ];

  const goBack = () => {
    if (selected) {
      setSelected(null);
      setStatement([]);
    } else {
      onBack();
    }
  };

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 40, paddingHorizontal: 4 }}>
      <View style={styles.backWrap}>
        <Text style={styles.back} onPress={goBack}>
          ← {selected ? "العودة إلى القائمة" : "العودة إلى التقارير"}
        </Text>
      </View>

      <ReportHeader
        title={selected ? `كشف حساب: ${selected.name}` : "تقرير العملاء"}
        subtitle={
          selected ? "الحركات والأرصدة" : "قائمة العملاء وأرصدتهم"
        }
        from={from}
        to={to}
        currencySymbol={baseSymbol}
      />

      <DateRangePicker from={from} to={to} onFromChange={setFrom} onToChange={setTo} />

      {!selected && (
        <>
          <Text style={styles.filterLabel}>الفلتر</Text>
          <View style={styles.filterRow}>
            {filterOptions.map((o) => (
              <Pressable
                key={o.key}
                onPress={() => setBalanceFilter(o.key)}
                style={[styles.chip, balanceFilter === o.key && styles.chipActive]}
              >
                <Text
                  style={[
                    styles.chipText,
                    balanceFilter === o.key && styles.chipTextActive,
                  ]}
                >
                  {o.label} ({o.count})
                </Text>
              </Pressable>
            ))}
          </View>
        </>
      )}

      <ReportActions
        onRefresh={() => (selected ? loadStatement(selected) : loadCustomers())}
        onExportPdf={() =>
          exportPdf(
            buildHtml(),
            selected
              ? `كشف-حساب-${selected.name}-${from}-${to}.pdf`
              : `تقرير-العملاء-${from}-${to}.pdf`
          )
        }
        onExportCsv={() =>
          exportCsv(
            csvContent,
            selected ? `كشف-حساب-${selected.name}.csv` : `تقرير-العملاء.csv`
          )
        }
      />

      {!selected ? (
        <ReportSummary
          items={[
            { label: "عدد العملاء", value: String(filteredCustomers.length) },
            {
              label: "لهم رصيد (مدينون)",
              value: String(positiveCount),
              color: COLORS.success,
            },
            {
              label: "عليهم رصيد (دائنون)",
              value: String(negativeCount),
              color: COLORS.danger,
            },
            {
              label: `إجمالي الأرصدة (${baseSymbol})`,
              value: totalBalance.toFixed(2),
              color: totalBalance > 0 ? COLORS.success : COLORS.danger,
            },
          ]}
        />
      ) : (
        <ReportSummary
          items={[
            { label: "عدد الحركات", value: String(statement.length) },
            {
              label: `إجمالي المدين (${baseSymbol})`,
              value: totalDebit.toFixed(2),
              color: COLORS.danger,
            },
            {
              label: `إجمالي الدائن (${baseSymbol})`,
              value: totalCredit.toFixed(2),
              color: COLORS.success,
            },
            {
              label: `الرصيد (${baseSymbol})`,
              value: Number(selected.balance || 0).toFixed(2),
              color:
                Number(selected.balance || 0) > 0
                  ? COLORS.success
                  : Number(selected.balance || 0) < 0
                  ? COLORS.danger
                  : COLORS.textMuted,
            },
          ]}
        />
      )}

      {!selected ? (
        <>
          <Text style={styles.sectionTitle}>
            قائمة العملاء ({filteredCustomers.length})
          </Text>
          {filteredCustomers.length === 0 ? (
            <Text style={styles.empty}>لا يوجد عملاء بهذا الفلتر</Text>
          ) : (
            filteredCustomers.map((c) => {
              const bal = Number(c.balance || 0);
              const balColor =
                bal > 0 ? COLORS.success : bal < 0 ? COLORS.danger : COLORS.textMuted;
              return (
                <Pressable
                  key={c.id}
                  style={styles.row}
                  onPress={() => loadStatement(c)}
                >
                  <View style={styles.rowRight}>
                    <Text style={[styles.amount, { color: balColor }]}>
                      {bal.toFixed(2)} {baseSymbol}
                    </Text>
                    <Text style={styles.openHint}>اضغط للتفاصيل ←</Text>
                  </View>
                  <View style={styles.rowInfo}>
                    <Text style={styles.rowName}>{c.name}</Text>
                    <Text style={styles.rowMeta}>
                      {c.code} · {c.phone || "—"}
                    </Text>
                  </View>
                </Pressable>
              );
            })
          )}
        </>
      ) : (
        <>
          <Text style={styles.sectionTitle}>
            حركات الحساب ({statement.length})
          </Text>
          {statement.length === 0 ? (
            <Text style={styles.empty}>لا توجد حركات في هذه الفترة</Text>
          ) : (
            statement.map((m: any, i: number) => (
              <View key={i} style={styles.row}>
                <View style={styles.rowRight}>
                  <Text style={styles.valueSmall}>
                    {Number(m.balance || 0).toFixed(2)}
                  </Text>
                </View>
                <View style={styles.rowInfo}>
                  <Text style={styles.rowName}>
                    {m.desc} · {m.ref}
                  </Text>
                  <Text style={styles.rowMeta}>
                    {new Date(m.created_at).toLocaleDateString("ar-EG")}
                  </Text>
                  <Text
                    style={{
                      fontSize: 11,
                      marginTop: 3,
                      textAlign: "right",
                      color: m.debit > 0 ? COLORS.danger : COLORS.success,
                    }}
                  >
                    {m.debit > 0
                      ? `مدين: ${m.debit.toFixed(2)}`
                      : `دائن: ${m.credit.toFixed(2)}`}
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
  back: { color: COLORS.blue, fontWeight: "700", textAlign: "right" },
  filterLabel: {
    fontSize: 12,
    color: COLORS.textMuted,
    textAlign: "right",
    marginTop: 10,
    marginBottom: 6,
    fontWeight: "700",
  },
  filterRow: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 6 },
  chip: {
    borderWidth: 1.2,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: COLORS.surface,
  },
  chipActive: { backgroundColor: COLORS.blue, borderColor: COLORS.blue },
  chipText: { fontSize: 12, color: COLORS.text, fontWeight: "700" },
  chipTextActive: { color: "#FFF", fontWeight: "800" },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: COLORS.blue,
    textAlign: "right",
    marginTop: 16,
    marginBottom: 8,
  },
  empty: {
    textAlign: "right",
    color: COLORS.textMuted,
    fontSize: 12,
    padding: 10,
  },
  row: {
    backgroundColor: COLORS.surface,
    borderWidth: 1.2,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  rowInfo: { flex: 1, alignItems: "flex-end" },
  rowRight: { alignItems: "flex-start" },
  rowName: {
    fontWeight: "700",
    color: COLORS.text,
    textAlign: "right",
    fontSize: 14,
  },
  rowMeta: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
    textAlign: "right",
  },
  amount: { fontWeight: "800", fontSize: 15 },
  openHint: { fontSize: 10, color: COLORS.blue, marginTop: 3, fontWeight: "600" },
  valueSmall: { fontWeight: "700", fontSize: 13, color: COLORS.blue },
});
