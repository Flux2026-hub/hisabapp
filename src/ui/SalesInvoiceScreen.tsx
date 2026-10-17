import { useEffect, useMemo, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { sqlite } from "../db/local";
import { buildInvoiceHtml, printHtml, shareHtmlAsPdf, type InvoicePrintData } from "../utils/printDocument";
import SalesReturnScreen from "./SalesReturnScreen";

const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

type Row = any;
type PaymentType = "cash" | "credit";
type InvoiceLine = { key: string; itemId: string; itemName: string; itemSku: string; available: number; unit: string; quantity: number; unitPrice: number; };

export default function SalesInv({ onBack }: { onBack: () => void }) {
  const [customers, setCustomers] = useState<Row[]>([]);
  const [currencies, setCurrencies] = useState<Row[]>([]);
  const [cashboxes, setCashboxes] = useState<Row[]>([]);
  const [items, setItems] = useState<Row[]>([]);
  const [salesReps, setSalesReps] = useState<Row[]>([]);

  const [customer, setCustomer] = useState<Row | null>(null);
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
        
        if (oldCustomer) setCustomer(oldCustomer);
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
        const last: any = await sqlite.getAllAsync(`SELECT invoice_no FROM invoices WHERE invoice_type = 'sales' AND invoice_no LIKE ? ORDER BY created_at DESC LIMIT 1`, [`${prefix}-%`]);
        let nextNum = 1; if (last && last.length > 0) nextNum = parseInt(String(last[0].invoice_no).replace(/\D/g, ""), 10) + 1;
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

      setCustomer(null); setLines([]); setNotes(""); setSalesRep(null); setDiscountValue(""); setDiscountType("percent"); setEditingId(null); setEditingNo(null); setDateStr(new Date().toISOString().slice(0, 10)); if (paymentType === "cash") setCashbox(null);
      await loadItems(); await loadHistory();
    } catch (e) { Alert.alert("تعذر الحفظ", String(e)); } finally { setSaving(false); }
  };

  if (returnInvoiceId) return <SalesReturnScreen invoiceId={returnInvoiceId} onBack={() => setReturnInvoiceId(null)} />;

  const symbol = currency?.symbol || currency?.code || "";

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets={true} contentContainerStyle={{ paddingBottom: 40, paddingHorizontal: 4 }}>
        <Pressable style={styles.back} onPress={onBack}><Text style={styles.backText}>{"->"} العودة</Text></Pressable>
        <Text style={styles.screenTitle}>{editingNo ? `تعديل الفاتورة ${editingNo}` : "فاتورة مبيعات جديدة"}</Text>

        <Text style={styles.label}>التاريخ</Text>
        <Pressable style={[styles.input, { justifyContent: "center", height: 42 }]} onPress={() => setShowDatePicker(true)}>
          <Text style={{ textAlign: "right", color: "#0F172A", fontSize: 14 }}>{dateStr}</Text>
        </Pressable>
        {showDatePicker && <DateTimePicker value={dateStr ? new Date(dateStr) : new Date()} mode="date" display="default" onChange={(e, d) => { setShowDatePicker(Platform.OS === 'ios'); if (d) setDateStr(d.toISOString().slice(0, 10)); }} />}

        <Text style={styles.label}>العميل</Text>
        <Pressable style={styles.picker} onPress={() => setShowCustomerPicker((v) => !v)}><Text style={styles.pickerText}>{customer ? customer.name : "اختر عميلاً"}</Text><Text style={styles.pickerArrow}>▼</Text></Pressable>
        {showCustomerPicker && (<View style={styles.suggestBox}>{customers.map((c) => (<Pressable key={c.id} style={styles.suggestItem} onPress={() => { setCustomer(c); setShowCustomerPicker(false); }}><Text style={styles.suggestName}>{c.name}</Text><Text style={styles.suggestMeta}>{c.code}</Text></Pressable>))}</View>)}

        <Text style={styles.label}>العملة</Text>
        <Pressable style={styles.picker} onPress={() => setShowCurrencyPicker((v) => !v)}><Text style={styles.pickerText}>{currency ? `${currency.name} (${currency.code})` : "اختر العملة"}</Text><Text style={styles.pickerArrow}>▼</Text></Pressable>
        {showCurrencyPicker && (<View style={styles.suggestBox}>{currencies.map((c) => (<Pressable key={c.id} style={styles.suggestItem} onPress={() => { setCurrency(c); setShowCurrencyPicker(false); }}><Text style={styles.suggestName}>{c.name}</Text></Pressable>))}</View>)}

        <Text style={styles.label}>نوع الدفع</Text>
        <View style={{ flexDirection: "row-reverse", gap: 8 }}>
          <Pressable style={[styles.typeBtn, paymentType === "cash" && styles.typeBtnActive]} onPress={() => setPaymentType("cash")}><Text style={[styles.typeText, paymentType === "cash" && styles.typeTextActive]}>نقدي</Text></Pressable>
          <Pressable style={[styles.typeBtn, paymentType === "credit" && styles.typeBtnActive]} onPress={() => setPaymentType("credit")}><Text style={[styles.typeText, paymentType === "credit" && styles.typeTextActive]}>أجل</Text></Pressable>
        </View>

        {paymentType === "cash" && (
          <>
            <Text style={styles.label}>الصندوق المستلم</Text>
            <Pressable style={styles.picker} onPress={() => setShowCashboxPicker((v) => !v)}><Text style={styles.pickerText}>{cashbox ? cashbox.name : "اختر الصندوق"}</Text><Text style={styles.pickerArrow}>▼</Text></Pressable>
            {showCashboxPicker && (<View style={styles.suggestBox}>{cashboxes.map((c) => (<Pressable key={c.id} style={styles.suggestItem} onPress={() => { setCashbox(c); setShowCashboxPicker(false); }}><Text style={styles.suggestName}>{c.name}</Text></Pressable>))}</View>)}
          </>
        )}

        <Text style={styles.sectionTitle}>المنتجات ({lines.length})</Text>
        <View style={styles.list}>
          {lines.map((l) => (
            <View key={l.key} style={styles.row}>
              <View style={styles.rowActions}><Pressable onPress={() => removeLine(l.key)} style={styles.delBtn}><Text style={styles.delText}>حذف</Text></Pressable></View>
              <View style={styles.rowInfo}><Text style={styles.rowName}>{l.itemName}</Text><Text style={styles.rowMeta}>{l.quantity} × {l.unitPrice} = {(l.quantity * l.unitPrice).toFixed(2)}</Text></View>
            </View>
          ))}
        </View>

        <Pressable style={styles.secondary} onPress={() => setShowItemPicker(!showItemPicker)}><Text style={styles.secondaryText}>+ إضافة منتج</Text></Pressable>
        {showItemPicker && (
          <View style={styles.addBox}>
            <Pressable style={styles.picker} onPress={() => setShowItemPicker(false)}><Text style={styles.pickerText}>{pickItem ? pickItem.name : "اختر المنتج"}</Text></Pressable>
            <View style={styles.suggestBox}>
              {items.map((i) => (<Pressable key={i.id} style={styles.suggestItem} onPress={() => { setPickItem(i); setShowItemPicker(false); setPickPrice(String(i.average_cost || 0)); }}><Text style={styles.suggestName}>{i.name}</Text><Text style={styles.suggestMeta}>متوفر: {i.stock_quantity}</Text></Pressable>))}
            </View>
            <View style={styles.twoCols}>
              <View style={{ flex: 1 }}><Text style={styles.label}>الكمية</Text><TextInput style={styles.input} value={pickQty} onChangeText={setPickQty} keyboardType="decimal-pad" textAlign="right" placeholder="0" /></View>
              <View style={{ flex: 1 }}><Text style={styles.label}>السعر</Text><TextInput style={styles.input} value={pickPrice} onChangeText={setPickPrice} keyboardType="decimal-pad" textAlign="right" placeholder="0" /></View>
            </View>
            <Pressable style={styles.primary} onPress={addLine}><Text style={styles.primaryText}>إضافة للسلة</Text></Pressable>
          </View>
        )}

        <Text style={styles.label}>مندوب المبيعات (اختياري)</Text>
        <Pressable style={styles.picker} onPress={() => setShowSalesRepPicker((v) => !v)}><Text style={styles.pickerText}>{salesRep ? salesRep.name : "بدون مندوب"}</Text><Text style={styles.pickerArrow}>▼</Text></Pressable>
        {showSalesRepPicker && (<View style={styles.suggestBox}><Pressable style={styles.suggestItem} onPress={() => { setSalesRep(null); setShowSalesRepPicker(false); }}><Text style={styles.suggestName}>بدون مندوب</Text></Pressable>{salesReps.map((r) => (<Pressable key={r.id} style={styles.suggestItem} onPress={() => { setSalesRep(r); setShowSalesRepPicker(false); }}><Text style={styles.suggestName}>{r.name}</Text><Text style={styles.suggestMeta}>عمولة {r.commission_rate}%</Text></Pressable>))}</View>)}

        <Text style={styles.label}>الخصم (اختياري)</Text>
        <View style={styles.typeRow}>
          <Pressable style={[styles.typeBtn, discountType === "percent" && styles.typeBtnActive]} onPress={() => setDiscountType("percent")}><Text style={[styles.typeText, discountType === "percent" && styles.typeTextActive]}>نسبة %</Text></Pressable>
          <Pressable style={[styles.typeBtn, discountType === "fixed" && styles.typeBtnActive]} onPress={() => setDiscountType("fixed")}><Text style={[styles.typeText, discountType === "fixed" && styles.typeTextActive]}>مبلغ</Text></Pressable>
        </View>
        <TextInput style={styles.input} value={discountValue} onChangeText={setDiscountValue} keyboardType="decimal-pad" textAlign="right" placeholder="0" />

        {discountAmount > 0 && (<View style={styles.summaryBox}><View style={styles.summaryRow}><Text style={styles.summaryLabel}>الإجمالي الفرعي</Text><Text style={styles.summaryValue}>{subtotal.toFixed(2)} {symbol}</Text></View><View style={styles.summaryRow}><Text style={styles.summaryLabel}>الخصم</Text><Text style={[styles.summaryValue, { color: "#DC2626" }]}>- {discountAmount.toFixed(2)} {symbol}</Text></View></View>)}

        <View style={styles.totalBox}><Text style={styles.totalLabel}>الإجمالي النهائي</Text><Text style={styles.totalValue}>{total.toFixed(2)} {symbol}</Text></View>

        <Text style={styles.label}>ملاحظات (اختياري)</Text>
        <TextInput style={[styles.input, { minHeight: 60 }]} value={notes} onChangeText={setNotes} textAlign="right" multiline placeholder="ملاحظات الفاتورة" />

        <Pressable style={[styles.primary, { marginTop: 16 }, (!canSave || saving) && styles.disabled]} onPress={save} disabled={!canSave || saving}><Text style={styles.primaryText}>{saving ? "جارٍ الحفظ..." : (editingId ? "تحديث الفاتورة" : "حفظ الفاتورة")}</Text></Pressable>
        {editingId && <Pressable style={styles.cancel} onPress={() => { setEditingId(null); setEditingNo(null); setCustomer(null); setLines([]); setNotes(""); }}><Text style={styles.cancelText}>إلغاء التعديل</Text></Pressable>}

        {history.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>آخر فواتير المبيعات</Text>
            <View style={styles.list}>
              {history.map((h) => (
                <View key={h.id} style={styles.histRow}>
                  <View style={{ flexDirection: "row-reverse", gap: 4 }}>
                    <Pressable onPress={() => setReturnInvoiceId(h.id)} style={styles.iconBtn}><Text style={{ fontSize: 14 }}>↩️</Text></Pressable>
                    <Pressable onPress={() => printInvoiceById(h.id)} style={styles.iconBtn}><Text style={{ fontSize: 14 }}>🖨️</Text></Pressable>
                    <Pressable onPress={() => editInvoice(h.id)} style={styles.iconBtn}><Text style={{ fontSize: 14 }}>✏️</Text></Pressable>
                    <Pressable onPress={() => confirmDelete(h.id, h.invoice_no)} style={styles.iconBtn}><Text style={{ fontSize: 14 }}>🗑️</Text></Pressable>
                  </View>
                  <View style={styles.histRight}><Text style={styles.histTotal}>{Number(h.total).toFixed(2)} {h.currency_code}</Text><Text style={styles.histType}>{h.payment_type === "cash" ? "نقدي" : "أجل"}</Text></View>
                  <View style={styles.histInfo}><Text style={styles.histName}>{h.party_name}</Text><Text style={styles.histMeta}>{h.invoice_no}</Text><Text style={styles.histDate}>{new Date(h.created_at).toLocaleString("ar-EG")}</Text></View>
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
  back: { paddingVertical: 10, marginBottom: 8, alignSelf: "flex-end" },
  backText: { color: "#1E40AF", fontWeight: "700", textAlign: "right" },
  screenTitle: {fontSize: 22,  color: "#0F172A", textAlign: "right", marginBottom: 12, fontFamily: "CodecBold"},
  label: { fontSize: 12, color: "#526078", textAlign: "right", marginTop: 8, marginBottom: 4 },
  input: { backgroundColor: "#f8fafc", borderWidth: 1, borderColor: "#D6E3F8", borderRadius: 8, padding: 10, fontSize: 14, color: "#0F172A" },
  picker: { backgroundColor: "#f8fafc", borderWidth: 1, borderColor: "#D6E3F8", borderRadius: 8, padding: 12, flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center" },
  pickerText: { color: "#0F172A", textAlign: "right", flex: 1, fontSize: 14 },
  pickerArrow: { color: "#8494B0", fontSize: 12, marginLeft: 8 },
  suggestBox: { marginTop: 4, backgroundColor: "#ffffff", borderWidth: 1, borderColor: "#D6E3F8", borderRadius: 8, overflow: "hidden", maxHeight: 200 },
  suggestItem: { padding: 10, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  suggestName: { fontWeight: "700", color: "#0F172A", textAlign: "right", fontSize: 13 },
  suggestMeta: { fontSize: 11, color: "#8494B0", textAlign: "right", marginTop: 2 },
  typeRow: { flexDirection: "row-reverse", gap: 8, marginBottom: 8 },
  typeBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: "#D6E3F8", backgroundColor: "#fff", alignItems: "center" },
  typeBtnActive: { backgroundColor: "#1E40AF", borderColor: "#1E40AF" },
  typeText: { color: "#0F172A", fontWeight: "700", fontSize: 13 },
  typeTextActive: { color: "#fff" },
  twoCols: { flexDirection: "row-reverse", gap: 8, marginTop: 8 },
  sectionTitle: {fontSize: 16,  color: "#0F172A", textAlign: "right", marginTop: 16, marginBottom: 8 , fontFamily: "CodecBold"},
  list: { gap: 8, marginTop: 4 },
  row: { backgroundColor: "#f8fafc", borderWidth: 1, borderColor: "#D6E3F8", borderRadius: 10, padding: 10, flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between" },
  rowInfo: { flex: 1, alignItems: "flex-end" },
  rowName: { fontWeight: "700", fontSize: 14, color: "#0F172A", textAlign: "right" },
  rowMeta: { fontSize: 11, color: "#8494B0", marginTop: 3, textAlign: "right" },
  rowActions: { flexDirection: "row-reverse", gap: 6 },
  delBtn: { backgroundColor: "#fee2e2", padding: 8, borderRadius: 7 },
  delText: { color: "#991b1b", fontSize: 12 },
  addBox: { backgroundColor: "#F8FAFC", padding: 12, borderRadius: 10, marginTop: 8, borderWidth: 1, borderColor: "#D6E3F8" },
  summaryBox: { backgroundColor: "#FEF2F2", padding: 12, borderRadius: 10, marginTop: 12 },
  summaryRow: { flexDirection: "row-reverse", justifyContent: "space-between", paddingVertical: 4 },
  summaryLabel: { color: "#7F1D1D", fontWeight: "600", fontSize: 13 },
  summaryValue: { color: "#0F172A", fontWeight: "700", fontSize: 13 },
  totalBox: { marginTop: 16, backgroundColor: "#EFF6FF", padding: 14, borderRadius: 10, flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center" },
  totalLabel: { color: "#1E40AF", fontWeight: "700", fontSize: 14 },
  totalValue: { color: "#1E40AF", fontWeight: "800", fontSize: 18 },
  primary: { backgroundColor: "#F97316", padding: 14, borderRadius: 10 },
  primaryText: { color: "#fff", fontWeight: "700", textAlign: "center" },
  secondary: { backgroundColor: "#1E40AF", padding: 12, borderRadius: 8, marginTop: 8, alignItems: "center" },
  secondaryText: { color: "#fff", fontWeight: "700" },
  cancel: { borderWidth: 1, borderColor: "#d1d5db", padding: 12, borderRadius: 10, marginTop: 8 },
  cancelText: { color: "#0F172A", textAlign: "center", fontWeight: "700" },
  disabled: { opacity: 0.5 },
  histRow: { backgroundColor: "#f8fafc", borderWidth: 1, borderColor: "#D6E3F8", borderRadius: 10, padding: 10, flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between" },
  histInfo: { flex: 1, alignItems: "flex-end" },
  histRight: { alignItems: "flex-end", paddingRight: 8 },
  histName: { fontWeight: "700", color: "#0F172A", textAlign: "right" },
  histMeta: { fontSize: 11, color: "#1E40AF", marginTop: 2, textAlign: "right", fontWeight: "600" },
  histDate: { fontSize: 10, color: "#8494B0", marginTop: 2, textAlign: "right" },
  histTotal: { fontWeight: "800", fontSize: 15, color: "#1E40AF" },
  histType: { fontSize: 11, color: "#8494B0", marginTop: 2 },
  iconBtn: { backgroundColor: "#EFF6FF", paddingHorizontal: 8, paddingVertical: 8, borderRadius: 6 },
});
