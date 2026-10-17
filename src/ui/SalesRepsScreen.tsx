import { useEffect, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { sqlite } from "../db/local";

const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

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
      const rows: any = await sqlite.getAllAsync("SELECT * FROM sales_reps ORDER BY is_active DESC, name");
      setReps(rows || []);
    } catch (e) { Alert.alert("تعذر التحميل", String(e)); }
  };

  useEffect(() => { load(); }, []);
  const reset = () => { setName(""); setCode(""); setPhone(""); setRate(""); setEditingId(null); };

  const save = async () => {
    if (!name.trim()) return Alert.alert("تنبيه", "أدخل اسم المندوب");
    if (!code.trim()) return Alert.alert("تنبيه", "أدخل كود المندوب");
    const rateNum = Number(rate);
    if (Number.isNaN(rateNum) || rateNum < 0 || rateNum > 100)
      return Alert.alert("تنبيه", "أدخل نسبة عمولة بين 0 و 100");
    setSaving(true);
    try {
      if (editingId) {
        await sqlite.runAsync("UPDATE sales_reps SET name=?, code=?, phone=?, commission_rate=? WHERE id=?", [name.trim(), code.trim(), phone.trim() || null, rateNum, editingId]);
      } else {
        await sqlite.runAsync("INSERT INTO sales_reps (id, code, name, phone, commission_rate, is_active, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)", [newId(), code.trim(), name.trim(), phone.trim() || null, rateNum, Date.now()]);
      }
      reset();
      await load();
    } catch (e) { Alert.alert("تعذر الحفظ", String(e)); }
    finally { setSaving(false); }
  };

  const startEdit = (r: any) => { setEditingId(r.id); setName(r.name); setCode(r.code); setPhone(r.phone || ""); setRate(String(r.commission_rate || 0)); };
  const toggleActive = async (r: any) => { await sqlite.runAsync("UPDATE sales_reps SET is_active = ? WHERE id = ?", [r.is_active ? 0 : 1, r.id]); await load(); };
  const remove = (r: any) => Alert.alert("تأكيد الحذف", `هل تريد حذف المندوب "${r.name}"؟`, [
    { text: "إلغاء", style: "cancel" },
    { text: "حذف", style: "destructive", onPress: async () => { try { await sqlite.runAsync("DELETE FROM sales_reps WHERE id = ?", [r.id]); await load(); } catch (e) { Alert.alert("تعذر الحذف", String(e)); } } },
  ]);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets={true} contentContainerStyle={{ paddingBottom: 40, paddingHorizontal: 4 }}>
        <Pressable style={styles.back} onPress={onBack}>
          <Text style={styles.backText}>{"->"} العودة إلى الوحدات المحاسبية</Text>
        </Pressable>

        <Text style={styles.screenTitle}>مناديب المبيعات</Text>
        <Text style={styles.hint}>أضف مناديب المبيعات وحدد نسبة العمولة لكل واحد.</Text>

        <View style={styles.formBox}>
          <Text style={styles.label}>الاسم *</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="مثال: أحمد علي" placeholderTextColor="#8494B0" />

          <Text style={styles.label}>الكود *</Text>
          <TextInput style={styles.input} value={code} onChangeText={setCode} placeholder="مثال: REP-001" placeholderTextColor="#8494B0" />

          <Text style={styles.label}>الهاتف</Text>
          <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="7xxxxxxxx" placeholderTextColor="#8494B0" keyboardType="phone-pad" />

          <Text style={styles.label}>نسبة العمولة % *</Text>
          <TextInput style={styles.input} value={rate} onChangeText={setRate} placeholder="مثال: 5" placeholderTextColor="#8494B0" keyboardType="decimal-pad" />

          <View style={styles.buttons}>
            <Pressable style={[styles.primary, saving && { opacity: 0.5 }]} onPress={save} disabled={saving}>
              <Text style={styles.primaryText}>{editingId ? "تحديث المندوب" : "إضافة المندوب"}</Text>
            </Pressable>
            {editingId && (
              <Pressable style={styles.cancel} onPress={reset}>
                <Text style={styles.cancelText}>إلغاء</Text>
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
                <Text style={styles.repMeta}>{r.code} · عمولة {r.commission_rate}%{r.phone ? ` · ${r.phone}` : ""}</Text>
              </View>
              <View style={styles.rowActions}>
                <Pressable style={styles.editBtn} onPress={() => startEdit(r)}>
                  <Text style={styles.editText}>تعديل</Text>
                </Pressable>
                <Pressable style={styles.editBtn} onPress={() => toggleActive(r)}>
                  <Text style={styles.editText}>{r.is_active ? "إيقاف" : "تشغيل"}</Text>
                </Pressable>
                <Pressable style={styles.delBtn} onPress={() => remove(r)}>
                  <Text style={styles.delText}>حذف</Text>
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
  back: {  paddingVertical: 10, alignSelf: "flex-end", marginBottom: 8 },
  backText: {  color: "#1E40AF", textAlign: "right", fontWeight: "700" },
  screenTitle: {fontSize: 22,  color: "#0F172A", textAlign: "right", marginBottom: 6, fontFamily: "CodecBold"},
  hint: { fontSize: 12, color: "#8494B0", textAlign: "right", marginBottom: 14, lineHeight: 18 },
  formBox: { backgroundColor: "#EFF6FF", padding: 14, borderRadius: 12, marginBottom: 16, borderWidth: 1, borderColor: "#D6E3F8" },
  label: { fontSize: 13, color: "#0F172A", marginTop: 8, marginBottom: 4, fontWeight: "700", textAlign: "right" },
  input: { backgroundColor: "#ffffff", borderWidth: 1, borderColor: "#D6E3F8", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 9, fontSize: 15, color: "#0F172A", textAlign: "right" },
  buttons: { flexDirection: "row-reverse", gap: 8, marginTop: 16 },
  primary: { backgroundColor: "#F97316", padding: 14, borderRadius: 10, flex: 1 },
  primaryText: { color: "#fff", fontWeight: "700", textAlign: "center" },
  cancel: { borderWidth: 1, borderColor: "#d1d5db", padding: 13, borderRadius: 10, flex: 1 },
  cancelText: { color: "#0F172A", textAlign: "center", fontWeight: "700" },
  sectionTitle: {fontSize: 16,  color: "#0F172A", textAlign: "right", marginTop: 8, marginBottom: 8 , fontFamily: "CodecBold"},
  empty: { textAlign: "center", color: "#8494B0", padding: 20 },
  repCard: { backgroundColor: "#ffffff", borderWidth: 1, borderColor: "#D6E3F8", borderRadius: 12, padding: 12, marginBottom: 8 },
  repName: { fontSize: 15, fontWeight: "800", color: "#0F172A", textAlign: "right" },
  repMeta: { fontSize: 12, color: "#8494B0", marginTop: 4, textAlign: "right" },
  rowActions: { flexDirection: "row-reverse", gap: 6, marginTop: 8, justifyContent: "flex-end" },
  editBtn: { backgroundColor: "#EFF6FF", padding: 8, borderRadius: 7 },
  editText: { color: "#0F172A", fontSize: 12, fontWeight: "600" },
  delBtn: { backgroundColor: "#fee2e2", padding: 8, borderRadius: 7 },
  delText: { color: "#0F172A", fontSize: 12, fontWeight: "600" },
});
