import { useEffect, useMemo, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import BrandBanner from "./components/BrandBanner";
import { createAccount, deleteAccount, listAccounts, updateAccount } from "../sync/accounting";
import { useTheme } from "./ThemeContext";

type Row = any;
type AccountType = "asset" | "liability" | "income" | "expense";

const TYPES: { key: AccountType; label: string; color: string }[] = [
  { key: "asset", label: "أصول", color: "#0b806c" },
  { key: "liability", label: "خصوم", color: "#dc2626" },
  { key: "income", label: "إيرادات", color: "#3b82f6" },
  { key: "expense", label: "مصروفات", color: "#f59e0b" },
];

const TYPE_MAP: Record<string, AccountType> = {
  asset: "asset", liability: "liability", income: "income", expense: "expense",
};

export default function AccountsScreen({ onBack }: { onBack: () => void }) {
  const { colors } = useTheme();
  const [rows, setRows] = useState<Row[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<AccountType>("asset");

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [parentCode, setParentCode] = useState("");
  const [parentLabel, setParentLabel] = useState("");
  const [initialBalance, setInitialBalance] = useState("");

  const [search, setSearch] = useState("");
  const [searchFocus, setSearchFocus] = useState(false);
  const [showParentPicker, setShowParentPicker] = useState(false);

  const load = async () => {
    try {
      const data = await listAccounts();
      setRows(data || []);
    } catch (e) { Alert.alert("تعذر تحميل الحسابات", String(e)); }
  };

  useEffect(() => { void load(); }, []);

  const typeOf = (r: Row): AccountType => TYPE_MAP[String(r.accountType ?? "")] ?? "asset";
  const tabRows = useMemo(() => rows.filter((r) => typeOf(r) === activeTab), [rows, activeTab]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tabRows;
    return tabRows.filter((r) => `${r.code ?? ""} ${r.name ?? ""}`.toLowerCase().includes(q));
  }, [tabRows, search]);

  const counts = useMemo(() => {
    const c: Record<AccountType, number> = { asset: 0, liability: 0, income: 0, expense: 0 };
    rows.forEach((r) => { c[typeOf(r)]++; });
    return c;
  }, [rows]);

  const possibleParents = useMemo(() => {
    return rows.filter((r) => r.id !== editingId && typeOf(r) === activeTab);
  }, [rows, editingId, activeTab]);

  const nextCode = useMemo(() => {
    const prefixes: Record<AccountType, string> = { asset: "1", liability: "2", income: "4", expense: "5" };
    const prefix = prefixes[activeTab];
    const sameType = rows.filter((r) => typeOf(r) === activeTab).map((r) => String(r.code ?? "")).filter((c) => /^\d+$/.test(c));
    if (sameType.length === 0) return `${prefix}000`;
    const max = Math.max(...sameType.map((c) => parseInt(c, 10)));
    return String(max + 1);
  }, [rows, activeTab]);

  const clearForm = () => {
    setEditingId(null); setCode(""); setName(""); setParentCode(""); setParentLabel(""); setInitialBalance(""); setShowParentPicker(false);
  };

  const save = async () => {
    try {
      const trimmedCode = code.trim();
      const trimmedName = name.trim();
      if (!trimmedCode) return Alert.alert("تنبيه", "الرمز مطلوب");
      if (!trimmedName) return Alert.alert("تنبيه", "الاسم مطلوب");
      if (rows.some((r) => String(r.code ?? "").trim() === trimmedCode && r.id !== editingId)) return Alert.alert("تنبيه", "رمز الحساب مستخدم مسبقاً");
      if (rows.some((r) => String(r.name ?? "").trim().toLowerCase() === trimmedName.toLowerCase() && r.id !== editingId)) return Alert.alert("تنبيه", "يوجد حساب بهذا الاسم مسبقاً");

      const bal = Number(initialBalance) || 0;
      const input: any = { code: trimmedCode, name: trimmedName, accountType: activeTab, parentCode: parentCode || undefined, balance: bal };

      if (editingId) await updateAccount(editingId, input);
      else await createAccount(input);

      await load();
      const wasEdit = !!editingId;
      clearForm();
      Alert.alert("تم الحفظ", `تم ${wasEdit ? "تعديل" : "إضافة"} الحساب`);
    } catch (e) { Alert.alert("تعذر الحفظ", String(e)); }
  };

  const edit = (r: Row) => {
    setEditingId(r.id); setCode(String(r.code ?? "")); setName(String(r.name ?? "")); setParentCode(String(r.parentCode ?? "")); setParentLabel(rows.find((x) => x.code === r.parentCode)?.name ?? ""); setInitialBalance(String(r.balance ?? "")); setActiveTab(typeOf(r));
  };

  const remove = (r: Row) => {
    if (rows.some((x) => x.parentCode === r.code)) return Alert.alert("لا يمكن الحذف", "توجد حسابات فرعية تحت هذا الحساب. احذفها أولاً.");
    Alert.alert("تأكيد الحذف", `هل تريد حذف «${r.name}»؟`, [
      { text: "إلغاء", style: "cancel" },
      { text: "حذف", style: "destructive", onPress: async () => {
          try { await deleteAccount(r.id); await load(); if (editingId === r.id) clearForm(); } catch (e) { Alert.alert("تعذر الحذف", String(e)); }
      }},
    ]);
  };

  const balanceColor = (bal: any) => { const n = Number(bal) || 0; return n > 0 ? colors.success : n < 0 ? colors.danger : colors.textMuted; };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
        
        <Pressable style={styles.back} onPress={onBack}>
          <Text style={[styles.backText, { color: colors.blue }]}>‹ العودة إلى الوحدات المحاسبية</Text>
        </Pressable>

        <BrandBanner />
        <Text style={[styles.screenTitle, { color: colors.text }]}>الحسابات الرئيسة</Text>
        <Text style={[styles.hint, { color: colors.textMuted }]}>شجرة الحسابات المحاسبية: أصول (1)، خصوم (2)، إيرادات (4)، مصروفات (5). كل حساب يمكن أن يكون أباً لحسابات فرعية.</Text>

        <View style={styles.tabs}>
          {TYPES.map((t) => {
            const active = activeTab === t.key;
            return (
              <Pressable key={t.key} onPress={() => { setActiveTab(t.key); clearForm(); }} style={[styles.tab, { borderColor: colors.border, backgroundColor: colors.surface }, active && { backgroundColor: t.color, borderColor: t.color }]}>
                <Text style={[styles.tabText, { color: colors.text }, active && { color: "#fff", fontWeight: "700" }]}>{t.label} ({counts[t.key]})</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.label, { color: colors.textMuted }]}>بحث</Text>
        <TextInput style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]} value={search} onChangeText={setSearch} onFocus={() => setSearchFocus(true)} onBlur={() => setTimeout(() => setSearchFocus(false), 200)} placeholder="ابحث بالرمز أو الاسم" placeholderTextColor={colors.textMuted} textAlign="right" />
        
        {searchFocus && search.trim().length > 0 && (
          <ScrollView style={[styles.suggestBox, { maxHeight: 200, backgroundColor: colors.surface, borderColor: colors.border }]} nestedScrollEnabled keyboardShouldPersistTaps="always">
            {filteredRows.length === 0 ? (
              <Text style={[styles.suggestEmpty, { color: colors.textMuted }]}>لا نتائج</Text>
            ) : (
              filteredRows.slice(0, 8).map((r) => (
                <Pressable key={r.id} style={[styles.suggestItem, { borderBottomColor: colors.bg }]} onPressIn={() => { edit(r); setSearch(""); setSearchFocus(false); }}>
                  <Text style={[styles.suggestName, { color: colors.text }]}>{r.name}</Text>
                  <Text style={[styles.suggestMeta, { color: colors.textMuted }]}>{r.code}</Text>
                </Pressable>
              ))
            )}
          </ScrollView>
        )}

        <Text style={[styles.sectionTitle, { color: colors.text }]}>{editingId ? "تعديل الحساب" : "إضافة حساب جديد"}</Text>

        <Text style={[styles.label, { color: colors.textMuted }]}>رمز الحساب</Text>
        <View style={{ flexDirection: "row-reverse", gap: 8 }}>
          <TextInput style={[styles.input, { flex: 1, backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]} value={code} onChangeText={setCode} placeholder={nextCode} placeholderTextColor={colors.textMuted} textAlign="right" editable={!editingId} />
          {!editingId && (
            <Pressable style={[styles.genBtn, { backgroundColor: colors.blue }]} onPress={() => setCode(nextCode)}>
              <Text style={{ color: "#FFF", fontSize: 12, fontWeight: "700" }}>توليد</Text>
            </Pressable>
          )}
        </View>

        <Text style={[styles.label, { color: colors.textMuted }]}>اسم الحساب</Text>
        <TextInput style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]} value={name} onChangeText={setName} placeholder="مثال: الصندوق - النقدية" placeholderTextColor={colors.textMuted} textAlign="right" />

        <Text style={[styles.label, { color: colors.textMuted }]}>الحساب الأب (اختياري)</Text>
        <Pressable style={[styles.picker, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => setShowParentPicker((v) => !v)}>
          <Text style={[styles.pickerText, { color: colors.text }]}>{parentLabel || "بدون أب (حساب رئيسي)"}</Text>
          <Text style={[styles.pickerArrow, { color: colors.textMuted }]}>▼</Text>
        </Pressable>
        
        {showParentPicker && (
          <ScrollView style={[styles.suggestBox, { maxHeight: 200, backgroundColor: colors.surface, borderColor: colors.border }]} nestedScrollEnabled keyboardShouldPersistTaps="always">
            <Pressable style={[styles.suggestItem, { borderBottomColor: colors.bg }]} onPressIn={() => { setParentCode(""); setParentLabel(""); setShowParentPicker(false); }}>
              <Text style={[styles.suggestName, { color: colors.text }]}>بدون أب (حساب رئيسي)</Text>
            </Pressable>
            {possibleParents.length === 0 ? (
              <Text style={[styles.suggestEmpty, { color: colors.textMuted }]}>لا توجد حسابات مناسبة</Text>
            ) : (
              possibleParents.map((p) => (
                <Pressable key={p.id} style={[styles.suggestItem, { borderBottomColor: colors.bg }]} onPressIn={() => { setParentCode(p.code); setParentLabel(`${p.code} - ${p.name}`); setShowParentPicker(false); }}>
                  <Text style={[styles.suggestName, { color: colors.text }]}>{p.name}</Text>
                  <Text style={[styles.suggestMeta, { color: colors.textMuted }]}>{p.code}</Text>
                </Pressable>
              ))
            )}
          </ScrollView>
        )}

        <Text style={[styles.label, { color: colors.textMuted }]}>الرصيد الافتتاحي (اختياري)</Text>
        <TextInput style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]} value={initialBalance} onChangeText={setInitialBalance} placeholder="0" placeholderTextColor={colors.textMuted} keyboardType="decimal-pad" textAlign="right" />

        <View style={styles.buttons}>
          <Pressable style={[styles.primary, { backgroundColor: colors.orange }]} onPress={save}>
            <Text style={styles.primaryText}>{editingId ? "حفظ التعديل" : "إضافة وحفظ"}</Text>
          </Pressable>
          {editingId && (
            <Pressable style={[styles.cancel, { borderColor: colors.border }]} onPress={clearForm}>
              <Text style={[styles.cancelText, { color: colors.text }]}>إلغاء</Text>
            </Pressable>
          )}
        </View>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>{TYPES.find((t) => t.key === activeTab)?.label} ({tabRows.length})</Text>
        <View style={styles.list}>
          {filteredRows.length === 0 ? (
            <Text style={[styles.empty, { color: colors.textMuted }]}>لا توجد حسابات في هذا التصنيف — ابدأ بالإضافة أدناه</Text>
          ) : (
            filteredRows.map((r) => (
              <View key={r.id} style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.rowActions}>
                  <Pressable onPress={() => edit(r)} style={[styles.editBtn, { backgroundColor: colors.isDark ? "#1E3A8A" : "#EFF6FF" }]}><Text style={styles.editText}>✏️</Text></Pressable>
                  <Pressable onPress={() => remove(r)} style={[styles.delBtn, { backgroundColor: colors.isDark ? "#7F1D1D" : "#fee2e2" }]}><Text style={styles.delText}>🗑️</Text></Pressable>
                </View>
                <View style={styles.rowInfo}>
                  <Text style={[styles.rowName, { color: colors.text }]}>{r.name}</Text>
                  <Text style={[styles.rowMeta, { color: colors.textMuted }]}>{r.code}{r.parentCode ? ` · تحت ${r.parentCode}` : ""}</Text>
                  <Text style={[styles.rowBalance, { color: balanceColor(r.balance) }]}>الرصيد: {Number(r.balance || 0).toFixed(2)}</Text>
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
  tabs: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 6, marginBottom: 10 },
  tab: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 },
  tabText: { fontSize: 12 },
  sectionTitle: { fontSize: 16, marginTop: 16, marginBottom: 8, textAlign: "left", width: "100%", fontFamily: "CodecBold" },
  label: { fontSize: 12, marginTop: 8, marginBottom: 4, textAlign: "right", width: "100%" },
  input: { borderWidth: 1, borderRadius: 8, padding: 10, fontSize: 14, textAlign: "right", width: "100%" },
  genBtn: { justifyContent: "center", alignItems: "center", paddingHorizontal: 12, borderRadius: 8 },
  picker: { borderWidth: 1, borderRadius: 8, padding: 12, flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center" },
  pickerText: { textAlign: "right", flex: 1, fontSize: 14 },
  pickerArrow: { fontSize: 12, marginLeft: 8 },
  list: { gap: 8, marginTop: 4 },
  empty: { textAlign: "right", fontSize: 12, padding: 10 },
  row: { borderWidth: 1, borderRadius: 10, padding: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  rowInfo: { flex: 1, alignItems: "flex-end", paddingRight: 10 },
  rowName: { fontWeight: "700", fontSize: 14, textAlign: "right", width: "100%" },
  rowMeta: { fontSize: 11, marginTop: 3, textAlign: "right" },
  rowBalance: { fontSize: 12, marginTop: 3, textAlign: "right", fontWeight: "600" },
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
