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
  Modal,
} from "react-native";
import BrandBanner from "./components/BrandBanner";
import { sqlite } from "../db/local";
import PurchaseReturnScreen from "./PurchaseReturnScreen";
import DateTimePicker from "@react-native-community/datetimepicker";
import {
  buildInvoiceHtml,
  printHtml,
  shareHtmlAsPdf,
  type InvoicePrintData,
} from "../utils/printDocument";
import { useTheme } from "./ThemeContext";
import PurchaseItemPicker from "./components/PurchaseItemPicker"; // 🚀 استدعاء المكون الجديد

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
  const { colors } = useTheme();
  const [suppliers, setSuppliers] = useState<Row[]>([]);
  const [currencies, setCurrencies] = useState<Row[]>([]);
  const [cashboxes, setCashboxes] = useState<Row[]>([]);
  const [items, setItems] = useState<Row[]>([]);

  const [supplier, setSupplier] = useState<Row | null>(null);
  const [supplierSearch, setSupplierSearch] = useState("");
  const [currency, setCurrency] = useState<Row | null>(null);
  const [paymentType, setPaymentType] = useState<PaymentType>("cash");
  const [cashbox, setCashbox] = useState<Row | null>(null);
  const [notes, setNotes] = useState("");

  const [lines, setLines] = useState<InvoiceLine[]>([]);

  const [showSupplierPicker, setShowSupplierPicker] = useState(false);
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  const [showCashboxPicker, setShowCashboxPicker] = useState(false);

  const [saving, setSaving] = useState(false);
  const [returnInvoiceId, setReturnInvoiceId] = useState<string | null>(null);
  const [history, setHistory] = useState<Row[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingNo, setEditingNo] = useState<string | null>(null);
  const [dateStr, setDateStr] = useState(new Date().toISOString().slice(0, 10));
  const [showDatePicker, setShowDatePicker] = useState(false);

  // ✅ حالة لعرض تفاصيل الفاتورة
  const [selectedInvoice, setSelectedInvoice] = useState<Row | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const s: any = await sqlite.getAllAsync(
          "SELECT id, code, name, phone, balance FROM suppliers ORDER BY name",
        );
        const cur: any = await sqlite.getAllAsync(
          "SELECT id, code, name, symbol, exchange_rate, is_base FROM currencies ORDER BY is_base DESC, code",
        );
        const cb: any = await sqlite.getAllAsync(
          "SELECT id, code, name, balance FROM cashboxes ORDER BY name",
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
      "SELECT id, sku, name, unit, stock_quantity, average_cost FROM items WHERE item_type IN ('raw_material','production_material','packaging') ORDER BY name",
    );
    setItems(rows || []);
  };

  const loadHistory = async () => {
    try {
      const rows: any = await sqlite.getAllAsync(
        `SELECT id, invoice_no, party_name, total, currency_code, payment_type, created_at FROM invoices WHERE invoice_type = 'purchase' ORDER BY created_at DESC LIMIT 10`,
      );
      setHistory(rows || []);
    } catch {}
  };

  const filteredSuppliers = useMemo(() => {
    if (!supplierSearch.trim()) return suppliers;
    const q = supplierSearch.toLowerCase();
    return suppliers.filter(
      (s) =>
        String(s.name).toLowerCase().includes(q) ||
        String(s.code).toLowerCase().includes(q) ||
        String(s.phone || "").includes(q),
    );
  }, [suppliers, supplierSearch]);

  const handleAddLine = (newLine: InvoiceLine) => {
    setLines((prev) => [...prev, newLine]);
  };

  const removeLine = (key: string) =>
    setLines(lines.filter((l) => l.key !== key));
  const total = useMemo(
    () => lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0),
    [lines],
  );
  const canSave =
    !!supplier &&
    !!currency &&
    lines.length > 0 &&
    (paymentType === "credit" || !!cashbox) &&
    !saving;

  const buildCurrentInvoiceData = (
    invoiceNo: string,
  ): InvoicePrintData | null => {
    if (!supplier || !currency) return null;
    const rate = Number(currency.exchangeRate) || 1;
    return {
      type: "purchase",
      invoiceNo,
      createdAt: dateStr ? new Date(dateStr).getTime() : Date.now(),
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
        [invoiceId],
      );
      if (!inv) return Alert.alert("خطأ", "الفاتورة غير موجودة");
      const invLines: any = await sqlite.getAllAsync(
        `SELECT l.*, i.name as item_name, i.sku as item_sku, i.unit as item_unit FROM invoice_lines l LEFT JOIN items i ON i.id = l.item_id WHERE l.invoice_id = ?`,
        [invoiceId],
      );
      const cur: any = await sqlite.getFirstAsync(
        "SELECT * FROM currencies WHERE code = ?",
        [inv.currency_code || ""],
      );
      let cashboxName: string | undefined;
      if (inv.cashbox_id) {
        const cb: any = await sqlite.getFirstAsync(
          "SELECT name FROM cashboxes WHERE id = ?",
          [inv.cashbox_id],
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
      await printHtml(await buildInvoiceHtml(data));
      setSelectedInvoice(null);
    } catch (e) {
      Alert.alert("تعذر الطباعة", String(e));
    }
  };

  const deleteInvoice = async (invoiceId: string) => {
    try {
      const inv: any = await sqlite.getFirstAsync(
        "SELECT * FROM invoices WHERE id = ?",
        [invoiceId],
      );
      if (!inv) return Alert.alert("خطأ", "الفاتورة غير موجودة");
      const invLines: any = await sqlite.getAllAsync(
        "SELECT * FROM invoice_lines WHERE invoice_id = ?",
        [invoiceId],
      );
      const now = Date.now();
      const rate = Number(inv.exchange_rate) || 1;
      const cur: any = await sqlite.getFirstAsync(
        "SELECT is_base FROM currencies WHERE code = ?",
        [inv.currency_code || "YER"],
      );
      const baseAmount =
        (cur?.is_base ?? cur?.isBase)
          ? Number(inv.total)
          : Number(inv.total) * rate;

      for (const l of invLines || []) {
        await sqlite.runAsync(
          "UPDATE items SET stock_quantity = stock_quantity - ?, updated_at = ? WHERE id = ?",
          [Number(l.quantity), now, l.item_id],
        );
      }

      await sqlite.runAsync(
        "DELETE FROM stock_movements WHERE source_type = 'purchase_invoice' AND source_id = ?",
        [invoiceId],
      );
      if (inv.payment_type === "credit" && inv.party_id)
        await sqlite.runAsync(
          "UPDATE suppliers SET balance = balance - ? WHERE id = ?",
          [baseAmount, inv.party_id],
        );
      if (inv.payment_type === "cash" && inv.cashbox_id)
        await sqlite.runAsync(
          "UPDATE cashboxes SET balance = balance + ? WHERE id = ?",
          [baseAmount, inv.cashbox_id],
        );

      await sqlite.runAsync("DELETE FROM invoice_lines WHERE invoice_id = ?", [
        invoiceId,
      ]);
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
      ],
    );
  };

  const editInvoice = async (invoiceId: string) => {
    Alert.alert(
      "تعديل الفاتورة",
      "سيتم فتح الفاتورة للتعديل المباشر. متابعة؟",
      [
        { text: "إلغاء", style: "cancel" },
        {
          text: "متابعة",
          onPress: async () => {
            try {
              const inv: any = await sqlite.getFirstAsync(
                "SELECT * FROM invoices WHERE id = ?",
                [invoiceId],
              );
              if (!inv) return;
              const invLines: any = await sqlite.getAllAsync(
                `SELECT l.*, i.name as item_name, i.sku as item_sku, i.unit as item_unit FROM invoice_lines l LEFT JOIN items i ON i.id = l.item_id WHERE l.invoice_id = ?`,
                [invoiceId],
              );
              const oldSupplier = suppliers.find((s) => s.id === inv.party_id);
              const oldCurrency = currencies.find(
                (c) => c.code === inv.currency_code,
              );
              const oldCashbox = cashboxes.find((c) => c.id === inv.cashbox_id);
              const oldPaymentType =
                (inv.payment_type as PaymentType) || "cash";

              setEditingId(inv.id);
              setEditingNo(inv.invoice_no);
              if (inv.created_at)
                setDateStr(new Date(inv.created_at).toISOString().slice(0, 10));

              if (oldSupplier) {
                setSupplier(oldSupplier);
                setSupplierSearch(oldSupplier.name);
              }
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
                })),
              );
              setSelectedInvoice(null); // إغلاق النافذة عند التعديل
            } catch (e) {
              Alert.alert("تعذر التعديل", String(e));
            }
          },
        },
      ],
    );
  };

  const save = () => {
    if (!canSave || !supplier || !currency) return;
    const symbol = currency.symbol || currency.code;
    Alert.alert(
      "تأكيد الحفظ",
      `فاتورة مشتريات بمبلغ ${total.toFixed(2)} ${symbol}\nالمورد: ${supplier.name}\nالدفع: ${paymentType === "cash" ? "نقدي" : "أجل"}`,
      [
        { text: "إلغاء", style: "cancel" },
        { text: "حفظ", onPress: doSave },
      ],
    );
  };

  const doSave = async () => {
    if (!supplier || !currency) return;
    setSaving(true);
    try {
      const now = dateStr ? new Date(dateStr).getTime() : Date.now();
      let currentInvoiceId = editingId;
      let currentInvoiceNo = editingNo;

      const rate = Number(currency.exchangeRate) || 1;
      const isBase = !!currency.isBase;
      const baseAmount = isBase ? total : total * rate;

      if (!currentInvoiceId) {
        currentInvoiceId = newId();
        const prefix = "PUR";
        const last: any = await sqlite.getAllAsync(
          `SELECT invoice_no FROM invoices WHERE invoice_type = 'purchase' AND invoice_no LIKE ?`,
          [`${prefix}-%`],
        );
        let maxNum = 0;
        if (last && last.length > 0) {
          last.forEach((row: any) => {
            const num = parseInt(String(row.invoice_no).replace(/\D/g, ""), 10);
            if (!isNaN(num) && num > maxNum) maxNum = num;
          });
        }
        const nextNum = maxNum + 1;
        currentInvoiceNo = `${prefix}-${String(nextNum).padStart(3, "0")}`;

        await sqlite.runAsync(
          `INSERT INTO invoices (id, invoice_no, invoice_type, party_id, party_name, status, subtotal, tax, total, created_at, currency_code, exchange_rate, payment_type, cashbox_id) VALUES (?, ?, 'purchase', ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?)`,
          [
            currentInvoiceId,
            currentInvoiceNo,
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
          ],
        );
      } else {
        const oldInv: any = await sqlite.getFirstAsync(
          "SELECT * FROM invoices WHERE id = ?",
          [currentInvoiceId],
        );
        const oldLines: any = await sqlite.getAllAsync(
          "SELECT * FROM invoice_lines WHERE invoice_id = ?",
          [currentInvoiceId],
        );

        for (const l of oldLines)
          await sqlite.runAsync(
            "UPDATE items SET stock_quantity = stock_quantity - ?, updated_at = ? WHERE id = ?",
            [Number(l.quantity), Date.now(), l.item_id],
          );

        const baseCur = currencies.find((c) => c.isBase);
        const oldRate = Number(oldInv.exchange_rate) || 1;
        const oldBaseAmount =
          oldInv.currency_code === baseCur?.code
            ? Number(oldInv.total)
            : Number(oldInv.total) * oldRate;

        if (oldInv.payment_type === "credit" && oldInv.party_id)
          await sqlite.runAsync(
            "UPDATE suppliers SET balance = balance - ? WHERE id = ?",
            [oldBaseAmount, oldInv.party_id],
          );
        else if (oldInv.payment_type === "cash" && oldInv.cashbox_id)
          await sqlite.runAsync(
            "UPDATE cashboxes SET balance = balance + ? WHERE id = ?",
            [oldBaseAmount, oldInv.cashbox_id],
          );

        await sqlite.runAsync(
          "DELETE FROM invoice_lines WHERE invoice_id = ?",
          [currentInvoiceId],
        );
        await sqlite.runAsync(
          "DELETE FROM stock_movements WHERE source_type = 'purchase_invoice' AND source_id = ?",
          [currentInvoiceId],
        );

        await sqlite.runAsync(
          `UPDATE invoices SET party_id=?, party_name=?, status=?, subtotal=?, total=?, created_at=?, currency_code=?, exchange_rate=?, payment_type=?, cashbox_id=? WHERE id=?`,
          [
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
            currentInvoiceId,
          ],
        );
      }

      for (const l of lines) {
        await sqlite.runAsync(
          `INSERT INTO invoice_lines (id, invoice_id, item_id, description, quantity, unit_price, line_total) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            newId(),
            currentInvoiceId,
            l.itemId,
            l.itemName,
            l.quantity,
            l.unitPrice,
            l.quantity * l.unitPrice,
          ],
        );
        await sqlite.runAsync(
          "UPDATE items SET stock_quantity = stock_quantity + ?, average_cost = ?, updated_at = ? WHERE id = ?",
          [l.quantity, l.unitPrice, now, l.itemId],
        );
        await sqlite.runAsync(
          `INSERT INTO stock_movements (id, source_type, source_id, item_id, warehouse_id, movement_type, quantity_in, quantity_out, planned_quantity, waste_quantity, unit_cost, created_at) VALUES (?, 'purchase_invoice', ?, ?, 'wh-wip', 'purchase_in', ?, 0, 0, 0, ?, ?)`,
          [newId(), currentInvoiceId, l.itemId, l.quantity, l.unitPrice, now],
        );
      }

      if (paymentType === "credit")
        await sqlite.runAsync(
          "UPDATE suppliers SET balance = balance + ? WHERE id = ?",
          [baseAmount, supplier.id],
        );
      else if (cashbox)
        await sqlite.runAsync(
          "UPDATE cashboxes SET balance = balance - ? WHERE id = ?",
          [baseAmount, cashbox.id],
        );

      const currentData = buildCurrentInvoiceData(currentInvoiceNo || "—");
      Alert.alert("تم الحفظ بنجاح", `رقم الفاتورة: ${currentInvoiceNo}`, [
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
              shareHtmlAsPdf(
                await buildInvoiceHtml(currentData),
                `فاتورة-شراء-${currentInvoiceNo}.pdf`,
              );
          },
        },
      ]);

      setSupplier(null);
      setSupplierSearch("");
      setLines([]);
      setNotes("");
      if (paymentType === "cash") setCashbox(null);
      setEditingId(null);
      setEditingNo(null);
      setDateStr(new Date().toISOString().slice(0, 10));
      await loadItems();
      await loadHistory();
    } catch (e) {
      Alert.alert("تعذر الحفظ", String(e));
    } finally {
      setSaving(false);
    }
  };

  const symbol = currency?.symbol || currency?.code || "";

  if (returnInvoiceId)
    return (
      <PurchaseReturnScreen
        invoiceId={returnInvoiceId}
        onBack={() => setReturnInvoiceId(null)}
      />
    );

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable
          android_ripple={{ color: "rgba(0,0,0,0.1)" }}
          style={styles.back}
          onPress={onBack}
        >
          <Text style={[styles.backText, { color: colors.blue }]}>
            ‹ العودة إلى الوحدات المحاسبية
          </Text>
        </Pressable>

        <BrandBanner />
        <Text style={[styles.screenTitle, { color: colors.text }]}>
          {editingNo ? `تعديل الفاتورة ${editingNo}` : "فاتورة مشتريات جديدة"}
        </Text>

        <Text style={[styles.label, { color: colors.textMuted }]}>التاريخ</Text>
        <Pressable
          android_ripple={{ color: "rgba(0,0,0,0.1)" }}
          style={[
            styles.input,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              justifyContent: "center",
              height: 42,
            },
          ]}
          onPress={() => setShowDatePicker(true)}
        >
          <Text
            style={{ textAlign: "right", color: colors.text, fontSize: 14 }}
          >
            {dateStr}
          </Text>
        </Pressable>
        {showDatePicker && (
          <DateTimePicker
            value={dateStr ? new Date(dateStr) : new Date()}
            mode="date"
            display="default"
            onChange={(e, d) => {
              setShowDatePicker(Platform.OS === "ios");
              if (d) setDateStr(d.toISOString().slice(0, 10));
            }}
          />
        )}

        <Text style={[styles.label, { color: colors.textMuted }]}>المورد</Text>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              color: colors.text,
            },
          ]}
          value={supplierSearch}
          onChangeText={(text) => {
            setSupplierSearch(text);
            setShowSupplierPicker(true);
            if (supplier && text !== supplier.name) setSupplier(null);
          }}
          onFocus={() => setShowSupplierPicker(true)}
          onBlur={() => setTimeout(() => setShowSupplierPicker(false), 200)}
          placeholder="ابحث أو اكتب اسم المورد..."
          placeholderTextColor={colors.textMuted}
          textAlign="right"
        />
        {showSupplierPicker && (
          <ScrollView
            style={[
              styles.suggestBox,
              {
                maxHeight: 200,
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
            nestedScrollEnabled
            keyboardShouldPersistTaps="always"
          >
            {filteredSuppliers.length === 0 ? (
              <Text style={[styles.suggestEmpty, { color: colors.textMuted }]}>
                لا توجد نتائج مطابقة
              </Text>
            ) : (
              filteredSuppliers.map((s) => (
                <Pressable
                  android_ripple={{ color: "rgba(0,0,0,0.1)" }}
                  key={s.id}
                  style={[styles.suggestItem, { borderBottomColor: colors.bg }]}
                  onPress={() => {
                    setSupplier(s);
                    setSupplierSearch(s.name);
                    setShowSupplierPicker(false);
                  }}
                >
                  <Text style={[styles.suggestName, { color: colors.text }]}>
                    {s.name}
                  </Text>
                  <Text
                    style={[styles.suggestMeta, { color: colors.textMuted }]}
                  >
                    {s.code} {s.phone ? `· ${s.phone}` : ""}
                  </Text>
                </Pressable>
              ))
            )}
          </ScrollView>
        )}

        <Text style={[styles.label, { color: colors.textMuted }]}>العملة</Text>
        <Pressable
          android_ripple={{ color: "rgba(0,0,0,0.1)" }}
          style={[
            styles.picker,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
          onPress={() => setShowCurrencyPicker((v) => !v)}
        >
          <Text style={[styles.pickerText, { color: colors.text }]}>
            {currency
              ? `${currency.name} (${currency.symbol})${currency.isBase ? " — أساسية" : ` — 1 = ${Number(currency.exchangeRate).toFixed(2)} YER`}`
              : "اختر عملة"}
          </Text>
          <Text style={[styles.pickerArrow, { color: colors.textMuted }]}>
            ▼
          </Text>
        </Pressable>
        {showCurrencyPicker && (
          <ScrollView
            style={[
              styles.suggestBox,
              {
                maxHeight: 200,
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
            nestedScrollEnabled
            keyboardShouldPersistTaps="always"
          >
            {currencies.map((c) => (
              <Pressable
                android_ripple={{ color: "rgba(0,0,0,0.1)" }}
                key={c.id}
                style={[styles.suggestItem, { borderBottomColor: colors.bg }]}
                onPress={() => {
                  setCurrency(c);
                  setShowCurrencyPicker(false);
                }}
              >
                <Text style={[styles.suggestName, { color: colors.text }]}>
                  {c.name} ({c.symbol})
                </Text>
                <Text style={[styles.suggestMeta, { color: colors.textMuted }]}>
                  {c.code}
                  {c.isBase
                    ? " · أساسية"
                    : ` · 1 = ${Number(c.exchangeRate).toFixed(2)} YER`}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        )}

        <Text style={[styles.label, { color: colors.textMuted }]}>
          نوع الدفع
        </Text>
        <View style={styles.toggleRow}>
          <Pressable
            android_ripple={{ color: "rgba(0,0,0,0.1)" }}
            style={[
              styles.toggleBtn,
              { backgroundColor: colors.surface, borderColor: colors.border },
              paymentType === "cash" && {
                backgroundColor: colors.orange,
                borderColor: colors.orange,
              },
            ]}
            onPress={() => setPaymentType("cash")}
          >
            <Text
              style={[
                styles.toggleText,
                { color: colors.text },
                paymentType === "cash" && { color: "#FFF", fontWeight: "700" },
              ]}
            >
              نقدي
            </Text>
          </Pressable>
          <Pressable
            android_ripple={{ color: "rgba(0,0,0,0.1)" }}
            style={[
              styles.toggleBtn,
              { backgroundColor: colors.surface, borderColor: colors.border },
              paymentType === "credit" && {
                backgroundColor: colors.orange,
                borderColor: colors.orange,
              },
            ]}
            onPress={() => setPaymentType("credit")}
          >
            <Text
              style={[
                styles.toggleText,
                { color: colors.text },
                paymentType === "credit" && {
                  color: "#FFF",
                  fontWeight: "700",
                },
              ]}
            >
              أجل
            </Text>
          </Pressable>
        </View>

        {paymentType === "cash" && (
          <>
            <Text style={[styles.label, { color: colors.textMuted }]}>
              الصندوق المدفوع منه
            </Text>
            <Pressable
              android_ripple={{ color: "rgba(0,0,0,0.1)" }}
              style={[
                styles.picker,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
              onPress={() => setShowCashboxPicker((v) => !v)}
            >
              <Text style={[styles.pickerText, { color: colors.text }]}>
                {cashbox ? cashbox.name : "اختر الصندوق"}
              </Text>
              <Text style={[styles.pickerArrow, { color: colors.textMuted }]}>
                ▼
              </Text>
            </Pressable>
            {showCashboxPicker && (
              <ScrollView
                style={[
                  styles.suggestBox,
                  {
                    maxHeight: 200,
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                ]}
                nestedScrollEnabled
                keyboardShouldPersistTaps="always"
              >
                {cashboxes.length === 0 ? (
                  <Text
                    style={[styles.suggestEmpty, { color: colors.textMuted }]}
                  >
                    لا توجد صناديق
                  </Text>
                ) : (
                  cashboxes.map((c) => (
                    <Pressable
                      android_ripple={{ color: "rgba(0,0,0,0.1)" }}
                      key={c.id}
                      style={[
                        styles.suggestItem,
                        { borderBottomColor: colors.bg },
                      ]}
                      onPress={() => {
                        setCashbox(c);
                        setShowCashboxPicker(false);
                      }}
                    >
                      <Text
                        style={[styles.suggestName, { color: colors.text }]}
                      >
                        {c.name}
                      </Text>
                      <Text
                        style={[
                          styles.suggestMeta,
                          { color: colors.textMuted },
                        ]}
                      >
                        {c.code} · الرصيد: {Number(c.balance || 0).toFixed(2)}
                      </Text>
                    </Pressable>
                  ))
                )}
              </ScrollView>
            )}
          </>
        )}

        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          المواد والعبوات ({lines.length})
        </Text>
        <View style={styles.list}>
          {lines.length === 0 ? (
            <Text style={[styles.empty, { color: colors.textMuted }]}>
              لا توجد مواد بعد
            </Text>
          ) : (
            lines.map((l) => (
              <View
                key={l.key}
                style={[
                  styles.row,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                ]}
              >
                <View style={styles.rowActions}>
                  <Pressable
                    android_ripple={{ color: "rgba(0,0,0,0.1)" }}
                    onPress={() => removeLine(l.key)}
                    style={[
                      styles.delBtn,
                      {
                        backgroundColor: colors.isDark ? "#7F1D1D" : "#fee2e2",
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.delText,
                        { color: colors.isDark ? "#FCA5A5" : "#0F172A" },
                      ]}
                    >
                      حذف
                    </Text>
                  </Pressable>
                </View>
                <View style={styles.rowInfo}>
                  <Text style={[styles.rowName, { color: colors.text }]}>
                    {l.itemName}
                  </Text>
                  <Text style={[styles.rowMeta, { color: colors.textMuted }]}>
                    {l.itemSku}
                  </Text>
                  <Text style={[styles.rowQty, { color: colors.blue }]}>
                    {l.quantity} {l.unit} × {l.unitPrice.toFixed(2)} {symbol}
                  </Text>
                  <Text style={[styles.rowTotal, { color: colors.success }]}>
                    الإجمالي: {(l.quantity * l.unitPrice).toFixed(2)} {symbol}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>

        {/* 🚀 استخدام المكون الجديد هنا */}
        <PurchaseItemPicker items={items} onAddLine={handleAddLine} />

        <View
          style={[
            styles.totalBox,
            { backgroundColor: colors.isDark ? "#1E3A8A" : "#EFF6FF" },
          ]}
        >
          <Text style={[styles.totalLabel, { color: colors.blue }]}>
            الإجمالي
          </Text>
          <Text style={[styles.totalValue, { color: colors.blue }]}>
            {total.toFixed(2)} {symbol}
          </Text>
        </View>

        <Text style={[styles.label, { color: colors.textMuted }]}>
          ملاحظات (اختياري)
        </Text>
        <TextInput
          style={[
            styles.input,
            {
              minHeight: 60,
              backgroundColor: colors.surface,
              borderColor: colors.border,
              color: colors.text,
            },
          ]}
          value={notes}
          onChangeText={setNotes}
          textAlign="right"
          multiline
          placeholder="ملاحظات الفاتورة"
          placeholderTextColor={colors.textMuted}
        />

        <View style={{ flexDirection: "row-reverse", gap: 8, marginTop: 16 }}>
          <Pressable
            android_ripple={{ color: "rgba(0,0,0,0.1)" }}
            style={[
              styles.primary,
              { marginTop: 0, flex: 1, backgroundColor: colors.orange },
              (!canSave || saving) && styles.disabled,
            ]}
            onPress={save}
            disabled={!canSave || saving}
          >
            <Text style={styles.primaryText}>
              {saving
                ? "جارٍ الحفظ..."
                : editingId
                  ? "تحديث الفاتورة"
                  : "حفظ الفاتورة"}
            </Text>
          </Pressable>
          <Pressable
            android_ripple={{ color: "rgba(0,0,0,0.1)" }}
            style={{
              borderWidth: 1,
              borderColor: colors.blue,
              paddingHorizontal: 16,
              borderRadius: 10,
              justifyContent: "center",
            }}
            onPress={async () => {
              const data = buildCurrentInvoiceData("—");
              if (!data)
                return Alert.alert("تنبيه", "أكمل بيانات الفاتورة أولاً");
              printHtml(await buildInvoiceHtml(data));
            }}
          >
            <Text
              style={{ color: colors.blue, fontWeight: "700", fontSize: 18 }}
            >
              🖨️
            </Text>
          </Pressable>
        </View>

        {history.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              آخر فواتير المشتريات
            </Text>
            <View style={styles.list}>
              {history.map((h) => (
                <Pressable
                  key={h.id}
                  onPress={() => setSelectedInvoice(h)}
                  style={[
                    styles.histRow,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <View style={styles.histActions}>
                    <Pressable
                      android_ripple={{ color: "rgba(0,0,0,0.1)" }}
                      onPress={(e) => {
                        e.stopPropagation();
                        setReturnInvoiceId(h.id);
                      }}
                      style={[
                        styles.iconBtn,
                        {
                          backgroundColor: colors.isDark
                            ? "#1E3A8A"
                            : "#EFF6FF",
                        },
                      ]}
                    >
                      <Text style={{ fontSize: 14 }}>↩️</Text>
                    </Pressable>
                    <Pressable
                      android_ripple={{ color: "rgba(0,0,0,0.1)" }}
                      onPress={(e) => {
                        e.stopPropagation();
                        printInvoiceById(h.id);
                      }}
                      style={[
                        styles.iconBtn,
                        {
                          backgroundColor: colors.isDark
                            ? "#1E3A8A"
                            : "#EFF6FF",
                        },
                      ]}
                    >
                      <Text style={{ fontSize: 14 }}>🖨️</Text>
                    </Pressable>
                    <Pressable
                      android_ripple={{ color: "rgba(0,0,0,0.1)" }}
                      onPress={(e) => {
                        e.stopPropagation();
                        editInvoice(h.id);
                      }}
                      style={[
                        styles.iconBtn,
                        {
                          backgroundColor: colors.isDark
                            ? "#1E3A8A"
                            : "#EFF6FF",
                        },
                      ]}
                    >
                      <Text style={{ fontSize: 14 }}>✏️</Text>
                    </Pressable>
                    <Pressable
                      android_ripple={{ color: "rgba(0,0,0,0.1)" }}
                      onPress={(e) => {
                        e.stopPropagation();
                        confirmDelete(h.id, h.invoice_no);
                      }}
                      style={[
                        styles.iconBtn,
                        {
                          backgroundColor: colors.isDark
                            ? "#7F1D1D"
                            : "#FEE2E2",
                        },
                      ]}
                    >
                      <Text style={{ fontSize: 14 }}>🗑️</Text>
                    </Pressable>
                  </View>
                  <View style={styles.histDetails}>
                    <Text style={[styles.histName, { color: colors.text }]}>
                      {h.party_name}
                    </Text>
                    <Text style={[styles.histMeta, { color: colors.blue }]}>
                      {h.invoice_no}
                    </Text>
                    <Text
                      style={[styles.histDate, { color: colors.textMuted }]}
                    >
                      {new Date(h.created_at).toLocaleString("ar-EG")}
                    </Text>
                    <Text style={[styles.histTotal, { color: colors.blue }]}>
                      {Number(h.total).toFixed(2)} {h.currency_code}
                    </Text>
                    <Text
                      style={[styles.histType, { color: colors.textMuted }]}
                    >
                      {h.payment_type === "cash" ? "نقدي" : "أجل"}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>
          </>
        )}
      </ScrollView>

      {/* ✅ نافذة تفاصيل الفاتورة */}
      <Modal
        visible={!!selectedInvoice}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedInvoice(null)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[styles.modalContent, { backgroundColor: colors.surface }]}
          >
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              تفاصيل الفاتورة
            </Text>

            {selectedInvoice && (
              <View style={styles.modalDetails}>
                <Text style={[styles.modalText, { color: colors.text }]}>
                  المورد: {selectedInvoice.party_name}
                </Text>
                <Text style={[styles.modalText, { color: colors.text }]}>
                  رقم الفاتورة: {selectedInvoice.invoice_no}
                </Text>
                <Text style={[styles.modalText, { color: colors.text }]}>
                  التاريخ:{" "}
                  {new Date(selectedInvoice.created_at).toLocaleDateString(
                    "ar-EG",
                  )}
                </Text>
                <Text style={[styles.modalText, { color: colors.text }]}>
                  نوع الدفع:{" "}
                  {selectedInvoice.payment_type === "cash" ? "نقدي" : "أجل"}
                </Text>
                <Text style={[styles.modalTotal, { color: colors.blue }]}>
                  الإجمالي: {Number(selectedInvoice.total).toFixed(2)}{" "}
                  {selectedInvoice.currency_code}
                </Text>
              </View>
            )}

            <View style={styles.modalActions}>
              <Pressable
                style={[styles.modalBtn, { backgroundColor: colors.blue }]}
                onPress={() => printInvoiceById(selectedInvoice.id)}
              >
                <Text style={styles.modalBtnText}>🖨️ طباعة</Text>
              </Pressable>
              <Pressable
                style={[styles.modalBtn, { backgroundColor: colors.textMuted }]}
                onPress={() => setSelectedInvoice(null)}
              >
                <Text style={styles.modalBtnText}>إغلاق</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    backgroundColor: "transparent",
    paddingHorizontal: 8,
    paddingTop: 16,
    paddingBottom: 40,
  },
  back: { paddingVertical: 10, alignSelf: "flex-start", marginBottom: 8 },
  backText: { textAlign: "left", fontWeight: "700" },
  screenTitle: {
    fontSize: 22,
    marginBottom: 6,
    textAlign: "left",
    width: "100%",
    fontFamily: "CodecBold",
  },
  hint: {
    fontSize: 12,
    marginBottom: 12,
    lineHeight: 18,
    textAlign: "left",
    width: "100%",
  },
  sectionTitle: {
    fontSize: 16,
    marginTop: 16,
    marginBottom: 8,
    textAlign: "left",
    width: "100%",
    fontFamily: "CodecBold",
  },
  label: {
    fontSize: 12,
    marginTop: 8,
    marginBottom: 4,
    textAlign: "right",
    width: "100%",
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    textAlign: "right",
    width: "100%",
  },
  picker: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
  },
  pickerText: { textAlign: "right", flex: 1, fontSize: 13 },
  pickerArrow: { fontSize: 12, marginLeft: 8 },
  toggleRow: { flexDirection: "row-reverse", gap: 8 },
  toggleBtn: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
  },
  toggleText: { fontWeight: "600" },
  list: { gap: 8, marginTop: 4 },
  empty: { textAlign: "right", fontSize: 12, padding: 10 },
  row: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rowInfo: { flex: 1, alignItems: "flex-end" },
  rowName: {
    fontWeight: "700",
    fontSize: 14,
    textAlign: "right",
    width: "100%",
  },
  rowMeta: { fontSize: 11, marginTop: 3, textAlign: "right" },
  rowQty: { fontSize: 12, marginTop: 3, textAlign: "right", fontWeight: "600" },
  rowTotal: {
    fontSize: 12,
    marginTop: 2,
    textAlign: "right",
    fontWeight: "700",
  },
  rowActions: { flexDirection: "row-reverse", gap: 6 },
  delBtn: { padding: 8, borderRadius: 7 },
  delText: { fontSize: 12 },
  suggestBox: {
    marginTop: 4,
    borderWidth: 1,
    borderRadius: 8,
    overflow: "hidden",
    maxHeight: 200,
  },
  suggestItem: { padding: 10, borderBottomWidth: 1 },
  suggestName: { fontWeight: "700", textAlign: "right", fontSize: 13 },
  suggestMeta: { fontSize: 11, textAlign: "right", marginTop: 2 },
  suggestEmpty: { padding: 10, textAlign: "right", fontSize: 12 },
  totalBox: {
    marginTop: 16,
    padding: 14,
    borderRadius: 10,
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
  },
  totalLabel: { fontWeight: "700", fontSize: 14 },
  totalValue: { fontWeight: "800", fontSize: 18 },
  primary: { padding: 14, borderRadius: 10, marginTop: 16 },
  primaryText: { color: "#fff", fontWeight: "700", textAlign: "center" },
  secondary: { padding: 12, borderRadius: 8, marginTop: 8 },
  secondaryText: { color: "#fff", fontWeight: "700", textAlign: "center" },
  disabled: { opacity: 0.5 },
  histRow: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  histDetails: { flex: 1, alignItems: "flex-end", paddingLeft: 12 },
  histActions: { flexDirection: "row", gap: 6, alignItems: "center" },
  iconBtn: {
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 36,
    alignItems: "center",
  },
  histName: { fontWeight: "700", fontSize: 14, textAlign: "right" },
  histMeta: {
    fontSize: 11,
    marginTop: 2,
    textAlign: "right",
    fontWeight: "600",
  },
  histDate: { fontSize: 10, marginTop: 2, textAlign: "right" },
  histTotal: {
    fontWeight: "800",
    fontSize: 16,
    marginTop: 6,
    textAlign: "right",
  },
  histType: { fontSize: 11, marginTop: 2, textAlign: "right" },

  // ✅ تنسيقات النافذة المنبثقة
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    width: "100%",
    borderRadius: 16,
    padding: 20,
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: "CodecBold",
    textAlign: "center",
    marginBottom: 15,
  },
  modalDetails: { marginBottom: 20, gap: 8 },
  modalText: { fontSize: 16, textAlign: "right" },
  modalTotal: {
    fontSize: 18,
    fontWeight: "bold",
    textAlign: "right",
    marginTop: 10,
  },
  modalActions: { flexDirection: "row-reverse", gap: 10, marginBottom: 10 },
  modalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  modalBtnText: { color: "#FFF", fontWeight: "bold", fontSize: 14 },
});
