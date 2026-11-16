import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { sqlite } from "../../db/local";
import ReportHeader from "./components/ReportHeader";
import ReportSummary from "./components/ReportSummary";
import DateRangePicker from "./components/DateRangePicker";
import ReportActions, { exportCsv } from "./components/ReportActions";
import { printHtml } from "../../utils/printDocument";
import { getLogoBase64 } from "../../utils/logoBase64";
import { useTheme } from "../ThemeContext";

type Row = any;

export default function CashboxesReport({ onBack }: { onBack: () => void }) {
  const { colors } = useTheme();
  const today = new Date().toISOString().slice(0, 10);
  // ✅ الفترة الافتراضية من بداية العام
  const [from, setFrom] = useState(new Date().getFullYear() + "-01-01");
  const [to, setTo] = useState(today);
  
  const [cashboxes, setCashboxes] = useState<Row[]>([]);
  const [selected, setSelected] = useState<Row | null>(null);
  const [movements, setMovements] = useState<Row[]>([]);
  const [currencies, setCurrencies] = useState<Row[]>([]);
  const [baseCurrency, setBaseCurrency] = useState<Row | null>(null);
  const [openingBalance, setOpeningBalance] = useState(0); // ✅ حالة الرصيد الافتتاحي

  useEffect(() => {
    (async () => {
      try {
        const curs: any = await sqlite.getAllAsync("SELECT id, code, name, symbol, exchange_rate, is_base FROM currencies ORDER BY is_base DESC, code");
        const normCur = (curs || []).map((x: any) => ({ id: x.id, code: x.code, name: x.name, symbol: x.symbol, exchangeRate: Number(x.exchange_rate ?? x.exchangeRate ?? 1) || 1, isBase: !!(x.is_base ?? x.isBase) }));
        setCurrencies(normCur);
        const base = normCur.find((c: any) => c.isBase) || null;
        setBaseCurrency(base);
        await loadCashboxes();
      } catch (e) { Alert.alert("تعذر التحميل", String(e)); }
    })();
  }, []);

  const baseSymbol = baseCurrency?.symbol || "ر.ي";

  const loadCashboxes = async () => {
    const rows: any = await sqlite.getAllAsync("SELECT id, code, name, parent_id, cashbox_type, balance FROM cashboxes ORDER BY code ASC");
    setCashboxes(rows || []);
  };

  // ✅ دالة جلب الحركات وحساب الرصيد الافتتاحي
  const loadMovements = async (cashbox: Row) => {
    try {
      const fromTs = new Date(from + "T00:00:00").getTime() || 0;
      const toTs = new Date(to + "T23:59:59").getTime() || Date.now();

      // 1. حساب الرصيد الافتتاحي (كل ما قبل تاريخ البداية)
      const prevVouchers: any = await sqlite.getAllAsync("SELECT SUM(CASE WHEN voucher_type = 'receipt' THEN amount ELSE -amount END) as total FROM vouchers WHERE cashbox_id = ? AND created_at < ?", [cashbox.id, fromTs]);
      const prevInvoices: any = await sqlite.getAllAsync("SELECT SUM(CASE WHEN invoice_type = 'sales' THEN total ELSE -total END) as total FROM invoices WHERE cashbox_id = ? AND payment_type = 'cash' AND created_at < ?", [cashbox.id, fromTs]);
      const prevTransIn: any = await sqlite.getFirstAsync("SELECT SUM(amount) as total FROM account_transfers WHERE to_account = ? AND created_at < ?", [cashbox.name, fromTs]);
      const prevTransOut: any = await sqlite.getFirstAsync("SELECT SUM(amount) as total FROM account_transfers WHERE from_account = ? AND created_at < ?", [cashbox.name, fromTs]);

      const initialOpening = (Number(prevVouchers?.total) || 0) + (Number(prevInvoices?.total) || 0) + (Number(prevTransIn?.total) || 0) - (Number(prevTransOut?.total) || 0);
      setOpeningBalance(initialOpening);

      // 2. جلب حركات الفترة الحالية
      const vouchers: any = await sqlite.getAllAsync("SELECT 'voucher' as kind, voucher_no as ref, amount, voucher_type, party_name, description, created_at, exchange_rate, currency_code FROM vouchers WHERE cashbox_id = ? AND created_at BETWEEN ? AND ? ORDER BY created_at ASC", [cashbox.id, fromTs, toTs]);
      const invoices: any = await sqlite.getAllAsync("SELECT 'invoice' as kind, invoice_no as ref, total as amount, invoice_type, party_name, NULL as description, created_at, exchange_rate, currency_code, payment_type FROM invoices WHERE cashbox_id = ? AND payment_type = 'cash' AND created_at BETWEEN ? AND ? ORDER BY created_at ASC", [cashbox.id, fromTs, toTs]);
      const transfersOut: any = await sqlite.getAllAsync("SELECT 'transfer_out' as kind, transfer_no as ref, amount, NULL as voucher_type, to_account as party_name, description, created_at, NULL as exchange_rate, NULL as currency_code FROM account_transfers WHERE from_account = ? AND created_at BETWEEN ? AND ?", [cashbox.name, fromTs, toTs]);
      const transfersIn: any = await sqlite.getAllAsync("SELECT 'transfer_in' as kind, transfer_no as ref, amount, NULL as voucher_type, from_account as party_name, description, created_at, NULL as exchange_rate, NULL as currency_code FROM account_transfers WHERE to_account = ? AND created_at BETWEEN ? AND ?", [cashbox.name, fromTs, toTs]);

      const all = [...(vouchers || []), ...(invoices || []), ...(transfersOut || []), ...(transfersIn || [])].sort((a: any, b: any) => a.created_at - b.created_at);

      let running = initialOpening;
      const withBalance = all.map((m: any) => {
        const amount = Number(m.amount) || 0;
        const curCode = m.currency_code || baseCurrency?.code || "YER";
        const rate = Number(m.exchange_rate) || 1;
        let debit = 0; let credit = 0; let desc = "";

        if (m.kind === "voucher") {
          if (m.voucher_type === "receipt") { debit = amount; desc = "سند قبض"; } else { credit = amount; desc = "سند دفع"; }
        } else if (m.kind === "invoice") {
          if (m.invoice_type === "sales") { debit = amount; desc = "فاتورة مبيعات نقدية"; } else { credit = amount; desc = "فاتورة مشتريات نقدية"; }
        } else if (m.kind === "transfer_out") { credit = amount; desc = "تحويل إلى " + m.party_name;
        } else if (m.kind === "transfer_in") { debit = amount; desc = "تحويل من " + m.party_name; }

        running += debit - credit;
        return { ...m, debit, credit, desc, balance: running, originalAmount: amount, originalCurrency: curCode };
      });

      setMovements(withBalance);
      setSelected(cashbox);
    } catch (e) { Alert.alert("تعذر التحميل", String(e)); }
  };

  // ✅ فصل الحركات حسب العملة
  const movementsByCurrency = useMemo(() => {
    const groups: Record<string, Row[]> = {};
    movements.forEach((m) => {
      const c = m.originalCurrency || baseCurrency?.code || "YER";
      if (!groups[c]) groups[c] = [];
      groups[c].push(m);
    });
    return groups;
  }, [movements, baseCurrency]);

  // ✅ إجمالي السيولة (الصناديق التحليلية فقط لتجنب الازدواجية)
  const totalLiquidityBase = useMemo(() => {
    return cashboxes
      .filter(c => c.cashbox_type === 'analytical') // ✅ فلترة الصناديق التحليلية
      .reduce((s, c) => s + Number(c.balance || 0), 0);
  }, [cashboxes]);

  const goBack = () => {
    if (selected) { setSelected(null); setMovements([]); setOpeningBalance(0); }
    else { onBack(); }
  };

  const buildPdfHtml = async () => {
    const logoBase64 = await getLogoBase64();
    const logoHtml = logoBase64 ? `<img src='${logoBase64}' class='logo'/>` : '';

    let tablesHtml = '';
    // ✅ بناء جدول لكل عملة
    Object.keys(movementsByCurrency).forEach((curCode) => {
      const rows = movementsByCurrency[curCode].map((m: any) => {
        const type = m.debit > 0 ? "وارد" : "صادر";
        const color = m.debit > 0 ? "#059669" : "#DC2626";
        return `<tr><td>${new Date(m.created_at).toLocaleDateString("ar-EG")}</td><td>${m.desc}</td><td>${m.ref}</td><td style='color:${color};font-weight:700;'>${type}</td><td style='color:${color};font-weight:700;'>${m.originalAmount.toFixed(2)} ${curCode}</td><td>${m.balance.toFixed(2)} ${curCode}</td></tr>`;
      }).join("");

      tablesHtml += `
        <h3 style='margin-top:20px;color:#1E40AF;'>حركات العملة: ${curCode}</h3>
        <table>
          <thead><tr><th>التاريخ</th><th>البيان</th><th>المرجع</th><th>النوع</th><th>المبلغ</th><th>الرصيد التراكمي</th></tr></thead>
          <tbody>
            <tr style='background:#f8fafc;'><td colspan='5'><strong>الرصيد الافتتاحي</strong></td><td><strong>${openingBalance.toFixed(2)} ${curCode}</strong></td></tr>
            ${rows || "<tr><td colspan='6' style='text-align:center'>لا توجد حركات</td></tr>"}
          </tbody>
        </table>
      `;
    });

    return `<!DOCTYPE html><html lang='ar' dir='rtl'><head><meta charset='utf-8'/><style>body{font-family:Arial;padding:20px;direction:rtl;} .header{display:flex;justify-content:space-between;border-bottom:3px solid #F97316;padding-bottom:10px;margin-bottom:20px;} .brand{font-size:22px;font-weight:800;color:#1E40AF;} .logo{height:60px;} table{width:100%;border-collapse:collapse;margin-bottom:20px;} th{background:#0B2545;color:#FFF;padding:8px;} td{border:1px solid #E2E8F0;padding:8px;text-align:right;}</style></head><body><div class='header'><div><div class='brand'>فلوكس</div><div style='font-size:12px;'>حركة الصندوق</div></div>${logoHtml}</div><h2>الصندوق: ${selected?.name}</h2><div>الفترة: ${from} → ${to}</div>${tablesHtml}</body></html>`;
  };

  return (
    <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
      <View style={styles.backWrap}>
        <Text style={[styles.back, { color: colors.blue }]} onPress={goBack}>‹ {selected ? "العودة إلى القائمة" : "العودة إلى التقارير"}</Text>
      </View>

      <ReportHeader title={selected ? `حركة: ${selected.name}` : "تقرير الصناديق"} subtitle={selected ? "الحركات والأرصدة" : "أرصدة الصناديق"} from={from} to={to} currencySymbol={baseSymbol} />
      <DateRangePicker from={from} to={to} onFromChange={setFrom} onToChange={setTo} />

      <ReportActions
        onRefresh={() => (selected ? loadMovements(selected) : loadCashboxes())}
        onExportPdf={async () => {
          try { const html = await buildPdfHtml(); await printHtml(html); } catch (error: any) { Alert.alert("خطأ في الطباعة", String(error.message || error)); }
        }}
        onExportCsv={() => {
          const header = "التاريخ,البيان,المرجع,النوع,المبلغ,الرصيد\n";
          const body = movements.map((m: any) => [ new Date(m.created_at).toLocaleDateString("ar-EG"), m.desc, m.ref, m.debit > 0 ? "وارد" : "صادر", Number(m.originalAmount || 0).toFixed(2) + " " + m.originalCurrency, Number(m.balance || 0).toFixed(2) ].join(",")).join("\n");
          exportCsv(header + body, `حركة-${selected?.name || "الصناديق"}.csv`);
        }}
      />

      {!selected ? (
        <>
          <ReportSummary items={[ 
            { label: "عدد الصناديق", value: String(cashboxes.length) }, 
            { label: `إجمالي السيولة (${baseSymbol})`, value: totalLiquidityBase.toFixed(2) } 
          ]} />
          <Text style={[styles.sectionTitle, { color: colors.blue }]}>قائمة الصناديق</Text>
          {cashboxes.length === 0 ? (
            <Text style={[styles.empty, { color: colors.textMuted }]}>لا توجد صناديق</Text>
          ) : (
            cashboxes.map((c) => {
              const paddingRight = c.cashbox_type === 'analytical' ? 30 : (c.cashbox_type === 'sub' ? 15 : 0);
              const icon = c.cashbox_type === 'main' ? "🏦" : (c.cashbox_type === 'sub' ? "📁" : "💵");
              return (
                <Pressable android_ripple={{ color: "rgba(0,0,0,0.1)" }} key={c.id} style={[styles.row, { paddingRight: 12 + paddingRight, backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => loadMovements(c)}>
                  <View style={styles.rowInfo}>
                    <Text style={[styles.rowName, { color: colors.text }]}>{icon} {c.name}</Text>
                    <Text style={[styles.rowMeta, { color: colors.textMuted }]}>{c.code} ({c.cashbox_type === 'analytical' ? 'تحليلي' : c.cashbox_type === 'sub' ? 'فرعي' : 'رئيسي'})</Text>
                  </View>
                  <View style={styles.rowRight}>
                    <Text style={[styles.amount, { color: colors.blue }]}>{Number(c.balance || 0).toFixed(2)} {baseSymbol}</Text>
                  </View>
                </Pressable>
              );
            })
          )}
        </>
      ) : (
        <>
          <ReportSummary items={[ 
            { label: "الرصيد الافتتاحي", value: openingBalance.toFixed(2) + " " + baseSymbol }, 
            { label: "عدد الحركات", value: String(movements.length) }
          ]} />
          
          {/* ✅ عرض جدول لكل عملة على حدة */}
          {Object.keys(movementsByCurrency).map(curCode => (
            <View key={curCode} style={{ marginTop: 16 }}>
              <Text style={[styles.sectionTitle, { color: colors.blue }]}>حركات العملة: {curCode}</Text>
              {movementsByCurrency[curCode].length === 0 ? (
                <Text style={[styles.empty, { color: colors.textMuted }]}>لا توجد حركات</Text>
              ) : (
                movementsByCurrency[curCode].map((m: any, i: number) => (
                  <View key={i} style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <View style={styles.rowInfo}>
                      <Text style={[styles.rowName, { color: colors.text }]}>{m.desc}</Text>
                      <Text style={[styles.rowMeta, { color: colors.textMuted }]}>{m.ref} · {new Date(m.created_at).toLocaleDateString("ar-EG")}</Text>
                    </View>
                    <View style={styles.rowRight}>
                      <Text style={[styles.amountSmall, { color: m.debit > 0 ? colors.success : colors.danger }]}>
                        {m.debit > 0 ? "+" : "−"}{m.originalAmount.toFixed(2)} {curCode}
                      </Text>
                      <Text style={[styles.conversionHint, { color: colors.textMuted }]}>الرصيد: {m.balance.toFixed(2)}</Text>
                    </View>
                  </View>
                ))
              )}
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
  sectionTitle: { fontSize: 15, marginTop: 16, marginBottom: 8, textAlign: "left", width: "100%", fontFamily: "CodecBold" },
  empty: { textAlign: "right", fontSize: 12, padding: 10 },
  row: { borderWidth: 1, borderRadius: 12, padding: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  rowInfo: { flex: 1, alignItems: "flex-end", paddingRight: 10 },
  rowRight: { alignItems: "flex-start", minWidth: 100 },
  rowName: { fontWeight: "700", fontSize: 14, textAlign: "right" },
  rowMeta: { fontSize: 11, marginTop: 2, textAlign: "right" },
  amount: { fontWeight: "800", fontSize: 16, textAlign: "left" },
  amountSmall: { fontWeight: "800", fontSize: 14 },
  conversionHint: { fontSize: 10, marginTop: 3, fontWeight: "600" },
});
