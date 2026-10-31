import { useEffect, useMemo, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import BrandBanner from "./components/BrandBanner";
import DateTimePicker from "@react-native-community/datetimepicker";
import { sqlite } from "../db/local";
import { buildInvoiceHtml, printHtml, shareHtmlAsPdf, type InvoicePrintData } from "../utils/printDocument";
import SalesReturnScreen from "./SalesReturnScreen";
import { useTheme } from "./ThemeContext";

const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

type Row = any;
type PaymentType = "cash" | "credit";
type InvoiceLine = { key: string; itemId: string; itemName: string; itemSku: string; available: number; unit: string; quantity: number; unitPrice: number; };

export default function SalesInv({ onBack }: { onBack: () => void }) {
  const { colors } = useTheme();
  const [customers, setCustomers] = useState<Row[]>([]);
  const [currencies, setCurrencies] = useState<Row[]>([]);
  const [cashboxes, setCashboxes] = useState<Row[]>([]);
  const [items, setItems] = useState<Row[]>([]);
  const [salesReps, setSalesReps] = useState<Row[]>([]);

  const [customer, setCustomer] = useState<Row | null>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [currency, setCurrency] = useState<Row | null>(null);
  const [paymentType, setPaymentType] = useState<PaymentType>("cash");
  const [cashbox, setCashbox] = useState<Row | null>(null);
  const [notes, setNotes] = useState("");
  const [salesRep, setSalesRep] = useState<Row | null>(null);

  const [dateStr, setDateStr] = useState(new Date().toISOString().slice(0, 10));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingNo, setEditingNo] = useState<string | null>(null);

  const [discountType, setDiscountType] = useState<"percent" | "fixed">("percent");
  const [discountValue, setDiscountValue] = useState("");

  const [lines, setLines] = useState<InvoiceLine[]>([]);
  const [pickItem, setPickItem] = useState<Row | null>(null);
  const [pickQty, setPickQty] = useState("");
  const [pickPrice, setPickPrice] = useState("");

  const [showCustomerPicker, setShowCustomerPicker] = useState(false);
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  const [showCashboxPicker, setShowCashboxPicker] = useState(false);
  const [showItemPicker, setShowItemPicker] = useState(false);
  const [showSalesRepPicker, setShowSalesRepPicker] = useState(false);

  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<Row[]>([]);
  const [returnInvoiceId, setReturnInvoiceId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const c: any = await sqlite.getAllAsync("SELECT id, code, name, phone, balance FROM customers ORDER BY name");
        const cur: any = await sqlite.getAllAsync("SELECT id, code, name, symbol, exchange_rate, is_base FROM currencies ORDER BY is_base DESC, code");
        const cb: any = await sqlite.getAllAsync("SELECT id, code, name, balance FROM cashboxes ORDER BY name");
        const reps: any = await sqlite.getAllAsync("SELECT id, code, name, phone, commission_rate FROM sales_reps WHERE is_active = 1 ORDER BY name");
        setCustomers(c || []);
        setCashboxes(cb || []);
        setSalesReps(reps || []);

        const normalizedCurrencies = (cur || []).map((x: any) => ({ id: x.id, code: x.code, name: x.name, symbol: x.symbol, exchangeRate: Number(x.exchange_rate ?? x.exchangeRate ?? 1) || 1, isBase: !!(x.is_base ?? x.isBase) }));
        setCurrencies(normalizedCurrencies);
        const baseCur = normalizedCurrencies.find((x: any) => x.isBase);
        if (baseCur) setCurrency(baseCur);

        await loadItems();
        await loadHistory();
      } catch (e) { Alert.alert("تعذر التحميل", String(e)); }
    })();
  }, []);

  const loadItems = async () => {
    const rows: any = await sqlite.getAllAsync("SELECT id, sku, name, unit, stock_quantity, average_cost FROM items WHERE item_type IN ('compound_finished','finished_product') ORDER BY name");
    setItems(rows || []);
  };

  const loadHistory = async () => {
    try {
      const rows: any = await sqlite.getAllAsync(`SELECT id, invoice_no, party_name, total, currency_code, payment_type, created_at FROM invoices WHERE invoice_type = 'sales' ORDER BY created_at DESC LIMIT 10`);
      setHistory(rows || []);
    } catch {}
  };

  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) return customers;
    const q = customerSearch.toLowerCase();
    return customers.filter(c => String(c.name).toLowerCase().includes(q) || String(c.code).toLowerCase().includes(q) || String(c.phone || "").includes(q));
  }, [customers, customerSearch]);

  const addLine = () => {
    if (!pickItem) return Alert.alert("تنبيه", "اختر المنتج");
    const qty = Number(pickQty); const price = Number(pickPrice);
    if (!qty || qty <= 0) return Alert.alert("تنبيه", "أدخل كمية صحيحة");
    if (price < 0 || Number.isNaN(price)) return Alert.alert("تنبيه", "أدخل سعراً صحيحاً");
    const alreadyUsed = lines.filter((l) => l.itemId === pickItem.id).reduce((s, l) => s + l.quantity, 0);
    const available = Number(pickItem.stock_quantity || 0) - alreadyUsed;
    if (qty > available) return Alert.alert("تنبيه", `المتوفر: ${available} ${pickItem.unit}`);

    setLines([...lines, { key: newId(), itemId: pickItem.id, itemName: pickItem.name, itemSku: pickItem.sku, available: Number(pickItem.stock_quantity || 0), unit: pickItem.unit, quantity: qty, unitPrice: price }]);
    setPickItem(null); setPickQty(""); setPickPrice(""); setShowItemPicker(false);
  };

  const removeLine = (key: string) => setLines(lines.filter((l) => l.key !== key));

  const subtotal = useMemo(() => lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0), [lines]);
  const discountAmount = useMemo(() => { const val = Number(discountValue) || 0; if (val <= 0) return 0; if (discountType === "percent") return subtotal * (val / 100); return Math.min(val, subtotal); }, [discountType, discountValue, subtotal]);
  const total = Math.max(0, subtotal - discountAmount);
  const commissionAmount = useMemo(() => { if (!salesRep) return 0; return total * ((Number(salesRep.commission_rate) || 0) / 100); }, [salesRep, total]);

  const canSave = !!customer && !!currency && lines.length > 0 && (paymentType === "credit" || !!cashbox) && !saving;

  const buildCurrentInvoiceData = (invoiceNo: string): InvoicePrintData | null => {
    if (!customer || !currency) return null;
    return { type: "sales", invoiceNo, createdAt: dateStr ? new Date(dateStr).getTime() : Date.now(), partyLabel: "العميل", partyName: customer.name, partyPhone: customer.phone || undefined, currencyCode: currency.code, currencySymbol: currency.symbol || currency.code, exchangeRate: Number(currency.exchangeRate) || 1, isBase: !!currency.isBase, paymentType, cashboxName: cashbox?.name, lines: lines.map((l) => ({ itemName: l.itemName, itemSku: l.itemSku, unit: l.unit, quantity: l.quantity, unitPrice: l.unitPrice })), subtotal, discountType, discountValue: Number(discountValue) || 0, discountAmount, total, notes: notes.trim() || undefined };
  };

  const printInvoiceById = async (invoiceId: string) => {
    try {
      const inv: any = await sqlite.getFirstAsync("SELECT * FROM invoices WHERE id = ?", [invoiceId]);
      const invLines: any = await sqlite.getAllAsync(`SELECT l.*, i.name as item_name, i.sku as item_sku, i.unit as item_unit FROM invoice_lines l LEFT JOIN items i ON i.id = l.item_id WHERE l.invoice_id = ?`, [invoiceId]);
      const cur: any = await sqlite.getFirstAsync("SELECT * FROM currencies WHERE code = ?", [inv.currency_code || ""]);
      let cashboxName; if (inv.cashbox_id) { const cb: any = await sqlite.getFirstAsync("SELECT name FROM cashboxes WHERE id = ?", [inv.cashbox_id]); cashboxName = cb?.name; }

      const data: InvoicePrintData = { type: "sales", invoiceNo: inv.invoice_no, createdAt: inv.created_at, partyLabel: "العميل", partyName: inv.party_name || "", currencyCode: inv.currency_code || "YER", currencySymbol: cur?.symbol || inv.currency_code || "YER", exchangeRate: Number(inv.exchange_rate) || 1, isBase: !!(cur?.is_base ?? cur?.isBase), paymentType: (inv.payment_type as "cash" | "credit") || "cash", cashboxName, lines: (invLines || []).map((l: any) => ({ itemName: l.item_name || l.description || "—", itemSku: l.item_sku || "", unit: l.item_unit || "", quantity: Number(l.quantity) || 0, unitPrice: Number(l.unit_price) || 0 })), subtotal: Number(inv.subtotal) || Number(inv.total) || 0, discountType: inv.discount_type || null, discountValue: Number(inv.discount_value) || 0, discountAmount: Number(inv.discount_amount) || 0, total: Number(inv.total) || 0 };
      await printHtml(await buildInvoiceHtml(data));
    } catch (e) { Alert.alert("تعذر الطباعة", String(e)); }
  };

  const deleteInvoice = async (invoiceId: string) => {
    try {
      const inv: any = await sqlite.getFirstAsync("SELECT * FROM invoices WHERE id = ?", [invoiceId]);
      const invLines: any = await sqlite.getAllAsync("SELECT * FROM invoice_lines WHERE invoice_id = ?", [invoiceId]);
      for (const l of invLines || []) { await sqlite.runAsync("UPDATE items SET stock_quantity = stock_quantity + ?, updated_at = ? WHERE id = ?", [Number(l.quantity), Date.now(), l.item_id]); }
      await sqlite.runAsync("DELETE FROM stock_movements WHERE source_type = 'sales_invoice' AND source_id = ?", [invoiceId]);

      const cur: any = await sqlite.getFirstAsync("SELECT is_base FROM currencies WHERE code = ?", [inv.currency_code || "YER"]);
      const baseAmount = (cur?.is_base ?? cur?.isBase) ? Number(inv.total) : Number(inv.total) * (Number(inv.exchange_rate) || 1);

      if (inv.payment_type === "credit" && inv.party_id) await sqlite.runAsync("UPDATE customers SET balance = balance - ? WHERE id = ?", [baseAmount, inv.party_id]);
      if (inv.payment_type === "cash" && inv.cashbox_id) await sqlite.runAsync("UPDATE cashboxes SET balance = balance - ? WHERE id = ?", [baseAmount, inv.cashbox_id]);

      await sqlite.runAsync("DELETE FROM invoice_lines WHERE invoice_id = ?", [invoiceId]);
      await sqlite.runAsync("DELETE FROM invoices WHERE id = ?", [invoiceId]);
      Alert.alert("تم الحذف", "تم حذف الفاتورة وعكس تأثيراتها");
      await loadItems(); await loadHistory();
    } catch (e) { Alert.alert("تعذر الحذف", String(e)); }
  };

  const confirmDelete = (invoiceId: string, invoiceNo: string) => { Alert.alert("تأكيد الحذف", `هل تريد حذف الفاتورة ${invoiceNo}؟\n\nسيتم:\n• إرجاع المخزون\n• عكس رصيد العميل/الصندوق\n• حذف السجلات المرتبطة`, [{ text: "إلغاء", style: "cancel" }, { text: "حذف", style: "destructive", onPress: () => deleteInvoice(invoiceId) }]); };

  const editInvoice = async (invoiceId: string) => {
    Alert.alert("تعديل الفاتورة", "سيتم فتح الفاتورة للتعديل المباشر. متابعة؟", [{ text: "إلغاء", style: "cancel" }, { text: "متابعة", onPress: async () => {
      try {
        const inv: any = await sqlite.getFirstAsync("SELECT * FROM invoices WHERE id = ?", [invoiceId]);
        if (!inv) return;
        const invLines: any = await sqlite.getAllAsync(`SELECT l.*, i.name as item_name, i.sku as item_sku, i.unit as item_unit FROM invoice_lines l LEFT JOIN items i ON i.id = l.item_id WHERE l.invoice_id = ?`, [invoiceId]);

        setEditingId(inv.id); setEditingNo(inv.invoice_no);
        if (inv.created_at) setDateStr(new Date(inv.created_at).toISOString().slice(0, 10));

        const oldCustomer = customers.find((c) => c.id === inv.party_id);
        const oldCurrency = currencies.find((c) => c.code === inv.currency_code);
        const oldCashbox = cashboxes.find((c) => c.id === inv.cashbox_id);
        const oldSalesRep = salesReps.find((r) => r.id === inv.sales_rep_id);

        if (oldCustomer) { setCustomer(oldCustomer); setCustomerSearch(oldCustomer.name); }
        if (oldCurrency) setCurrency(oldCurrency);
        if (oldCashbox) setCashbox(oldCashbox);
        if (oldSalesRep) setSalesRep(oldSalesRep); else setSalesRep(null);
        setPaymentType((inv.payment_type as PaymentType) || "cash");

        if (inv.discount_type) { setDiscountType(inv.discount_type); setDiscountValue(String(inv.discount_value || "")); } else { setDiscountType("percent"); setDiscountValue(""); }

        setLines((invLines || []).map((l: any) => ({ key: newId(), itemId: l.item_id, itemName: l.item_name || l.description || "—", itemSku: l.item_sku || "", available: 0, unit: l.item_unit || "", quantity: Number(l.quantity), unitPrice: Number(l.unit_price) })));
      } catch (e) { Alert.alert("تعذر التعديل", String(e)); }
    }}]);
  };

  const save = () => {
    if (!canSave || !customer || !currency) return;
    Alert.alert("تأكيد الحفظ", `فاتورة مبيعات بمبلغ ${total.toFixed(2)} ${currency.symbol || currency.code}\nالعميل: ${customer.name}`, [{ text: "إلغاء", style: "cancel" }, { text: "حفظ", onPress: doSave }]);
  };

  const doSave = async () => {
    if (!customer || !currency) return;
    setSaving(true);
    try {
      const finalDate = dateStr ? new Date(dateStr).getTime() : Date.now();
      let currentInvoiceId = editingId;
      let currentInvoiceNo = editingNo;

      const rate = Number(currency.exchangeRate) || 1;
      const isBase = !!currency.isBase;
      const baseAmount = isBase ? total : total * rate;

      if (!currentInvoiceId) {
        currentInvoiceId = newId();
        const prefix = "SAL";
        const last: any = await sqlite.getAllAsync(`SELECT invoice_no FROM invoices WHERE invoice_type = 'sales' AND invoice_no LIKE ?`, [`${prefix}-%`]);
        let maxNum = 0;
        if (last && last.length > 0) {
          last.forEach((row: any) => {
            const num = parseInt(String(row.invoice_no).replace(/\D/g, ""), 10);
            if (!isNaN(num) && num > maxNum) maxNum = num;
          });
        }
        const nextNum = maxNum + 1;
        currentInvoiceNo = `${prefix}-${String(nextNum).padStart(3, "0")}`;

        await sqlite.runAsync(`INSERT INTO invoices (id, invoice_no, invoice_type, party_id, party_name, status, subtotal, tax, total, created_at, currency_code, exchange_rate, payment_type, cashbox_id, sales_rep_id, sales_rep_name, commission_rate, commission_amount, discount_type, discount_value, discount_amount) VALUES (?, ?, 'sales', ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [currentInvoiceId, currentInvoiceNo, customer.id, customer.name, paymentType === "cash" ? "paid" : "posted", subtotal, total, finalDate, currency.code, rate, paymentType, paymentType === "cash" && cashbox ? cashbox.id : null, salesRep?.id || null, salesRep?.name || null, salesRep ? Number(salesRep.commission_rate) : 0, salesRep ? commissionAmount : 0, discountAmount > 0 ? discountType : null, discountAmount > 0 ? Number(discountValue) : 0, discountAmount]);
      } else {
        const oldInv: any = await sqlite.getFirstAsync("SELECT * FROM invoices WHERE id = ?", [currentInvoiceId]);
        const oldLines: any = await sqlite.getAllAsync("SELECT * FROM invoice_lines WHERE invoice_id = ?", [currentInvoiceId]);

        for (const l of oldLines) await sqlite.runAsync("UPDATE items SET stock_quantity = stock_quantity + ?, updated_at = ? WHERE id = ?", [Number(l.quantity), Date.now(), l.item_id]);

        const baseCur = currencies.find(c => c.isBase);
        const oldRate = Number(oldInv.exchange_rate) || 1;
        const oldBaseAmount = oldInv.currency_code === baseCur?.code ? Number(oldInv.total) : Number(oldInv.total) * oldRate;

        if (oldInv.payment_type === "credit" && oldInv.party_id) await sqlite.runAsync("UPDATE customers SET balance = balance - ? WHERE id = ?", [oldBaseAmount, oldInv.party_id]);
        else if (oldInv.payment_type === "cash" && oldInv.cashbox_id) await sqlite.runAsync("UPDATE cashboxes SET balance = balance - ? WHERE id = ?", [oldBaseAmount, oldInv.cashbox_id]);

        await sqlite.runAsync("DELETE FROM invoice_lines WHERE invoice_id = ?", [currentInvoiceId]);
        await sqlite.runAsync("DELETE FROM stock_movements WHERE source_type = 'sales_invoice' AND source_id = ?", [currentInvoiceId]);

        await sqlite.runAsync(`UPDATE invoices SET party_id=?, party_name=?, status=?, subtotal=?, total=?, created_at=?, currency_code=?, exchange_rate=?, payment_type=?, cashbox_id=?, sales_rep_id=?, sales_rep_name=?, commission_rate=?, commission_amount=?, discount_type=?, discount_value=?, discount_amount=? WHERE id=?`, [customer.id, customer.name, paymentType === "cash" ? "paid" : "posted", subtotal, total, finalDate, currency.code, rate, paymentType, paymentType === "cash" && cashbox ? cashbox.id : null, salesRep?.id || null, salesRep?.name || null, salesRep ? Number(salesRep.commission_rate) : 0, salesRep ? commissionAmount : 0, discountAmount > 0 ? discountType : null, discountAmount > 0 ? Number(discountValue) : 0, discountAmount, currentInvoiceId]);
      }

      for (const l of lines) {
        await sqlite.runAsync(`INSERT INTO invoice_lines (id, invoice_id, item_id, description, quantity, unit_price, line_total) VALUES (?, ?, ?, ?, ?, ?, ?)`, [newId(), currentInvoiceId, l.itemId, l.itemName, l.quantity, l.unitPrice, l.quantity * l.unitPrice]);
        await sqlite.runAsync("UPDATE items SET stock_quantity = stock_quantity - ?, updated_at = ? WHERE id = ?", [l.quantity, Date.now(), l.itemId]);
        await sqlite.runAsync(`INSERT INTO stock_movements (id, source_type, source_id, item_id, warehouse_id, movement_type, quantity_in, quantity_out, planned_quantity, waste_quantity, unit_cost, created_at) VALUES (?, 'sales_invoice', ?, ?, 'wh-final', 'sale_out', 0, ?, 0, 0, ?, ?)`, [newId(), currentInvoiceId, l.itemId, l.quantity, l.unitPrice, Date.now()]);
      }

      if (paymentType === "credit") await sqlite.runAsync("UPDATE customers SET balance = balance + ? WHERE id = ?", [baseAmount, customer.id]);
      else if (cashbox) await sqlite.runAsync("UPDATE cashboxes SET balance = balance + ? WHERE id = ?", [baseAmount, cashbox.id]);

      const currentData = buildCurrentInvoiceData(currentInvoiceNo || "—");
      Alert.alert("تم الحفظ بنجاح", `رقم الفاتورة: ${currentInvoiceNo}`, [{ text: "طباعة", onPress: async () => { if (currentData) printHtml(await buildInvoiceHtml(currentData)); } }, { text: "مشاركة PDF", onPress: async () => { if (currentData) shareHtmlAsPdf(await buildInvoiceHtml(currentData), `فاتورة-${currentInvoiceNo}.pdf`); } }, { text: "لاحقاً", style: "cancel" }]);

      setCustomer(null); setCustomerSearch(""); setLines([]); setNotes(""); setSalesRep(null); setDiscountValue(""); setDiscountType("percent"); setEditingId(null); setEditingNo(null); setDateStr(new Date().toISOString().slice(0, 10)); if (paymentType === "cash") setCashbox(null);
      await loadItems(); await loadHistory();
    } catch (e) { Alert.alert("تعذر الحفظ", String(e)); } finally { setSaving(false); }
  };

  if (returnInvoiceId) return <SalesReturnScreen invoiceId={returnInvoiceId} onBack={() => setReturnInvoiceId(null)} />;

  const symbol = currency?.symbol || currency?.code || "";

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
        
        <Pressable style={styles.back} onPress={onBack}>
          <Text style={[styles.backText, { color: colors.blue }]}>‹ العودة إلى الوحدات المحاسبية</Text>
        </Pressable>

        <BrandBanner />
        <Text style={[styles.screenTitle, { color: colors.text }]}>{editingNo ? `تعديل الفاتورة ${editingNo}` : "فاتورة مبيعات جديدة"}</Text>

        <Text style={[styles.label, { color: colors.textMuted }]}>التاريخ</Text>
        <Pressable style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, justifyContent: "center", height: 42 }]} onPress={() => setShowDatePicker(true)}>
          <Text style={{ textAlign: "right", color: colors.text, fontSize: 14 }}>{dateStr}</Text>
        </Pressable>
        {showDatePicker && <DateTimePicker value={dateStr ? new Date(dateStr) : new Date()} mode="date" display="default" onChange={(e, d) => { setShowDatePicker(Platform.OS === 'ios'); if (d) setDateStr(d.toISOString().slice(0, 10)); }} />}

        <Text style={[styles.label, { color: colors.textMuted }]}>العميل</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
          value={customerSearch}
          onChangeText={(text) => {
            setCustomerSearch(text);
            setShowCustomerPicker(true);
            if (customer && text !== customer.name) setCustomer(null);
          }}
          onFocus={() => setShowCustomerPicker(true)}
          onBlur={() => setTimeout(() => setShowCustomerPicker(false), 200)}
          placeholder="ابحث أو اكتب اسم العميل..."
          placeholderTextColor={colors.textMuted}
          textAlign="right"
        />
        {showCustomerPicker && (
          <ScrollView style={[styles.suggestBox, { maxHeight: 200, backgroundColor: colors.surface, borderColor: colors.border }]} nestedScrollEnabled keyboardShouldPersistTaps="always">
            {filteredCustomers.length === 0 ? (
              <Text style={{ padding: 10, textAlign: "right", color: colors.textMuted }}>لا توجد نتائج مطابقة</Text>
            ) : (
              filteredCustomers.map((c) => (
                <Pressable key={c.id} style={[styles.suggestItem, { borderBottomColor: colors.bg }]} onPress={() => { setCustomer(c); setCustomerSearch(c.name); setShowCustomerPicker(false); }}>
                  <Text style={[styles.suggestName, { color: colors.text }]}>{c.name}</Text>
                  <Text style={[styles.suggestMeta, { color: colors.textMuted }]}>{c.code} {c.phone ? `· ${c.phone}` : ""}</Text>
                </Pressable>
              ))
            )}
          </ScrollView>
        )}

        <Text style={[styles.label, { color: colors.textMuted }]}>العملة</Text>
        <Pressable style={[styles.picker, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => setShowCurrencyPicker((v) => !v)}><Text style={[styles.pickerText, { color: colors.text }]}>{currency ? `${currency.name} (${currency.code})` : "اختر العملة"}</Text><Text style={[styles.pickerArrow, { color: colors.textMuted }]}>▼</Text></Pressable>
        {showCurrencyPicker && (<ScrollView style={[styles.suggestBox, { maxHeight: 200, backgroundColor: colors.surface, borderColor: colors.border }]} nestedScrollEnabled keyboardShouldPersistTaps="always">{currencies.map((c) => (<Pressable key={c.id} style={[styles.suggestItem, { borderBottomColor: colors.bg }]} onPress={() => { setCurrency(c); setShowCurrencyPicker(false); }}><Text style={[styles.suggestName, { color: colors.text }]}>{c.name}</Text></Pressable>))}</ScrollView>)}

        <Text style={[styles.label, { color: colors.textMuted }]}>نوع الدفع</Text>
        <View style={{ flexDirection: "row-reverse", gap: 8 }}>
          <Pressable style={[styles.typeBtn, { backgroundColor: colors.surface, borderColor: colors.border }, paymentType === "cash" && { backgroundColor: colors.blue, borderColor: colors.blue }]} onPress={() => setPaymentType("cash")}><Text style={[styles.typeText, { color: colors.text }, paymentType === "cash" && { color: "#fff" }]}>نقدي</Text></Pressable>
          <Pressable style={[styles.typeBtn, { backgroundColor: colors.surface, borderColor: colors.border }, paymentType === "credit" && { backgroundColor: colors.blue, borderColor: colors.blue }]} onPress={() => setPaymentType("credit")}><Text style={[styles.typeText, { color: colors.text }, paymentType === "credit" && { color: "#fff" }]}>أجل</Text></Pressable>
        </View>

        {paymentType === "cash" && (
          <>
            <Text style={[styles.label, { color: colors.textMuted }]}>الصندوق المستلم</Text>
            <Pressable style={[styles.picker, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => setShowCashboxPicker((v) => !v)}><Text style={[styles.pickerText, { color: colors.text }]}>{cashbox ? cashbox.name : "اختر الصندوق"}</Text><Text style={[styles.pickerArrow, { color: colors.textMuted }]}>▼</Text></Pressable>
            {showCashboxPicker && (<ScrollView style={[styles.suggestBox, { maxHeight: 200, backgroundColor: colors.surface, borderColor: colors.border }]} nestedScrollEnabled keyboardShouldPersistTaps="always">{cashboxes.map((c) => (<Pressable key={c.id} style={[styles.suggestItem, { borderBottomColor: colors.bg }]} onPress={() => { setCashbox(c); setShowCashboxPicker(false); }}><Text style={[styles.suggestName, { color: colors.text }]}>{c.name}</Text></Pressable>))}</ScrollView>)}
          </>
        )}

        <Text style={[styles.sectionTitle, { color: colors.text }]}>المنتجات ({lines.length})</Text>
        <View style={styles.list}>
          {lines.map((l) => (
            <View key={l.key} style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.rowActions}><Pressable onPress={() => removeLine(l.key)} style={[styles.delBtn, { backgroundColor: colors.isDark ? "#7F1D1D" : "#fee2e2" }]}><Text style={styles.delText}>حذف</Text></Pressable></View>
              <View style={styles.rowInfo}><Text style={[styles.rowName, { color: colors.text }]}>{l.itemName}</Text><Text style={[styles.rowMeta, { color: colors.textMuted }]}>{l.quantity} × {l.unitPrice} = {(l.quantity * l.unitPrice).toFixed(2)}</Text></View>
            </View>
          ))}
        </View>

        <Pressable style={[styles.secondary, { backgroundColor: colors.blue, marginTop: 12 }]} onPress={() => setShowItemPicker(!showItemPicker)}><Text style={styles.secondaryText}>+ إضافة منتج</Text></Pressable>
        {showItemPicker && (
          <View style={[styles.addBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Pressable style={[styles.picker, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => setShowItemPicker(false)}><Text style={[styles.pickerText, { color: colors.text }]}>{pickItem ? pickItem.name : "اختر المنتج"}</Text></Pressable>
            <ScrollView style={[styles.suggestBox, { maxHeight: 200, backgroundColor: colors.surface, borderColor: colors.border }]} nestedScrollEnabled keyboardShouldPersistTaps="always">
              {items.map((i) => (<Pressable key={i.id} style={[styles.suggestItem, { borderBottomColor: colors.bg }]} onPress={() => { setPickItem(i); setShowItemPicker(false); setPickPrice(String(i.average_cost || 0)); }}><Text style={[styles.suggestName, { color: colors.text }]}>{i.name}</Text><Text style={[styles.suggestMeta, { color: colors.textMuted }]}>متوفر: {i.stock_quantity}</Text></Pressable>))}
            </ScrollView>
            <View style={styles.twoCols}>
              <View style={{ flex: 1 }}><Text style={[styles.label, { color: colors.textMuted }]}>الكمية</Text><TextInput style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]} value={pickQty} onChangeText={setPickQty} keyboardType="decimal-pad" textAlign="right" placeholder="0" /></View>
              <View style={{ flex: 1 }}><Text style={[styles.label, { color: colors.textMuted }]}>السعر</Text><TextInput style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]} value={pickPrice} onChangeText={setPickPrice} keyboardType="decimal-pad" textAlign="right" placeholder="0" /></View>
            </View>
            <Pressable style={[styles.primary, { backgroundColor: colors.orange, marginTop: 12 }]} onPress={addLine}><Text style={styles.primaryText}>إضافة للسلة</Text></Pressable>
          </View>
        )}

        <Text style={[styles.label, { color: colors.textMuted }]}>مندوب المبيعات (اختياري)</Text>
        <Pressable style={[styles.picker, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => setShowSalesRepPicker((v) => !v)}><Text style={[styles.pickerText, { color: colors.text }]}>{salesRep ? salesRep.name : "بدون مندوب"}</Text><Text style={[styles.pickerArrow, { color: colors.textMuted }]}>▼</Text></Pressable>
        {showSalesRepPicker && (<ScrollView style={[styles.suggestBox, { maxHeight: 200, backgroundColor: colors.surface, borderColor: colors.border }]} nestedScrollEnabled keyboardShouldPersistTaps="always"><Pressable style={[styles.suggestItem, { borderBottomColor: colors.bg }]} onPress={() => { setSalesRep(null); setShowSalesRepPicker(false); }}><Text style={[styles.suggestName, { color: colors.text }]}>بدون مندوب</Text></Pressable>{salesReps.map((r) => (<Pressable key={r.id} style={[styles.suggestItem, { borderBottomColor: colors.bg }]} onPress={() => { setSalesRep(r); setShowSalesRepPicker(false); }}><Text style={[styles.suggestName, { color: colors.text }]}>{r.name}</Text><Text style={[styles.suggestMeta, { color: colors.textMuted }]}>عمولة {r.commission_rate}%</Text></Pressable>))}</ScrollView>)}

        <Text style={[styles.label, { color: colors.textMuted }]}>الخصم (اختياري)</Text>
        <View style={styles.typeRow}>
          <Pressable style={[styles.typeBtn, { backgroundColor: colors.surface, borderColor: colors.border }, discountType === "percent" && { backgroundColor: colors.blue, borderColor: colors.blue }]} onPress={() => setDiscountType("percent")}><Text style={[styles.typeText, { color: colors.text }, discountType === "percent" && { color: "#fff" }]}>نسبة %</Text></Pressable>
          <Pressable style={[styles.typeBtn, { backgroundColor: colors.surface, borderColor: colors.border }, discountType === "fixed" && { backgroundColor: colors.blue, borderColor: colors.blue }]} onPress={() => setDiscountType("fixed")}><Text style={[styles.typeText, { color: colors.text }, discountType === "fixed" && { color: "#fff" }]}>مبلغ</Text></Pressable>
        </View>
        <TextInput style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]} value={discountValue} onChangeText={setDiscountValue} keyboardType="decimal-pad" textAlign="right" placeholder="0" />

        {discountAmount > 0 && (<View style={[styles.summaryBox, { backgroundColor: colors.isDark ? "#7F1D1D" : "#FEF2F2" }]}><View style={styles.summaryRow}><Text style={[styles.summaryLabel, { color: colors.textMuted }]}>الإجمالي الفرعي</Text><Text style={[styles.summaryValue, { color: colors.text }]}>{subtotal.toFixed(2)} {symbol}</Text></View><View style={styles.summaryRow}><Text style={[styles.summaryLabel, { color: colors.textMuted }]}>الخصم</Text><Text style={[styles.summaryValue, { color: colors.danger }]}>- {discountAmount.toFixed(2)} {symbol}</Text></View></View>)}

        <View style={[styles.totalBox, { backgroundColor: colors.isDark ? "#1E3A8A" : "#EFF6FF" }]}><Text style={[styles.totalLabel, { color: colors.blue }]}>الإجمالي النهائي</Text><Text style={[styles.totalValue, { color: colors.blue }]}>{total.toFixed(2)} {symbol}</Text></View>

        <Text style={[styles.label, { color: colors.textMuted }]}>ملاحظات (اختياري)</Text>
        <TextInput style={[styles.input, { minHeight: 60, backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]} value={notes} onChangeText={setNotes} textAlign="right" multiline placeholder="ملاحظات الفاتورة" />

        <Pressable style={[styles.primary, { marginTop: 16, backgroundColor: colors.orange }, (!canSave || saving) && styles.disabled]} onPress={save} disabled={!canSave || saving}><Text style={styles.primaryText}>{saving ? "جارٍ الحفظ..." : (editingId ? "تحديث الفاتورة" : "حفظ الفاتورة")}</Text></Pressable>
        {editingId && <Pressable style={[styles.cancel, { borderColor: colors.border }]} onPress={() => { setEditingId(null); setEditingNo(null); setCustomer(null); setCustomerSearch(""); setLines([]); setNotes(""); }}><Text style={[styles.cancelText, { color: colors.text }]}>إلغاء التعديل</Text></Pressable>}

        {history.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>آخر فواتير المبيعات</Text>
            <View style={styles.list}>
              {history.map((h) => (
                <View key={h.id} style={[styles.histRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <View style={styles.histActions}>
                    <Pressable onPress={() => setReturnInvoiceId(h.id)} style={[styles.iconBtn, { backgroundColor: colors.isDark ? "#1E3A8A" : "#EFF6FF" }]}><Text style={{ fontSize: 14 }}>↩️</Text></Pressable>
                    <Pressable onPress={() => printInvoiceById(h.id)} style={[styles.iconBtn, { backgroundColor: colors.isDark ? "#1E3A8A" : "#EFF6FF" }]}><Text style={{ fontSize: 14 }}>🖨️</Text></Pressable>
                    <Pressable onPress={() => editInvoice(h.id)} style={[styles.iconBtn, { backgroundColor: colors.isDark ? "#1E3A8A" : "#EFF6FF" }]}><Text style={{ fontSize: 14 }}>✏️</Text></Pressable>
                    <Pressable onPress={() => confirmDelete(h.id, h.invoice_no)} style={[styles.iconBtn, { backgroundColor: colors.isDark ? "#7F1D1D" : "#FEE2E2" }]}><Text style={{ fontSize: 14 }}>🗑️</Text></Pressable>
                  </View>
                  <View style={styles.histDetails}>
                    <Text style={[styles.histName, { color: colors.text }]}>{h.party_name}</Text>
                    <Text style={[styles.histMeta, { color: colors.blue }]}>{h.invoice_no}</Text>
                    <Text style={[styles.histDate, { color: colors.textMuted }]}>{new Date(h.created_at).toLocaleString("ar-EG")}</Text>
                    <Text style={[styles.histTotal, { color: colors.blue }]}>{Number(h.total).toFixed(2)} {h.currency_code}</Text>
                    <Text style={[styles.histType, { color: colors.textMuted }]}>{h.payment_type === "cash" ? "نقدي" : "أجل"}</Text>
                  </View>
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: { backgroundColor: "transparent", paddingHorizontal: 8, paddingTop: 16, paddingBottom: 40 },
  back: { paddingVertical: 10, marginBottom: 8, alignSelf: "flex-start" },
  backText: { fontWeight: "700", textAlign: "left" },
  screenTitle: { fontSize: 22, marginBottom: 12, alignSelf: "flex-start", textAlign: "left", width: "100%", fontFamily: "CodecBold" },
  sectionTitle: { fontSize: 16, marginTop: 16, marginBottom: 8, textAlign: "left", width: "100%", fontFamily: "CodecBold" },
  label: { fontSize: 12, marginTop: 8, marginBottom: 4, textAlign: "right", width: "100%" },
  input: { borderWidth: 1, borderRadius: 8, padding: 10, fontSize: 14, textAlign: "right", width: "100%" },
  picker: { borderWidth: 1, borderRadius: 8, padding: 12, flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center" },
  pickerText: { textAlign: "right", flex: 1, fontSize: 14 },
  pickerArrow: { fontSize: 12, marginLeft: 8 },
  suggestBox: { marginTop: 4, borderWidth: 1, borderRadius: 8, overflow: "hidden", maxHeight: 200 },
  suggestItem: { padding: 10, borderBottomWidth: 1 },
  suggestName: { fontWeight: "700", textAlign: "right", fontSize: 13 },
  suggestMeta: { fontSize: 11, textAlign: "right", marginTop: 2 },
  typeRow: { flexDirection: "row-reverse", gap: 8, marginBottom: 8 },
  typeBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 1, alignItems: "center" },
  typeText: { fontWeight: "700", fontSize: 13 },
  twoCols: { flexDirection: "row-reverse", gap: 8, marginTop: 8 },
  list: { gap: 8, marginTop: 4 },
  row: { borderWidth: 1, borderRadius: 10, padding: 10, flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between" },
  rowInfo: { flex: 1, alignItems: "flex-end" },
  rowName: { fontWeight: "700", fontSize: 14, textAlign: "right", width: "100%" },
  rowMeta: { fontSize: 11, marginTop: 3, textAlign: "right" },
  rowActions: { flexDirection: "row-reverse", gap: 6 },
  delBtn: { padding: 8, borderRadius: 7 },
  delText: { fontSize: 12 },
  addBox: { padding: 12, borderRadius: 10, marginTop: 8, borderWidth: 1 },
  summaryBox: { padding: 12, borderRadius: 10, marginTop: 12 },
  summaryRow: { flexDirection: "row-reverse", justifyContent: "space-between", paddingVertical: 4 },
  summaryLabel: { fontWeight: "600", fontSize: 13 },
  summaryValue: { fontWeight: "700", fontSize: 13 },
  totalBox: { marginTop: 16, padding: 14, borderRadius: 10, flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center" },
  totalLabel: { fontWeight: "700", fontSize: 14 },
  totalValue: { fontWeight: "800", fontSize: 18 },
  primary: { padding: 14, borderRadius: 10 },
  primaryText: { color: "#fff", fontWeight: "700", textAlign: "center" },
  secondary: { padding: 12, borderRadius: 8, marginTop: 8, alignItems: "center" },
  secondaryText: { color: "#fff", fontWeight: "700" },
  cancel: { borderWidth: 1, padding: 12, borderRadius: 10, marginTop: 8 },
  cancelText: { textAlign: "center", fontWeight: "700" },
  disabled: { opacity: 0.5 },
  histRow: { borderWidth: 1, borderRadius: 12, padding: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  histDetails: { flex: 1, alignItems: "flex-end", paddingLeft: 12 },
  histActions: { flexDirection: "row", gap: 6, alignItems: "center" },
  iconBtn: { paddingHorizontal: 8, paddingVertical: 8, borderRadius: 8, minWidth: 36, alignItems: "center" },
  histName: { fontWeight: "700", fontSize: 14, textAlign: "right" },
  histMeta: { fontSize: 11, marginTop: 2, textAlign: "right", fontWeight: "600" },
  histDate: { fontSize: 10, marginTop: 2, textAlign: "right" },
  histTotal: { fontWeight: "800", fontSize: 16, marginTop: 6, textAlign: "right" },
  histType: { fontSize: 11, marginTop: 2, textAlign: "right" },
});
