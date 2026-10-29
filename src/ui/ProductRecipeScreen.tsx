import { useEffect, useMemo, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import BrandBanner from "./components/BrandBanner";
import { sqlite } from "../db/local";
import { useTheme } from "./ThemeContext"; // 🚀 استدعاء مركز الألوان

type Item = { id: string; sku: string; name: string; itemType: string; unit: string; stockQuantity: number; };
type BomLine = { id: string; bom_id: string; component_item_id: string; quantity_per_output: number; unit: string; waste_percent: number; component_name?: string; component_sku?: string; };

const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export default function ProductRecipeScreen({ onBack }: { onBack: () => void }) {
  const { colors } = useTheme(); // 🚀 قراءة الألوان
  const [finishedItems, setFinishedItems] = useState<Item[]>([]);
  const [components, setComponents] = useState<Item[]>([]);
  const [selectedFinished, setSelectedFinished] = useState<Item | null>(null);
  const [bomId, setBomId] = useState<string | null>(null);
  const [lines, setLines] = useState<BomLine[]>([]);
  const [outputQty, setOutputQty] = useState("1");
  const [outputUnit, setOutputUnit] = useState("علبة");

  // 🚀 حالات البحث
  const [finishedSearch, setFinishedSearch] = useState("");
  const [componentSearch, setComponentSearch] = useState("");
  const [unitSearch, setUnitSearch] = useState("");

  const [showFinishedPicker, setShowFinishedPicker] = useState(false);
  const [showComponentPicker, setShowComponentPicker] = useState(false);
  const [showUnitPicker, setShowUnitPicker] = useState(false);

  const [newComponent, setNewComponent] = useState<Item | null>(null);
  const [newQty, setNewQty] = useState("");
  const [newUnit, setNewUnit] = useState("");
  const [newWaste, setNewWaste] = useState("0");

  const UNITS_LIST = ["جرام", "كيلو", "لتر", "حبة", "عبوة", "علبة", "كرتون"];

  // تحميل الأصناف
  useEffect(() => {
    (async () => {
      try {
        const all: any = await sqlite.getAllAsync("SELECT id, sku, name, item_type as itemType, unit, stock_quantity as stockQuantity FROM items ORDER BY name");
        const finished = (all || []).filter((i: any) => i.itemType === "compound_finished" || i.itemType === "finished_product");
        const comp = (all || []).filter((i: any) => i.itemType === "raw_material" || i.itemType === "production_material" || i.itemType === "packaging");
        setFinishedItems(finished);
        setComponents(comp);
      } catch (e) { Alert.alert("تعذر تحميل الأصناف", String(e)); }
    })();
  }, []);

  // تحميل التركيبة عند اختيار منتج نهائي
  useEffect(() => {
    if (!selectedFinished) { setBomId(null); setLines([]); return; }
    (async () => {
      try {
        const bom: any = await sqlite.getFirstAsync("SELECT id, output_quantity, output_unit FROM product_boms WHERE finished_item_id = ? AND is_active = 1 ORDER BY version DESC LIMIT 1", [selectedFinished.id]);
        if (bom) {
          setBomId(bom.id);
          setOutputQty(String(bom.output_quantity ?? 1));
          setOutputUnit(bom.output_unit ?? "علبة");
          const rows: any = await sqlite.getAllAsync(`SELECT l.id, l.bom_id, l.component_item_id, l.quantity_per_output, l.unit, l.waste_percent, i.name as component_name, i.sku as component_sku FROM product_bom_lines l LEFT JOIN items i ON i.id = l.component_item_id WHERE l.bom_id = ? ORDER BY i.name`, [bom.id]);
          setLines(rows || []);
        } else {
          setBomId(null); setLines([]); setOutputQty("1"); setOutputUnit(selectedFinished.unit || "علبة");
        }
      } catch (e) { Alert.alert("تعذر تحميل التركيبة", String(e)); }
    })();
  }, [selectedFinished]);

  const saveBomHead = async () => {
    if (!selectedFinished) { Alert.alert("تنبيه", "اختر المنتج النهائي أولاً"); return; }
    const qty = Number(outputQty) || 1;
    try {
      let currentBomId = bomId;
      if (!currentBomId) {
        currentBomId = newId();
        await sqlite.runAsync(`INSERT INTO product_boms (id, name, finished_item_id, version, output_quantity, output_unit, effective_from, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [currentBomId, `تركيبة ${selectedFinished.name}`, selectedFinished.id, 1, qty, outputUnit, new Date().toISOString().slice(0, 10), 1]);
        setBomId(currentBomId);
      } else {
        await sqlite.runAsync("UPDATE product_boms SET output_quantity = ?, output_unit = ? WHERE id = ?", [qty, outputUnit, currentBomId]);
      }
      Alert.alert("تم الحفظ", "تم حفظ رأس التركيبة — أضف المكونات من الأسفل");
    } catch (e) { Alert.alert("تعذر الحفظ", String(e)); }
  };

  const reloadLines = async (id: string) => {
    const rows: any = await sqlite.getAllAsync(`SELECT l.id, l.bom_id, l.component_item_id, l.quantity_per_output, l.unit, l.waste_percent, i.name as component_name, i.sku as component_sku FROM product_bom_lines l LEFT JOIN items i ON i.id = l.component_item_id WHERE l.bom_id = ? ORDER BY i.name`, [id]);
    setLines(rows || []);
  };

  const addLine = async () => {
    if (!bomId) { Alert.alert("تنبيه", "احفظ رأس التركيبة أولاً"); return; }
    if (!newComponent) { Alert.alert("تنبيه", "اختر المكوّن"); return; }
    const qty = Number(newQty);
    if (!qty || qty <= 0) { Alert.alert("تنبيه", "أدخل كمية صحيحة أكبر من صفر"); return; }
    try {
      await sqlite.runAsync(`INSERT INTO product_bom_lines (id, bom_id, component_item_id, quantity_per_output, unit, waste_percent) VALUES (?, ?, ?, ?, ?, ?)`, [newId(), bomId, newComponent.id, qty, newUnit || newComponent.unit, Number(newWaste) || 0]);
      await reloadLines(bomId);
      setNewComponent(null); setNewQty(""); setNewUnit(""); setNewWaste("0"); setComponentSearch(""); setUnitSearch("");
    } catch (e) { Alert.alert("تعذر الإضافة", String(e)); }
  };

  const removeLine = (line: BomLine) => {
    Alert.alert("تأكيد الحذف", `حذف «${line.component_name}» من التركيبة؟`, [
      { text: "إلغاء", style: "cancel" },
      { text: "حذف", style: "destructive", onPress: async () => {
          try { await sqlite.runAsync("DELETE FROM product_bom_lines WHERE id = ?", [line.id]); if (bomId) await reloadLines(bomId); } catch (e) { Alert.alert("تعذر الحذف", String(e)); }
      }},
    ]);
  };

  // 🚀 دوال الفلترة للبحث
  const filteredFinished = useMemo(() => {
    if (!finishedSearch.trim()) return finishedItems;
    const q = finishedSearch.toLowerCase();
    return finishedItems.filter(i => String(i.name).toLowerCase().includes(q) || String(i.sku).toLowerCase().includes(q));
  }, [finishedItems, finishedSearch]);

  const filteredComponents = useMemo(() => {
    if (!componentSearch.trim()) return components;
    const q = componentSearch.toLowerCase();
    return components.filter(i => String(i.name).toLowerCase().includes(q) || String(i.sku).toLowerCase().includes(q));
  }, [components, componentSearch]);

  const filteredUnits = useMemo(() => {
    if (!unitSearch.trim()) return UNITS_LIST;
    const q = unitSearch.toLowerCase();
    return UNITS_LIST.filter(u => u.toLowerCase().includes(q));
  }, [unitSearch]);

  const totalComponents = lines.length;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
        
        <Pressable style={styles.back} onPress={onBack}>
          <Text style={[styles.backText, { color: colors.blue }]}>‹ العودة إلى الوحدات المحاسبية</Text>
        </Pressable>

        <BrandBanner />
        <Text style={[styles.screenTitle, { color: colors.text }]}>التركيبة (وصفة الإنتاج)</Text>
        <Text style={[styles.hint, { color: colors.textMuted }]}>حدّد مكونات كل منتج نهائي. هذه التركيبة تُستخدم لاحقاً في أمر الإنتاج لحساب المواد المطلوبة وخصمها من المخزون.</Text>

        {/* اختيار المنتج النهائي */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>المنتج النهائي</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
          value={finishedSearch}
          onChangeText={(text) => { setFinishedSearch(text); setShowFinishedPicker(true); if (selectedFinished && text !== selectedFinished.name) setSelectedFinished(null); }}
          onFocus={() => setShowFinishedPicker(true)}
          onBlur={() => setTimeout(() => setShowFinishedPicker(false), 200)}
          placeholder="ابحث أو اكتب اسم المنتج..."
          placeholderTextColor={colors.textMuted}
          textAlign="right"
        />

        {showFinishedPicker && (
          <ScrollView style={[styles.suggestBox, { maxHeight: 200, backgroundColor: colors.surface, borderColor: colors.border }]} nestedScrollEnabled>
            {filteredFinished.length === 0 ? (
              <Text style={[styles.suggestEmpty, { color: colors.textMuted }]}>لا توجد منتجات نهائية مطابقة</Text>
            ) : (
              filteredFinished.map((it) => (
                <Pressable key={it.id} style={[styles.suggestItem, { borderBottomColor: colors.bg }]} onPress={() => { setSelectedFinished(it); setFinishedSearch(it.name); setShowFinishedPicker(false); }}>
                  <Text style={[styles.suggestName, { color: colors.text }]}>{it.name}</Text>
                  <Text style={[styles.suggestMeta, { color: colors.textMuted }]}>{it.sku} · {it.unit}</Text>
                </Pressable>
              ))
            )}
          </ScrollView>
        )}

        {selectedFinished && (
          <>
            {/* رأس التركيبة */}
            <Text style={[styles.sectionTitle, { color: colors.text }]}>مخرجات التركيبة</Text>
            <Text style={[styles.label, { color: colors.textMuted }]}>الكمية الناتجة من هذه التركيبة</Text>
            <View style={styles.inlineRow}>
              <View style={{ flex: 1 }}>
                <TextInput style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]} value={outputQty} onChangeText={setOutputQty} keyboardType="decimal-pad" textAlign="right" placeholder="1" placeholderTextColor={colors.textMuted} />
              </View>
              <View style={{ flex: 1 }}>
                <TextInput style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]} value={outputUnit} onChangeText={setOutputUnit} textAlign="right" placeholder="علبة" placeholderTextColor={colors.textMuted} />
              </View>
            </View>
            <Pressable style={[styles.secondary, { backgroundColor: colors.blue }]} onPress={saveBomHead}>
              <Text style={styles.secondaryText}>{bomId ? "تحديث رأس التركيبة" : "إنشاء رأس التركيبة"}</Text>
            </Pressable>

            {/* المكونات */}
            <Text style={[styles.sectionTitle, { color: colors.text }]}>المكونات ({totalComponents})</Text>
            {lines.length === 0 ? (
              <Text style={[styles.empty, { color: colors.textMuted }]}>لا توجد مكونات بعد — أضف من الأسفل</Text>
            ) : (
              <View style={styles.list}>
                {lines.map((l) => (
                  <View key={l.id} style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <View style={styles.rowActions}>
                      <Pressable onPress={() => removeLine(l)} style={[styles.delBtn, { backgroundColor: colors.isDark ? "#7F1D1D" : "#fee2e2" }]}>
                        <Text style={[styles.delText, { color: colors.isDark ? "#FCA5A5" : "#0F172A" }]}>حذف</Text>
                      </Pressable>
                    </View>
                    <View style={styles.rowInfo}>
                      <Text style={[styles.rowName, { color: colors.text }]}>{l.component_name ?? "—"}</Text>
                      <Text style={[styles.rowMeta, { color: colors.textMuted }]}>{l.component_sku ?? ""}</Text>
                      <Text style={[styles.rowQty, { color: colors.blue }]}>{Number(l.quantity_per_output).toFixed(2)} {l.unit}{Number(l.waste_percent) > 0 ? `  (+${l.waste_percent}% هدر)` : ""}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* إضافة مكوّن */}
            <Text style={[styles.sectionTitle, { color: colors.text }]}>إضافة مكوّن</Text>

            <Text style={[styles.label, { color: colors.textMuted }]}>المكوّن</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
              value={componentSearch}
              onChangeText={(text) => { setComponentSearch(text); setShowComponentPicker(true); if (newComponent && text !== newComponent.name) setNewComponent(null); }}
              onFocus={() => setShowComponentPicker(true)}
              onBlur={() => setTimeout(() => setShowComponentPicker(false), 200)}
              placeholder="ابحث أو اكتب اسم المكوّن..."
              placeholderTextColor={colors.textMuted}
              textAlign="right"
            />

            {showComponentPicker && (
              <ScrollView style={[styles.suggestBox, { maxHeight: 200, backgroundColor: colors.surface, borderColor: colors.border }]} nestedScrollEnabled>
                {filteredComponents.length === 0 ? (
                  <Text style={[styles.suggestEmpty, { color: colors.textMuted }]}>لا توجد مواد أو عبوات مطابقة</Text>
                ) : (
                  filteredComponents.map((it) => (
                    <Pressable key={it.id} style={[styles.suggestItem, { borderBottomColor: colors.bg }]} onPress={() => { setNewComponent(it); setComponentSearch(it.name); setNewUnit(it.unit); setUnitSearch(it.unit); setShowComponentPicker(false); }}>
                      <Text style={[styles.suggestName, { color: colors.text }]}>{it.name}</Text>
                      <Text style={[styles.suggestMeta, { color: colors.textMuted }]}>{it.sku} · {it.unit}</Text>
                    </Pressable>
                  ))
                )}
              </ScrollView>
            )}

            <Text style={[styles.label, { color: colors.textMuted }]}>الكمية اللازمة لكل وحدة إنتاج</Text>
            <TextInput style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]} value={newQty} onChangeText={setNewQty} keyboardType="decimal-pad" textAlign="right" placeholder="مثال: 150" placeholderTextColor={colors.textMuted} />

            <Text style={[styles.label, { color: colors.textMuted }]}>الوحدة</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
              value={unitSearch}
              onChangeText={(text) => { setUnitSearch(text); setNewUnit(text); setShowUnitPicker(true); }}
              onFocus={() => setShowUnitPicker(true)}
              onBlur={() => setTimeout(() => setShowUnitPicker(false), 200)}
              placeholder="اختر الوحدة..."
              placeholderTextColor={colors.textMuted}
              textAlign="right"
            />
            {showUnitPicker && (
              <ScrollView style={[styles.suggestBox, { maxHeight: 200, backgroundColor: colors.surface, borderColor: colors.border }]} nestedScrollEnabled>
                {filteredUnits.map((u) => (
                  <Pressable key={u} style={[styles.suggestItem, { borderBottomColor: colors.bg }]} onPress={() => { setNewUnit(u); setUnitSearch(u); setShowUnitPicker(false); }}>
                    <Text style={[styles.suggestName, { color: colors.text }]}>{u}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}

            <Text style={[styles.label, { color: colors.textMuted }]}>نسبة الهدر % (اختياري)</Text>
            <TextInput style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]} value={newWaste} onChangeText={setNewWaste} keyboardType="decimal-pad" textAlign="right" placeholder="0" placeholderTextColor={colors.textMuted} />

            <Pressable style={[styles.primary, { backgroundColor: colors.orange }]} onPress={addLine}>
              <Text style={styles.primaryText}>+ إضافة المكوّن</Text>
            </Pressable>
          </>
        )}
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
  inlineRow: { flexDirection: "row-reverse", gap: 8 },
  picker: { borderWidth: 1, borderRadius: 8, padding: 12, flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center" },
  pickerText: { textAlign: "right", flex: 1, fontSize: 14 },
  pickerArrow: { fontSize: 12, marginLeft: 8 },
  suggestBox: { marginTop: 4, borderWidth: 1, borderRadius: 8, overflow: "hidden", maxHeight: 200 },
  suggestItem: { padding: 10, borderBottomWidth: 1 },
  suggestName: { fontWeight: "700", textAlign: "right", fontSize: 13 },
  suggestMeta: { fontSize: 11, textAlign: "right", marginTop: 2 },
  suggestEmpty: { padding: 10, textAlign: "right", fontSize: 12 },
  list: { gap: 8, marginTop: 4 },
  empty: { textAlign: "right", fontSize: 12, padding: 10 },
  row: { borderWidth: 1, borderRadius: 10, padding: 10, flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between" },
  rowInfo: { flex: 1, alignItems: "flex-end" },
  rowName: { fontWeight: "700", fontSize: 14, textAlign: "right", width: "100%" },
  rowMeta: { fontSize: 11, marginTop: 3, textAlign: "right" },
  rowQty: { fontSize: 12, marginTop: 3, textAlign: "right", fontWeight: "600" },
  rowActions: { flexDirection: "row-reverse", gap: 6 },
  delBtn: { padding: 8, borderRadius: 7 },
  delText: { fontSize: 12, fontWeight: "700" },
  secondary: { padding: 12, borderRadius: 8, marginTop: 8 },
  secondaryText: { color: "#fff", fontWeight: "700", textAlign: "center" },
  primary: { padding: 14, borderRadius: 10, marginTop: 16 },
  primaryText: { color: "#fff", fontWeight: "700", textAlign: "center" },
});
