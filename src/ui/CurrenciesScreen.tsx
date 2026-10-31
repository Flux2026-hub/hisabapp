import { useEffect, useMemo, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import BrandBanner from "./components/BrandBanner";
import { sqlite } from "../db/local";
import { useTheme } from "./ThemeContext"; // 🚀 استدعاء مركز الألوان

const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

type Row = any;

export default function CurrenciesScreen({ onBack }: { onBack: () => void }) {
  const { colors } = useTheme(); // 🚀 قراءة الألوان
  const [rows, setRows] = useState<Row[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [exchangeRate, setExchangeRate] = useState("1");
  const [isBase, setIsBase] = useState(false);

  const load = async () => {
    try {
      const data: any = await sqlite.getAllAsync("SELECT * FROM currencies ORDER BY is_base DESC, code ASC");
      setRows(data || []);
    } catch (e) { Alert.alert("تعذر تحميل العملات", String(e)); }
  };

  useEffect(() => { void load(); }, []);

  const clearForm = () => {
    setEditingId(null); setCode(""); setName(""); setSymbol(""); setExchangeRate("1"); setIsBase(false);
  };

  const save = async () => {
    try {
      const trimmedCode = code.trim().toUpperCase();
      const trimmedName = name.trim();
      const trimmedSymbol = symbol.trim();
      const rate = Number(exchangeRate) || 1;

      if (!trimmedCode) return Alert.alert("تنبيه", "رمز العملة مطلوب (مثال: USD)");
      if (!trimmedName) return Alert.alert("تنبيه", "اسم العملة مطلوب");
      if (rows.some((r) => String(r.code ?? "").toUpperCase() === trimmedCode && r.id !== editingId)) return Alert.alert("تنبيه", "رمز العملة مستخدم مسبقاً");

      const now = Date.now();

      // إذا تم تحديدها كعملة أساسية، نجعل سعر الصرف 1 ونلغي الأساسية عن الباقي
      if (isBase) {
        await sqlite.runAsync("UPDATE currencies SET is_base = 0");
      }

      if (editingId) {
        await sqlite.runAsync(
          "UPDATE currencies SET code=?, name=?, symbol=?, exchange_rate=?, is_base=? WHERE id=?",
          [trimmedCode, trimmedName, trimmedSymbol, isBase ? 1 : rate, isBase ? 1 : 0, editingId]
        );
      } else {
        await sqlite.runAsync(
          "INSERT INTO currencies (id, code, name, symbol, exchange_rate, is_base, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
          [newId(), trimmedCode, trimmedName, trimmedSymbol, isBase ? 1 : rate, isBase ? 1 : 0, now]
        );
      }

      await load();
      const wasEdit = !!editingId;
      clearForm();
      Alert.alert("تم الحفظ", `تم ${wasEdit ? "تعديل" : "إضافة"} العملة`);
    } catch (e) { Alert.alert("تعذر الحفظ", String(e)); }
  };

  const edit = (r: Row) => {
    setEditingId(r.id); setCode(String(r.code ?? "")); setName(String(r.name ?? "")); setSymbol(String(r.symbol ?? "")); setExchangeRate(String(r.exchange_rate ?? "1")); setIsBase(!!r.is_base);
  };

  const remove = (r: Row) => {
    if (r.is_base) return Alert.alert("لا يمكن الحذف", "لا يمكن حذف العملة الأساسية للتطبيق.");
    Alert.alert("تأكيد الحذف", `هل تريد حذف «${r.name}»؟`, [
      { text: "إلغاء", style: "cancel" },
      { text: "حذف", style: "destructive", onPress: async () => {
          try {
            await sqlite.runAsync("DELETE FROM currencies WHERE id = ?", [r.id]);
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
        <Text style={[styles.screenTitle, { color: colors.text }]}>إدارة العملات</Text>
        <Text style={[styles.hint, { color: colors.textMuted }]}>حدد العملة الأساسية (مثل الريال اليمني) وأسعار صرف باقي العملات مقابلها. يتم استخدام هذه الأسعار في الفواتير والتقارير.</Text>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>{editingId ? "تعديل العملة" : "إضافة عملة جديدة"}</Text>

        <Text style={[styles.label, { color: colors.textMuted }]}>رمز العملة (ISO)</Text>
        <TextInput style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]} value={code} onChangeText={setCode} placeholder="USD, SAR, YER" placeholderTextColor={colors.textMuted} textAlign="right" autoCapitalize="characters" editable={!isBase && !editingId} />

        <Text style={[styles.label, { color: colors.textMuted }]}>اسم العملة</Text>
        <TextInput style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]} value={name} onChangeText={setName} placeholder="دولار أمريكي، ريال سعودي..." placeholderTextColor={colors.textMuted} textAlign="right" />

        <Text style={[styles.label, { color: colors.textMuted }]}>رمز العملة (Symbol)</Text>
        <TextInput style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]} value={symbol} onChangeText={setSymbol} placeholder="$, ر.س, ر.ي" placeholderTextColor={colors.textMuted} textAlign="right" />

        <View style={[styles.switchRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Switch value={isBase} onValueChange={setIsBase} trackColor={{ false: "#CBD5E1", true: colors.orange }} thumbColor="#FFF" disabled={!!editingId && isBase} />
          <Text style={[styles.switchLabel, { color: colors.text }]}>هل هذه هي العملة الأساسية؟</Text>
        </View>

        {!isBase && (
          <>
            <Text style={[styles.label, { color: colors.textMuted }]}>سعر الصرف (مقابل العملة الأساسية)</Text>
            <TextInput style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]} value={exchangeRate} onChangeText={setExchangeRate} placeholder="مثال: 140" placeholderTextColor={colors.textMuted} keyboardType="decimal-pad" textAlign="right" />
          </>
        )}

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

        <Text style={[styles.sectionTitle, { color: colors.text }]}>العملات المسجلة ({rows.length})</Text>
        <View style={styles.list}>
          {rows.length === 0 ? (
            <Text style={[styles.empty, { color: colors.textMuted }]}>لا توجد عملات مسجلة.</Text>
          ) : (
            rows.map((r) => (
              <View key={r.id} style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.rowActions}>
                  <Pressable android_ripple={{ color: "rgba(0,0,0,0.1)" }} onPress={() => edit(r)} style={[styles.editBtn, { backgroundColor: colors.isDark ? "#1E3A8A" : "#EFF6FF" }]}><Text style={styles.editText}>✏️</Text></Pressable>
                  {!r.is_base && (
                    <Pressable android_ripple={{ color: "rgba(0,0,0,0.1)" }} onPress={() => remove(r)} style={[styles.delBtn, { backgroundColor: colors.isDark ? "#7F1D1D" : "#fee2e2" }]}><Text style={styles.delText}>🗑️</Text></Pressable>
                  )}
                </View>
                <View style={styles.rowInfo}>
                  <Text style={[styles.rowName, { color: colors.text }]}>{r.name} ({r.code}) {r.symbol ? `- ${r.symbol}` : ""}</Text>
                  {r.is_base ? (
                    <Text style={[styles.rowBase, { color: colors.success }]}>⭐ العملة الأساسية</Text>
                  ) : (
                    <Text style={[styles.rowRate, { color: colors.blue }]}>سعر الصرف: {Number(r.exchange_rate).toFixed(2)}</Text>
                  )}
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
  switchRow: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center", borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, marginTop: 12 },
  switchLabel: { fontSize: 14, fontWeight: "700", flex: 1, textAlign: "right", marginRight: 10 },
  list: { gap: 8, marginTop: 4 },
  empty: { textAlign: "right", fontSize: 12, padding: 10 },
  row: { borderWidth: 1, borderRadius: 10, padding: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  rowInfo: { flex: 1, alignItems: "flex-end", paddingRight: 10 },
  rowName: { fontWeight: "700", fontSize: 14, textAlign: "right", width: "100%" },
  rowBase: { fontSize: 12, marginTop: 4, textAlign: "right", fontWeight: "700" },
  rowRate: { fontSize: 12, marginTop: 4, textAlign: "right", fontWeight: "600" },
  rowActions: { flexDirection: "row", gap: 6, alignItems: "center" },
  editBtn: { paddingHorizontal: 8, paddingVertical: 8, borderRadius: 8, minWidth: 36, alignItems: "center" },
  editText: { fontSize: 12 },
  delBtn: { paddingHorizontal: 8, paddingVertical: 8, borderRadius: 8, minWidth: 36, alignItems: "center" },
  delText: { fontSize: 12 },
  buttons: { flexDirection: "row-reverse", gap: 8, marginTop: 16 },
  primary: { padding: 14, borderRadius: 10, flex: 1 },
  primaryText: { color: "#fff", fontWeight: "700", textAlign: "center" },
  cancel: { borderWidth: 1, padding: 13, borderRadius: 10 },
  cancelText: { textAlign: "center" },
});
