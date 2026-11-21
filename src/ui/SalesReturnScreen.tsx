import { useEffect, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Pressable,
  Platform,
} from "react-native";
import { sqlite } from "../db/local";

const newId = () =>
  `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export default function SalesReturnScreen({
  invoiceId,
  onBack,
}: {
  invoiceId: string;
  onBack: () => void;
}) {
  const [invoice, setInvoice] = useState<any>(null);
  const [lines, setLines] = useState<any[]>([]);
  const [refundType, setRefundType] = useState<"cash" | "credit">("credit");
  const [cashboxes, setCashboxes] = useState<any[]>([]);
  const [cashbox, setCashbox] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const inv: any = await sqlite.getFirstAsync(
          "SELECT * FROM invoices WHERE id = ?",
          [invoiceId],
        );
        if (!inv) return Alert.alert("خطأ", "الفاتورة غير موجودة");
        setInvoice(inv);
        const invLines: any = await sqlite.getAllAsync(
          "SELECT * FROM invoice_lines WHERE invoice_id = ?",
          [invoiceId],
        );
        setLines((invLines || []).map((l: any) => ({ ...l, returnQty: "" })));
        const cb: any = await sqlite.getAllAsync(
          "SELECT id, name FROM cashboxes ORDER BY name",
        );
        setCashboxes(cb || []);
        if (cb && cb.length > 0) setCashbox(cb[0]);
        if (inv.payment_type === "credit") setRefundType("credit");
        else setRefundType("cash");
      } catch (e) {
        Alert.alert("تعذر التحميل", String(e));
      }
    })();
  }, [invoiceId]);

  const getTotalReturn = () =>
    lines.reduce(
      (sum, l) => sum + (Number(l.returnQty) || 0) * Number(l.unit_price),
      0,
    );
  const totalReturnAmount = getTotalReturn();
  const hasItems = lines.some((l) => (Number(l.returnQty) || 0) > 0);

  const save = async () => {
    if (!invoice || !hasItems)
      return Alert.alert("تنبيه", "أدخل كمية لصنف واحد على الأقل");
    if (refundType === "cash" && !cashbox)
      return Alert.alert("تنبيه", "اختر الصندوق");

    setSaving(true);
    try {
      const now = Date.now();
      const last: any = await sqlite.getAllAsync(
        `SELECT return_no FROM sales_returns ORDER BY created_at DESC LIMIT 1`,
      );
      let nextNum = 1;
      if (last && last.length > 0)
        nextNum =
          parseInt(String(last[0].return_no).replace(/\D/g, ""), 10) + 1;
      const returnNo = `RET-${String(nextNum).padStart(3, "0")}`;
      const returnId = newId();

      await sqlite.runAsync(
        `INSERT INTO sales_returns (id, return_no, invoice_id, invoice_no, customer_id, customer_name, total, refund_type, cashbox_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          returnId,
          returnNo,
          invoice.id,
          invoice.invoice_no,
          invoice.party_id,
          invoice.party_name,
          totalReturnAmount,
          refundType,
          refundType === "cash" ? cashbox?.id : null,
          now,
        ],
      );

      for (const l of lines) {
        const qty = Number(l.returnQty) || 0;
        if (qty <= 0) continue;
        const lineTotal = qty * Number(l.unit_price);
        await sqlite.runAsync(
          `INSERT INTO sales_return_lines (id, return_id, item_id, item_name, quantity, unit_price, line_total) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            newId(),
            returnId,
            l.item_id,
            l.description,
            qty,
            l.unit_price,
            lineTotal,
          ],
        );
        await sqlite.runAsync(
          "UPDATE items SET stock_quantity = stock_quantity + ?, updated_at = ? WHERE id = ?",
          [qty, now, l.item_id],
        );
        await sqlite.runAsync(
          `INSERT INTO stock_movements (id, source_type, source_id, item_id, warehouse_id, movement_type, quantity_in, quantity_out, planned_quantity, waste_quantity, unit_cost, created_at) VALUES (?, 'sales_return', ?, ?, 'wh-final', 'return_in', ?, 0, 0, 0, ?, ?)`,
          [newId(), returnId, l.item_id, qty, l.unit_price, now],
        );
      }

      const rate = Number(invoice.exchange_rate) || 1;
      const baseReturnAmount = totalReturnAmount * rate;

      if (refundType === "credit" && invoice.party_id)
        await sqlite.runAsync(
          "UPDATE customers SET balance = balance - ? WHERE id = ?",
          [baseReturnAmount, invoice.party_id],
        );
      else if (refundType === "cash" && cashbox)
        await sqlite.runAsync(
          "UPDATE cashboxes SET balance = balance - ? WHERE id = ?",
          [baseReturnAmount, cashbox.id],
        );

      Alert.alert("تم بنجاح", `رقم المرتجع: ${returnNo}`);
      onBack();
    } catch (e) {
      Alert.alert("تعذر الحفظ", String(e));
    } finally {
      setSaving(false);
    }
  };

  if (!invoice)
    return (
      <Text style={{ padding: 20, textAlign: "center", marginTop: 50 }}>
        جاري التحميل...
      </Text>
    );

  return (
    <ScrollView
      contentContainerStyle={{
        backgroundColor: "#ffffff",
        marginHorizontal: 16,
        marginTop: 16,
        marginBottom: 16,
        borderRadius: 16,
        padding: 20,
        paddingBottom: 40,
      }}
    >
      <Pressable
        android_ripple={{ color: "rgba(0,0,0,0.1)" }}
        style={styles.back}
        onPress={onBack}
      >
        <Text style={styles.backText}>{"&gt;"} العودة لسجل المبيعات</Text>
      </Pressable>
      <Text style={styles.screenTitle}>مرتجع مبيعات</Text>
      <Text style={styles.hint}>
        الفاتورة: {invoice.invoice_no} · العميل: {invoice.party_name}
      </Text>

      <Text style={styles.sectionTitle}>البنود</Text>
      {lines.map((l, idx) => (
        <View key={l.id} style={styles.lineBox}>
          <Text style={styles.lineName}>{l.description}</Text>
          <Text style={styles.lineMeta}>
            الكمية الأصلية: {l.quantity} · السعر: {l.unit_price}
          </Text>
          <View
            style={{
              flexDirection: "row-reverse",
              alignItems: "center",
              marginTop: 8,
              gap: 8,
            }}
          >
            <Text style={{ fontSize: 13, color: "#0F172A", fontWeight: "700" }}>
              الكمية المرتجعة:
            </Text>
            <TextInput
              style={[styles.input, { flex: 1, paddingVertical: 6 }]}
              value={l.returnQty}
              onChangeText={(val) => {
                const newLines = [...lines];
                newLines[idx].returnQty = val;
                setLines(newLines);
              }}
              keyboardType="decimal-pad"
              placeholder="0"
              textAlign="center"
            />
          </View>
        </View>
      ))}

      <Text style={styles.sectionTitle}>طريقة الاسترداد</Text>
      <View style={{ flexDirection: "row-reverse", gap: 8, marginBottom: 8 }}>
        <Pressable
          android_ripple={{ color: "rgba(0,0,0,0.1)" }}
          style={[
            styles.typeBtn,
            refundType === "credit" && styles.typeBtnActive,
          ]}
          onPress={() => setRefundType("credit")}
        >
          <Text
            style={[
              styles.typeText,
              refundType === "credit" && styles.typeTextActive,
            ]}
          >
            خصم من رصيد العميل
          </Text>
        </Pressable>
        <Pressable
          android_ripple={{ color: "rgba(0,0,0,0.1)" }}
          style={[
            styles.typeBtn,
            refundType === "cash" && styles.typeBtnActive,
          ]}
          onPress={() => setRefundType("cash")}
        >
          <Text
            style={[
              styles.typeText,
              refundType === "cash" && styles.typeTextActive,
            ]}
          >
            إرجاع نقدي
          </Text>
        </Pressable>
      </View>

      {refundType === "cash" && (
        <View style={{ marginTop: 8 }}>
          <Text style={styles.label}>اختر الصندوق</Text>
          <View style={styles.suggestBox}>
            {cashboxes.map((c) => (
              <Pressable
                android_ripple={{ color: "rgba(0,0,0,0.1)" }}
                key={c.id}
                style={styles.suggestItem}
                onPressIn={() => setCashbox(c)}
              >
                <Text style={styles.suggestName}>{c.name}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      <View style={styles.totalBox}>
        <Text style={styles.totalLabel}>إجمالي المرتجع</Text>
        <Text style={styles.totalValue}>
          {totalReturnAmount.toFixed(2)} {invoice.currency_code}
        </Text>
      </View>

      <Pressable
        android_ripple={{ color: "rgba(0,0,0,0.1)" }}
        style={[styles.primary, (!hasItems || saving) && { opacity: 0.5 }]}
        onPress={save}
        disabled={!hasItems || saving}
      >
        <Text style={styles.primaryText}>
          {saving ? "جارٍ الحفظ..." : "حفظ المرتجع"}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  back: { paddingVertical: 10, marginBottom: 8, alignSelf: "flex-end" },
  backText: { color: "#1E40AF", fontWeight: "700", textAlign: "right" },
  screenTitle: {
    fontSize: 22,
    color: "#0F172A",
    marginBottom: 6,
    textAlign: "right",
    writingDirection: "rtl",
    width: "100%",
    fontFamily: "CodecBold",
  },
  hint: {
    fontSize: 12,
    color: "#8494B0",
    marginBottom: 14,
    textAlign: "right",
    writingDirection: "rtl",
    width: "100%",
  },
  sectionTitle: {
    fontSize: 16,
    color: "#0F172A",
    marginTop: 16,
    marginBottom: 8,
    textAlign: "right",
    writingDirection: "rtl",
    width: "100%",
    fontFamily: "CodecBold",
  },
  lineBox: {
    backgroundColor: "#f8fafc",
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#D6E3F8",
  },
  lineName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0F172A",
    textAlign: "right",
  },
  lineMeta: {
    fontSize: 12,
    color: "#8494B0",
    textAlign: "right",
    marginTop: 4,
  },
  input: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#D6E3F8",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 9,
    fontSize: 15,
    color: "#0F172A",
    textAlign: "right",
    writingDirection: "rtl",
    width: "100%",
  },
  label: {
    fontSize: 12,
    color: "#526078",
    marginTop: 8,
    marginBottom: 4,
    textAlign: "right",
    writingDirection: "rtl",
    width: "100%",
  },
  typeBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#D6E3F8",
    backgroundColor: "#ffffff",
    alignItems: "center",
  },
  typeBtnActive: { backgroundColor: "#1E40AF", borderColor: "#1E40AF" },
  typeText: {
    color: "#0F172A",
    fontWeight: "700",
    fontSize: 12,
    textAlign: "center",
  },
  typeTextActive: { color: "#ffffff" },
  suggestBox: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#D6E3F8",
    borderRadius: 8,
    overflow: "hidden",
    maxHeight: 150,
    marginTop: 4,
  },
  suggestItem: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  suggestName: {
    fontWeight: "700",
    color: "#0F172A",
    textAlign: "right",
    fontSize: 13,
  },
  totalBox: {
    marginTop: 16,
    backgroundColor: "#EFF6FF",
    padding: 14,
    borderRadius: 10,
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
  },
  totalLabel: { color: "#1E40AF", fontWeight: "700", fontSize: 14 },
  totalValue: { color: "#1E40AF", fontWeight: "800", fontSize: 18 },
  primary: {
    backgroundColor: "#F97316",
    padding: 14,
    borderRadius: 10,
    marginTop: 16,
  },
  primaryText: { color: "#fff", fontWeight: "700", textAlign: "center" },
});
