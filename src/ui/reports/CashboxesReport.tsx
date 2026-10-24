import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { sqlite } from "../../db/local";
import ReportHeader from "./components/ReportHeader";
import ReportSummary from "./components/ReportSummary";
import DateRangePicker from "./components/DateRangePicker";
import ReportActions, { exportCsv } from "./components/ReportActions";
import { COLORS } from "../theme";
import { printHtml } from "../../utils/printDocument";

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

  const formatOriginal = (originalAmount: any, originalCurrency: string) => {
    const amt = Number(originalAmount) || 0;
    const c = currencies.find((x: any) => x.code === originalCurrency);
    return `${amt.toFixed(2)} ${c?.symbol || originalCurrency || ""}`;
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

  const buildPdfHtml = () => {
    const rowsData = visibleMovements.map((m: any) => {
      const baseAmount = m.debit > 0 ? m.debit : m.credit;
      const displayAmount = viewCurrency === "original"
        ? formatOriginal(m.originalAmount, m.originalCurrency)
        : (Number(fromBase(baseAmount, viewCurrency)) || 0).toFixed(2) + " " + viewSymbol;
      const type = m.debit > 0 ? "وارد" : "صادر";
      const color = m.debit > 0 ? "#059669" : "#DC2626";
      return "<tr><td>" + new Date(m.created_at).toLocaleDateString("ar-EG") + "</td><td>" + m.desc + "</td><td>" + m.ref + "</td><td style='color:" + color + ";font-weight:700;'>" + type + "</td><td style='font-weight:700;color:" + color + ";'>" + displayAmount + "</td></tr>";
    }).join("");

    const totalDebitDisplay = viewCurrency === "original" ? (Number(totalDebit) || 0).toFixed(2) + " " + baseSymbol : (Number(fromBase(Number(totalDebit) || 0, viewCurrency)) || 0).toFixed(2) + " " + viewSymbol;
    const totalCreditDisplay = viewCurrency === "original" ? (Number(totalCredit) || 0).toFixed(2) + " " + baseSymbol : (Number(fromBase(Number(totalCredit) || 0, viewCurrency)) || 0).toFixed(2) + " " + viewSymbol;
    const balanceDisplay = viewCurrency === "original" ? (Number(selected?.balance) || 0).toFixed(2) + " " + baseSymbol : (Number(fromBase(Number(selected?.balance) || 0, viewCurrency)) || 0).toFixed(2) + " " + viewSymbol;
    const viewLabel = viewCurrency === "original" ? "كما هي" : viewSymbol;

    return "<!DOCTYPE html><html lang='ar' dir='rtl'><head><meta charset='utf-8'/><title>حركة صندوق</title><style>@page{size:A4;margin:12mm;}body{font-family:Arial,Tahoma;direction:rtl;color:#0F172A;font-size:13px;margin:0;padding:0;}.header{text-align:center;padding-bottom:14px;border-bottom:3px solid #F97316;margin-bottom:16px;}.brand{font-size:22px;font-weight:800;color:#1E40AF;}.brand-sub{font-size:11px;color:#8494B0;font-weight:700;margin-top:3px;}.info-grid{display:flex;gap:12px;margin-bottom:14px;}.info-cell{flex:1;background:#EFF6FF;border:1.5px solid #D6E3F8;border-radius:8px;padding:10px;}.info-label{font-size:11px;color:#8494B0;margin-bottom:3px;font-weight:700;}.info-value{font-size:14px;font-weight:800;color:#0F172A;}.summary{background:#EFF6FF;border-radius:8px;padding:12px;margin-bottom:14px;}.summary-row{display:flex;justify-content:space-between;padding:5px 0;font-size:13px;font-weight:700;}table{width:100%;border-collapse:collapse;}th{background:#0B2545;color:#FFF;padding:10px 8px;font-size:12px;text-align:right;}td{padding:9px 8px;border-bottom:1px solid #E2E8F0;font-size:12px;text-align:right;}tr:nth-child(even) td{background:#F8FAFC;}.footer{margin-top:24px;padding-top:10px;border-top:1px solid #D6E3F8;font-size:10px;color:#8494B0;text-align:center;font-weight:600;}.empty{padding:30px;text-align:center;color:#8494B0;}</style></head><body><div class='header'><div class='brand'>فلوكس</div><div class='brand-sub'>مسلك مجاري</div></div><div class='info-grid'><div class='info-cell'><div class='info-label'>الصندوق</div><div class='info-value'>" + (selected?.name || "") + "</div>" + (selected?.code ? "<div style='font-size:11px;color:#64748B;margin-top:3px;'>رمز: " + selected.code + "</div>" : "") + "</div><div class='info-cell'><div class='info-label'>الفترة</div><div class='info-value'>" + from + " → " + to + "</div><div style='font-size:11px;color:#64748B;margin-top:3px;'>عرض المبالغ: " + viewLabel + "</div></div></div><div class='summary'><div class='summary-row'><span>إجمالي الوارد</span><span style='color:#059669;'>" + totalDebitDisplay + "</span></div><div class='summary-row'><span>إجمالي الصادر</span><span style='color:#DC2626;'>" + totalCreditDisplay + "</span></div><div class='summary-row' style='border-top:1.5px solid #D6E3F8;padding-top:8px;margin-top:5px;font-size:15px;'><span>الرصيد</span><span style='color:#1E40AF;'>" + balanceDisplay + "</span></div></div><table><thead><tr><th style='width:90px;'>التاريخ</th><th>البيان</th><th style='width:80px;'>المرجع</th><th style='width:60px;'>النوع</th><th style='width:130px;'>المبلغ</th></tr></thead><tbody>" + (rowsData || "<tr><td colspan='5' class='empty'>لا توجد حركات</td></tr>") + "</tbody></table><div class='footer'>نظام فلوكس المحاسبي - " + new Date().toLocaleString("ar-EG") + "</div></body></html>";
  };

  return (
    <ScrollView contentContainerStyle={{ backgroundColor: "#ffffff", marginHorizontal: 16, marginTop: 16, marginBottom: 16, borderRadius: 16, padding: 20, paddingBottom: 40 }}>
      <View style={styles.backWrap}>
        <Text style={styles.back} onPress={goBack}>
          -> {selected ? "العودة إلى القائمة" : "العودة إلى التقارير"}
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
        onExportPdf={async () => {
          try {
            const html = buildPdfHtml();
            await printHtml(html);
          } catch (error: any) {
            Alert.alert("خطأ في الطباعة", String(error.message || error));
            console.error(error);
          }
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
                <View style={styles.rowInfo}>
                  <Text style={styles.rowName}>{c.name}</Text>
                  <Text style={styles.rowMeta}>
                    {c.code} · {c.cashbox_type}
                  </Text>
                </View>
            <View style={styles.rowRight}>
                  <Text style={[styles.amount, { color: COLORS.blue }]}>
                    {Number(c.balance || 0).toFixed(2)} {baseSymbol}
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
                  <View style={styles.rowInfo}>
                    <Text style={styles.rowName}>{m.desc}</Text>
                    <Text style={styles.rowMeta}>
                      {m.ref} · {new Date(m.created_at).toLocaleDateString("ar-EG")}
                    </Text>
                  </View>
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
  balance: { fontWeight: "800", fontSize: 16, textAlign: "left" },
  value: { fontWeight: "800", fontSize: 16, textAlign: "left" },
  rowValues: { alignItems: "flex-start", minWidth: 100 },
  backWrap: { paddingVertical: 8 },
  back: { alignSelf: "flex-end",  color: COLORS.blue, fontWeight: "700", textAlign: "right" },
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
  sectionTitle: {fontSize: 15,
    
    color: COLORS.blue,
    
    marginTop: 16,
    marginBottom: 8,
   textAlign: "right", writingDirection: "rtl", width: "100%", fontFamily: "CodecBold"},
  empty: {
    textAlign: "right",
    color: COLORS.textMuted,
    fontSize: 12,
    padding: 10,
  },
  row: { backgroundColor: "#ffffff", borderWidth: 1, borderColor: "#D6E3F8", borderRadius: 12, padding: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  rowInfo: { flex: 1, alignItems: "flex-end", paddingRight: 10 },
  rowRight: { alignItems: "flex-start", minWidth: 100 },
  rowName: { fontWeight: "700", fontSize: 14, color: "#0F172A", textAlign: "right" },
  rowMeta: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
    textAlign: "right",
  },
  amount: { fontWeight: "800", fontSize: 16, textAlign: "left" },
  amountSmall: { fontWeight: "800", fontSize: 14 },
  conversionHint: {
    fontSize: 10,
    color: COLORS.textMuted,
    marginTop: 3,
    fontWeight: "600",
  },
});
