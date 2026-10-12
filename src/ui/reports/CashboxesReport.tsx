import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { sqlite } from "../../db/local";
import ReportHeader from "./components/ReportHeader";
import ReportSummary from "./components/ReportSummary";
import DateRangePicker from "./components/DateRangePicker";
import ReportActions, { exportCsv } from "./components/ReportActions";
import { COLORS } from "../theme";

type Row = any;
type CurrencyFilter = "all" | string;
type ViewCurrency = "original" | string;

export default function CashboxesReport({ onBack }: { onBack: () => void }) {
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(today.slice(0, 8) + "01");
  const [to, setTo] = useState(today);
  const [cashboxes, setCashboxes] = useState<Row[]>([]);
  const [selected, setSelected] = useState<Row | null>(null);
  const [movements, setMovements] = useState<Row[]>([]);
  const [currencies, setCurrencies] = useState<Row[]>([]);
  const [baseCurrency, setBaseCurrency] = useState<Row | null>(null);
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
        await loadCashboxes();
      } catch (e) {
        Alert.alert("تعذر التحميل", String(e));
      }
    })();
  }, []);

  const baseSymbol = baseCurrency?.symbol || "ر.ي";

  const loadCashboxes = async () => {
    const rows: any = await sqlite.getAllAsync(
      "SELECT id, code, name, cashbox_type, balance FROM cashboxes ORDER BY name"
    );
    setCashboxes(rows || []);
  };

  const toBase = (amount: number, currencyCode: string, exchangeRate: number) => {
    if (!baseCurrency) return amount;
    if (currencyCode === baseCurrency.code) return amount;
    return amount * (Number(exchangeRate) || 1);
  };

  const fromBase = (baseAmount: number, targetCode: string) => {
    if (targetCode === baseCurrency?.code) return baseAmount;
    const target = currencies.find((c: any) => c.code === targetCode);
    if (!target) return baseAmount;
    return baseAmount / (Number(target.exchangeRate) || 1);
  };

  const viewSymbol = useMemo(() => {
    if (viewCurrency === "original") return "";
    const c = currencies.find((x: any) => x.code === viewCurrency);
    return c?.symbol || viewCurrency;
  }, [viewCurrency, currencies]);

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
        const curCode = m.currency_code || baseCurrency?.code || "YER";
        const rate = Number(m.exchange_rate) || 1;
        const baseAmount = toBase(amount, curCode, rate);

        let debit = 0;
        let credit = 0;
        let desc = "";

        if (m.kind === "voucher") {
          if (m.voucher_type === "receipt") {
            debit = baseAmount;
            desc = "سند قبض";
          } else {
            credit = baseAmount;
            desc = "سند دفع";
          }
        } else if (m.kind === "invoice") {
          if (m.invoice_type === "sales") {
            debit = baseAmount;
            desc = "فاتورة مبيعات نقدية";
          } else {
            credit = baseAmount;
            desc = "فاتورة مشتريات نقدية";
          }
        } else if (m.kind === "transfer_out") {
          credit = baseAmount;
          desc = "تحويل إلى " + m.party_name;
        } else if (m.kind === "transfer_in") {
          debit = baseAmount;
          desc = "تحويل من " + m.party_name;
        }

        running += debit - credit;
        return {
          ...m,
          debit,
          credit,
          desc,
          balance: running,
          originalAmount: amount,
          originalCurrency: curCode,
        };
      });

      setMovements(withBalance);
      setSelected(cashbox);
    } catch (e) {
      Alert.alert("تعذر التحميل", String(e));
    }
  };

  const visibleMovements = useMemo(() => {
    if (currencyFilter === "all") return movements;
    return movements.filter((m: any) => m.originalCurrency === currencyFilter);
  }, [movements, currencyFilter]);

  const toBase = (amount: number, currencyCode: string, exchangeRate: number) => {
    if (!baseCurrency) return amount;
    if (currencyCode === baseCurrency.code) return amount;
    return amount * (Number(exchangeRate) || 1);
  };

  const fromBase = (baseAmount: number, targetCode: string) => {
    if (targetCode === baseCurrency?.code) return baseAmount;
    const target = currencies.find((c: any) => c.code === targetCode);
    if (!target) return baseAmount;
    return baseAmount / (Number(target.exchangeRate) || 1);
  };

  const viewSymbol = useMemo(() => {
    if (viewCurrency === "original") return "";
    const c = currencies.find((x: any) => x.code === viewCurrency);
    return c?.symbol || viewCurrency;
  }, [viewCurrency, currencies]);

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
        const curCode = m.currency_code || baseCurrency?.code || "YER";
        const rate = Number(m.exchange_rate) || 1;
        const baseAmount = toBase(amount, curCode, rate);

        let debit = 0;
        let credit = 0;
        let desc = "";

        if (m.kind === "voucher") {
          if (m.voucher_type === "receipt") {
            debit = baseAmount;
            desc = "سند قبض";
          } else {
            credit = baseAmount;
            desc = "سند دفع";
          }
        } else if (m.kind === "invoice") {
          if (m.invoice_type === "sales") {
            debit = baseAmount;
            desc = "فاتورة مبيعات نقدية";
          } else {
            credit = baseAmount;
            desc = "فاتورة مشتريات نقدية";
          }
        } else if (m.kind === "transfer_out") {
          credit = baseAmount;
          desc = "تحويل إلى " + m.party_name;
        } else if (m.kind === "transfer_in") {
          debit = baseAmount;
          desc = "تحويل من " + m.party_name;
        }

        running += debit - credit;
        return {
          ...m,
          debit,
          credit,
          desc,
          balance: running,
          originalAmount: amount,
          originalCurrency: curCode,
        };
      });

      setMovements(withBalance);
      setSelected(cashbox);
    } catch (e) {
      Alert.alert("تعذر التحميل", String(e));
    }
  };

  const visibleMovements = useMemo(() => {
    if (currencyFilter === "all") return movements;
    return movements.filter((m: any) => m.originalCurrency === currencyFilter);
  }, [movements, currencyFilter]);

  const formatOriginal = (originalAmount: number, originalCurrency: string) => {
    const c = currencies.find((x: any) => x.code === originalCurrency);
    return `${originalAmount.toFixed(2)} ${c?.symbol || originalCurrency}`;
  };

  const totalDebit = useMemo(
    () => visibleMovements.reduce((s, r) => s + (r.debit || 0), 0),
    [visibleMovements]
  );
  const totalCredit = useMemo(
    () => visibleMovements.reduce((s, r) => s + (r.credit || 0), 0),
    [visibleMovements]
  );

  const totalBalance = useMemo(
    () => cashboxes.reduce((s, c) => s + Number(c.balance || 0), 0),
    [cashboxes]
  );

  const goBack = () => {
    if (selected) {
      setSelected(null);
      setMovements([]);
      setCurrencyFilter("all");
      setViewCurrency("original");
    } else {
      onBack();
    }
  };

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
        title={selected ? `حركة: ${selected.name}` : "تقرير الصناديق"}
        subtitle={selected ? "الحركات والأرصدة" : "أرصدة الصناديق"}
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

      <ReportActions
        onRefresh={() => (selected ? loadMovements(selected) : loadCashboxes())}
        onExportPdf={() => {
          Alert.alert("قريباً", "تصدير PDF مع فلترة العملة سيُضاف لاحقاً");
        }}
        onExportCsv={() => {
          const header = "التاريخ,البيان,المرجع,وارد,صادر,الرصيد\n";
          const body = visibleMovements
            .map((m: any) => {
              const debit = Number(m.debit || 0);
              const credit = Number(m.credit || 0);
              const bal = Number(m.balance || 0);
              return [
                new Date(m.created_at).toLocaleDateString("ar-EG"),
                m.desc,
                m.ref,
                debit.toFixed(2),
                credit.toFixed(2),
                bal.toFixed(2),
              ].join(",");
            })
            .join("\n");
          exportCsv(header + body, `حركة-${selected?.name || "الصناديق"}.csv`);
        }}
      />

      {!selected ? (
        <>
          <ReportSummary
            items={[
              { label: "عدد الصناديق", value: String(cashboxes.length) },
              {
                label: `إجمالي الأرصدة (${baseSymbol})`,
                value: totalBalance.toFixed(2),
              },
            ]}
          />
          <Text style={styles.sectionTitle}>قائمة الصناديق</Text>
          {cashboxes.length === 0 ? (
            <Text style={styles.empty}>لا توجد صناديق</Text>
          ) : (
            cashboxes.map((c) => (
              <Pressable
                key={c.id}
                style={styles.row}
                onPress={() => loadMovements(c)}
              >
                <View style={styles.rowRight}>
                  <Text style={[styles.amount, { color: COLORS.blue }]}>
                    {Number(c.balance || 0).toFixed(2)} {baseSymbol}
                  </Text>
                </View>
                <View style={styles.rowInfo}>
                  <Text style={styles.rowName}>{c.name}</Text>
                  <Text style={styles.rowMeta}>
                    {c.code} · {c.cashbox_type}
                  </Text>
                </View>
              </Pressable>
            ))
          )}
        </>
      ) : (
        <>
          <ReportSummary
            items={[
              { label: "عدد الحركات", value: String(visibleMovements.length) },
              {
                label: `إجمالي الوارد (${viewCurrency === "original" ? baseSymbol : viewSymbol})`,
                value:
                  viewCurrency === "original"
                    ? totalDebit.toFixed(2)
                    : fromBase(totalDebit, viewCurrency).toFixed(2),
                color: COLORS.success,
              },
              {
                label: `إجمالي الصادر (${viewCurrency === "original" ? baseSymbol : viewSymbol})`,
                value:
                  viewCurrency === "original"
                    ? totalCredit.toFixed(2)
                    : fromBase(totalCredit, viewCurrency).toFixed(2),
                color: COLORS.danger,
              },
              {
                label: `الرصيد (${viewCurrency === "original" ? baseSymbol : viewSymbol})`,
                value:
                  viewCurrency === "original"
                    ? Number(selected.balance || 0).toFixed(2)
                    : fromBase(Number(selected.balance || 0), viewCurrency).toFixed(2),
                color: COLORS.blue,
              },
            ]}
          />

          <Text style={styles.sectionTitle}>
            حركات الصندوق ({visibleMovements.length})
          </Text>
          {visibleMovements.length === 0 ? (
            <Text style={styles.empty}>لا توجد حركات</Text>
          ) : (
            visibleMovements.map((m: any, i: number) => {
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
                        { color: m.debit > 0 ? COLORS.success : COLORS.danger },
                      ]}
                    >
                      {m.debit > 0 ? "+" : "−"}
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
