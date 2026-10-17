import { useEffect, useState } from "react";
import {
  Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from "react-native";
import { sqlite } from "../db/local";
import DateTimePicker from "@react-native-community/datetimepicker";

type Row = any;

const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export default function TransfersScreen({ onBack }: { onBack: () => void }) {
  const [cashboxes, setCashboxes] = useState<Row[]>([]);
  const [from, setFrom] = useState<Row | null>(null);
  const [to, setTo] = useState<Row | null>(null);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [showFrom, setShowFrom] = useState(false);
  const [showTo, setShowTo] = useState(false);
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<Row[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const cb: any = await sqlite.getAllAsync(
          "SELECT id, code, name, balance FROM cashboxes ORDER BY name"
        );
        setCashboxes(cb || []);
        await loadHistory();
      } catch (e) {
        Alert.alert("تعذر التحميل", String(e));
      }
    })();
  }, []);

  const loadHistory = async () => {
    const rows: any = await sqlite.getAllAsync(
      `SELECT id, transfer_no, from_account, to_account, amount, description, created_at
       FROM account_transfers ORDER BY created_at DESC LIMIT 10`
    );
    setHistory(rows || []);
  };

  const canSave =
    !!from && !!to && from.id !== to.id && Number(amount) > 0 && !saving;

  const save = () => {
    if (!canSave || !from || !to) return;
    const amt = Number(amount);
    if (amt > Number(from.balance)) {
      Alert.alert("رصيد غير كافٍ", `الصندوق المصدر يحتوي على ${Number(from.balance).toFixed(2)} فقط`);
      return;
    }
    Alert.alert(
      "تأكيد التحويل",
      `تحويل ${amt.toFixed(2)} من "${from.name}" إلى "${to.name}"`,
      [
        { text: "إلغاء", style: "cancel" },
        { text: "تنفيذ", onPress: doSave },
      ]
    );
  };

  const doSave = async () => {
    if (!from || !to) return;
    setSaving(true);
    try {
      const now = Date.now();
      const amt = Number(amount);
      const prefix = "TRF";
      const last: any = await sqlite.getAllAsync(
        `SELECT transfer_no FROM account_transfers WHERE transfer_no LIKE ? ORDER BY created_at DESC LIMIT 1`,
        [`${prefix}-%`]
      );
      let nextNum = 1;
      if (last && last.length > 0) {
        nextNum = parseInt(String(last[0].transfer_no).replace(/\D/g, ""), 10) + 1;
      }
      const transferNo = `${prefix}-${String(nextNum).padStart(3, "0")}`;

      await sqlite.runAsync(
        `INSERT INTO account_transfers
         (id, transfer_no, from_account, to_account, amount, description, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [newId(), transferNo, from.name, to.name, amt, description.trim(), now]
      );

      await sqlite.runAsync(
        "UPDATE cashboxes SET balance = balance - ? WHERE id = ?",
        [amt, from.id]
      );
      await sqlite.runAsync(
        "UPDATE cashboxes SET balance = balance + ? WHERE id = ?",
        [amt, to.id]
      );

      Alert.alert("تم التحويل بنجاح", `رقم التحويل: ${transferNo}`);
      setFrom(null);
      setTo(null);
      setAmount("");
      setDescription("");

      const refreshed: any = await sqlite.getAllAsync(
        "SELECT id, code, name, balance FROM cashboxes ORDER BY name"
      );
      setCashboxes(refreshed || []);
      await loadHistory();
    } catch (e) {
      Alert.alert("تعذر التحويل", String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets={true} contentContainerStyle={{ paddingBottom: 40, paddingHorizontal: 4 }}>
        <Pressable style={styles.back} onPress={onBack}>
          <Text style={styles.backText}>العودة -> إلى الوحدات المحاسبية</Text>
        </Pressable>

        <Text style={styles.screenTitle}>التحويلات بين الصناديق</Text>
        <Text style={styles.hint}>
          نقل مبلغ من صندوق إلى آخر. يجب أن يكون رصيد الصندوق المصدر كافياً.
        </Text>

        <Text style={styles.label}>من صندوق</Text>
        <Pressable style={styles.picker} onPress={() => setShowFrom((v) => !v)}>
          <Text style={styles.pickerText}>
            {from ? `${from.name} (${Number(from.balance).toFixed(2)})` : "اختر الصندوق المصدر"}
          </Text>
          <Text style={styles.pickerArrow}>▼</Text>
        </Pressable>
        {showFrom && (
          <View style={styles.suggestBox}>
            {cashboxes.length === 0 ? (
              <Text style={styles.suggestEmpty}>لا توجد صناديق</Text>
            ) : (
              cashboxes.map((c) => (
                <Pressable key={c.id} style={styles.suggestItem} onPress={() => { setFrom(c); setShowFrom(false); }}>
                  <Text style={styles.suggestName}>{c.name}</Text>
                  <Text style={styles.suggestMeta}>{c.code} · الرصيد: {Number(c.balance || 0).toFixed(2)}</Text>
                </Pressable>
              ))
            )}
          </View>
        )}

        <Text style={styles.label}>إلى صندوق</Text>
        <Pressable style={styles.picker} onPress={() => setShowTo((v) => !v)}>
          <Text style={styles.pickerText}>
            {to ? `${to.name} (${Number(to.balance).toFixed(2)})` : "اختر الصندوق الهدف"}
          </Text>
          <Text style={styles.pickerArrow}>▼</Text>
        </Pressable>
        {showTo && (
          <View style={styles.suggestBox}>
            {cashboxes.filter((c) => c.id !== from?.id).length === 0 ? (
              <Text style={styles.suggestEmpty}>لا توجد صناديق أخرى</Text>
            ) : (
              cashboxes.filter((c) => c.id !== from?.id).map((c) => (
                <Pressable key={c.id} style={styles.suggestItem} onPress={() => { setTo(c); setShowTo(false); }}>
                  <Text style={styles.suggestName}>{c.name}</Text>
                  <Text style={styles.suggestMeta}>{c.code} · الرصيد: {Number(c.balance || 0).toFixed(2)}</Text>
                </Pressable>
              ))
            )}
          </View>
        )}

        <Text style={styles.label}>المبلغ</Text>
        <TextInput
          style={styles.input}
          value={amount}
          onChangeText={setAmount}
          placeholder="0"
          placeholderTextColor="#9CA3AF"
          keyboardType="decimal-pad"
          textAlign="right"
        />

        <Text style={styles.label}>البيان (اختياري)</Text>
        <TextInput
          style={[styles.input, { minHeight: 60 }]}
          value={description}
          onChangeText={setDescription}
          placeholder="سبب التحويل"
          placeholderTextColor="#9CA3AF"
          textAlign="right"
          multiline
        />

        <Pressable style={[styles.primary, (!canSave || saving) && styles.disabled]} onPress={save} disabled={!canSave || saving}>
          <Text style={styles.primaryText}>{saving ? "جارٍ التنفيذ..." : "تنفيذ التحويل"}</Text>
        </Pressable>

        {history.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>آخر التحويلات</Text>
            <View style={styles.list}>
              {history.map((h) => (
                <View key={h.id} style={styles.histRow}>
                  <View style={styles.histRight}>
                    <Text style={styles.histAmount}>{Number(h.amount).toFixed(2)}</Text>
                  </View>
                  <View style={styles.histInfo}>
                    <Text style={styles.histName}>{h.from_account} → {h.to_account}</Text>
                    <Text style={styles.histMeta}>{h.transfer_no}</Text>
                    <Text style={styles.histDate}>{new Date(h.created_at).toLocaleString("ar-EG")}</Text>
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
  screenTitle: {   fontSize: 20,  color: "#0F172A", textAlign: "right", marginBottom: 6, fontFamily: "Alexandria-Regular",
   },
  hint: { fontSize: 12, color: "#8494B0", textAlign: "right", marginBottom: 12, lineHeight: 18 },
  sectionTitle: { fontSize: 16,  color: "#0F172A", textAlign: "right", marginTop: 16, marginBottom: 8 },
  label: { fontSize: 12, color: "#526078", textAlign: "right", marginTop: 8, marginBottom: 4 },
  input: { backgroundColor: "#f8fafc", borderWidth: 1, borderColor: "#D6E3F8", borderRadius: 8, padding: 10, fontSize: 14, color: "#0F172A" },
  picker: { backgroundColor: "#f8fafc", borderWidth: 1, borderColor: "#D6E3F8", borderRadius: 8, padding: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  pickerText: { color: "#0F172A", textAlign: "right", flex: 1, fontSize: 14 },
  pickerArrow: { color: "#8494B0", fontSize: 12, marginLeft: 8 },
  list: { gap: 8, marginTop: 4 },
  suggestBox: { marginTop: 4, backgroundColor: "#ffffff", borderWidth: 1, borderColor: "#D6E3F8", borderRadius: 8, overflow: "hidden" },
  suggestItem: { padding: 10, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  suggestName: { fontWeight: "700", color: "#0F172A", textAlign: "right", fontSize: 13 },
  suggestMeta: { fontSize: 11, color: "#8494B0", textAlign: "right", marginTop: 2 },
  suggestEmpty: { padding: 10, color: "#8494B0", textAlign: "right", fontSize: 12 },
  primary: { backgroundColor: "#F97316", padding: 14, borderRadius: 10, marginTop: 16 },
  primaryText: { color: "#fff", fontWeight: "700", textAlign: "center" },
  disabled: { opacity: 0.5 },
  histRow: { backgroundColor: "#f8fafc", borderWidth: 1, borderColor: "#D6E3F8", borderRadius: 10, padding: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  histInfo: { flex: 1, alignItems: "flex-end" },
  histRight: { alignItems: "flex-start", paddingRight: 8 },
  histName: { fontWeight: "700", color: "#0F172A", textAlign: "right" },
  histMeta: { fontSize: 11, color: "#1E40AF", marginTop: 2, textAlign: "right", fontWeight: "600" },
  histDate: { fontSize: 10, color: "#8494B0", marginTop: 2, textAlign: "right" },
  histAmount: { fontWeight: "800", fontSize: 15, color: "#1E40AF" },
});