import { useEffect, useMemo, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import BrandBanner from "./components/BrandBanner";
import { createCashbox, deleteCashbox, listCashboxes, updateCashbox } from "../sync/accounting";
import { sqlite } from "../db/local";
import { useTheme } from "./ThemeContext"; // 🚀 استدعاء مركز الألوان

type Row = any;
type CashboxType = "main" | "sub" | "analytical";

const TYPES: { key: CashboxType; label: string; color: string }[] = [
  { key: "main", label: "صناديق رئيسية", color: "#0b806c" },
  { key: "sub", label: "صناديق فرعية", color: "#3b82f6" },
  { key: "analytical", label: "صناديق تحليلية", color: "#f59e0b" },
];

const TYPE_MAP: Record<string, CashboxType> = { main: "main", sub: "sub", analytical: "analytical" };

export default function CashboxesScreen({ onBack }: { onBack: () => void }) {
  const { colors } = useTheme(); // 🚀 قراءة الألوان
  const [rows, setRows] = useState<Row[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<CashboxType>("main");
  const [sarRate, setSarRate] = useState(140);

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState<string | null>(null);
  const [parentLabel, setParentLabel] = useState("");
  const [initialBalance, setInitialBalance] = useState("");
  const [currencyCode, setCurrencyCode] = useState<"YER" | "SAR">("YER");

  const [search, setSearch] = useState("");
  const [searchFocus, setSearchFocus] = useState(false);
  const [showParentPicker, setShowParentPicker] = useState(false);

  const load = async () => {
    try {
      const data = await listCashboxes();
      setRows(data || []);
      const sar: any = await sqlite.getFirstAsync("SELECT exchange_rate FROM currencies WHERE code = 'SAR'");
      if (sar?.exchange_rate) setSarRate(Number(sar.exchange_rate) || 140);
    } catch (e) { Alert.alert("تعذر تحميل الصناديق", String(e)); }
  };

  useEffect(() => { void load(); }, []);

  const typeOf = (r: Row): CashboxType => TYPE_MAP[String(r.cashboxType ?? "")] ?? "main";
  const tabRows = useMemo(() => rows.filter((r) => typeOf(r) === activeTab), [rows, activeTab]);
  
  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tabRows;
    return tabRows.filter((r) => `${r.code ?? ""} ${r.name ?? ""}`.toLowerCase().includes(q));
  }, [tabRows, search]);

  const counts = useMemo(() => {
    const c: Record<CashboxType, number> = { main: 0, sub: 0, analytical: 0 };
    rows.forEach((r) => { c[typeOf(r)]++; });
    return c;
  }, [rows]);

  const possibleParents = useMemo(() => {
    return rows.filter((r) => {
      if (r.id === editingId) return false;
      if (activeTab === "sub") return typeOf(r) === "main";
      if (activeTab === "analytical") return typeOf(r) !== "analytical";
      return false;
    });
  }, [rows, editingId, activeTab]);

  const nextCode = useMemo(() => {
    const prefix = activeTab === "main" ? "CB" : activeTab === "sub" ? "SB" : "AB";
    const nums = rows.filter((r) => String(r.code ?? "").startsWith(prefix)).map((r) => parseInt(String(r.code ?? "").replace(/\D/g, ""), 10)).filter((n) => !Number.isNaN(n));
    const next = nums.length ? Math.max(...nums) + 1 : 1;
    return `${prefix}-${String(next).padStart(3, "0")}`;
  }, [rows, activeTab]);

  const clearForm = () => {
    setEditingId(null); setCode(""); setName(""); setParentId(null); setParentLabel(""); setInitialBalance(""); setCurrencyCode("YER"); setShowParentPicker(false);
  };

  const save = async () => {
    try {
      const trimmedCode = code.trim();
      const trimmedName = name.trim();
      if (!trimmedCode) return Alert.alert("تنبيه", "الرمز مطلوب");
      if (!trimmedName) return Alert.alert("تنبيه", "الاسم مطلوب");
      if (activeTab !== "main" && !parentId) return Alert.alert("تنبيه", "اختر الصندوق الأب");
      if (rows.some((r) => String(r.code ?? "").trim() === trimmedCode && r.id !== editingId)) return Alert.alert("تنبيه", "الرمز مستخدم مسبقاً");
      if (rows.some((r) => String(r.name ?? "").trim().toLowerCase() === trimmedName.toLowerCase() && r.id !== editingId)) return Alert.alert("تنبيه", "يوجد صندوق بهذا الاسم مسبقاً");

      const input: any = { code: trimmedCode, name: trimmedName, parentId: activeTab === "main" ? undefined : parentId, cashboxType: activeTab, balance: Number(initialBalance) || 0, currencyCode };

      if (editingId) await updateCashbox(editingId, input);
      else await createCashbox(input);

      await load(); const wasEdit = !!editingId; clearForm();
      Alert.alert("تم الحفظ", `تم ${wasEdit ? "تعديل" : "إضافة"} الصندوق`);
    } catch (e) { Alert.alert("تعذر الحفظ", String(e)); }
  };

  const edit = (r: Row) => {
    setEditingId(r.id); setCode(String(r.code ?? "")); setName(String(r.name ?? "")); setParentId(r.parentId ?? null); setParentLabel(rows.find((x) => x.id === r.parentId)?.name ?? ""); setInitialBalance(String(r.balance ?? "")); setCurrencyCode(r.currencyCode === "SAR" ? "SAR" : "YER"); setActiveTab(typeOf(r));
  };

  const remove = (r: Row) => {
    if (rows.some((x) => x.parentId === r.id)) return Alert.alert("لا يمكن الحذف", "يوجد صناديق فرعية مرتبطة بهذا الصندوق. احذفها أولاً.");
    Alert.alert("تأكيد الحذف", `هل تريد حذف «${r.name}»؟`, [
      { text: "إلغاء", style: "cancel" },
      { text: "حذف", style: "destructive", onPress: async () => {
          try { await deleteCashbox(r.id); await load(); if (editingId === r.id) clearForm(); } catch (e) { Alert.alert("تعذر الحذف", String(e)); }
      }},
    ]);
  };

  const balanceColor = (bal: any) => { const n = Number(bal) || 0; return n > 0 ? "#0b806c" : n < 0 ? "#dc2626" : "#8494B0"; };
  const getParentName = (pid: string) => rows.find(r => r.id === pid)?.name || "";

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <Pressable style={styles.back} onPress={onBack}>
          <Text style={[styles.backText, { color: colors.blue }]}>‹ العودة إلى الوحدات المحاسبية</Text>
        </Pressable>

        <BrandBanner />
        <Text style={[styles.screenTitle, { color: colors.text }]}>الصناديق</Text>
        <Text style={[styles.hint, { color: colors.textMuted }]}>الصناديق الرئيسية تحتوي الصناديق الفرعية، والتحليلية تُستخدم لإجراء العمليات المالية. الرصيد المعروض يعكس الحركات المسجلة.</Text>

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
          <ScrollView style={[styles.suggestBox, { maxHeight: 200, backgroundColor: colors.surface, borderColor: colors.border }]} nestedScrollEnabled>
            {filteredRows.length === 0 ? (
              <Text style={[styles.suggestEmpty, { color: colors.textMuted }]}>لا نتائج</Text>
            ) : (
              filteredRows.slice(0, 8).map((r) => (
                <Pressable key={r.id} style={[styles.suggestItem, { borderBottomColor: colors.bg }]} onPress={() => { edit(r); setSearch(""); setSearchFocus(false); }}>
                  <Text style={[styles.suggestName, { color: colors.text }]}>{r.name}</Text>
                  <Text style={[styles.suggestMeta, { color: colors.textMuted }]}>{r.code}</Text>
                </Pressable>
              ))
            )}
          </ScrollView>
        )}

        <Text style={[styles.sectionTitle, { color: colors.text }]}>{editingId ? "تعديل الصندوق" : "إضافة صندوق جديد"}</Text>

        <Text style={[styles.label, { color: colors.textMuted }]}>الرمز</Text>
        <TextInput style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]} value={code} onChangeText={setCode} placeholder={nextCode} placeholderTextColor={colors.textMuted} textAlign="right" editable={!editingId} />

        <Text style={[styles.label, { color: colors.textMuted }]}>الاسم</Text>
        <TextInput style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]} value={name} onChangeText={setName} placeholder="مثال: الصندوق الرئيسي - الكاش" placeholderTextColor={colors.textMuted} textAlign="right" />

        {activeTab !== "main" && (
          <>
            <Text style={[styles.label, { color: colors.textMuted }]}>الصندوق الأب</Text>
            <Pressable style={[styles.picker, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => setShowParentPicker((v) => !v)}>
              <Text style={[styles.pickerText, { color: colors.text }]}>{parentLabel || "اختر الصندوق الأب"}</Text>
              <Text style={[styles.pickerArrow, { color: colors.textMuted }]}>▼</Text>
            </Pressable>
            {showParentPicker && (
              <ScrollView style={[styles.suggestBox, { maxHeight: 200, backgroundColor: colors.surface, borderColor: colors.border }]} nestedScrollEnabled>
                {possibleParents.length === 0 ? (
                  <Text style={[styles.suggestEmpty, { color: colors.textMuted }]}>لا توجد صناديق مناسبة كآباء</Text>
                ) : (
                  possibleParents.map((p) => (
                    <Pressable key={p.id} style={[styles.suggestItem, { borderBottomColor: colors.bg }]} onPress={() => { setParentId(p.id); setParentLabel(p.name); setShowParentPicker(false); }}>
                      <Text style={[styles.suggestName, { color: colors.text }]}>{p.name}</Text>
                      <Text style={[styles.suggestMeta, { color: colors.textMuted }]}>{p.code}</Text>
                    </Pressable>
                  ))
                )}
              </ScrollView>
            )}
          </>
        )}

        <Text style={[styles.label, { color: colors.textMuted }]}>العملة</Text>
        <View style={styles.currencyRow}>
          <Pressable style={[styles.currencyBtn, { backgroundColor: colors.surface, borderColor: colors.border }, currencyCode === "YER" && styles.currencyBtnActive]} onPress={() => setCurrencyCode("YER")}>
            <Text style={[styles.currencyText, { color: colors.textMuted }, currencyCode === "YER" && styles.currencyTextActive]}>ريال يمني (YER)</Text>
          </Pressable>
          <Pressable style={[styles.currencyBtn, { backgroundColor: colors.surface, borderColor: colors.border }, currencyCode === "SAR" && styles.currencyBtnActive]} onPress={() => setCurrencyCode("SAR")}>
            <Text style={[styles.currencyText, { color: colors.textMuted }, currencyCode === "SAR" && styles.currencyTextActive]}>ريال سعودي (SAR)</Text>
          </Pressable>
        </View>

        <Text style={[styles.label, { color: colors.textMuted }]}>الرصيد الافتتاحي (اختياري)</Text>
        <TextInput style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]} value={initialBalance} onChangeText={setInitialBalance} placeholder="0" placeholderTextColor={colors.textMuted} keyboardType="decimal-pad" textAlign="right" />

        <View style={styles.buttons}>
          <Pressable style={[styles.primary, { backgroundColor: colors.orange }]} onPress={save}><Text style={styles.primaryText}>{editingId ? "حفظ التعديل" : "إضافة وحفظ"}</Text></Pressable>
          {editingId && (<Pressable style={[styles.cancel, { borderColor: colors.border }]} onPress={clearForm}><Text style={[styles.cancelText, { color: colors.text }]}>إلغاء</Text></Pressable>)}
        </View>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>{TYPES.find((t) => t.key === activeTab)?.label} ({tabRows.length})</Text>
        <View style={styles.list}>
          {filteredRows.length === 0 ? (
            <Text style={[styles.empty, { color: colors.textMuted }]}>لا توجد صناديق في هذا التصنيف — ابدأ بالإضافة أدناه</Text>
          ) : (
            filteredRows.map((r) => {
              const isSAR = r.currencyCode === "SAR";
              const bal = Number(r.balance || 0);
              const equivalent = isSAR ? bal * sarRate : bal / sarRate;
              return (
                <View key={r.id} style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <View style={styles.rowActions}>
                    <Pressable onPress={() => edit(r)} style={[styles.editBtn, { backgroundColor: colors.isDark ? "#1E3A8A" : "#EFF6FF" }]}><Text style={styles.editText}>✏️</Text></Pressable>
                    <Pressable onPress={() => remove(r)} style={[styles.delBtn, { backgroundColor: colors.isDark ? "#7F1D1D" : "#fee2e2" }]}><Text style={styles.delText}>🗑️</Text></Pressable>
                  </View>
                  <View style={styles.rowInfo}>
                    <Text style={[styles.rowName, { color: colors.text }]}>{r.name}</Text>
                    <Text style={[styles.rowMeta, { color: colors.textMuted }]}>{r.code} {r.parentId ? `• تابع لـ: ${getParentName(r.parentId)}` : ""}</Text>
                    <Text style={[styles.rowBalance, { color: balanceColor(r.balance) }]}>الرصيد: {bal.toFixed(2)} {isSAR ? "SAR" : "YER"}</Text>
                    <Text style={[styles.rowEquivalent, { color: colors.textMuted }]}>≈ {equivalent.toFixed(2)} {isSAR ? "YER" : "SAR"}</Text>
                  </View>
                </View>
              );
            })
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
  picker: { borderWidth: 1, borderRadius: 8, padding: 12, flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center" },
  pickerText: { textAlign: "right", flex: 1, fontSize: 14 },
  pickerArrow: { fontSize: 12, marginLeft: 8 },
  list: { gap: 8, marginTop: 4 },
  empty: { textAlign: "right", fontSize: 12, padding: 10 },
  row: { borderWidth: 1, borderRadius: 10, padding: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  rowInfo: { flex: 1, alignItems: "flex-end", paddingRight: 10 },
  rowName: { fontWeight: "700", fontSize: 14, textAlign: "right", width: "100%" },
  rowMeta: { fontSize: 11, marginTop: 3, textAlign: "right" },
  rowBalance: { fontSize: 13, marginTop: 3, textAlign: "right", fontWeight: "700" },
  rowEquivalent: { fontSize: 11, marginTop: 2, textAlign: "right", fontWeight: "600" },
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
  currencyRow: { flexDirection: "row-reverse", gap: 8, marginBottom: 8 },
  currencyBtn: { flex: 1, padding: 12, borderWidth: 1, borderRadius: 8, alignItems: "center" },
  currencyBtnActive: { backgroundColor: "#EFF6FF", borderColor: "#3b82f6" },
  currencyText: { fontWeight: "600", fontSize: 13 },
  currencyTextActive: { color: "#1D4ED8", fontWeight: "800" },
});
