import { useEffect, useMemo, useState } from "react";
import {
  Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from "react-native";
import { sqlite } from "../db/local";
import PurchaseReturnScreen from "./PurchaseReturnScreen";
import DateTimePicker from "@react-native-community/datetimepicker";
import {
  buildInvoiceHtml, printHtml, shareHtmlAsPdf,
  type InvoicePrintData,
} from "../utils/printDocument";

type Row = any;
type PaymentType = "cash" | "credit";

type InvoiceLine = {
  key: string;
  itemId: string;
  itemName: string;
  itemSku: string;
  unit: string;
  quantity: number;
  unitPrice: number;
};

const newId = () =>
  `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export default function PurchaseInv({ onBack }: { onBack: () => void }) {
  const [suppliers, setSuppliers] = useState<Row[]>([]);
  const [currencies, setCurrencies] = useState<Row[]>([]);
  const [cashboxes, setCashboxes] = useState<Row[]>([]);
  const [items, setItems] = useState<Row[]>([]);

  const [supplier, setSupplier] = useState<Row | null>(null);
  const [currency, setCurrency] = useState<Row | null>(null);
  const [paymentType, setPaymentType] = useState<PaymentType>("cash");
  const [cashbox, setCashbox] = useState<Row | null>(null);
  const [notes, setNotes] = useState("");

  const [lines, setLines] = useState<InvoiceLine[]>([]);
  const [pickItem, setPickItem] = useState<Row | null>(null);
  const [pickQty, setPickQty] = useState("");
  const [pickPrice, setPickPrice] = useState("");

  const [showSupplierPicker, setShowSupplierPicker] = useState(false);
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  const [showCashboxPicker, setShowCashboxPicker] = useState(false);
  const [showItemPicker, setShowItemPicker] = useState(false);

  const [saving, setSaving] = useState(false);
  const [returnInvoiceId, setReturnInvoiceId] = useState<string | null>(null);
  const [history, setHistory] = useState<Row[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const s: any = await sqlite.getAllAsync(
          "SELECT id, code, name, phone, balance FROM suppliers ORDER BY name"
        );
        const cur: any = await sqlite.getAllAsync(
          "SELECT id, code, name, symbol, exchange_rate, is_base FROM currencies ORDER BY is_base DESC, code"
        );
        const cb: any = await sqlite.getAllAsync(
          "SELECT id, code, name, balance FROM cashboxes ORDER BY name"
        );
        setSuppliers(s || []);
        setCashboxes(cb || []);

        const normalizedCurrencies = (cur || []).map((x: any) => ({
          id: x.id,
          code: x.code,
          name: x.name,
          symbol: x.symbol,
          exchangeRate: Number(x.exchange_rate ?? x.exchangeRate ?? 1) || 1,
          isBase: !!(x.is_base ?? x.isBase),
        }));
        setCurrencies(normalizedCurrencies);

        const baseCur = normalizedCurrencies.find((x: any) => x.isBase);
        if (baseCur) setCurrency(baseCur);

        await loadItems();
        await loadHistory();
      } catch (e) {
        Alert.alert("تعذر التحميل", String(e));
      }
    })();
  }, []);

  const loadItems = async () => {
    const rows: any = await sqlite.getAllAsync(
      "SELECT id, sku, name, unit, stock_quantity, average_cost FROM items WHERE item_type IN ('raw_material','production_material','packaging') ORDER BY name"
    );
    setItems(rows || []);
  };

  const loadHistory = async () => {
    try {
      const rows: any = await sqlite.getAllAsync(
        `SELECT id, invoice_no, party_name, total, currency_code, payment_type, created_at
         FROM invoices WHERE invoice_type = 'purchase'
         ORDER BY created_at DESC LIMIT 10`
      );
      setHistory(rows || []);
    } catch {}
  };

  const addLine = () => {
    if (!pickItem) return Alert.alert("تنبيه", "اختر المادة/العبوة");
    const qty = Number(pickQty);
    const price = Number(pickPrice);
    if (!qty || qty <= 0) return Alert.alert("تنبيه", "أدخل كمية صحيحة");
    if (price < 0 || Number.isNaN(price)) return Alert.alert("تنبيه", "أدخل سعراً صحيحاً");

    setLines([
      ...lines,
      {
        key: newId(),
        itemId: pickItem.id,
        itemName: pickItem.name,
        itemSku: pickItem.sku,
        unit: pickItem.unit,
        quantity: qty,
        unitPrice: price,
      },
    ]);
    setPickItem(null);
    setPickQty("");
    setPickPrice("");
    setShowItemPicker(false);
  };

  const removeLine = (key: string) =>
    setLines(lines.filter((l) => l.key !== key));

  const total = useMemo(
    () => lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0),
    [lines]
  );

  const canSave =
    !!supplier &&
    !!currency &&
    lines.length > 0 &&
    (paymentType === "credit" || !!cashbox) &&
    !saving;

  const buildCurrentInvoiceData = (invoiceNo: string): InvoicePrintData | null => {
    if (!supplier || !currency) return null;
    const rate = Number(currency.exchangeRate) || 1;
    return {
      type: "purchase",
      invoiceNo,
      createdAt: Date.now(),
      partyLabel: "المورد",
      partyName: supplier.name,
      partyPhone: supplier.phone || undefined,
      currencyCode: currency.code,
      currencySymbol: currency.symbol || currency.code,
      exchangeRate: rate,
      isBase: !!currency.isBase,
      paymentType,
      cashboxName: cashbox?.name,
      lines: lines.map((l) => ({
        itemName: l.itemName,
        itemSku: l.itemSku,
        unit: l.unit,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
      })),
      total,
      notes: notes.trim() || undefined,
    };
  };

  const printInvoiceById = async (invoiceId: string) => {
    try {
      const inv: any = await sqlite.getFirstAsync(
        "SELECT * FROM invoices WHERE id = ?",
        [invoiceId]
      );
      if (!inv) return Alert.alert("خطأ", "الفاتورة غير موجودة");

      const invLines: any = await sqlite.getAllAsync(
        `SELECT l.*, i.name as item_name, i.sku as item_sku, i.unit as item_unit
         FROM invoice_lines l
         LEFT JOIN items i ON i.id = l.item_id
         WHERE l.invoice_id = ?`,
        [invoiceId]
      );

      const cur: any = await sqlite.getFirstAsync(
        "SELECT * FROM currencies WHERE code = ?",
        [inv.currency_code || ""]
      );

      let cashboxName: string | undefined;
      if (inv.cashbox_id) {
        const cb: any = await sqlite.getFirstAsync(
          "SELECT name FROM cashboxes WHERE id = ?",
          [inv.cashbox_id]
        );
        cashboxName = cb?.name;
      }

      const data: InvoicePrintData = {
        type: "purchase",
        invoiceNo: inv.invoice_no,
        createdAt: inv.created_at,
        partyLabel: "المورد",
        partyName: inv.party_name || "",
        currencyCode: inv.currency_code || "YER",
        currencySymbol: cur?.symbol || inv.currency_code || "YER",
        exchangeRate: Number(inv.exchange_rate) || 1,
        isBase: !!(cur?.is_base ?? cur?.isBase),
        paymentType: (inv.payment_type as "cash" | "credit") || "cash",
        cashboxName,
        lines: (invLines || []).map((l: any) => ({
          itemName: l.item_name || l.description || "—",
          itemSku: l.item_sku || "",
          unit: l.item_unit || "",
          quantity: Number(l.quantity) || 0,
          unitPrice: Number(l.unit_price) || 0,
        })),
        total: Number(inv.total) || 0,
      };

      const html = await buildInvoiceHtml(data);
      await printHtml(html);
    } catch (e) {
      Alert.alert("تعذر الطباعة", String(e));
    }
  };

  const deleteInvoice = async (invoiceId: string) => {
    try {
      const inv: any = await sqlite.getFirstAsync(
        "SELECT * FROM invoices WHERE id = ?",
        [invoiceId]
      );
      if (!inv) return Alert.alert("خطأ", "الفاتورة غير موجودة");

      const invLines: any = await sqlite.getAllAsync(
        "SELECT * FROM invoice_lines WHERE invoice_id = ?",
        [invoiceId]
      );

      const now = Date.now();
      const rate = Number(inv.exchange_rate) || 1;

      const cur: any = await sqlite.getFirstAsync(
        "SELECT is_base FROM currencies WHERE code = ?",
        [inv.currency_code || "YER"]
      );
      const isBaseReal = !!(cur?.is_base ?? cur?.isBase);
      const baseAmount = isBaseReal
        ? Number(inv.total)
        : Number(inv.total) * rate;

      for (const l of invLines || []) {
        await sqlite.runAsync(
          "UPDATE items SET stock_quantity = stock_quantity - ?, updated_at = ? WHERE id = ?",
          [Number(l.quantity), now, l.item_id]
        );
      }

      await sqlite.runAsync(
        "DELETE FROM stock_movements WHERE source_type = 'purchase_invoice' AND source_id = ?",
        [invoiceId]
      );

      if (inv.payment_type === "credit" && inv.party_id) {
        await sqlite.runAsync(
          "UPDATE suppliers SET balance = balance - ? WHERE id = ?",
          [baseAmount, inv.party_id]
        );
      }

      if (inv.payment_type === "cash" && inv.cashbox_id) {
        await sqlite.runAsync(
          "UPDATE cashboxes SET balance = balance + ? WHERE id = ?",
          [baseAmount, inv.cashbox_id]
        );
      }

      await sqlite.runAsync(
        "DELETE FROM invoice_lines WHERE invoice_id = ?",
        [invoiceId]
      );
      await sqlite.runAsync("DELETE FROM invoices WHERE id = ?", [invoiceId]);

      Alert.alert("تم الحذف", "تم حذف الفاتورة وعكس تأثيراتها");
      await loadItems();
      await loadHistory();
    } catch (e) {
      Alert.alert("تعذر الحذف", String(e));
    }
  };

  const confirmDelete = (invoiceId: string, invoiceNo: string) => {
    Alert.alert(
      "تأكيد الحذف",
      `هل تريد حذف الفاتورة ${invoiceNo}؟\n\nسيتم:\n• خصم المخزون\n• عكس رصيد المورد/الصندوق\n• حذف السجلات المرتبطة`,
      [
        { text: "إلغاء", style: "cancel" },
        {
          text: "حذف",
          style: "destructive",
          onPress: () => deleteInvoice(invoiceId),
        },
      ]
    );
  };

  const editInvoice = async (invoiceId: string) => {
    Alert.alert(
      "تعديل الفاتورة",
      "سيتم حذف الفاتورة الحالية وفتح نموذج جديد بنفس البيانات للتعديل.\n\nمتابعة؟",
      [
        { text: "إلغاء", style: "cancel" },
        {
          text: "متابعة",
          onPress: async () => {
            try {
              const inv: any = await sqlite.getFirstAsync(
                "SELECT * FROM invoices WHERE id = ?",
                [invoiceId]
              );
              if (!inv) return;

              const invLines: any = await sqlite.getAllAsync(
                `SELECT l.*, i.name as item_name, i.sku as item_sku, i.unit as item_unit
                 FROM invoice_lines l
                 LEFT JOIN items i ON i.id = l.item_id
                 WHERE l.invoice_id = ?`,
                [invoiceId]
              );

              const oldSupplier = suppliers.find((s) => s.id === inv.party_id);
              const oldCurrency = currencies.find((c) => c.code === inv.currency_code);
              const oldCashbox = cashboxes.find((c) => c.id === inv.cashbox_id);
              const oldPaymentType = (inv.payment_type as PaymentType) || "cash";

              await deleteInvoice(invoiceId);

              if (oldSupplier) setSupplier(oldSupplier);
              if (oldCurrency) setCurrency(oldCurrency);
              if (oldCashbox) setCashbox(oldCashbox);
              setPaymentType(oldPaymentType);

              setLines(
                (invLines || []).map((l: any) => ({
                  key: newId(),
                  itemId: l.item_id,
                  itemName: l.item_name || l.description || "—",
                  itemSku: l.item_sku || "",
                  unit: l.item_unit || "",
                  quantity: Number(l.quantity),
                  unitPrice: Number(l.unit_price),
                }))
              );

              await loadItems();
              Alert.alert(
                "تم التحميل",
                "الفاتورة جاهزة للتعديل — أكمل ثم احفظ كفاتورة جديدة"
              );
            } catch (e) {
              Alert.alert("تعذر التعديل", String(e));
            }
          },
        },
      ]
    );
  };

  const save = () => {
    if (!canSave || !supplier || !currency) return;
    const symbol = currency.symbol || currency.code;
    Alert.alert(
      "تأكيد الحفظ",
      `فاتورة مشتريات بمبلغ ${total.toFixed(2)} ${symbol}\n` +
        `المورد: ${supplier.name}\n` +
        `الدفع: ${paymentType === "cash" ? "نقدي" : "أجل"}`,
      [
        { text: "إلغاء", style: "cancel" },
        { text: "حفظ", onPress: doSave },
      ]
    );
  };

  const doSave = async () => {
    if (!supplier || !currency) return;
    setSaving(true);
    try {
      const now = Date.now();
      const invoiceId = newId();
      const prefix = "PUR";
      const last: any = await sqlite.getAllAsync(
        `SELECT invoice_no FROM invoices WHERE invoice_type = 'purchase' AND invoice_no LIKE ?
         ORDER BY created_at DESC LIMIT 1`,
        [`${prefix}-%`]
      );
      let nextNum = 1;
      if (last && last.length > 0) {
        nextNum = parseInt(String(last[0].invoice_no).replace(/\D/g, ""), 10) + 1;
      }
      const invoiceNo = `${prefix}-${String(nextNum).padStart(3, "0")}`;

      const rate = Number(currency.exchangeRate) || 1;
      const isBase = !!currency.isBase;
      const baseAmount = isBase ? total : total * rate;

      await sqlite.runAsync(
        `INSERT INTO invoices
         (id, invoice_no, invoice_type, party_id, party_name, status,
          subtotal, tax, total, created_at,
          currency_code, exchange_rate, payment_type, cashbox_id)
         VALUES (?, ?, 'purchase', ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?)`,
        [
          invoiceId, invoiceNo, supplier.id, supplier.name,
          paymentType === "cash" ? "paid" : "posted",
          total, total, now,
          currency.code, rate, paymentType,
          paymentType === "cash" && cashbox ? cashbox.id : null,
        ]
      );

      for (const l of lines) {
        await sqlite.runAsync(
          `INSERT INTO invoice_lines
           (id, invoice_id, item_id, description, quantity, unit_price, line_total)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [newId(), invoiceId, l.itemId, l.itemName, l.quantity, l.unitPrice, l.quantity * l.unitPrice]
        );

        await sqlite.runAsync(
          "UPDATE items SET stock_quantity = stock_quantity + ?, average_cost = ?, updated_at = ? WHERE id = ?",
          [l.quantity, l.unitPrice, now, l.itemId]
        );

        await sqlite.runAsync(
          `INSERT INTO stock_movements
           (id, source_type, source_id, item_id, warehouse_id, movement_type,
            quantity_in, quantity_out, planned_quantity, waste_quantity,
            unit_cost, created_at)
           VALUES (?, 'purchase_invoice', ?, ?, 'wh-wip', 'purchase_in',
                   ?, 0, 0, 0, ?, ?)`,
          [newId(), invoiceId, l.itemId, l.quantity, l.unitPrice, now]
        );
      }

      if (paymentType === "credit") {
        await sqlite.runAsync(
          "UPDATE suppliers SET balance = balance + ? WHERE id = ?",
          [baseAmount, supplier.id]
        );
      } else if (cashbox) {
        await sqlite.runAsync(
          "UPDATE cashboxes SET balance = balance - ? WHERE id = ?",
          [baseAmount, cashbox.id]
        );
      }

      const currentData = buildCurrentInvoiceData(invoiceNo);
      Alert.alert(
        "تم الحفظ بنجاح",
        `رقم الفاتورة: ${invoiceNo}\n\nهل تريد طباعة الفاتورة؟`,
        [
          { text: "لاحقاً", style: "cancel" },
          {
            text: "طباعة",
            onPress: async () => {
              if (currentData) printHtml(await buildInvoiceHtml(currentData));
            },
          },
          {
            text: "مشاركة PDF",
            onPress: async () => {
              if (currentData)
                shareHtmlAsPdf(await buildInvoiceHtml(currentData), `فاتورة-شراء-${invoiceNo}.pdf`);
            },
          },
        ]
      );

      setSupplier(null);
      setLines([]);
      setNotes("");
      if (paymentType === "cash") setCashbox(null);

      await loadItems();
      await loadHistory();
    } catch (e) {
      Alert.alert("تعذر الحفظ", String(e));
    } finally {
      setSaving(false);
    }
  };

  const symbol = currency?.symbol || currency?.code || "";

  if (returnInvoiceId) return <PurchaseReturnScreen invoiceId={returnInvoiceId} onBack={() => setReturnInvoiceId(null)} />;


  const showRowOptions = (id: string, no: string) => {
    Alert.alert(`الفاتورة ${no}`, "اختر الإجراء المطلوب:", [
      { text: "طباعة", onPress: () => printInvoiceById(id) },
      { text: "تعديل", onPress: () => editInvoice(id) },
      { text: "إرجاع", onPress: () => setReturnInvoiceId(id) },
      { text: "حذف", style: "destructive", onPress: () => confirmDelete(id, no) },
      { text: "إلغاء", style: "cancel" },
    ]);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets={true} contentContainerStyle={{ paddingBottom: 40, paddingHorizontal: 4 }}>
        <Pressable style={styles.back} onPress={onBack}>
          <Text style={styles.backText}>العودة -> إلى الوحدات المحاسبية</Text>
        </Pressable>

        <Text style={styles.screenTitle}>فاتورة مشتريات جديدة</Text>
        <Text style={styles.hint}>
          تُسجَّل من الموردين، وتضيف إلى مخزون تحت الإنتاج (مواد خام وعبوات).
        </Text>

        <Text style={styles.label}>المورد</Text>
        <Pressable style={styles.picker} onPress={() => setShowSupplierPicker((v) => !v)}>
          <Text style={styles.pickerText}>{supplier ? supplier.name : "اختر مورداً"}</Text>
          <Text style={styles.pickerArrow}>▼</Text>
        </Pressable>
        {showSupplierPicker && (
          <View style={styles.suggestBox}>
            {suppliers.length === 0 ? (
              <Text style={styles.suggestEmpty}>لا يوجد موردون — أضفهم من شاشة الموردين</Text>
            ) : (
              suppliers.map((s) => (
                <Pressable key={s.id} style={styles.suggestItem} onPress={async () => { setSupplier(s); setShowSupplierPicker(false); }}>
                  <Text style={styles.suggestName}>{s.name}</Text>
                  <Text style={styles.suggestMeta}>{s.code} · {s.phone || ""}</Text>
                </Pressable>
              ))
            )}
          </View>
        )}

        <Text style={styles.label}>العملة</Text>
        <Pressable style={styles.picker} onPress={() => setShowCurrencyPicker((v) => !v)}>
          <Text style={styles.pickerText}>
            {currency
              ? `${currency.name} (${currency.symbol})${currency.isBase ? " — أساسية" : ` — 1 = ${Number(currency.exchangeRate).toFixed(2)} YER`}`
              : "اختر عملة"}
          </Text>
          <Text style={styles.pickerArrow}>▼</Text>
        </Pressable>
        {showCurrencyPicker && (
          <View style={styles.suggestBox}>
            {currencies.map((c) => (
              <Pressable
                key={c.id}
                style={styles.suggestItem}
                onPress={async () => { setCurrency(c); setShowCurrencyPicker(false); }}
              >
                <Text style={styles.suggestName}>{c.name} ({c.symbol})</Text>
                <Text style={styles.suggestMeta}>
                  {c.code}{c.isBase ? " · أساسية" : ` · 1 = ${Number(c.exchangeRate).toFixed(2)} YER`}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        <Text style={styles.label}>نوع الدفع</Text>
        <View style={styles.toggleRow}>
          <Pressable
            style={[styles.toggleBtn, paymentType === "cash" && styles.toggleActive]}
            onPress={() => setPaymentType("cash")}
          >
            <Text style={[styles.toggleText, paymentType === "cash" && styles.toggleTextActive]}>نقدي</Text>
          </Pressable>
          <Pressable
            style={[styles.toggleBtn, paymentType === "credit" && styles.toggleActive]}
            onPress={() => setPaymentType("credit")}
          >
            <Text style={[styles.toggleText, paymentType === "credit" && styles.toggleTextActive]}>أجل</Text>
          </Pressable>
        </View>

        {paymentType === "cash" && (
          <>
            <Text style={styles.label}>الصندوق المدفوع منه</Text>
            <Pressable style={styles.picker} onPress={() => setShowCashboxPicker((v) => !v)}>
              <Text style={styles.pickerText}>{cashbox ? cashbox.name : "اختر الصندوق"}</Text>
              <Text style={styles.pickerArrow}>▼</Text>
            </Pressable>
            {showCashboxPicker && (
              <View style={styles.suggestBox}>
                {cashboxes.length === 0 ? (
                  <Text style={styles.suggestEmpty}>لا توجد صناديق</Text>
                ) : (
                  cashboxes.map((c) => (
                    <Pressable key={c.id} style={styles.suggestItem} onPress={async () => { setCashbox(c); setShowCashboxPicker(false); }}>
                      <Text style={styles.suggestName}>{c.name}</Text>
                      <Text style={styles.suggestMeta}>{c.code} · الرصيد: {Number(c.balance || 0).toFixed(2)}</Text>
                    </Pressable>
                  ))
                )}
              </View>
            )}
          </>
        )}

        <Text style={styles.sectionTitle}>المواد والعبوات ({lines.length})</Text>
        <View style={styles.list}>
          {lines.length === 0 ? (
            <Text style={styles.empty}>لا توجد مواد بعد</Text>
          ) : (
            lines.map((l) => (
              <View key={l.key} style={styles.row}>
                <View style={styles.rowActions}>
                  <Pressable onPress={() => removeLine(l.key)} style={styles.delBtn}>
                    <Text style={styles.delText}>حذف</Text>
                  </Pressable>
                </View>
                <View style={styles.rowInfo}>
                  <Text style={styles.rowName}>{l.itemName}</Text>
                  <Text style={styles.rowMeta}>{l.itemSku}</Text>
                  <Text style={styles.rowQty}>
                    {l.quantity} {l.unit} × {l.unitPrice.toFixed(2)} {symbol}
                  </Text>
                  <Text style={styles.rowTotal}>
                    الإجمالي: {(l.quantity * l.unitPrice).toFixed(2)} {symbol}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>

        <Text style={styles.sectionTitle}>إضافة مادة / عبوة</Text>
        <Pressable style={styles.picker} onPress={() => setShowItemPicker((v) => !v)}>
          <Text style={styles.pickerText}>{pickItem ? pickItem.name : "اختر من الأصناف"}</Text>
          <Text style={styles.pickerArrow}>▼</Text>
        </Pressable>
        {showItemPicker && (
          <View style={styles.suggestBox}>
            {items.length === 0 ? (
              <Text style={styles.suggestEmpty}>لا توجد مواد — أضفها من شاشة الأصناف</Text>
            ) : (
              items.map((it) => (
                <Pressable
                  key={it.id}
                  style={styles.suggestItem}
                  onPress={async () => {
                    setPickItem(it);
                    setPickPrice(String(it.average_cost ?? ""));
                    setShowItemPicker(false);
                  }}
                >
                  <Text style={styles.suggestName}>{it.name}</Text>
                  <Text style={styles.suggestMeta}>{it.sku} · {it.unit}</Text>
                </Pressable>
              ))
            )}
          </View>
        )}

        <Text style={styles.label}>الكمية</Text>
        <TextInput
          style={styles.input}
          value={pickQty}
          onChangeText={setPickQty}
          keyboardType="decimal-pad"
          textAlign="right"
          placeholder="0"
          placeholderTextColor="#9CA3AF"
        />

        <Text style={styles.label}>سعر الوحدة ({symbol})</Text>
        <TextInput
          style={styles.input}
          value={pickPrice}
          onChangeText={setPickPrice}
          keyboardType="decimal-pad"
          textAlign="right"
          placeholder="0"
          placeholderTextColor="#9CA3AF"
        />

        <Pressable style={styles.secondary} onPress={addLine}>
          <Text style={styles.secondaryText}>+ إضافة المادة</Text>
        </Pressable>

        <View style={styles.totalBox}>
          <Text style={styles.totalLabel}>الإجمالي</Text>
          <Text style={styles.totalValue}>{total.toFixed(2)} {symbol}</Text>
        </View>

        <Text style={styles.label}>ملاحظات (اختياري)</Text>
        <TextInput
          style={[styles.input, { minHeight: 60 }]}
          value={notes}
          onChangeText={setNotes}
          textAlign="right"
          multiline
          placeholder="ملاحظات الفاتورة"
          placeholderTextColor="#9CA3AF"
        />

        <View style={{ flexDirection: "row-reverse", gap: 8, marginTop: 16 }}>
          <Pressable
            style={[styles.primary, { marginTop: 0, flex: 1 }, (!canSave || saving) && styles.disabled]}
            onPress={save}
            disabled={!canSave || saving}
          >
            <Text style={styles.primaryText}>
              {saving ? "جارٍ الحفظ..." : "حفظ الفاتورة"}
            </Text>
          </Pressable>
          <Pressable
            style={{
              borderWidth: 1,
              borderColor: "#1E40AF",
              paddingHorizontal: 16,
              borderRadius: 10,
              justifyContent: "center",
            }}
            onPress={async () => {
              const data = buildCurrentInvoiceData("—");
              if (!data) {
                Alert.alert("تنبيه", "أكمل بيانات الفاتورة أولاً");
                return;
              }
              printHtml(await buildInvoiceHtml(data));
            }}
          >
            <Text style={{ color: "#1E40AF", fontWeight: "700", fontSize: 18 }}>🖨️</Text>
          </Pressable>
        </View>

        {history.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>آخر فواتير المشتريات</Text>
            <View style={styles.list}>
              {history.map((h) => (
                <View key={h.id} style={styles.histRow}>
                  <View style={{ flexDirection: "row-reverse", gap: 4 }}>
                    <Pressable
                      onPress={() => setReturnInvoiceId(h.id)}
                      style={{
                        backgroundColor: "#f3e8ff",
                        paddingHorizontal: 8,
                        paddingVertical: 8,
                        borderRadius: 6,
                      }}
                    >
                      <Text style={{ fontSize: 14 }}>↩️</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => printInvoiceById(h.id)}
                      style={{
                        backgroundColor: "#EFF6FF",
                        paddingHorizontal: 8,
                        paddingVertical: 8,
                        borderRadius: 6,
                      }}
                    >
                      <Text style={{ fontSize: 14 }}>🖨️</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => editInvoice(h.id)}
                      style={{
                        backgroundColor: "#fef3c7",
                        paddingHorizontal: 8,
                        paddingVertical: 8,
                        borderRadius: 6,
                      }}
                    >
                      <Text style={{ fontSize: 14 }}>✏️</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => confirmDelete(h.id, h.invoice_no)}
                      style={{
                        backgroundColor: "#fee2e2",
                        paddingHorizontal: 8,
                        paddingVertical: 8,
                        borderRadius: 6,
                      }}
                    >
                      <Text style={{ fontSize: 14 }}>🗑️</Text>
                    </Pressable>
                  </View>
                  <View style={styles.histRight}>
                    <Text style={styles.histTotal}>
                      {Number(h.total).toFixed(2)} {h.currency_code}
                    </Text>
                    <Text style={styles.histType}>
                      {h.payment_type === "cash" ? "نقدي" : "أجل"}
                    </Text>
                  </View>
                  <View style={styles.histInfo}>
                    <Text style={styles.histName}>{h.party_name}</Text>
                    <Text style={styles.histMeta}>{h.invoice_no}</Text>
                    <Text style={styles.histDate}>
                      {new Date(h.created_at).toLocaleString("ar-EG")}
                    </Text>
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
  back: {  paddingVertical: 10, alignSelf: "flex-end", marginBottom: 8 },
  backText: {  color: "#1E40AF", textAlign: "right", fontWeight: "700" },
  screenTitle: { fontSize: 20,  color: "#0F172A",  marginBottom: 6, fontFamily: "CodecBold", textAlign: "right", alignSelf: "flex-end", width: "100%", },
  hint: { fontSize: 12, color: "#8494B0", textAlign: "right", marginBottom: 12, lineHeight: 18 },
  sectionTitle: {fontSize: 16,  color: "#0F172A", textAlign: "right", marginTop: 16, marginBottom: 8 , fontFamily: "CodecBold"},
  label: { fontSize: 12, color: "#526078", textAlign: "right", marginTop: 8, marginBottom: 4 },
  input: {  backgroundColor: "#f8fafc", borderWidth: 1, borderColor: "#D6E3F8", borderRadius: 8, padding: 10, fontSize: 14, color: "#0F172A", textAlign: "right", },
  picker: { backgroundColor: "#f8fafc", borderWidth: 1, borderColor: "#D6E3F8", borderRadius: 8, padding: 12, flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center" },
  pickerText: { color: "#0F172A", textAlign: "right", flex: 1, fontSize: 13 },
  pickerArrow: { color: "#8494B0", fontSize: 12, marginLeft: 8 },
  toggleRow: { flexDirection: "row-reverse", gap: 8 },
  toggleBtn: { flex: 1, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: "#D6E3F8", alignItems: "center" },
  toggleActive: { backgroundColor: "#F97316", borderColor: "#F97316" },
  toggleText: { color: "#0F172A", fontWeight: "600" },
  toggleTextActive: { color: "#fff", fontWeight: "700" },
  list: { gap: 8, marginTop: 4 },
  empty: { textAlign: "right", color: "#8494B0", fontSize: 12, padding: 10 },
  row: { backgroundColor: "#f8fafc", borderWidth: 1, borderColor: "#D6E3F8", borderRadius: 10, padding: 10, flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between" },
  rowInfo: { flex: 1, alignItems: "flex-end" },
  rowName: { fontWeight: "700", fontSize: 14, color: "#0F172A", textAlign: "right" },
  rowMeta: { fontSize: 11, color: "#8494B0", marginTop: 3, textAlign: "right" },
  rowQty: { fontSize: 12, color: "#1E40AF", marginTop: 3, textAlign: "right", fontWeight: "600" },
  rowTotal: { fontSize: 12, color: "#0b806c", marginTop: 2, textAlign: "right", fontWeight: "700" },
  rowActions: { flexDirection: "row-reverse", gap: 6 },
  delBtn: { backgroundColor: "#fee2e2", padding: 8, borderRadius: 7 },
  delText: { color: "#0F172A", fontSize: 12 },
  suggestBox: { marginTop: 4, backgroundColor: "#ffffff", borderWidth: 1, borderColor: "#D6E3F8", borderRadius: 8, overflow: "hidden" },
  suggestItem: { padding: 10, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  suggestName: { fontWeight: "700", color: "#0F172A", textAlign: "right", fontSize: 13 },
  suggestMeta: { fontSize: 11, color: "#8494B0", textAlign: "right", marginTop: 2 },
  suggestEmpty: { padding: 10, color: "#8494B0", textAlign: "right", fontSize: 12 },
  totalBox: { marginTop: 16, backgroundColor: "#EFF6FF", padding: 14, borderRadius: 10, flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center" },
  totalLabel: { color: "#1E40AF", fontWeight: "700", fontSize: 14 },
  totalValue: { color: "#1E40AF", fontWeight: "800", fontSize: 18 },
  primary: { backgroundColor: "#F97316", padding: 14, borderRadius: 10, marginTop: 16 },
  primaryText: { color: "#fff", fontWeight: "700", textAlign: "center" },
  secondary: { backgroundColor: "#1E40AF", padding: 12, borderRadius: 8, marginTop: 8 },
  secondaryText: { color: "#fff", fontWeight: "700", textAlign: "center" },
  disabled: { opacity: 0.5 },
  histRow: { backgroundColor: "#f8fafc", borderWidth: 1, borderColor: "#D6E3F8", borderRadius: 10, padding: 10, flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", gap: 8 },
  histInfo: { flex: 1, alignItems: "flex-end" },
  histRight: { alignItems: "flex-end" },
  histName: { fontWeight: "700", color: "#0F172A", textAlign: "right" },
  histMeta: { fontSize: 11, color: "#1E40AF", marginTop: 2, textAlign: "right", fontWeight: "600" },
  histDate: { fontSize: 10, color: "#8494B0", marginTop: 2, textAlign: "right" },
  histTotal: { color: "#0b806c", fontWeight: "700", fontSize: 13 },
  histType: { color: "#8494B0", fontSize: 10, marginTop: 2 },
});
