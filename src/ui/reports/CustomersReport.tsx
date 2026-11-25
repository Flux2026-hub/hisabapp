import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator, Alert, PanResponder, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View,
} from "react-native";
import { sqlite } from "../../db/local";
import ReportHeader from "./components/ReportHeader";
import ReportSummary from "./components/ReportSummary";
import DateRangePicker from "./components/DateRangePicker";
import ReportActions, { exportCsv, exportPdf } from "./components/ReportActions";
import { useTheme } from "../ThemeContext";

type Row = any;
type BalanceFilter = "all" | "positive" | "negative";
type CurrencyFilter = "all" | string;
type ViewCurrency = "original" | string;

/* ---------------- Helpers ---------------- */
const escapeHtml = (v: any) =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const escapeCsv = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;

const localToday = () => {
  const n = new Date();
  const y = n.getFullYear();
  const m = String(n.getMonth() + 1).padStart(2, "0");
  const d = String(n.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const startOfDay = (iso: string) => {
  const t = new Date(iso + "T00:00:00").getTime();
  if (!Number.isFinite(t)) {
    console.warn(`[CustomersReport] تاريخ غير صالح: "${iso}"`);
    return 0;
  }
  return t;
};
const startOfNextDay = (iso: string) => startOfDay(iso) + 86400000;

const normalizeAr = (s: string) =>
  String(s ?? "")
    .toLowerCase()
    .replace(/[أإآ]/g, "ا")
    .replace(/[ىي]/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[\u064B-\u065F\u0670]/g, "");

export default function CustomersReport({ onBack }: { onBack: () => void }) {
  const { colors } = useTheme();
  const today = localToday();
  const [from, setFrom] = useState(today.slice(0, 4) + "-01-01");
  const [to, setTo] = useState(today);
  const [customers, setCustomers] = useState<Row[]>([]);
  const [selected, setSelected] = useState<Row | null>(null);
  const [statement, setStatement] = useState<Row[]>([]);
  const [openingBalance, setOpeningBalance] = useState<number>(0);
  const [currencies, setCurrencies] = useState<Row[]>([]);
  const [baseCurrency, setBaseCurrency] = useState<Row | null>(null);
  const [balanceFilter, setBalanceFilter] = useState<BalanceFilter>("all");
  const [currencyFilter, setCurrencyFilter] = useState<CurrencyFilter>("all");
  const [viewCurrency, setViewCurrency] = useState<ViewCurrency>("original");
  const [searchQuery, setSearchQuery] = useState("");
  const [loadingStatement, setLoadingStatement] = useState(false);
  const [exportingAll, setExportingAll] = useState(false);
  const [computedClosing, setComputedClosing] = useState<number | null>(null);

  const queryJournalsRef = useRef(false);
  const journalFilterRef = useRef("");
  const invoicesHasPartyTypeRef = useRef(false);
  const vouchersHasPartyTypeRef = useRef(true);

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
        setBaseCurrency(normCur.find((c: any) => c.isBase) || null);

        try {
          const cols: any = await sqlite.getAllAsync("PRAGMA table_info(journal_entries)");
          const names = (cols || []).map((c: any) => String(c.name));
          if (names.includes("source_type")) {
            queryJournalsRef.current = true;
            journalFilterRef.current =
              " AND (je.source_type IS NULL OR je.source_type NOT IN ('invoice','voucher','receipt','payment'))";
          } else if (names.includes("source_id")) {
            queryJournalsRef.current = true;
            journalFilterRef.current = " AND je.source_id IS NULL";
          }
        } catch { queryJournalsRef.current = false; }

        try {
          const cols: any = await sqlite.getAllAsync("PRAGMA table_info(invoices)");
          invoicesHasPartyTypeRef.current = (cols || []).some((c: any) => String(c.name) === "party_type");
        } catch { invoicesHasPartyTypeRef.current = false; }

        try {
          const cols: any = await sqlite.getAllAsync("PRAGMA table_info(vouchers)");
          vouchersHasPartyTypeRef.current = (cols || []).some((c: any) => String(c.name) === "party_type");
        } catch { vouchersHasPartyTypeRef.current = true; }

        await loadCustomers();
      } catch (e) {
        Alert.alert("تعذر التحميل", String(e));
      }
    })();
  }, []);

  const baseSymbol = baseCurrency?.symbol || "ر.ي";
  const loadCustomers = async () => {
    const rows: any = await sqlite.getAllAsync("SELECT id, code, name, phone, balance FROM customers ORDER BY name");
    setCustomers(rows || []);
  };

  const fromBase = (baseAmount: number, targetCode: string) => {
    if (targetCode === baseCurrency?.code) return baseAmount;
    const t = currencies.find((c: any) => c.code === targetCode);
    if (!t) return baseAmount;
    return baseAmount / (Number(t.exchangeRate) || 1);
  };

  const convertForDisplay = (m: any, targetCode: string): { amount: number } => {
    if (targetCode === m.originalCurrency) {
      return { amount: m.originalAmount };
    }
    const baseAmount = m.debit > 0 ? m.debit : m.credit;
    if (targetCode === baseCurrency?.code) {
      return { amount: baseAmount };
    }
    return { amount: fromBase(baseAmount, targetCode) };
  };

  const displayFor = (m: any): string => {
    if (viewCurrency === "original") {
      return formatOriginal(m.originalAmount, m.originalCurrency);
    }
    const { amount } = convertForDisplay(m, viewCurrency);
    return `${amount.toFixed(2)} ${viewSymbol}`;
  };

  const formatOriginal = (amt: number, cur: string) => {
    const c = currencies.find((x: any) => x.code === cur);
    return `${amt.toFixed(2)} ${c?.symbol || cur || "—"}`;
  };

  const mapRow = (m: any, base: Row | null) => {
    const rate = Number(m.exchange_rate) || 1;
    const rawAmount = Number(m.amount) || 0;
    const inBase = (a: number) => (m.currency_code === base?.code ? a : a * rate);
    let debit = 0, credit = 0, desc = "", originalAmount = rawAmount;

    if (m.kind === "invoice") {
      const a = inBase(rawAmount);
      if (m.invoice_type === "sales") { debit = a; desc = "فاتورة مبيعات"; }
      else if (m.invoice_type === "purchases") { credit = a; desc = "فاتورة مشتريات"; }
      else if (m.invoice_type === "sales_return" || m.invoice_type === "sales_returns") {
        credit = a; desc = "مردود مبيعات";
      } else {
        console.warn(`[CustomersReport] نوع فاتورة غير معروف: ${m.invoice_type}`);
        debit = a; desc = `فاتورة (${m.invoice_type || "؟"})`;
      }
    } else if (m.kind === "voucher") {
      const a = inBase(rawAmount);
      if (m.payment_type === "receipt") { credit = a; desc = "سند قبض"; }
      else if (m.payment_type === "payment") { debit = a; desc = "سند دفع"; }
      else {
        console.warn(`[CustomersReport] نوع سند غير معروف: ${m.payment_type}`);
        debit = a; desc = `سند (${m.payment_type || "؟"})`;
      }
    } else if (m.kind === "journal") {
      const jD = Number(m.debit) || 0;
      const jC = Number(m.credit) || 0;
      const a = inBase(jD > 0 ? jD : jC);
      if (jD > 0) { debit = a; desc = "قيد يومية (مدين)"; }
      else if (jC > 0) { credit = a; desc = "قيد يومية (دائن)"; }
      originalAmount = jD > 0 ? jD : jC;
    }
    return { ...m, debit, credit, desc, originalAmount, originalCurrency: m.currency_code };
  };

  const invoiceWhere = () =>
    invoicesHasPartyTypeRef.current
      ? "party_id = ? AND party_type = 'customer' AND created_at >= ? AND created_at < ?"
      : "party_id = ? AND created_at >= ? AND created_at < ?";

  const invoiceWherePrior = () =>
    invoicesHasPartyTypeRef.current
      ? "party_id = ? AND party_type = 'customer' AND created_at < ?"
      : "party_id = ? AND created_at < ?";

  const voucherWhere = () =>
    vouchersHasPartyTypeRef.current
      ? "party_type = 'customer' AND party_id = ?"
      : "party_id = ?";

  const buildStatementData = async (customer: Row) => {
    if (!baseCurrency) throw new Error("لم تُحمّل بيانات العملات بعد");
    const fromTs = startOfDay(from);
    const toTs = startOfNextDay(to);
    if (fromTs >= toTs) throw new Error("تاريخ البداية يجب أن يكون قبل تاريخ النهاية");

    const priorInvoices: any = await sqlite.getAllAsync(
      `SELECT 'invoice' as kind, invoice_no as ref, total as amount, currency_code, exchange_rate,
              invoice_type, created_at, 0 as debit, 0 as credit
         FROM invoices WHERE ${invoiceWherePrior()}`,
      [customer.id, fromTs]
    );
    const priorVouchers: any = await sqlite.getAllAsync(
      `SELECT 'voucher' as kind, voucher_no as ref, amount, currency_code, exchange_rate,
              voucher_type as payment_type, created_at, NULL as invoice_type
         FROM vouchers WHERE ${voucherWhere()} AND created_at < ?`,
      [customer.id, fromTs]
    );
    let priorJournals: any = [];
    if (queryJournalsRef.current) {
      priorJournals = await sqlite.getAllAsync(
        `SELECT 'journal' as kind, je.entry_no as ref,
                CASE WHEN jl.debit > 0 THEN jl.debit ELSE jl.credit END as amount,
                je.currency_code, je.exchange_rate, 'journal' as payment_type,
                je.created_at, 'journal' as invoice_type, jl.debit, jl.credit
           FROM journal_lines jl JOIN journal_entries je ON jl.entry_id = je.id
           WHERE jl.party_id = ? AND jl.party_type = 'customer' AND je.created_at < ?${journalFilterRef.current}`,
        [customer.id, fromTs]
      );
    }

    let opening = 0;
    for (const r of [...(priorInvoices || []), ...(priorVouchers || []), ...(priorJournals || [])]) {
      const mapped = mapRow(r, baseCurrency);
      opening += mapped.debit - mapped.credit;
    }

    const invoices: any = await sqlite.getAllAsync(
      `SELECT 'invoice' as kind, invoice_no as ref, total as amount, currency_code, exchange_rate,
              payment_type, created_at, invoice_type, 0 as debit, 0 as credit
         FROM invoices WHERE ${invoiceWhere()}`,
      [customer.id, fromTs, toTs]
    );
    const vouchers: any = await sqlite.getAllAsync(
      `SELECT 'voucher' as kind, voucher_no as ref, amount, currency_code, exchange_rate,
              voucher_type as payment_type, created_at, NULL as invoice_type
         FROM vouchers WHERE ${voucherWhere()} AND created_at >= ? AND created_at < ?`,
      [customer.id, fromTs, toTs]
    );
    let journals: any = [];
    if (queryJournalsRef.current) {
      journals = await sqlite.getAllAsync(
        `SELECT 'journal' as kind, je.entry_no as ref,
                CASE WHEN jl.debit > 0 THEN jl.debit ELSE jl.credit END as amount,
                je.currency_code, je.exchange_rate, 'journal' as payment_type,
                je.created_at, 'journal' as invoice_type, jl.debit, jl.credit
           FROM journal_lines jl JOIN journal_entries je ON jl.entry_id = je.id
           WHERE jl.party_id = ? AND jl.party_type = 'customer'
             AND je.created_at >= ? AND je.created_at < ?${journalFilterRef.current}`,
        [customer.id, fromTs, toTs]
      );
    }

    const all = [...(invoices || []), ...(vouchers || []), ...(journals || [])]
      .sort((a: any, b: any) => a.created_at - b.created_at);

    let running = opening;
    const rows = all.map((m: any) => {
      const mapped = mapRow(m, baseCurrency);
      running += mapped.debit - mapped.credit;
      return { ...mapped, balance: running };
    });

    const declared = Number(customer.balance) || 0;
    if (Math.abs(running - declared) > 0.01) {
      console.warn(
        `[CustomersReport] ${customer.name}: رصيد الكشف (${running.toFixed(2)}) ≠ رصيد العميل (${declared.toFixed(2)})`
      );
    }

    return { opening, rows, closing: running };
  };

  const loadStatement = async (customer: Row) => {
    if (!baseCurrency) {
      Alert.alert("الرجاء الانتظار", "جاري تحميل بيانات العملات...");
      return;
    }
    setLoadingStatement(true);
    try {
      const { opening, rows, closing } = await buildStatementData(customer);
      setOpeningBalance(opening);
      setStatement(rows);
      setComputedClosing(closing);
      setSelected(customer);
    } catch (e) {
      Alert.alert("تعذر تحميل كشف الحساب", String(e));
    } finally {
      setLoadingStatement(false);
    }
  };

  const filteredCustomers = useMemo(() => {
    const q = normalizeAr(searchQuery.trim());
    return customers.filter((c) => {
      const bal = Number(c.balance) || 0;
      if (balanceFilter === "positive" && !(bal > 0)) return false;
      if (balanceFilter === "negative" && !(bal < 0)) return false;
      if (q) {
        const haystack = normalizeAr(`${c.name || ""} ${c.code || ""} ${c.phone || ""}`);
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [customers, balanceFilter, searchQuery]);

  const visibleStatement = useMemo(() => {
    if (currencyFilter === "all") return statement;
    return statement.filter((m: any) => m.originalCurrency === currencyFilter);
  }, [statement, currencyFilter]);

  const currentIndex = useMemo(
    () => (selected ? filteredCustomers.findIndex((c) => c.id === selected.id) : -1),
    [selected, filteredCustomers]
  );
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < filteredCustomers.length - 1;

  const goToAdjacentRef = useRef<(dir: 1 | -1) => void>(() => {});
  goToAdjacentRef.current = (dir) => {
    if (!selected) return;
    const idx = filteredCustomers.findIndex((c) => c.id === selected.id);
    if (idx === -1) return;
    const target = filteredCustomers[idx + dir];
    if (target) loadStatement(target);
  };

  const swipePanResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 20 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderRelease: (_, g) => {
        if (g.dx > 60) goToAdjacentRef.current(-1);
        else if (g.dx < -60) goToAdjacentRef.current(1);
      },
    })
  ).current;

  const viewSymbol = useMemo(() => {
    if (viewCurrency === "original") return "";
    const c = currencies.find((x: any) => x.code === viewCurrency);
    return c?.symbol || viewCurrency;
  }, [viewCurrency, currencies]);

  const totalDebit = useMemo(() => visibleStatement.reduce((s, r) => s + (r.debit || 0), 0), [visibleStatement]);
  const totalCredit = useMemo(() => visibleStatement.reduce((s, r) => s + (r.credit || 0), 0), [visibleStatement]);
  const totalBalance = useMemo(() => filteredCustomers.reduce((s, c) => s + Number(c.balance || 0), 0), [filteredCustomers]);
  const positiveCount = useMemo(() => customers.filter((c) => Number(c.balance) > 0).length, [customers]);
  const negativeCount = useMemo(() => customers.filter((c) => Number(c.balance) < 0).length, [customers]);

  const closingForDisplay = useMemo(() => {
    if (!selected) return 0;
    return computedClosing ?? Number(selected.balance || 0);
  }, [computedClosing, selected]);

  const hasBalanceMismatch = useMemo(() => {
    if (!selected || computedClosing === null) return false;
    return Math.abs(computedClosing - Number(selected.balance || 0)) > 0.01;
  }, [selected, computedClosing]);

  const goBack = () => {
    if (selected) {
      setSelected(null);
      setStatement([]);
      setOpeningBalance(0);
      setComputedClosing(null);
      setCurrencyFilter("all");
      setViewCurrency("original");
    } else onBack();
  };

  const currencyTabs = useMemo(() => {
    const arr = [{ key: "all", label: "الكل" }];
    for (const c of currencies) arr.push({ key: c.code, label: c.symbol || c.code });
    return arr;
  }, [currencies]);

  const viewTabs = useMemo(() => {
    const arr = [{ key: "original", label: "كما هي" }];
    for (const c of currencies) arr.push({ key: c.code, label: `بـ ${c.symbol || c.code}` });
    return arr;
  }, [currencies]);

  const wrapHtml = (content: string) =>
    "<!DOCTYPE html><html lang='ar' dir='rtl'><head><meta charset='utf-8'/><title>كشف حساب</title><style>@page{size:A4;margin:12mm;}body{font-family:Arial,Tahoma;direction:rtl;color:#0F172A;font-size:13px;margin:0;padding:0;}.header{text-align:center;padding-bottom:14px;border-bottom:3px solid #F97316;margin-bottom:16px;}.brand{font-size:22px;font-weight:800;color:#1E40AF;}.brand-sub{font-size:11px;color:#8494B0;font-weight:700;margin-top:3px;}.info-grid{display:flex;gap:12px;margin-bottom:14px;}.info-cell{flex:1;background:#EFF6FF;border:1.5px solid #D6E3F8;border-radius:8px;padding:10px;}.info-label{font-size:11px;color:#8494B0;margin-bottom:3px;font-weight:700;}.info-value{font-size:14px;font-weight:800;color:#0F172A;}.summary{background:#EFF6FF;border-radius:8px;padding:12px;margin-bottom:14px;}.summary-row{display:flex;justify-content:space-between;padding:5px 0;font-size:13px;font-weight:700;}table{width:100%;border-collapse:collapse;}th{background:#0B2545;color:#FFF;padding:10px 8px;font-size:14px;text-align:right;}td{padding:9px 8px;border-bottom:1px solid #E2E8F0;font-size:14px;text-align:right;}tr:nth-child(even) td{background:#F8FAFC;}.footer{margin-top:24px;padding-top:10px;border-top:1px solid #D6E3F8;font-size:10px;color:#8494B0;text-align:center;font-weight:600;}.empty{padding:30px;text-align:center;color:#8494B0;}</style></head><body>" +
    content +
    "</body></html>";

  const buildCustomerSectionHtml = (customer: Row, opening: number, rows: Row[]) => {
    const totalD = rows.reduce((s, r) => s + (r.debit || 0), 0);
    const totalC = rows.reduce((s, r) => s + (r.credit || 0), 0);
    const closing = opening + totalD - totalC;

    const rowsData = rows.map((m: any) => {
      const display = viewCurrency === "original"
        ? formatOriginal(m.originalAmount, m.originalCurrency)
        : (() => {
            const { amount } = convertForDisplay(m, viewCurrency);
            return `${amount.toFixed(2)} ${viewSymbol}`;
          })();
      const type = m.debit > 0 ? "مدين" : "دائن";
      const color = m.debit > 0 ? "#DC2626" : "#059669";
      return (
        "<tr><td>" + escapeHtml(new Date(m.created_at).toLocaleDateString("ar-EG")) + "</td>" +
        "<td>" + escapeHtml(m.desc) + "</td>" +
        "<td>" + escapeHtml(m.ref) + "</td>" +
        "<td style='color:" + color + ";font-weight:700;'>" + type + "</td>" +
        "<td style='font-weight:700;color:" + color + ";'>" + escapeHtml(display) + "</td></tr>"
      );
    }).join("");

    const fmt = (v: number) =>
      viewCurrency === "original" ? v.toFixed(2) + " " + baseSymbol : fromBase(v, viewCurrency).toFixed(2) + " " + viewSymbol;

    const viewLabel = viewCurrency === "original" ? "كما هي" : viewSymbol;

    return (
      "<div class='header'><div class='brand'>فلوكس</div><div class='brand-sub'>مسلك مجاري</div></div>" +
      "<div class='info-grid'><div class='info-cell'><div class='info-label'>العميل</div><div class='info-value'>" +
      escapeHtml(customer?.name || "") + "</div>" +
      (customer?.code ? "<div style='font-size:11px;color:#64748B;margin-top:3px;'>رمز: " + escapeHtml(customer.code) + "</div>" : "") +
      (customer?.phone ? "<div style='font-size:11px;color:#64748B;'>هاتف: " + escapeHtml(customer.phone) + "</div>" : "") +
      "</div><div class='info-cell'><div class='info-label'>الفترة</div><div class='info-value'>" + from + " → " + to + "</div>" +
      "<div style='font-size:11px;color:#64748B;margin-top:3px;'>عرض المبالغ: " + viewLabel + "</div></div></div>" +
      "<div class='summary'>" +
      "<div class='summary-row'><span>الرصيد الافتتاحي</span><span style='color:#1E40AF;'>" + fmt(opening) + "</span></div>" +
      "<div class='summary-row'><span>إجمالي المدين</span><span style='color:#DC2626;'>" + fmt(totalD) + "</span></div>" +
      "<div class='summary-row'><span>إجمالي الدائن</span><span style='color:#059669;'>" + fmt(totalC) + "</span></div>" +
      "<div class='summary-row' style='border-top:1.5px solid #D6E3F8;padding-top:8px;margin-top:5px;font-size:15px;'><span>الرصيد الختامي</span><span style='color:#1E40AF;'>" + fmt(closing) + "</span></div></div>" +
      "<table><thead><tr><th style='width:90px;'>التاريخ</th><th>البيان</th><th style='width:80px;'>المرجع</th><th style='width:60px;'>النوع</th><th style='width:130px;'>المبلغ</th></tr></thead><tbody>" +
      (rowsData || "<tr><td colspan='5' class='empty'>لا توجد حركات</td></tr>") +
      "</tbody></table><div class='footer'>نظام فلوكس المحاسبي - " + new Date().toLocaleString("ar-EG") + "</div>"
    );
  };

  const exportSinglePdf = () => {
    if (!selected) return;
    const section = buildCustomerSectionHtml(selected, openingBalance, visibleStatement);
    exportPdf(wrapHtml(section), `كشف-${selected.name || "عميل"}-${from}-${to}.pdf`);
  };

  const exportAllPdf = async () => {
    if (!baseCurrency) return;
    if (filteredCustomers.length === 0) {
      Alert.alert("لا توجد بيانات", "لا يوجد عملاء مطابقون للفلتر الحالي.");
      return;
    }
    setExportingAll(true);
    try {
      const sections: string[] = [];
      for (const c of filteredCustomers) {
        const { opening, rows } = await buildStatementData(c);
        sections.push(buildCustomerSectionHtml(c, opening, rows));
      }
      const body = sections
        .map((s, i) => (i < sections.length - 1
          ? `<div style="page-break-after: always;">${s}</div>`
          : `<div>${s}</div>`))
        .join("");
      exportPdf(wrapHtml(body), `كشوف-العملاء-${from}-${to}.pdf`);
    } catch (e) {
      Alert.alert("تعذر التصدير", String(e));
    } finally {
      setExportingAll(false);
    }
  };

  const exportStatementCsv = () => {
    if (!selected) return;
    const rows = visibleStatement.map((m: any) => ({
      date: new Date(m.created_at).toLocaleDateString("ar-EG"),
      desc: m.desc,
      ref: m.ref,
      amount: displayFor(m),
    }));
    const header = ["التاريخ", "البيان", "المرجع", "المبلغ"].map(escapeCsv).join(",") + "\n";
    const body = rows.map((r) => [r.date, r.desc, r.ref, r.amount].map(escapeCsv).join(",")).join("\n");
    exportCsv(header + body, `كشف-${selected.name || "عميل"}.csv`);
  };

  const exportCustomersCsv = () => {
    const header = ["الاسم", "الكود", "الهاتف", "الرصيد"].map(escapeCsv).join(",") + "\n";
    const body = filteredCustomers
      .map((c) =>
        [c.name || "", c.code || "", c.phone || "", Number(c.balance || 0).toFixed(2)]
          .map(escapeCsv).join(",")
      ).join("\n");
    const total = filteredCustomers.reduce((s, c) => s + Number(c.balance || 0), 0);
    const footer = ["الإجمالي", "", "", total.toFixed(2)].map(escapeCsv).join(",");
    exportCsv(header + body + "\n" + footer, `قائمة-العملاء-${from}-${to}.csv`);
  };

  return (
    <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
      <View style={styles.backWrap}>
        <Text style={[styles.back, { color: colors.blue }]} onPress={goBack}>
          ‹ {selected ? "العودة إلى القائمة" : "العودة إلى التقارير"}
        </Text>
      </View>

      {selected && (
        <View style={styles.navRow}>
          <Pressable onPress={() => goToAdjacentRef.current(-1)} disabled={!hasPrev} style={[styles.navBtn, !hasPrev && styles.navBtnDisabled]}>
            <Text style={[styles.navBtnText, { color: hasPrev ? colors.blue : colors.textMuted }]}>‹ السابق</Text>
          </Pressable>
          <Text style={[styles.navCounter, { color: colors.textMuted }]}>
            {currentIndex + 1} / {filteredCustomers.length}
          </Text>
          <Pressable onPress={() => goToAdjacentRef.current(1)} disabled={!hasNext} style={[styles.navBtn, !hasNext && styles.navBtnDisabled]}>
            <Text style={[styles.navBtnText, { color: hasNext ? colors.blue : colors.textMuted }]}>التالي ›</Text>
          </Pressable>
        </View>
      )}

      <View {...(selected ? swipePanResponder.panHandlers : {})}>
        <ReportHeader
          title={selected ? `كشف حساب: ${selected.name}` : "تقرير العملاء"}
          subtitle={selected ? "اسحب يميناً/يساراً للتنقل · الحركات والأرصدة" : "قائمة العملاء وأرصدتهم"}
          from={from} to={to} currencySymbol={baseSymbol}
        />
      </View>

      <DateRangePicker from={from} to={to} onFromChange={setFrom} onToChange={setTo} />

      {!selected && (
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="🔍 ابحث بالاسم أو الكود أو الهاتف..."
          placeholderTextColor={colors.textMuted}
          style={[styles.searchInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
        />
      )}

      {selected && (
        <>
          <Text style={[styles.filterLabel, { color: colors.textMuted }]}>فلترة العملة</Text>
          <View style={styles.filterRow}>
            {currencyTabs.map((o) => (
              <Pressable key={o.key} onPress={() => setCurrencyFilter(o.key)}
                style={[styles.chip, { backgroundColor: colors.surface, borderColor: colors.border }, currencyFilter === o.key && { backgroundColor: colors.blue, borderColor: colors.blue }]}>
                <Text style={[styles.chipText, { color: colors.text }, currencyFilter === o.key && { color: "#FFF" }]}>{o.label}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={[styles.filterLabel, { color: colors.textMuted }]}>عرض المبالغ</Text>
          <View style={styles.filterRow}>
            {viewTabs.map((o) => (
              <Pressable key={o.key} onPress={() => setViewCurrency(o.key)}
                style={[styles.chip, { backgroundColor: colors.surface, borderColor: colors.border }, viewCurrency === o.key && { backgroundColor: colors.orange, borderColor: colors.orange }]}>
                <Text style={[styles.chipText, { color: colors.text }, viewCurrency === o.key && { color: "#FFF" }]}>{o.label}</Text>
              </Pressable>
            ))}
          </View>
        </>
      )}

      {!selected && (
        <>
          <Text style={[styles.filterLabel, { color: colors.textMuted }]}>الفلتر</Text>
          <View style={styles.filterRow}>
            {[
              { key: "all", label: `الكل (${customers.length})` },
              { key: "positive", label: `لهم رصيد (${positiveCount})` },
              { key: "negative", label: `عليهم رصيد (${negativeCount})` },
            ].map((o) => (
              <Pressable key={o.key} onPress={() => setBalanceFilter(o.key as BalanceFilter)}
                style={[styles.chip, { backgroundColor: colors.surface, borderColor: colors.border }, balanceFilter === o.key && { backgroundColor: colors.blue, borderColor: colors.blue }]}>
                <Text style={[styles.chipText, { color: colors.text }, balanceFilter === o.key && { color: "#FFF" }]}>{o.label}</Text>
              </Pressable>
            ))}
          </View>
        </>
      )}

      <ReportActions
        onRefresh={() => (selected ? loadStatement(selected) : loadCustomers())}
        onExportPdf={() => (selected ? exportSinglePdf() : exportAllPdf())}
        onExportCsv={() => (selected ? exportStatementCsv() : exportCustomersCsv())}
      />

      {exportingAll && (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="small" color={colors.blue} />
          <Text style={[styles.loadingText, { color: colors.textMuted }]}>
            جاري تجهيز كشوف {filteredCustomers.length} عميل...
          </Text>
        </View>
      )}

      {!selected ? (
        <>
          <Text style={[styles.sectionTitle, { color: colors.blue }]}>
            قائمة العملاء ({filteredCustomers.length})
          </Text>
          <Text style={[styles.totalLine, { color: colors.textMuted }]}>
            إجمالي أرصدة المعروضين: {totalBalance.toFixed(2)} {baseSymbol}
          </Text>
          {filteredCustomers.length === 0 ? (
            <Text style={[styles.empty, { color: colors.textMuted }]}>
              {searchQuery ? "لا نتائج مطابقة للبحث" : "لا يوجد عملاء بهذا الفلتر"}
            </Text>
          ) : (
            filteredCustomers.map((c) => {
              const bal = Number(c.balance || 0);
              const balColor = bal > 0 ? colors.success : bal < 0 ? colors.danger : colors.textMuted;
              return (
                <Pressable key={c.id} onPress={() => loadStatement(c)}
                  style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <View style={styles.rowRight}>
                    <Text style={[styles.amount, { color: balColor }]}>{bal.toFixed(2)} {baseSymbol}</Text>
                  </View>
                  <View style={styles.rowInfo}>
                    <Text style={[styles.rowName, { color: colors.text }]}>{c.name}</Text>
                    <Text style={[styles.rowMeta, { color: colors.textMuted }]}>{c.code} · {c.phone || "—"}</Text>
                  </View>
                </Pressable>
              );
            })
          )}
        </>
      ) : (
        <>
          {loadingStatement && (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="small" color={colors.blue} />
              <Text style={[styles.loadingText, { color: colors.textMuted }]}>جاري تحميل الكشف...</Text>
            </View>
          )}
          <ReportSummary items={[
            { label: "عدد الحركات", value: String(visibleStatement.length) },
            { label: `إجمالي المدين (${viewCurrency === "original" ? baseSymbol : viewSymbol})`, value: viewCurrency === "original" ? totalDebit.toFixed(2) : fromBase(totalDebit, viewCurrency).toFixed(2), color: colors.danger },
            { label: `إجمالي الدائن (${viewCurrency === "original" ? baseSymbol : viewSymbol})`, value: viewCurrency === "original" ? totalCredit.toFixed(2) : fromBase(totalCredit, viewCurrency).toFixed(2), color: colors.success },
            { label: `الرصيد الختامي (${viewCurrency === "original" ? baseSymbol : viewSymbol})`, value: viewCurrency === "original" ? closingForDisplay.toFixed(2) : fromBase(closingForDisplay, viewCurrency).toFixed(2), color: closingForDisplay > 0 ? colors.success : closingForDisplay < 0 ? colors.danger : colors.textMuted },
          ]} />
          {hasBalanceMismatch && (
            <View style={[styles.warnBox, { borderColor: colors.danger, backgroundColor: colors.surface }]}>
              <Text style={[styles.warnText, { color: colors.danger }]}>
                ⚠ الرصيد المخزّن ({Number(selected.balance || 0).toFixed(2)} {baseSymbol}) يختلف عن الرصيد المحسوب من الحركات ({closingForDisplay.toFixed(2)} {baseSymbol}). يُعرض المحسوب. قد تحتاج إعادة حساب أرصدة العملاء.
              </Text>
            </View>
          )}
          <Text style={[styles.openingLine, { color: colors.blue }]}>
            الرصيد الافتتاحي للفترة: {viewCurrency === "original" ? openingBalance.toFixed(2) + " " + baseSymbol : fromBase(openingBalance, viewCurrency).toFixed(2) + " " + viewSymbol}
          </Text>
          <Text style={[styles.sectionTitle, { color: colors.blue }]}>حركات الحساب ({visibleStatement.length})</Text>
          {visibleStatement.length === 0 ? (
            <Text style={[styles.empty, { color: colors.textMuted }]}>لا توجد حركات</Text>
          ) : (
            visibleStatement.map((m: any, i: number) => {
              const display = displayFor(m);
              const showConv = viewCurrency === "original" && m.originalCurrency !== baseCurrency?.code;
              const baseAmount = m.debit > 0 ? m.debit : m.credit;
              return (
                <View key={`${m.kind}-${m.ref}-${m.created_at}-${i}`}
                  style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <View style={styles.rowRight}>
                    <Text style={[styles.amountSmall, { color: m.debit > 0 ? colors.danger : colors.success }]}>
                      {m.debit > 0 ? "−" : "+"}{display}
                    </Text>
                    {showConv && (
                      <Text style={[styles.conversionHint, { color: colors.textMuted }]}>≈ {baseAmount.toFixed(2)} {baseSymbol}</Text>
                    )}
                  </View>
                  <View style={styles.rowInfo}>
                    <Text style={[styles.rowName, { color: colors.text }]}>{m.desc}</Text>
                    <Text style={[styles.rowMeta, { color: colors.textMuted }]}>{m.ref} · {new Date(m.created_at).toLocaleDateString("ar-EG")}</Text>
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
  scrollContainer: { backgroundColor: "transparent", paddingHorizontal: 8, paddingTop: 16, paddingBottom: 40 },
  backWrap: { paddingVertical: 8 },
  back: { alignSelf: "flex-start", fontWeight: "700", textAlign: "left" },
  filterLabel: { fontSize: 12, textAlign: "left", marginTop: 10, marginBottom: 6, fontWeight: "700" },
  filterRow: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 6, marginBottom: 8 },
  chip: { borderWidth: 1.2, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  chipText: { fontSize: 12, fontWeight: "700" },
  sectionTitle: { fontSize: 15, marginTop: 16, marginBottom: 8, textAlign: "left", width: "100%", fontFamily: "CodecBold" },
  empty: { textAlign: "right", fontSize: 12, padding: 10 },
  row: { borderWidth: 1.2, borderRadius: 10, padding: 12, flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  rowInfo: { flex: 1, alignItems: "flex-end" },
  rowRight: { alignItems: "flex-end" },
  rowName: { fontWeight: "700", fontSize: 14, textAlign: "right", width: "100%" },
  rowMeta: { fontSize: 11, marginTop: 2, textAlign: "right" },
  amount: { fontWeight: "800", fontSize: 15 },
  amountSmall: { fontWeight: "800", fontSize: 14 },
  conversionHint: { fontSize: 10, marginTop: 2, fontWeight: "600" },
  totalLine: { fontSize: 12, textAlign: "right", marginBottom: 8, fontWeight: "700" },
  openingLine: { fontSize: 12, textAlign: "right", marginVertical: 8, fontWeight: "700" },
  loadingWrap: { flexDirection: "row-reverse", alignItems: "center", gap: 8, padding: 8, justifyContent: "center" },
  loadingText: { fontSize: 12, fontWeight: "700" },
  searchInput: { borderWidth: 1.2, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, textAlign: "right", marginBottom: 8 },
  navRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 6, marginBottom: 4 },
  navBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  navBtnDisabled: { opacity: 0.4 },
  navBtnText: { fontSize: 13, fontWeight: "700" },
  navCounter: { fontSize: 12, fontWeight: "700" },
  warnBox: { borderWidth: 1.2, borderRadius: 10, padding: 10, marginVertical: 8 },
  warnText: { fontSize: 12, fontWeight: "700", lineHeight: 18, textAlign: "right" },
});
