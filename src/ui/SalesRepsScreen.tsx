import { useEffect, useMemo, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import BrandBanner from "./components/BrandBanner";
import { sqlite } from "../db/local";
import { useTheme } from "./ThemeContext";

const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

type Row = any;

export default function SalesRepsScreen({ onBack }: { onBack: () => void }) {
  const { colors } = useTheme();
  const [rows, setRows] = useState<Row[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [commissionRate, setCommissionRate] = useState("0");
  const [isActive, setIsActive] = useState(true);

  const [search, setSearch] = useState("");
  const [searchFocus, setSearchFocus] = useState(false);

  const load = async () => {
    try {
      const data: any = await sqlite.getAllAsync("SELECT * FROM sales_reps ORDER BY name ASC");
      setRows(data || []);
    } catch (e) { Alert.alert("تعذر تحميل المناديب", String(e)); }
  };

  useEffect(() => { void load(); }, []);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => `${r.code ?? ""} ${r.name ?? ""} ${r.phone ?? ""}`.toLowerCase().includes(q));
  }, [rows, search]);

  // 🚀 دالة توليد الكود التالي
  const nextCode = useMemo(() => {
    const nums = rows.map(r => parseInt(String(r.code).replace(/\D/g, ""), 10)).filter(n => !Number.isNaN(n));
    const next = nums.length ? Math.max(...nums) + 1 : 1;
    return `REP-${String(next).padStart(3, "0")}`;
  }, [rows]);

  const clearForm = () => {
    setEditingId(null); setCode(""); setName(""); setPhone(""); setCommissionRate("0"); setIsActive(true);
  };

  const save = async () => {
    try {
      const trimmedCode = code.trim();
      const trimmedName = name.trim();
      const rate = Number(commissionRate) || 0;

      if (!trimmedCode) return Alert.alert("تنبيه", "رمز المندوب مطلوب");
      if (!trimmedName) return Alert.alert("تنبيه", "اسم المندوب مطلوب");
      if (rows.some((r) => String(r.code ?? "").trim() === trimmedCode && r.id !== editingId)) return Alert.alert("تنبيه", "الرمز مستخدم مسبقاً");

      const now = Date.now();

      if (editingId) {
        await sqlite.runAsync(
          "UPDATE sales_reps SET code=?, name=?, phone=?, commission_rate=?, is_active=? WHERE id=?",
          [trimmedCode, trimmedName, phone.trim(), rate, isActive ? 1 : 0, editingId]
        );
      } else {
        await sqlite.runAsync(
          "INSERT INTO sales_reps (id, code, name, phone, commission_rate, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
          [newId(), trimmedCode, trimmedName, phone.trim(), rate, isActive ? 1 : 0, now]
        );
      }

      await load();
      const wasEdit = !!editingId;
      clearForm();
      Alert.alert("تم الحفظ", `تم ${wasEdit ? "تعديل" : "إضافة"} المندوب`);
    } catch (e) { Alert.alert("تعذر الحفظ", String(e)); }
  };

  const edit = (r: Row) => {
    setEditingId(r.id); setCode(String(r.code ?? "")); setName(String(r.name ?? "")); setPhone(String(r.phone ?? "")); setCommissionRate(String(r.commission_rate ?? "0")); setIsActive(!!r.is_active);
  };

  const remove = (r: Row) => {
    Alert.alert("تأكيد الحذف", `هل تريد حذف «${r.name}»؟`, [
      { text: "إلغاء", style: "cancel" },
      { text: "حذف", style: "destructive", onPress: async () => {
          try {
            await sqlite.runAsync("DELETE FROM sales_reps WHERE id = ?", [r.id]);
            await load();
            if (editingId === r.id) clearForm();
          } catch (e) { Alert.alert("تعذر الحذف", String(e)); }
      }},
    ]);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
        
        <Pressable android_ripple={{ color: "rgba(0,0,0,0.1)" }} style={styles.back} onPress={onBack}>
          <Text style={[styles.backText, { color: colors.blue }]}>‹ العودة إلى الوحدات المحاسبية</Text>
        </Pressable>

        <BrandBanner />
        <Text style={[styles.screenTitle, { color: colors.text }]}>مناديب المبيعات</Text>
        <Text style={[styles.hint, { color: colors.textMuted }]}>أضف مناديب المبيعات وحدد نسبة العمولة لكل منهم. سيتم ربطهم بالفواتير لحساب العمولات في التقارير.</Text>

        <Text style={[styles.label, { color: colors.textMuted }]}>بحث</Text>
        <TextInput style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]} value={search} onChangeText={setSearch} onFocus={() => setSearchFocus(true)} onBlur={() => setTimeout(() => setSearchFocus(false), 200)} placeholder="ابحث بالرمز أو الاسم أو الهاتف" placeholderTextColor={colors.textMuted} textAlign="right" />
        
        {searchFocus && search.trim().length > 0 && (
          <ScrollView style={[styles.suggestBox, { maxHeight: 200, backgroundColor: colors.surface, borderColor: colors.border }]} nestedScrollEnabled keyboardShouldPersistTaps="always">
            {filteredRows.length === 0 ? (
              <Text style={[styles.suggestEmpty, { color: colors.textMuted }]}>لا نتائج</Text>
            ) : (
              filteredRows.slice(0, 8).map((r) => (
                <Pressable android_ripple={{ color: "rgba(0,0,0,0.1)" }} key={r.id} style={[styles.suggestItem, { borderBottomColor: colors.bg }]} onPressIn={() => { edit(r); setSearch(""); setSearchFocus(false); }}>
                  <Text style={[styles.suggestName, { color: colors.text }]}>{r.name}</Text>
                  <Text style={[styles.suggestMeta, { color: colors.textMuted }]}>{r.code} · {r.phone || "—"}</Text>
                </Pressable>
              ))
            )}
          </ScrollView>
        )}

        <Text style={[styles.sectionTitle, { color: colors.text }]}>{editingId ? "تعديل المندوب" : "إضافة مندوب جديد"}</Text>

        <Text style={[styles.label, { color: colors.textMuted }]}>الرمز</Text>
        <View style={{ flexDirection: "row-reverse", gap: 8 }}>
          <TextInput style={[styles.input, { flex: 1, backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]} value={code} onChangeText={setCode} placeholder={nextCode} placeholderTextColor={colors.textMuted} textAlign="right" editable={!editingId} />
          {!editingId && (
            <Pressable android_ripple={{ color: "rgba(0,0,0,0.1)" }} style={[styles.genBtn, { backgroundColor: colors.blue }]} onPress={() => setCode(nextCode)}>
              <Text style={{ color: "#FFF", fontSize: 12, fontWeight: "700" }}>توليد</Text>
            </Pressable>
          )}
        </View>

        <Text style={[styles.label, { color: colors.textMuted }]}>اسم المندوب</Text>
        <TextInput style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]} value={name} onChangeText={setName} placeholder="اسم المندوب" placeholderTextColor={colors.textMuted} textAlign="right" />

        <Text style={[styles.label, { color: colors.textMuted }]}>رقم الهاتف (اختياري)</Text>
        <TextInput style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]} value={phone} onChangeText={setPhone} placeholder="7XXXXXXXX" placeholderTextColor={colors.textMuted} keyboardType="phone-pad" textAlign="right" />

        <Text style={[styles.label, { color: colors.textMuted }]}>نسبة العمولة (%)</Text>
        <TextInput style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]} value={commissionRate} onChangeText={setCommissionRate} placeholder="مثال: 5" placeholderTextColor={colors.textMuted} keyboardType="decimal-pad" textAlign="right" />

        <View style={[styles.switchRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Switch value={isActive} onValueChange={setIsActive} trackColor={{ false: "#CBD5E1", true: colors.orange }} thumbColor="#FFF" />
          <Text style={[styles.switchLabel, { color: colors.text }]}>المندوب نشط (متاح للاختيار في الفواتير)</Text>
        </View>

        <View style={styles.buttons}>
          <Pressable android_ripple={{ color: "rgba(0,0,0,0.1)" }} style={[styles.primary, { backgroundColor: colors.orange }]} onPress={save}>
            <Text style={styles.primaryText}>{editingId ? "حفظ التعديل" : "إضافة وحفظ"}</Text>
          </Pressable>
          {editingId && (
            <Pressable android_ripple={{ color: "rgba(0,0,0,0.1)" }} style={[styles.cancel, { borderColor: colors.border }]} onPress={clearForm}>
              <Text style={[styles.cancelText, { color: colors.text }]}>إلغاء</Text>
            </Pressable>
          )}
        </View>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>قائمة المناديب ({rows.length})</Text>
        <View style={styles.list}>
          {filteredRows.length === 0 ? (
            <Text style={[styles.empty, { color: colors.textMuted }]}>لا يوجد مناديب مسجلين.</Text>
          ) : (
            filteredRows.map((r) => (
              <View key={r.id} style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.rowActions}>
                  <Pressable android_ripple={{ color: "rgba(0,0,0,0.1)" }} onPress={() => edit(r)} style={[styles.editBtn, { backgroundColor: colors.isDark ? "#1E3A8A" : "#EFF6FF" }]}><Text style={styles.editText}>✏️</Text></Pressable>
                  <Pressable android_ripple={{ color: "rgba(0,0,0,0.1)" }} onPress={() => remove(r)} style={[styles.delBtn, { backgroundColor: colors.isDark ? "#7F1D1D" : "#fee2e2" }]}><Text style={styles.delText}>🗑️</Text></Pressable>
                </View>
                <View style={styles.rowInfo}>
                  <Text style={[styles.rowName, { color: colors.text }]}>{r.name}</Text>
                  <Text style={[styles.rowMeta, { color: colors.textMuted }]}>{r.code} · {r.phone || "—"}</Text>
                  <Text style={[styles.rowRate, { color: colors.blue }]}>العمولة: {r.commission_rate}%</Text>
                  {!r.is_active && <Text style={{ color: colors.danger, fontSize: 11, marginTop: 2, fontWeight: "700" }}>غير نشط</Text>}
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: { backgroundColor: "transparent", paddingHorizontal: 8, paddingTop: 16, paddingBottom: 40 },
  back: { paddingVertical: 10, alignSelf: "flex-start", marginBottom: 8 },
  backText: { textAlign: "left", fontWeight: "700" },
  screenTitle: { fontSize: 20, marginBottom: 6, textAlign: "left", width: "100%", fontFamily: "CodecBold" },
  hint: { fontSize: 12, marginBottom: 12, lineHeight: 18, textAlign: "left", width: "100%" },
  sectionTitle: { fontSize: 16, marginTop: 16, marginBottom: 8, textAlign: "left", width: "100%", fontFamily: "CodecBold" },
  label: { fontSize: 12, marginTop: 8, marginBottom: 4, textAlign: "right", width: "100%" },
  input: { borderWidth: 1, borderRadius: 8, padding: 10, fontSize: 14, textAlign: "right", width: "100%" },
  genBtn: { justifyContent: "center", alignItems: "center", paddingHorizontal: 12, borderRadius: 8 },
  switchRow: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center", borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, marginTop: 12 },
  switchLabel: { fontSize: 14, fontWeight: "700", flex: 1, textAlign: "right", marginRight: 10 },
  list: { gap: 8, marginTop: 4 },
  empty: { textAlign: "right", fontSize: 12, padding: 10 },
  row: { borderWidth: 1, borderRadius: 10, padding: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  rowInfo: { flex: 1, alignItems: "flex-end", paddingRight: 10 },
  rowName: { fontWeight: "700", fontSize: 14, textAlign: "right", width: "100%" },
  rowMeta: { fontSize: 11, marginTop: 3, textAlign: "right" },
  rowRate: { fontSize: 12, marginTop: 3, textAlign: "right", fontWeight: "700" },
  rowActions: { flexDirection: "row", gap: 6, alignItems: "center" },
  editBtn: { paddingHorizontal: 8, paddingVertical: 8, borderRadius: 8, minWidth: 36, alignItems: "center" },
  editText: { fontSize: 12 },
  delBtn: { paddingHorizontal: 8, paddingVertical: 8, borderRadius: 8, minWidth: 36, alignItems: "center" },
  delText: { fontSize: 12 },
  suggestBox: { marginTop: 4, borderWidth: 1, borderRadius: 8, overflow: "hidden", maxHeight: 200 },
  suggestItem: { padding: 10, borderBottomWidth: 1 },
  suggestName: { fontWeight: "700", textAlign: "right", fontSize: 13 },
  suggestMeta: { fontSize: 11, textAlign: "right", marginTop: 2 },
  suggestEmpty: { padding: 10, textAlign: "right", fontSize: 12 },
  buttons: { flexDirection: "row-reverse", gap: 8, marginTop: 16 },
  primary: { padding: 14, borderRadius: 10, flex: 1 },
  primaryText: { color: "#fff", fontWeight: "700", textAlign: "center" },
  cancel: { borderWidth: 1, padding: 13, borderRadius: 10 },
  cancelText: { textAlign: "center" },
});
