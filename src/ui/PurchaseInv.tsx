import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { sqlite } from "../db/local";

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

export default function PurchaseInvoiceScreen({ onBack }: { onBack: () => void }) {
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
  const [history, setHistory] = useState<Row[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const s: any = await sqlite.getAllAsync(
          "SELECT id, code, name, phone, balance FROM suppliers ORDER BY name"
        );
        const cur: any = await sqlite.getAllAsync(
          "SELECT * FROM currencies ORDER BY is_base DESC, code"
        );
        const cb: any = await sqlite.getAllAsync(
          "SELECT id, code, name, balance FROM cashboxes ORDER BY name"
        );
        setSuppliers(s || []);
        setCurrencies(cur || []);
        setCashboxes(cb || []);
        const baseCur = (cur || []).find((x: any) => !!x.isBase);
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
          invoiceId,
          invoiceNo,
          supplier.id,
          supplier.name,
          paymentType === "cash" ? "paid" : "posted",
          total,
          total,
          now,
          currency.code,
          rate,
          paymentType,
          paymentType === "cash" && cashbox ? cashbox.id : null,
        ]
      );

      for (const l of lines) {
        await sqlite.runAsync(
          `INSERT INTO invoice_lines
           (id, invoice_id, item_id, description, quantity, unit_price, line_total)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            newId(),
            invoiceId,
            l.itemId,
            l.itemName,
            l.quantity,
            l.unitPrice,
            l.quantity * l.unitPrice,
          ]
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

      Alert.alert("تم الحفظ بنجاح", `رقم الفاتورة: ${invoiceNo}`);

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

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 40, paddingHorizontal: 4 }}
      >
        <Pressable style={styles.back} onPress={onBack}>
          <Text style={styles.backText}>← العودة إلى الوحدات المحاسبية</Text>
        </Pressable>

        <Text style={styles.screenTitle}>فاتورة مشتريات جديدة</Text>
        <Text style={styles.hint}>
          تُسجَّل من الموردين، وتضيف إلى مخزون تحت الإنتاج (مواد خام وعبوات).
        </Text>

        <Text style={styles.label}>المورد</Text>
        <Pressable
          style={styles.picker}
          onPress={() => setShowSupplierPicker((v) => !v)}
        >
          <Text style={styles.pickerText}>
            {supplier ? supplier.name : "اختر مورداً"}
          </Text>
          <Text style={styles.pickerArrow}>▼</Text>
        </Pressable>
        {showSupplierPicker && (
          <View style={styles.suggestBox}>
            {suppliers.length === 0 ? (
              <Text style={styles.suggestEmpty}>
                لا يوجد موردون — أضفهم من شاشة الموردين
              </Text>
            ) : (
              suppliers.map((s) => (
                <Pressable
                  key={s.id}
                  style={styles.suggestItem}
                  onPress={() => {
                    setSupplier(s);
                    setShowSupplierPicker(false);
                  }}
                >
                  <Text style={styles.suggestName}>{s.name}</Text>
                  <Text style={styles.suggestMeta}>
                    {s.code} · {s.phone || ""}
                  </Text>
                </Pressable>
              ))
            )}
          </View>
        )}

        <Text style={styles.label}>العملة</Text>
        <Pressable
          style={styles.picker}
          onPress={() => setShowCurrencyPicker((v) => !v)}
        >
          <Text style={styles.pickerText}>
            {currency ? `${currency.name} (${currency.symbol})` : "اختر عملة"}
          </Text>
          <Text style={styles.pickerArrow}>▼</Text>
        </Pressable>
        {showCurrencyPicker && (
          <View style={styles.suggestBox}>
            {currencies.map((c) => (
              <Pressable
                key={c.id}
                style={styles.suggestItem}
                onPress={() => {
                  setCurrency(c);
                  setShowCurrencyPicker(false);
                }}
              >
                <Text style={styles.suggestName}>
                  {c.name} ({c.symbol})
                </Text>
                <Text style={styles.suggestMeta}>
                  {c.code}
                  {!!c.isBase
                    ? " · أساسية"
                    : ` · 1 = ${Number(c.exchangeRate).toFixed(2)}`}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        <Text style={styles.label}>نوع الدفع</Text>
        <View style={styles.toggleRow}>
          <Pressable
            style={[
              styles.toggleBtn,
              paymentType === "cash" && styles.toggleActive,
            ]}
            onPress={() => setPaymentType("cash")}
          >
            <Text
              style={[
                styles.toggleText,
                paymentType === "cash" && styles.toggleTextActive,
              ]}
            >
              نقدي
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.toggleBtn,
              paymentType === "credit" && styles.toggleActive,
            ]}
            onPress={() => setPaymentType("credit")}
          >
            <Text
              style={[
                styles.toggleText,
                paymentType === "credit" && styles.toggleTextActive,
              ]}
            >
              أجل
            </Text>
          </Pressable>
        </View>

        {paymentType === "cash" && (
          <>
            <Text style={styles.label}>الصندوق المدفوع منه</Text>
            <Pressable
              style={styles.picker}
              onPress={() => setShowCashboxPicker((v) => !v)}
            >
              <Text style={styles.pickerText}>
                {cashbox ? cashbox.name : "اختر الصندوق"}
              </Text>
              <Text style={styles.pickerArrow}>▼</Text>
            </Pressable>
            {showCashboxPicker && (
              <View style={styles.suggestBox}>
                {cashboxes.length === 0 ? (
                  <Text style={styles.suggestEmpty}>لا توجد صناديق</Text>
                ) : (
                  cashboxes.map((c) => (
                    <Pressable
                      key={c.id}
                      style={styles.suggestItem}
                      onPress={() => {
                        setCashbox(c);
                        setShowCashboxPicker(false);
                      }}
                    >
                      <Text style={styles.suggestName}>{c.name}</Text>
                      <Text style={styles.suggestMeta}>
                        {c.code} · الرصيد: {Number(c.balance || 0).toFixed(2)}
                      </Text>
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
                  <Pressable
                    onPress={() => removeLine(l.key)}
                    style={styles.delBtn}
                  >
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
        <Pressable
          style={styles.picker}
          onPress={() => setShowItemPicker((v) => !v)}
        >
          <Text style={styles.pickerText}>
            {pickItem ? pickItem.name : "اختر من الأصناف"}
          </Text>
          <Text style={styles.pickerArrow}>▼</Text>
        </Pressable>
        {showItemPicker && (
          <View style={styles.suggestBox}>
            {items.length === 0 ? (
              <Text style={styles.suggestEmpty}>
                لا توجد مواد — أضفها من شاشة الأصناف
              </Text>
            ) : (
              items.map((it) => (
                <Pressable
                  key={it.id}
                  style={styles.suggestItem}
                  onPress={() => {
                    setPickItem(it);
                    setPickPrice(String(it.average_cost ?? ""));
                    setShowItemPicker(false);
                  }}
                >
                  <Text style={styles.suggestName}>{it.name}</Text>
                  <Text style={styles.suggestMeta}>
                    {it.sku} · {it.unit}
                  </Text>
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
          <Text style={styles.totalValue}>
            {total.toFixed(2)} {symbol}
          </Text>
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

        <Pressable
          style={[styles.primary, (!canSave || saving) && styles.disabled]}
          onPress={save}
          disabled={!canSave || saving}
        >
          <Text style={styles.primaryText}>
            {saving ? "جارٍ الحفظ..." : "حفظ الفاتورة"}
          </Text>
        </Pressable>

        {history.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>آخر فواتير المشتريات</Text>
            <View style={styles.list}>
              {history.map((h) => (
                <View key={h.id} style={styles.histRow}>
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
  back: { paddingVertical: 10, marginBottom: 8 },
  backText: { color: "#087f68", fontWeight: "700", textAlign: "right" },
  screenTitle: { fontSize: 20, fontWeight: "800", color: "#172033", textAlign: "right", marginBottom: 6 },
  hint: { fontSize: 12, color: "#758298", textAlign: "right", marginBottom: 12, lineHeight: 18 },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: "#172033", textAlign: "right", marginTop: 16, marginBottom: 8 },
  label: { fontSize: 12, color: "#526078", textAlign: "right", marginTop: 8, marginBottom: 4 },
  input: { backgroundColor: "#f8fafc", borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 8, padding: 10, fontSize: 14, color: "#172033" },
  picker: { backgroundColor: "#f8fafc", borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 8, padding: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  pickerText: { color: "#172033", textAlign: "right", flex: 1, fontSize: 14 },
  pickerArrow: { color: "#758298", fontSize: 12, marginLeft: 8 },
  toggleRow: { flexDirection: "row", gap: 8 },
  toggleBtn: { flex: 1, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: "#dfe5ed", alignItems: "center" },
  toggleActive: { backgroundColor: "#10a88a", borderColor: "#10a88a" },
  toggleText: { color: "#172033", fontWeight: "600" },
  toggleTextActive: { color: "#fff", fontWeight: "700" },
  list: { gap: 8, marginTop: 4 },
  empty: { textAlign: "right", color: "#758298", fontSize: 12, padding: 10 },
  row: { backgroundColor: "#f8fafc", borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 10, padding: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  rowInfo: { flex: 1, alignItems: "flex-end" },
  rowName: { fontWeight: "700", fontSize: 14, color: "#172033", textAlign: "right" },
  rowMeta: { fontSize: 11, color: "#758298", marginTop: 3, textAlign: "right" },
  rowQty: { fontSize: 12, color: "#315b85", marginTop: 3, textAlign: "right", fontWeight: "600" },
  rowTotal: { fontSize: 12, color: "#0b806c", marginTop: 2, textAlign: "right", fontWeight: "700" },
  rowActions: { flexDirection: "row", gap: 6 },
  delBtn: { backgroundColor: "#fee2e2", padding: 8, borderRadius: 7 },
  delText: { color: "#172033", fontSize: 12 },
  suggestBox: { marginTop: 4, backgroundColor: "#ffffff", borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 8, overflow: "hidden" },
  suggestItem: { padding: 10, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  suggestName: { fontWeight: "700", color: "#172033", textAlign: "right", fontSize: 13 },
  suggestMeta: { fontSize: 11, color: "#758298", textAlign: "right", marginTop: 2 },
  suggestEmpty: { padding: 10, color: "#758298", textAlign: "right", fontSize: 12 },
  totalBox: { marginTop: 16, backgroundColor: "#e8f7f3", padding: 14, borderRadius: 10, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  totalLabel: { color: "#087f68", fontWeight: "700", fontSize: 14 },
  totalValue: { color: "#087f68", fontWeight: "800", fontSize: 18 },
  primary: { backgroundColor: "#10a88a", padding: 14, borderRadius: 10, marginTop: 16 },
  primaryText: { color: "#fff", fontWeight: "700", textAlign: "center" },
  secondary: { backgroundColor: "#315b85", padding: 12, borderRadius: 8, marginTop: 8 },
  secondaryText: { color: "#fff", fontWeight: "700", textAlign: "center" },
  disabled: { opacity: 0.5 },
  histRow: { backgroundColor: "#f8fafc", borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 10, padding: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  histInfo: { flex: 1, alignItems: "flex-end" },
  histRight: { alignItems: "flex-start" },
  histName: { fontWeight: "700", color: "#172033", textAlign: "right" },
  histMeta: { fontSize: 11, color: "#315b85", marginTop: 2, textAlign: "right", fontWeight: "600" },
  histDate: { fontSize: 10, color: "#758298", marginTop: 2, textAlign: "right" },
  histTotal: { color: "#0b806c", fontWeight: "700", fontSize: 13 },
  histType: { color: "#758298", fontSize: 10, marginTop: 2 },
});