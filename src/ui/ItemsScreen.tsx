import { useEffect, useMemo, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import BrandBanner from "./components/BrandBanner";
import { sqlite } from "../db/local";
import { useTheme } from "./ThemeContext"; // 🚀 استدعاء مركز الألوان

type Row = any;
type ItemType = "raw_material" | "production_material" | "packaging" | "compound_finished" | "finished_product";

const ITEM_TYPES: { key: ItemType; label: string; color: string }[] = [
  { key: "raw_material", label: "مواد خام", color: "#0b806c" },
  { key: "production_material", label: "مواد إنتاج", color: "#3b82f6" },
  { key: "packaging", label: "عبوات", color: "#f59e0b" },
  { key: "finished_product", label: "منتجات نهائية", color: "#8b5cf6" },
  { key: "compound_finished", label: "منتجات مركبة", color: "#ec4899" },
];

const UNITS = ["حبة", "كرتون", "كيلو", "لتر", "متر", "طن", "عبوة"];

const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export default function ItemsScreen({ onBack }: { onBack: () => void }) {
  const { colors } = useTheme(); // 🚀 قراءة الألوان
  const [rows, setRows] = useState<Row[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ItemType>("raw_material");

  const [sku, setSku] = useState("");
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("حبة");
  const [stockQty, setStockQty] = useState("0");
  const [averageCost, setAverageCost] = useState("0");

  const [search, setSearch] = useState("");
  const [searchFocus, setSearchFocus] = useState(false);
  const [showUnitPicker, setShowUnitPicker] = useState(false);

  const load = async () => {
    try {
      const data: any = await sqlite.getAllAsync("SELECT * FROM items ORDER BY name");
      setRows(data || []);
    } catch (e) { Alert.alert("تعذر تحميل الأصناف", String(e)); }
  };

  useEffect(() => { void load(); }, []);

  const tabRows = useMemo(() => rows.filter((r) => r.item_type === activeTab), [rows, activeTab]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tabRows;
    return tabRows.filter((r) => `${r.sku ?? ""} ${r.name ?? ""}`.toLowerCase().includes(q));
  }, [tabRows, search]);

  const counts = useMemo(() => {
    const c: any = {};
    ITEM_TYPES.forEach(t => c[t.key] = 0);
    rows.forEach((r) => { if (c[r.item_type] !== undefined) c[r.item_type]++; });
    return c;
  }, [rows]);

  const clearForm = () => {
    setEditingId(null); setSku(""); setName(""); setUnit("حبة"); setStockQty("0"); setAverageCost("0"); setShowUnitPicker(false);
  };

  const generateSku = () => {
    const prefix = activeTab.substring(0, 3).toUpperCase();
    const nums = rows.filter(r => r.item_type === activeTab && String(r.sku).startsWith(prefix)).map(r => parseInt(String(r.sku).replace(/\D/g, ""), 10)).filter(n => !Number.isNaN(n));
    const next = nums.length ? Math.max(...nums) + 1 : 1;
    setSku(`${prefix}-${String(next).padStart(3, "0")}`);
  };

  const save = async () => {
    try {
      const trimmedSku = sku.trim();
      const trimmedName = name.trim();
      if (!trimmedSku) return Alert.alert("تنبيه", "الرمز (SKU) مطلوب");
      if (!trimmedName) return Alert.alert("تنبيه", "اسم الصنف مطلوب");
      if (rows.some((r) => String(r.sku ?? "").trim() === trimmedSku && r.id !== editingId)) return Alert.alert("تنبيه", "الرمز مستخدم مسبقاً");

      const now = Date.now();
      const qty = Number(stockQty) || 0;
      const cost = Number(averageCost) || 0;

      if (editingId) {
        await sqlite.runAsync(
          "UPDATE items SET sku=?, name=?, unit=?, stock_quantity=?, average_cost=?, updated_at=? WHERE id=?",
          [trimmedSku, trimmedName, unit, qty, cost, now, editingId]
        );
      } else {
        await sqlite.runAsync(
          "INSERT INTO items (id, sku, name, item_type, unit, stock_quantity, average_cost, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
          [newId(), trimmedSku, trimmedName, activeTab, unit, qty, cost, now]
        );
      }

      await load();
      const wasEdit = !!editingId;
      clearForm();
      Alert.alert("تم الحفظ", `تم ${wasEdit ? "تعديل" : "إضافة"} الصنف`);
    } catch (e) { Alert.alert("تعذر الحفظ", String(e)); }
  };

  const edit = (r: Row) => {
    setEditingId(r.id); setSku(String(r.sku ?? "")); setName(String(r.name ?? "")); setUnit(String(r.unit ?? "حبة")); setStockQty(String(r.stock_quantity ?? "0")); setAverageCost(String(r.average_cost ?? "0")); setActiveTab(r.item_type);
  };

  const remove = (r: Row) => {
    Alert.alert("تأكيد الحذف", `هل تريد حذف «${r.name}»؟`, [
      { text: "إلغاء", style: "cancel" },
      { text: "حذف", style: "destructive", onPress: async () => {
          try {
            await sqlite.runAsync("DELETE FROM items WHERE id = ?", [r.id]);
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
        <Text style={[styles.screenTitle, { color: colors.text }]}>إدارة المخزون والأصناف</Text>
        <Text style={[styles.hint, { color: colors.textMuted }]}>أضف المواد الخام والعبوات والمنتجات النهائية. يتم تحديث المخزون تلقائياً عند إجراء فواتير البيع والشراء.</Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
          {ITEM_TYPES.map((t) => {
            const active = activeTab === t.key;
            return (
              <Pressable android_ripple={{ color: "rgba(0,0,0,0.1)" }} key={t.key} onPress={() => { setActiveTab(t.key); clearForm(); }} style={[styles.tab, { borderColor: colors.border, backgroundColor: colors.surface }, active && { backgroundColor: t.color, borderColor: t.color }]}>
                <Text style={[styles.tabText, { color: colors.text }, active && { color: "#fff", fontWeight: "700" }]}>{t.label} ({counts[t.key] || 0})</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <Text style={[styles.label, { color: colors.textMuted }]}>بحث</Text>
        <TextInput style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]} value={search} onChangeText={setSearch} onFocus={() => setSearchFocus(true)} onBlur={() => setTimeout(() => setSearchFocus(false), 200)} placeholder="ابحث بالرمز أو الاسم" placeholderTextColor={colors.textMuted} textAlign="right" />
        
        {searchFocus && search.trim().length > 0 && (
          <ScrollView style={[styles.suggestBox, { maxHeight: 200, backgroundColor: colors.surface, borderColor: colors.border }]} nestedScrollEnabled keyboardShouldPersistTaps="always">
            {filteredRows.length === 0 ? (
              <Text style={[styles.suggestEmpty, { color: colors.textMuted }]}>لا نتائج</Text>
            ) : (
              filteredRows.slice(0, 8).map((r) => (
                <Pressable android_ripple={{ color: "rgba(0,0,0,0.1)" }} key={r.id} style={[styles.suggestItem, { borderBottomColor: colors.bg }]} onPressIn={() => { edit(r); setSearch(""); setSearchFocus(false); }}>
                  <Text style={[styles.suggestName, { color: colors.text }]}>{r.name}</Text>
                  <Text style={[styles.suggestMeta, { color: colors.textMuted }]}>{r.sku}</Text>
                </Pressable>
              ))
            )}
          </ScrollView>
        )}

        <Text style={[styles.sectionTitle, { color: colors.text }]}>{editingId ? "تعديل الصنف" : "إضافة صنف جديد"}</Text>

        <Text style={[styles.label, { color: colors.textMuted }]}>الرمز (SKU)</Text>
        <View style={{ flexDirection: "row-reverse", gap: 8 }}>
          <TextInput style={[styles.input, { flex: 1, backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]} value={sku} onChangeText={setSku} placeholder="SKU-001" placeholderTextColor={colors.textMuted} textAlign="right" editable={!editingId} />
          {!editingId && (
            <Pressable android_ripple={{ color: "rgba(0,0,0,0.1)" }} style={[styles.genBtn, { backgroundColor: colors.blue }]} onPress={generateSku}>
              <Text style={{ color: "#FFF", fontSize: 12, fontWeight: "700" }}>توليد</Text>
            </Pressable>
          )}
        </View>

        <Text style={[styles.label, { color: colors.textMuted }]}>اسم الصنف</Text>
        <TextInput style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]} value={name} onChangeText={setName} placeholder="اسم المادة أو المنتج" placeholderTextColor={colors.textMuted} textAlign="right" />

        <Text style={[styles.label, { color: colors.textMuted }]}>وحدة القياس</Text>
        <Pressable android_ripple={{ color: "rgba(0,0,0,0.1)" }} style={[styles.picker, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => setShowUnitPicker((v) => !v)}>
          <Text style={[styles.pickerText, { color: colors.text }]}>{unit}</Text>
          <Text style={[styles.pickerArrow, { color: colors.textMuted }]}>▼</Text>
        </Pressable>
        
        {showUnitPicker && (
          <ScrollView style={[styles.suggestBox, { maxHeight: 200, backgroundColor: colors.surface, borderColor: colors.border }]} nestedScrollEnabled keyboardShouldPersistTaps="always">
            {UNITS.map((u) => (
              <Pressable android_ripple={{ color: "rgba(0,0,0,0.1)" }} key={u} style={[styles.suggestItem, { borderBottomColor: colors.bg }]} onPressIn={() => { setUnit(u); setShowUnitPicker(false); }}>
                <Text style={[styles.suggestName, { color: colors.text }]}>{u}</Text>
              </Pressable>
            ))}
          </ScrollView>
        )}

        <View style={{ flexDirection: "row-reverse", gap: 8, marginTop: 10 }}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.label, { color: colors.textMuted }]}>الكمية بالمخزون</Text>
            <TextInput style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]} value={stockQty} onChangeText={setStockQty} keyboardType="decimal-pad" textAlign="right" placeholder="0" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.label, { color: colors.textMuted }]}>متوسط التكلفة (YER)</Text>
            <TextInput style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]} value={averageCost} onChangeText={setAverageCost} keyboardType="decimal-pad" textAlign="right" placeholder="0" />
          </View>
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

        <Text style={[styles.sectionTitle, { color: colors.text }]}>{ITEM_TYPES.find((t) => t.key === activeTab)?.label} ({tabRows.length})</Text>
        <View style={styles.list}>
          {filteredRows.length === 0 ? (
            <Text style={[styles.empty, { color: colors.textMuted }]}>لا توجد أصناف في هذا التصنيف.</Text>
          ) : (
            filteredRows.map((r) => (
              <View key={r.id} style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.rowActions}>
                  <Pressable android_ripple={{ color: "rgba(0,0,0,0.1)" }} onPress={() => edit(r)} style={[styles.editBtn, { backgroundColor: colors.isDark ? "#1E3A8A" : "#EFF6FF" }]}><Text style={styles.editText}>✏️</Text></Pressable>
                  <Pressable android_ripple={{ color: "rgba(0,0,0,0.1)" }} onPress={() => remove(r)} style={[styles.delBtn, { backgroundColor: colors.isDark ? "#7F1D1D" : "#fee2e2" }]}><Text style={styles.delText}>🗑️</Text></Pressable>
                </View>
                <View style={styles.rowInfo}>
                  <Text style={[styles.rowName, { color: colors.text }]}>{r.name}</Text>
                  <Text style={[styles.rowMeta, { color: colors.textMuted }]}>{r.sku} · {r.unit}</Text>
                  <Text style={[styles.rowStock, { color: colors.blue }]}>الكمية: {Number(r.stock_quantity || 0)}</Text>
                  <Text style={[styles.rowCost, { color: colors.textMuted }]}>التكلفة: {Number(r.average_cost || 0).toFixed(2)} YER</Text>
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
  rowStock: { fontSize: 12, marginTop: 3, textAlign: "right", fontWeight: "700" },
  rowCost: { fontSize: 11, marginTop: 2, textAlign: "right" },
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
