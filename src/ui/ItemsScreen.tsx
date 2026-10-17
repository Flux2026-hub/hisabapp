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
} from "react-native";
import {
  createItem,
  deleteItem,
  listItems,
  updateItem,
} from "../sync/accounting";

type Row = any;

type Category = "raw_material" | "packaging" | "finished_product";

const CATEGORIES: { key: Category; label: string; color: string }[] = [
  { key: "raw_material", label: "مواد إنتاج", color: "#f59e0b" },
  { key: "packaging", label: "عبوات وتغليف", color: "#3b82f6" },
  { key: "finished_product", label: "منتج نهائي", color: "#F97316" },
];

const UNITS = ["جرام", "كيلو", "لتر", "حبة", "عبوة", "علبة", "كرتون"];

const WAREHOUSE_FOR: Record<Category, string> = {
  raw_material: "مخزن تحت الإنتاج",
  packaging: "مخزن تحت الإنتاج",
  finished_product: "مخزن المخزون التام",
};

const CATEGORY_MAP: Record<string, Category> = {
  raw_material: "raw_material",
  production_material: "raw_material",
  packaging: "packaging",
  compound_finished: "finished_product",
  finished_product: "finished_product",
};

export default function ItemsScreen({ onBack }: { onBack: () => void }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Category>("raw_material");

  const [sku, setSku] = useState("");
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("جرام");
  const [quantity, setQuantity] = useState("");
  const [avgCost, setAvgCost] = useState("");

  const [search, setSearch] = useState("");
  const [searchFocus, setSearchFocus] = useState(false);
  const [showUnitSuggest, setShowUnitSuggest] = useState(false);

  const load = async () => {
    try {
      const data = await listItems();
      setRows(data || []);
    } catch (e) {
      Alert.alert("تعذر تحميل الأصناف", String(e));
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const categoryOf = (r: Row): Category =>
    CATEGORY_MAP[String(r.itemType ?? "")] ?? "raw_material";

  const filterByTab = (r: Row) => categoryOf(r) === activeTab;

  const tabRows = useMemo(() => rows.filter(filterByTab), [rows, activeTab]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tabRows;
    return tabRows.filter((r) =>
      `${r.sku ?? ""} ${r.name ?? ""}`.toLowerCase().includes(q)
    );
  }, [tabRows, search]);

  const counts = useMemo(() => {
    const c: Record<Category, number> = {
      raw_material: 0,
      packaging: 0,
      finished_product: 0,
    };
    rows.forEach((r) => {
      c[categoryOf(r)]++;
    });
    return c;
  }, [rows]);

  const clearForm = () => {
    setEditingId(null);
    setSku("");
    setName("");
    setUnit("جرام");
    setQuantity("");
    setAvgCost("");
    setShowUnitSuggest(false);
  };

  const nextSku = useMemo(() => {
    const prefix =
      activeTab === "raw_material"
        ? "RM"
        : activeTab === "packaging"
        ? "PK"
        : "FP";
    const nums = rows
      .filter((r) => String(r.sku ?? "").startsWith(prefix))
      .map((r) => parseInt(String(r.sku ?? "").replace(/\D/g, ""), 10))
      .filter((n) => !Number.isNaN(n));
    const next = nums.length ? Math.max(...nums) + 1 : 1;
    return `${prefix}-${String(next).padStart(3, "0")}`;
  }, [rows, activeTab]);

  const save = async () => {
    try {
      const trimmedSku = sku.trim();
      const trimmedName = name.trim();
      const qty = Number(quantity) || 0;
      const cost = Number(avgCost) || 0;

      if (!trimmedSku) return Alert.alert("تنبيه", "الرمز مطلوب");
      if (!trimmedName) return Alert.alert("تنبيه", "الاسم مطلوب");

      const dupSku = rows.some(
        (r) => String(r.sku ?? "").trim() === trimmedSku && r.id !== editingId
      );
      if (dupSku) return Alert.alert("تنبيه", "الرمز مستخدم مسبقاً");

      const dupName = rows.some(
        (r) =>
          String(r.name ?? "").trim().toLowerCase() ===
            trimmedName.toLowerCase() && r.id !== editingId
      );
      if (dupName) return Alert.alert("تنبيه", "يوجد صنف بهذا الاسم مسبقاً");

      const itemType =
        activeTab === "raw_material"
          ? "raw_material"
          : activeTab === "packaging"
          ? "packaging"
          : "compound_finished";

      const input: any = {
        sku: trimmedSku,
        code: trimmedSku,
        name: trimmedName,
        itemType,
        unit,
        stockQuantity: qty,
        averageCost: cost,
      };

      if (editingId) await updateItem(editingId, input);
      else await createItem(input);

      await load();
      const wasEdit = !!editingId;
      clearForm();
      Alert.alert("تم الحفظ", `تم ${wasEdit ? "تعديل" : "إضافة"} الصنف`);
    } catch (e) {
      Alert.alert("تعذر الحفظ", String(e));
    }
  };

  const edit = (r: Row) => {
    setEditingId(r.id);
    setSku(String(r.sku ?? ""));
    setName(String(r.name ?? ""));
    setUnit(String(r.unit ?? "جرام"));
    setQuantity(String(r.stockQuantity ?? ""));
    setAvgCost(String(r.averageCost ?? ""));
    setActiveTab(categoryOf(r));
  };

  const remove = (r: Row) => {
    Alert.alert("تأكيد الحذف", `هل تريد حذف «${r.name}»؟`, [
      { text: "إلغاء", style: "cancel" },
      {
        text: "حذف",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteItem(r.id);
            await load();
            if (editingId === r.id) clearForm();
          } catch (e) {
            Alert.alert("تعذر الحذف", String(e));
          }
        },
      },
    ]);
  };

  const stockColor = (qty: any) => {
    const n = Number(qty) || 0;
    if (n <= 0) return "#dc2626";
    if (n < 10) return "#f59e0b";
    return "#0b806c";
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets={true}
        contentContainerStyle={{ paddingBottom: 40, paddingHorizontal: 4 }}
      >
        <Pressable style={styles.back} onPress={onBack}>
          <Text style={styles.backText}>العودة -> إلى الوحدات المحاسبية</Text>
        </Pressable>

        <Text style={styles.screenTitle}>الأصناف والمواد</Text>
        <Text style={styles.hint}>
          تصنيف الأصناف: مواد إنتاج وعبوات تُخزَّن في "مخزن تحت الإنتاج"،
          والمنتج النهائي في "مخزن المخزون التام".
        </Text>

        {/* تبويبات التصنيف */}
        <View style={styles.tabs}>
          {CATEGORIES.map((c) => {
            const active = activeTab === c.key;
            return (
              <Pressable
                key={c.key}
                onPress={() => {
                  setActiveTab(c.key);
                  clearForm();
                }}
                style={[
                  styles.tab,
                  active && { backgroundColor: c.color, borderColor: c.color },
                ]}
              >
                <Text
                  style={[
                    styles.tabText,
                    active && { color: "#fff", fontWeight: "700" },
                  ]}
                >
                  {c.label} ({counts[c.key]})
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* بيانات المخزن */}
        <View style={styles.warehouseBar}>
          <Text style={styles.warehouseText}>
            📦 يُخزَّن في: {WAREHOUSE_FOR[activeTab]}
          </Text>
        </View>

        {/* البحث */}
        <Text style={styles.label}>بحث</Text>
        <TextInput
          style={styles.input}
          value={search}
          onChangeText={setSearch}
          onFocus={() => setSearchFocus(true)}
          onBlur={() => setTimeout(() => setSearchFocus(false), 200)}
          placeholder="ابحث بالرمز أو الاسم"
          placeholderTextColor="#9CA3AF"
          textAlign="right"
        />
        {searchFocus && search.trim().length > 0 && (
          <View style={styles.suggestBox}>
            {filteredRows.length === 0 ? (
              <Text style={styles.suggestEmpty}>لا نتائج</Text>
            ) : (
              filteredRows.slice(0, 8).map((r) => (
                <Pressable
                  key={r.id}
                  style={styles.suggestItem}
                  onPress={() => {
                    edit(r);
                    setSearch("");
                    setSearchFocus(false);
                  }}
                >
                  <Text style={styles.suggestName}>{r.name}</Text>
                  <Text style={styles.suggestMeta}>
                    {r.sku} · {r.unit}
                  </Text>
                </Pressable>
              ))
            )}
          </View>
        )}

        {/* القائمة */}
        <Text style={styles.sectionTitle}>
          {CATEGORIES.find((c) => c.key === activeTab)?.label} ({tabRows.length})
        </Text>
        <View style={styles.list}>
          {filteredRows.length === 0 ? (
            <Text style={styles.empty}>
              لا توجد أصناف في هذا التصنيف — ابدأ بإضافة صنف من النموذج أدناه
            </Text>
          ) : (
            filteredRows.map((r) => (
              <View key={r.id} style={styles.row}>
                <View style={styles.rowActions}>
                  <Pressable onPress={() => edit(r)} style={styles.editBtn}>
                    <Text style={styles.editText}>تعديل</Text>
                  </Pressable>
                  <Pressable onPress={() => remove(r)} style={styles.delBtn}>
                    <Text style={styles.delText}>حذف</Text>
                  </Pressable>
                </View>
                <View style={styles.rowInfo}>
                  <Text style={styles.rowName}>{r.name}</Text>
                  <Text style={styles.rowMeta}>
                    {r.sku} · {r.unit}
                  </Text>
                  <Text
                    style={[
                      styles.rowStock,
                      { color: stockColor(r.stockQuantity) },
                    ]}
                  >
                    الرصيد: {Number(r.stockQuantity || 0).toFixed(2)} {r.unit}
                  </Text>
                  {Number(r.averageCost) > 0 && (
                    <Text style={styles.rowCost}>
                      التكلفة: {Number(r.averageCost).toFixed(2)}
                    </Text>
                  )}
                </View>
              </View>
            ))
          )}
        </View>

        {/* نموذج الإضافة/التعديل */}
        <Text style={styles.sectionTitle}>
          {editingId ? `تعديل الصنف` : `إضافة صنف جديد`}
        </Text>

        <Text style={styles.label}>الرمز</Text>
        <TextInput
          style={styles.input}
          value={sku}
          onChangeText={setSku}
          placeholder={nextSku}
          placeholderTextColor="#9CA3AF"
          textAlign="right"
          editable={!editingId}
        />

        <Text style={styles.label}>الاسم</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="مثال: هيدروكسيد الصوديوم"
          placeholderTextColor="#9CA3AF"
          textAlign="right"
        />

        <Text style={styles.label}>وحدة القياس</Text>
        <TextInput
          style={styles.input}
          value={unit}
          onChangeText={setUnit}
          onFocus={() => setShowUnitSuggest(true)}
          onBlur={() => setTimeout(() => setShowUnitSuggest(false), 200)}
          placeholder="جرام / لتر / حبة..."
          placeholderTextColor="#9CA3AF"
          textAlign="right"
        />
        {showUnitSuggest && (
          <View style={styles.suggestBox}>
            {UNITS.map((u) => (
              <Pressable
                key={u}
                style={styles.suggestItem}
                onPress={() => {
                  setUnit(u);
                  setShowUnitSuggest(false);
                }}
              >
                <Text style={styles.suggestName}>{u}</Text>
              </Pressable>
            ))}
          </View>
        )}

        <Text style={styles.label}>الرصيد الحالي</Text>
        <TextInput
          style={styles.input}
          value={quantity}
          onChangeText={setQuantity}
          placeholder="0"
          placeholderTextColor="#9CA3AF"
          keyboardType="decimal-pad"
          textAlign="right"
        />

        <Text style={styles.label}>متوسط التكلفة (اختياري)</Text>
        <TextInput
          style={styles.input}
          value={avgCost}
          onChangeText={setAvgCost}
          placeholder="0"
          placeholderTextColor="#9CA3AF"
          keyboardType="decimal-pad"
          textAlign="right"
        />

        <View style={styles.buttons}>
          <Pressable style={styles.primary} onPress={save}>
            <Text style={styles.primaryText}>
              {editingId ? "حفظ التعديل" : "إضافة وحفظ"}
            </Text>
          </Pressable>
          {editingId && (
            <Pressable style={styles.cancel} onPress={clearForm}>
              <Text style={styles.cancelText}>إلغاء</Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  back: {  paddingVertical: 10, alignSelf: "flex-end", marginBottom: 8 },
  backText: {  color: "#1E40AF", textAlign: "right", fontWeight: "700", textAlign: "right" },
  screenTitle: { 
    fontSize: 20,
    fontWeight: "800",
    color: "#0F172A",
    textAlign: "right",
    marginBottom: 6,
fontFamily: "Alexandria-Regular",
  },
  hint: {
    fontSize: 12,
    color: "#8494B0",
    textAlign: "right",
    marginBottom: 12,
    lineHeight: 18,
  },
  tabs: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 10 },
  tab: {
    borderWidth: 1,
    borderColor: "#D6E3F8",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  tabText: { fontSize: 12, color: "#0F172A" },
  warehouseBar: {
    backgroundColor: "#eef6ff",
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
  },
  warehouseText: {
    color: "#1E40AF",
    fontSize: 12,
    textAlign: "right",
    fontWeight: "600",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
    textAlign: "right",
    marginTop: 16,
    marginBottom: 8,
  },
  label: {
    fontSize: 12,
    color: "#526078",
    textAlign: "right",
    marginTop: 8,
    marginBottom: 4,
  },
  input: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#D6E3F8",
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    color: "#0F172A",
  },
  list: { gap: 8, marginTop: 4 },
  empty: { textAlign: "right", color: "#8494B0", fontSize: 12, padding: 10 },
  row: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#D6E3F8",
    borderRadius: 10,
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rowInfo: { flex: 1, alignItems: "flex-end" },
  rowName: {
    fontWeight: "700",
    fontSize: 14,
    color: "#0F172A",
    textAlign: "right",
  },
  rowMeta: {
    fontSize: 11,
    color: "#8494B0",
    marginTop: 3,
    textAlign: "right",
  },
  rowStock: {
    fontSize: 12,
    marginTop: 3,
    textAlign: "right",
    fontWeight: "600",
  },
  rowCost: { fontSize: 11, color: "#8494B0", marginTop: 2, textAlign: "right" },
  rowActions: { flexDirection: "row", gap: 6 },
  editBtn: { backgroundColor: "#EFF6FF", padding: 8, borderRadius: 7 },
  editText: { color: "#0F172A", fontSize: 12 },
  delBtn: { backgroundColor: "#fee2e2", padding: 8, borderRadius: 7 },
  delText: { color: "#0F172A", fontSize: 12 },
  suggestBox: {
    marginTop: 4,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#D6E3F8",
    borderRadius: 8,
    overflow: "hidden",
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
  suggestMeta: {
    fontSize: 11,
    color: "#8494B0",
    textAlign: "right",
    marginTop: 2,
  },
  suggestEmpty: {
    padding: 10,
    color: "#8494B0",
    textAlign: "right",
    fontSize: 12,
  },
  buttons: { flexDirection: "row", gap: 8, marginTop: 16 },
  primary: {
    backgroundColor: "#F97316",
    padding: 14,
    borderRadius: 10,
    flex: 1,
  },
  primaryText: { color: "#fff", fontWeight: "700", textAlign: "center" },
  cancel: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    padding: 13,
    borderRadius: 10,
  },
  cancelText: { color: "#0F172A", textAlign: "center" },
});