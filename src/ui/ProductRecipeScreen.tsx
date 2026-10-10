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
import { sqlite } from "../db/local";

type Item = {
  id: string;
  sku: string;
  name: string;
  itemType: string;
  unit: string;
  stockQuantity: number;
};

type BomLine = {
  id: string;
  bom_id: string;
  component_item_id: string;
  quantity_per_output: number;
  unit: string;
  waste_percent: number;
  component_name?: string;
  component_sku?: string;
};

const newId = () =>
  `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export default function ProductRecipeScreen({ onBack }: { onBack: () => void }) {
  const [finishedItems, setFinishedItems] = useState<Item[]>([]);
  const [components, setComponents] = useState<Item[]>([]);
  const [selectedFinished, setSelectedFinished] = useState<Item | null>(null);
  const [bomId, setBomId] = useState<string | null>(null);
  const [lines, setLines] = useState<BomLine[]>([]);
  const [outputQty, setOutputQty] = useState("1");
  const [outputUnit, setOutputUnit] = useState("علبة");

  const [showFinishedPicker, setShowFinishedPicker] = useState(false);
  const [showComponentPicker, setShowComponentPicker] = useState(false);
  const [showUnitPicker, setShowUnitPicker] = useState(false);

  const [newComponent, setNewComponent] = useState<Item | null>(null);
  const [newQty, setNewQty] = useState("");
  const [newUnit, setNewUnit] = useState("");
  const [newWaste, setNewWaste] = useState("0");

  // تحميل الأصناف
  useEffect(() => {
    (async () => {
      try {
        const all: any = await sqlite.getAllAsync(
          "SELECT id, sku, name, item_type as itemType, unit, stock_quantity as stockQuantity FROM items ORDER BY name"
        );
        const finished = (all || []).filter(
          (i: any) =>
            i.itemType === "compound_finished" ||
            i.itemType === "finished_product"
        );
        const comp = (all || []).filter(
          (i: any) =>
            i.itemType === "raw_material" ||
            i.itemType === "production_material" ||
            i.itemType === "packaging"
        );
        setFinishedItems(finished);
        setComponents(comp);
      } catch (e) {
        Alert.alert("تعذر تحميل الأصناف", String(e));
      }
    })();
  }, []);

  // تحميل التركيبة عند اختيار منتج نهائي
  useEffect(() => {
    if (!selectedFinished) {
      setBomId(null);
      setLines([]);
      return;
    }
    (async () => {
      try {
        const bom: any = await sqlite.getFirstAsync(
          "SELECT id, output_quantity, output_unit FROM product_boms WHERE finished_item_id = ? AND is_active = 1 ORDER BY version DESC LIMIT 1",
          [selectedFinished.id]
        );
        if (bom) {
          setBomId(bom.id);
          setOutputQty(String(bom.output_quantity ?? 1));
          setOutputUnit(bom.output_unit ?? "علبة");
          const rows: any = await sqlite.getAllAsync(
            `SELECT l.id, l.bom_id, l.component_item_id, l.quantity_per_output,
                    l.unit, l.waste_percent,
                    i.name as component_name, i.sku as component_sku
             FROM product_bom_lines l
             LEFT JOIN items i ON i.id = l.component_item_id
             WHERE l.bom_id = ?
             ORDER BY i.name`,
            [bom.id]
          );
          setLines(rows || []);
        } else {
          setBomId(null);
          setLines([]);
          setOutputQty("1");
          setOutputUnit(selectedFinished.unit || "علبة");
        }
      } catch (e) {
        Alert.alert("تعذر تحميل التركيبة", String(e));
      }
    })();
  }, [selectedFinished]);

  const saveBomHead = async () => {
    if (!selectedFinished) {
      Alert.alert("تنبيه", "اختر المنتج النهائي أولاً");
      return;
    }
    const qty = Number(outputQty) || 1;
    try {
      let currentBomId = bomId;
      if (!currentBomId) {
        currentBomId = newId();
        await sqlite.runAsync(
          `INSERT INTO product_boms
           (id, name, finished_item_id, version, output_quantity, output_unit, effective_from, is_active)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            currentBomId,
            `تركيبة ${selectedFinished.name}`,
            selectedFinished.id,
            1,
            qty,
            outputUnit,
            new Date().toISOString().slice(0, 10),
            1,
          ]
        );
        setBomId(currentBomId);
      } else {
        await sqlite.runAsync(
          "UPDATE product_boms SET output_quantity = ?, output_unit = ? WHERE id = ?",
          [qty, outputUnit, currentBomId]
        );
      }
      Alert.alert("تم الحفظ", "تم حفظ رأس التركيبة — أضف المكونات من الأسفل");
    } catch (e) {
      Alert.alert("تعذر الحفظ", String(e));
    }
  };

  const reloadLines = async (id: string) => {
    const rows: any = await sqlite.getAllAsync(
      `SELECT l.id, l.bom_id, l.component_item_id, l.quantity_per_output,
              l.unit, l.waste_percent,
              i.name as component_name, i.sku as component_sku
       FROM product_bom_lines l
       LEFT JOIN items i ON i.id = l.component_item_id
       WHERE l.bom_id = ?
       ORDER BY i.name`,
      [id]
    );
    setLines(rows || []);
  };

  const addLine = async () => {
    if (!bomId) {
      Alert.alert("تنبيه", "احفظ رأس التركيبة أولاً");
      return;
    }
    if (!newComponent) {
      Alert.alert("تنبيه", "اختر المكوّن");
      return;
    }
    const qty = Number(newQty);
    if (!qty || qty <= 0) {
      Alert.alert("تنبيه", "أدخل كمية صحيحة أكبر من صفر");
      return;
    }
    try {
      await sqlite.runAsync(
        `INSERT INTO product_bom_lines
         (id, bom_id, component_item_id, quantity_per_output, unit, waste_percent)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          newId(),
          bomId,
          newComponent.id,
          qty,
          newUnit || newComponent.unit,
          Number(newWaste) || 0,
        ]
      );
      await reloadLines(bomId);
      setNewComponent(null);
      setNewQty("");
      setNewUnit("");
      setNewWaste("0");
    } catch (e) {
      Alert.alert("تعذر الإضافة", String(e));
    }
  };

  const removeLine = (line: BomLine) => {
    Alert.alert("تأكيد الحذف", `حذف «${line.component_name}» من التركيبة؟`, [
      { text: "إلغاء", style: "cancel" },
      {
        text: "حذف",
        style: "destructive",
        onPress: async () => {
          try {
            await sqlite.runAsync("DELETE FROM product_bom_lines WHERE id = ?", [
              line.id,
            ]);
            if (bomId) await reloadLines(bomId);
          } catch (e) {
            Alert.alert("تعذر الحذف", String(e));
          }
        },
      },
    ]);
  };

  const totalComponents = lines.length;

  const filteredFinished = useMemo(() => finishedItems, [finishedItems]);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 40, paddingHorizontal: 4 }}
      >
        <Pressable style={styles.back} onPress={onBack}>
          <Text style={styles.backText}>← العودة إلى الوحدات المحاسبية</Text>
        </Pressable>

        <Text style={styles.screenTitle}>التركيبة (وصفة الإنتاج)</Text>
        <Text style={styles.hint}>
          حدّد مكونات كل منتج نهائي. هذه التركيبة تُستخدم لاحقاً في أمر الإنتاج
          لحساب المواد المطلوبة وخصمها من المخزون.
        </Text>

        {/* اختيار المنتج النهائي */}
        <Text style={styles.sectionTitle}>المنتج النهائي</Text>
        <Pressable
          style={styles.picker}
          onPress={() => setShowFinishedPicker((v) => !v)}
        >
          <Text style={styles.pickerText}>
            {selectedFinished ? selectedFinished.name : "اختر منتجاً نهائياً"}
          </Text>
          <Text style={styles.pickerArrow}>▼</Text>
        </Pressable>

        {showFinishedPicker && (
          <View style={styles.suggestBox}>
            {filteredFinished.length === 0 ? (
              <Text style={styles.suggestEmpty}>
                لا توجد منتجات نهائية — أضفها من شاشة الأصناف
              </Text>
            ) : (
              filteredFinished.map((it) => (
                <Pressable
                  key={it.id}
                  style={styles.suggestItem}
                  onPress={() => {
                    setSelectedFinished(it);
                    setShowFinishedPicker(false);
                  }}
                >
                  <Text style={styles.suggestName}>{it.name}</Text>
                  <Text style={styles.suggestMeta}>
                    {it.sku} · {it.unit}
                  </Text>
                </Pressable>
              ))
            )}
          </View>
        )}

        {selectedFinished && (
          <>
            {/* رأس التركيبة */}
            <Text style={styles.sectionTitle}>مخرجات التركيبة</Text>
            <Text style={styles.label}>
              الكمية الناتجة من هذه التركيبة
            </Text>
            <View style={styles.inlineRow}>
              <View style={{ flex: 1 }}>
                <TextInput
                  style={styles.input}
                  value={outputQty}
                  onChangeText={setOutputQty}
                  keyboardType="decimal-pad"
                  textAlign="right"
                  placeholder="1"
                  placeholderTextColor="#9CA3AF"
                />
              </View>
              <View style={{ flex: 1 }}>
                <TextInput
                  style={styles.input}
                  value={outputUnit}
                  onChangeText={setOutputUnit}
                  textAlign="right"
                  placeholder="علبة"
                  placeholderTextColor="#9CA3AF"
                />
              </View>
            </View>
            <Pressable style={styles.secondary} onPress={saveBomHead}>
              <Text style={styles.secondaryText}>
                {bomId ? "تحديث رأس التركيبة" : "إنشاء رأس التركيبة"}
              </Text>
            </Pressable>

            {/* المكونات */}
            <Text style={styles.sectionTitle}>
              المكونات ({totalComponents})
            </Text>

            {lines.length === 0 ? (
              <Text style={styles.empty}>
                لا توجد مكونات بعد — أضف من الأسفل
              </Text>
            ) : (
              <View style={styles.list}>
                {lines.map((l) => (
                  <View key={l.id} style={styles.row}>
                    <View style={styles.rowActions}>
                      <Pressable
                        onPress={() => removeLine(l)}
                        style={styles.delBtn}
                      >
                        <Text style={styles.delText}>حذف</Text>
                      </Pressable>
                    </View>
                    <View style={styles.rowInfo}>
                      <Text style={styles.rowName}>
                        {l.component_name ?? "—"}
                      </Text>
                      <Text style={styles.rowMeta}>
                        {l.component_sku ?? ""}
                      </Text>
                      <Text style={styles.rowQty}>
                        {Number(l.quantity_per_output).toFixed(2)} {l.unit}
                        {Number(l.waste_percent) > 0
                          ? `  (+${l.waste_percent}% هدر)`
                          : ""}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* إضافة مكوّن */}
            <Text style={styles.sectionTitle}>إضافة مكوّن</Text>

            <Text style={styles.label}>المكوّن</Text>
            <Pressable
              style={styles.picker}
              onPress={() => setShowComponentPicker((v) => !v)}
            >
              <Text style={styles.pickerText}>
                {newComponent ? newComponent.name : "اختر من الأصناف"}
              </Text>
              <Text style={styles.pickerArrow}>▼</Text>
            </Pressable>

            {showComponentPicker && (
              <View style={styles.suggestBox}>
                {components.length === 0 ? (
                  <Text style={styles.suggestEmpty}>
                    لا توجد مواد أو عبوات — أضفها من شاشة الأصناف
                  </Text>
                ) : (
                  components.map((it) => (
                    <Pressable
                      key={it.id}
                      style={styles.suggestItem}
                      onPress={() => {
                        setNewComponent(it);
                        setNewUnit(it.unit);
                        setShowComponentPicker(false);
                      }}
                    >
                      <Text style={styles.suggestName}>{it.name}</Text>
                      <Text style={styles.suggestMeta}>
                        {it.sku} · {it.unit}
                      </Text>
                    </Pressable>
                  ))
                )}
              </View>
            )}

            <Text style={styles.label}>الكمية اللازمة لكل وحدة إنتاج</Text>
            <TextInput
              style={styles.input}
              value={newQty}
              onChangeText={setNewQty}
              keyboardType="decimal-pad"
              textAlign="right"
              placeholder="مثال: 150"
              placeholderTextColor="#9CA3AF"
            />

            <Text style={styles.label}>الوحدة</Text>
            <Pressable
              style={styles.picker}
              onPress={() => setShowUnitPicker((v) => !v)}
            >
              <Text style={styles.pickerText}>
                {newUnit || "اختر الوحدة"}
              </Text>
              <Text style={styles.pickerArrow}>▼</Text>
            </Pressable>
            {showUnitPicker && (
              <View style={styles.suggestBox}>
                {["جرام", "كيلو", "لتر", "حبة", "عبوة", "علبة", "كرتون"].map(
                  (u) => (
                    <Pressable
                      key={u}
                      style={styles.suggestItem}
                      onPress={() => {
                        setNewUnit(u);
                        setShowUnitPicker(false);
                      }}
                    >
                      <Text style={styles.suggestName}>{u}</Text>
                    </Pressable>
                  )
                )}
              </View>
            )}

            <Text style={styles.label}>نسبة الهدر % (اختياري)</Text>
            <TextInput
              style={styles.input}
              value={newWaste}
              onChangeText={setNewWaste}
              keyboardType="decimal-pad"
              textAlign="right"
              placeholder="0"
              placeholderTextColor="#9CA3AF"
            />

            <Pressable style={styles.primary} onPress={addLine}>
              <Text style={styles.primaryText}>+ إضافة المكوّن</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  back: { paddingVertical: 10, marginBottom: 8 },
  backText: { color: "#087f68", fontWeight: "700", textAlign: "right" },
  screenTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#172033",
    textAlign: "right",
    marginBottom: 6,
  },
  hint: {
    fontSize: 12,
    color: "#758298",
    textAlign: "right",
    marginBottom: 12,
    lineHeight: 18,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#172033",
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
    borderColor: "#e2e8f0",
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    color: "#172033",
  },
  inlineRow: { flexDirection: "row", gap: 8 },
  picker: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    padding: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  pickerText: { color: "#172033", textAlign: "right", flex: 1, fontSize: 14 },
  pickerArrow: { color: "#758298", fontSize: 12, marginLeft: 8 },
  suggestBox: {
    marginTop: 4,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
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
    color: "#172033",
    textAlign: "right",
    fontSize: 13,
  },
  suggestMeta: {
    fontSize: 11,
    color: "#758298",
    textAlign: "right",
    marginTop: 2,
  },
  suggestEmpty: {
    padding: 10,
    color: "#758298",
    textAlign: "right",
    fontSize: 12,
  },
  list: { gap: 8, marginTop: 4 },
  empty: { textAlign: "right", color: "#758298", fontSize: 12, padding: 10 },
  row: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
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
    color: "#172033",
    textAlign: "right",
  },
  rowMeta: {
    fontSize: 11,
    color: "#758298",
    marginTop: 3,
    textAlign: "right",
  },
  rowQty: {
    fontSize: 12,
    color: "#315b85",
    marginTop: 3,
    textAlign: "right",
    fontWeight: "600",
  },
  rowActions: { flexDirection: "row", gap: 6 },
  delBtn: { backgroundColor: "#fee2e2", padding: 8, borderRadius: 7 },
  delText: { color: "#172033", fontSize: 12 },
  secondary: {
    backgroundColor: "#315b85",
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  secondaryText: { color: "#fff", fontWeight: "700", textAlign: "center" },
  primary: {
    backgroundColor: "#10a88a",
    padding: 14,
    borderRadius: 10,
    marginTop: 16,
  },
  primaryText: { color: "#fff", fontWeight: "700", textAlign: "center" },
});