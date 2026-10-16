import { useEffect, useState } from "react";
import {
  Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from "react-native";
import { sqlite } from "../db/local";

const newId = () =>
  `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export default function SalesRepsScreen({ onBack }: { onBack: () => void }) {
  const [reps, setReps] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [phone, setPhone] = useState("");
  const [rate, setRate] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const rows: any = await sqlite.getAllAsync(
        "SELECT * FROM sales_reps ORDER BY is_active DESC, name"
      );
      setReps(rows || []);
    } catch (e) { Alert.alert("تعذر التحميل", String(e)); }
  };

  useEffect(() => { load(); }, []);

  const reset = () => {
    setName(""); setCode(""); setPhone(""); setRate(""); setEditingId(null);
  };

  const save = async () => {
    if (!name.trim()) return Alert.alert("تنبيه", "أدخل اسم المندوب");
    if (!code.trim()) return Alert.alert("تنبيه", "أدخل كود المندوب");
    const rateNum = Number(rate);
    if (Number.isNaN(rateNum) || rateNum < 0 || rateNum > 100)
      return Alert.alert("تنبيه", "أدخل نسبة عمولة بين 0 و 100");
    setSaving(true);
    try {
      if (editingId) {
        await sqlite.runAsync(
          "UPDATE sales_reps SET name=?, code=?, phone=?, commission_rate=? WHERE id=?",
          [name.trim(), code.trim(), phone.trim() || null, rateNum, editingId]
        );
      } else {
        await sqlite.runAsync(
          "INSERT INTO sales_reps (id, code, name, phone, commission_rate, is_active, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)",
          [newId(), code.trim(), name.trim(), phone.trim() || null, rateNum, Date.now()]
        );
      }
      reset();
      await load();
    } catch (e) { Alert.alert("تعذر الحفظ", String(e)); }
    finally { setSaving(false); }
  };

  const startEdit = (r: any) => {
    setEditingId(r.id); setName(r.name); setCode(r.code);
    setPhone(r.phone || ""); setRate(String(r.commission_rate || 0));
  };

  const toggleActive = async (r: any) => {
    await sqlite.runAsync("UPDATE sales_reps SET is_active = ? WHERE id = ?", [r.is_active ? 0 : 1, r.id]);
    await load();
  };

  const remove = (r: any) => {
    Alert.alert("تأكيد الحذف", `هل تريد حذف المندوب "${r.name}"؟`, [
      { text: "إلغاء", style: "cancel" },
      { text: "حذف", style: "destructive", onPress: async () => {
        try {
          await sqlite.runAsync("DELETE FROM sales_reps WHERE id = ?", [r.id]);
          await load();
        } catch (e) { Alert.alert("تعذر الحذف", String(e)); }
      }},
    ]);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 40, paddingHorizontal: 4 }}>
        <Pressable style={styles.back} onPress={onBack}>
          <Text style={styles.backText}>← العودة</Text>
        </Pressable>

        <Text style={styles.screenTitle}>مناديب المبيعات</Text>
        <Text style={styles.hint}>أضف مناديب المبيعات وحدد نسبة العمولة لكل واحد.</Text>

        <View style={styles.formBox}>
          <Text style={styles.label}>الاسم *</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="مثال: أحمد علي" placeholderTextColor="#888" />

          <Text style={styles.label}>الكود *</Text>
          <TextInput style={styles.input} value={code} onChangeText={setCode} placeholder="مثال: REP-001" placeholderTextColor="#888" />

          <Text style={styles.label}>الهاتف</Text>
          <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="7xxxxxxxx" placeholderTextColor="#888" keyboardType="phone-pad" />

          <Text style={styles.label}>نسبة العمولة % *</Text>
          <TextInput style={styles.input} value={rate} onChangeText={setRate} placeholder="مثال: 5" placeholderTextColor="#888" keyboardType="decimal-pad" />

          <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
            <Pressable style={[styles.saveBtn, saving && { opacity: 0.5 }]} onPress={save} disabled={saving}>
              <Text style={styles.saveBtnText}>{editingId ? "تحديث" : "إضافة"}</Text>
            </Pressable>
            {editingId && (
              <Pressable style={styles.cancelBtn} onPress={reset}>
                <Text style={styles.cancelBtnText}>إلغاء التعديل</Text>
              </Pressable>
            )}
          </View>
        </View>

        <Text style={styles.sectionTitle}>القائمة ({reps.length})</Text>

        {reps.length === 0 ? (
          <Text style={styles.empty}>لا يوجد مناديب بعد</Text>
        ) : (
          reps.map((r: any) => (
            <View key={r.id} style={[styles.repCard, !r.is_active && { opacity: 0.5 }]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.repName}>{r.name}</Text>
                <Text style={styles.repMeta}>{r.code} · {r.commission_rate}% {r.phone ? `· ${r.phone}` : ""}</Text>
              </View>
              <View style={{ flexDirection: "row", gap: 6 }}>
                <Pressable style={styles.iconBtn} onPress={() => startEdit(r)}>
                  <Text style={styles.iconBtnText}>✏️</Text>
                </Pressable>
                <Pressable style={styles.iconBtn} onPress={() => toggleActive(r)}>
                  <Text style={styles.iconBtnText}>{r.is_active ? "🚫" : "✅"}</Text>
                </Pressable>
                <Pressable style={styles.iconBtn} onPress={() => remove(r)}>
                  <Text style={styles.iconBtnText}>🗑️</Text>
                </Pressable>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  back: { paddingVertical: 10 },
  backText: { color: "#0a7ea4", fontSize: 14 },
  screenTitle: { fontSize: 22, fontWeight: "700", marginTop: 8, marginBottom: 4, color: "#111" },
  hint: { color: "#666", fontSize: 13, marginBottom: 16 },
  formBox: { backgroundColor: "#f5f5f5", padding: 12, borderRadius: 10, marginBottom: 16 },
  label: { fontSize: 13, color: "#333", marginTop: 8, marginBottom: 4, fontWeight: "600" },
  input: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#ddd", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 15 },
  saveBtn: { flex: 1, backgroundColor: "#0a7ea4", padding: 12, borderRadius: 8, alignItems: "center" },
  saveBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  cancelBtn: { flex: 1, backgroundColor: "#eee", padding: 12, borderRadius: 8, alignItems: "center" },
  cancelBtnText: { color: "#333", fontWeight: "600", fontSize: 15 },
  sectionTitle: { fontSize: 16, fontWeight: "700", marginTop: 8, marginBottom: 8, color: "#111" },
  empty: { textAlign: "center", color: "#888", padding: 20 },
  repCard: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderWidth: 1, borderColor: "#e5e5e5", borderRadius: 10, padding: 12, marginBottom: 8 },
  repName: { fontSize: 15, fontWeight: "700", color: "#111" },
  repMeta: { fontSize: 12, color: "#666", marginTop: 2 },
  iconBtn: { padding: 6 },
  iconBtnText: { fontSize: 18 },
});
