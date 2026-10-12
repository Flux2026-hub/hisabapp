import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { sqlite } from "../../db/local";
import ReportHeader from "./components/ReportHeader";
import ReportSummary from "./components/ReportSummary";
import DateRangePicker from "./components/DateRangePicker";
import ReportActions, { exportCsv, exportPdf } from "./components/ReportActions";
import { COLORS } from "../theme";

type Row = any;
type BalanceFilter = "all" | "positive" | "negative";
type CurrencyFilter = "all" | string;
type ViewCurrency = "original" | string;

export default function CustomersReport({ onBack }: { onBack: () => void }) {
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(today.slice(0, 8) + "01");
  const [to, setTo] = useState(today);
  const [customers, setCustomers] = useState<Row[]>([]);
  const [selected, setSelected] = useState<Row | null>(null);
  const [statement, setStatement] = useState<Row[]>([]);
  const [currencies, setCurrencies] = useState<Row[]>([]);
  const [baseCurrency, setBaseCurrency] = useState<Row | null>(null);
  const [balanceFilter, setBalanceFilter] = useState<BalanceFilter>("all");
  const [currencyFilter, setCurrencyFilter] = useState<CurrencyFilter>("all");
  const [viewCurrency, setViewCurrency] = useState<ViewCurrency>("original");

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

  // تحويل مبلغ من عملته إلى العملة الأساسية
  const toBase = (amount: number, currencyCode: string, exchangeRate: number) => {
    if (!baseCurrency) return amount;
    if (currencyCode === baseCurrency.code) return amount;
    return amount * (Number(exchangeRate) || 1);
  };

  // تحويل مبلغ من العملة الأساسية إلى عملة العرض المختارة
  const fromBase = (baseAmount: number, targetCode: string) => {
    if (targetCode === baseCurrency?.code) return baseAmount;
    const target = currencies.find((c: any) => c.code === targetCode);
    if (!target) return baseAmount;
    return baseAmount / (Number(target.exchangeRate) || 1);
  };

  // الحصول على رمز عملة العرض
  const viewSymbol = useMemo(() => {
    if (viewCurrency === "original") return "";
    const c = currencies.find((x: any) => x.code === viewCurrency);
    return c?.symbol || viewCurrency;
  }, [viewCurrency, currencies]);

  // الفلترة حسب رصيد العميل
  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      const bal = Number(c.balance) || 0;
      if (balanceFilter === "positive") return bal > 0;
      if (balanceFilter === "negative") return bal < 0;
      return true;
    });
  }, [customers, balanceFilter]);

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
        return {
          ...m,
          debit,
          credit,
          desc,
          balance: running,
          originalAmount: amount,
          originalCurrency: m.currency_code,
        };
      });

      setStatement(withBalance);
      setSelected(customer);
    } catch (e) {
      Alert.alert("تعذر تحميل كشف الحساب", String(e));
    }
  };

  // فلترة السطور حسب العملة
  const visibleStatement = useMemo(() => {
    if (currencyFilter === "all") return statement;
    return statement.filter((m: any) => m.originalCurrency === currencyFilter);
  }, [statement, currencyFilter]);

  // تنسيق المبلغ حسب viewCurrency
  const formatAmount = (baseAmount: number, originalAmount: number, originalCurrency: string) => {
    const symbolOf = (code: string) => {
      const c = currencies.find((x: any) => x.code === code);
      return c?.symbol || code;
    };

    if (viewCurrency === "original") {
      return `${originalAmount.toFixed(2)} ${symbolOf(originalCurrency)}`;
    }
    const converted = fromBase(baseAmount, viewCurrency);
    return `${converted.toFixed(2)} ${viewSymbol}`;
  };

  // عرض المبلغ الأصلي (للتفاصيل)
  const formatOriginal = (originalAmount: number, originalCurrency: string) => {
    const c = currencies.find((x: any) => x.code === originalCurrency);
    return `${originalAmount.toFixed(2)} ${c?.symbol || originalCurrency}`;
  };

  const totalDebit = useMemo(
    () => visibleStatement.reduce((s, r) => s + (r.debit || 0), 0),
    [visibleStatement]
  );
  const totalCredit = useMemo(
    () => visibleStatement.reduce((s, r) => s + (r.credit || 0), 0),
    [visibleStatement]
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

  const goBack = () => {
    if (selected) {
      setSelected(null);
      setStatement([]);
      setCurrencyFilter("all");
      setViewCurrency("original");
    } else {
      onBack();
    }
  };

  // خيارات العملات للفلترة والتبديل
  const currencyTabs = useMemo(() => {
    const arr: Array<{ key: string; label: string }> = [
      { key: "all", label: "الكل" },
    ];
    for (const c of currencies) {
      arr.push({ key: c.code, label: c.symbol || c.code });
    }
    return arr;
  }, [currencies]);

  const viewTabs = useMemo(() => {
    const arr: Array<{ key: string; label: string }> = [
      { key: "original", label: "كما هي" },
    ];
    for (const c of currencies) {
      arr.push({ key: c.code, label: `بـ ${c.symbol || c.code}` });
    }
    return arr;
  }, [currencies]);

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

      {selected && (
        <>
          <Text style={styles.filterLabel}>فلترة العملة</Text>
          <View style={styles.filterRow}>
            {currencyTabs.map((o) => (
              <Pressable
                key={o.key}
                onPress={() => setCurrencyFilter(o.key)}
                style={[styles.chip, currencyFilter === o.key && styles.chipActive]}
              >
                <Text
                  style={[
                    styles.chipText,
                    currencyFilter === o.key && styles.chipTextActive,
                  ]}
                >
                  {o.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.filterLabel}>عرض المبالغ</Text>
          <View style={styles.filterRow}>
            {viewTabs.map((o) => (
              <Pressable
                key={o.key}
                onPress={() => setViewCurrency(o.key)}
                style={[styles.chipView, viewCurrency === o.key && styles.chipViewActive]}
              >
                <Text
                  style={[
                    styles.chipText,
                    viewCurrency === o.key && styles.chipTextActive,
                  ]}
                >
                  {o.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </>
      )}

      {!selected && (
        <>
          <Text style={styles.filterLabel}>الفلتر</Text>
          <View style={styles.filterRow}>
            {[
              { key: "all", label: `الكل (${customers.length})` },
              { key: "positive", label: `لهم رصيد (${positiveCount})` },
              { key: "negative", label: `عليهم رصيد (${negativeCount})` },
            ].map((o) => (
              <Pressable
                key={o.key}
                onPress={() => setBalanceFilter(o.key as BalanceFilter)}
                style={[styles.chip, balanceFilter === o.key && styles.chipActive]}
              >
                <Text
                  style={[
                    styles.chipText,
                    balanceFilter === o.key && styles.chipTextActive,
                  ]}
                >
                  {o.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </>
      )}

      <ReportActions
        onRefresh={() => (selected ? loadStatement(selected) : loadCustomers())}
        onExportPdf={() => {
          Alert.alert("قريباً", "تصدير PDF مع فلترة العملة سيُضاف لاحقاً");
        }}
        onExportCsv={() => {
          const rows = visibleStatement.map((m: any) => ({
            date: new Date(m.created_at).toLocaleDateString("ar-EG"),
            desc: m.desc,
            ref: m.ref,
            amount: formatAmount(m.debit || m.credit, m.originalAmount, m.originalCurrency),
          }));
          const header = "التاريخ,البيان,المرجع,المبلغ\n";
          const body = rows.map((r) => `${r.date},${r.desc},${r.ref},${r.amount}`).join("\n");
          exportCsv(header + body, `كشف-${selected?.name || "العملاء"}.csv`);
        }}
      />

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
          <ReportSummary
            items={[
              { label: "عدد الحركات", value: String(visibleStatement.length) },
              {
                label: `إجمالي المدين (${viewCurrency === "original" ? baseSymbol : viewSymbol})`,
                value:
                  viewCurrency === "original"
                    ? totalDebit.toFixed(2)
                    : fromBase(totalDebit, viewCurrency).toFixed(2),
                color: COLORS.danger,
              },
              {
                label: `إجمالي الدائن (${viewCurrency === "original" ? baseSymbol : viewSymbol})`,
                value:
                  viewCurrency === "original"
                    ? totalCredit.toFixed(2)
                    : fromBase(totalCredit, viewCurrency).toFixed(2),
                color: COLORS.success,
              },
              {
                label: `الرصيد (${viewCurrency === "original" ? baseSymbol : viewSymbol})`,
                value:
                  viewCurrency === "original"
                    ? Number(selected.balance || 0).toFixed(2)
                    : fromBase(Number(selected.balance || 0), viewCurrency).toFixed(2),
                color:
                  Number(selected.balance || 0) > 0
                    ? COLORS.success
                    : Number(selected.balance || 0) < 0
                    ? COLORS.danger
                    : COLORS.textMuted,
              },
            ]}
          />

          <Text style={styles.sectionTitle}>
            حركات الحساب ({visibleStatement.length})
          </Text>
          {visibleStatement.length === 0 ? (
            <Text style={styles.empty}>لا توجد حركات</Text>
          ) : (
            visibleStatement.map((m: any, i: number) => {
              const baseAmount = m.debit > 0 ? m.debit : m.credit;
              const displayAmount =
                viewCurrency === "original"
                  ? formatOriginal(m.originalAmount, m.originalCurrency)
                  : `${fromBase(baseAmount, viewCurrency).toFixed(2)} ${viewSymbol}`;

              const showConversion =
                viewCurrency === "original" &&
                m.originalCurrency !== baseCurrency?.code;

              return (
                <View key={i} style={styles.row}>
                  <View style={styles.rowRight}>
                    <Text
                      style={[
                        styles.amountSmall,
                        { color: m.debit > 0 ? COLORS.danger : COLORS.success },
                      ]}
                    >
                      {m.debit > 0 ? "−" : "+"}
                      {displayAmount}
                    </Text>
                    {showConversion && (
                      <Text style={styles.conversionHint}>
                        ≈ {baseAmount.toFixed(2)} {baseSymbol}
                      </Text>
                    )}
                  </View>
                  <View style={styles.rowInfo}>
                    <Text style={styles.rowName}>{m.desc}</Text>
                    <Text style={styles.rowMeta}>
                      {m.ref} · {new Date(m.created_at).toLocaleDateString("ar-EG")}
                    </Text>
                  </View>
                </View>
              );
            })
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
  chipView: {
    borderWidth: 1.2,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: COLORS.surface,
  },
  chipViewActive: { backgroundColor: COLORS.orange, borderColor: COLORS.orange },
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
  amountSmall: { fontWeight: "800", fontSize: 14 },
  conversionHint: {
    fontSize: 10,
    color: COLORS.textMuted,
    marginTop: 3,
    fontWeight: "600",
  },
});
