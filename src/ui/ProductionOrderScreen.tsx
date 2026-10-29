import { useEffect, useMemo, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import BrandBanner from "./components/BrandBanner";
import { sqlite } from "../db/local";
import { useTheme } from "./ThemeContext"; // 🚀 استدعاء مركز الألوان

type Item = {
  id: string; sku: string; name: string; itemType: string; unit: string; stockQuantity: number; averageCost: number;
};

type Requirement = {
  itemId: string; itemName: string; itemSku: string; unit: string; required: number; available: number; enough: boolean;
};

const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export default function ProductionOrderScreen({ onBack }: { onBack: () => void }) {
  const { colors } = useTheme(); // 🚀 قراءة الألوان
  const [finishedItems, setFinishedItems] = useState<Item[]>([]);
  const [selectedFinished, setSelectedFinished] = useState<Item | null>(null);
  const [qty, setQty] = useState("");
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [bom, setBom] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [searchFinished, setSearchFinished] = useState(""); // 🚀 للبحث
  const [history, setHistory] = useState<any[]>([]);

  // تحميل المنتجات النهائية
  useEffect(() => {
    (async () => {
      try {
        const all: any = await sqlite.getAllAsync(
          "SELECT id, sku, name, item_type as itemType, unit, stock_quantity as stockQuantity, average_cost as averageCost FROM items WHERE item_type IN ('compound_finished','finished_product') ORDER BY name"
        );
        setFinishedItems(all || []);
      } catch (e) { Alert.alert("تعذر تحميل البيانات", String(e)); }
      loadHistory();
    })();
  }, []);

  const loadHistory = async () => {
    try {
      const rows: any = await sqlite.getAllAsync(`
        SELECT m.id, m.quantity_in, m.created_at, i.name as item_name
        FROM stock_movements m
        LEFT JOIN items i ON i.id = m.item_id
        WHERE m.movement_type = 'production_output'
        ORDER BY m.created_at DESC
        LIMIT 10
      `);
      setHistory(rows || []);
    } catch {}
  };

  // 🚀 فلترة المنتجات بناءً على البحث
  const filteredFinished = useMemo(() => {
    if (!searchFinished.trim()) return finishedItems;
    const q = searchFinished.toLowerCase();
    return finishedItems.filter(i => String(i.name).toLowerCase().includes(q) || String(i.sku).toLowerCase().includes(q));
  }, [finishedItems, searchFinished]);

  // حساب المتطلبات عند تغيير المنتج أو الكمية
  useEffect(() => {
    if (!selectedFinished || !qty) {
      setRequirements([]); setBom(null); return;
    }
    (async () => {
      try {
        const bomRow: any = await sqlite.getFirstAsync(
          "SELECT id, output_quantity FROM product_boms WHERE finished_item_id = ? AND is_active = 1 ORDER BY version DESC LIMIT 1",
          [selectedFinished.id]
        );
        if (!bomRow) { setBom(null); setRequirements([]); return; }
        setBom(bomRow);
        
        const lines: any = await sqlite.getAllAsync(
          `SELECT l.component_item_id, l.quantity_per_output, l.unit, l.waste_percent,
                  i.name as item_name, i.sku as item_sku, i.stock_quantity, i.unit as item_unit
           FROM product_bom_lines l
           LEFT JOIN items i ON i.id = l.component_item_id
           WHERE l.bom_id = ?`, [bomRow.id]
        );
        
        const qtyNum = Number(qty) || 0;
        const outputQty = Number(bomRow.output_quantity) || 1;
        const ratio = qtyNum / outputQty;
        
        const reqs: Requirement[] = (lines || []).map((l: any) => {
          const waste = 1 + (Number(l.waste_percent) || 0) / 100;
          const required = Number(l.quantity_per_output) * ratio * waste;
          const available = Number(l.stock_quantity) || 0;
          return { itemId: l.component_item_id, itemName: l.item_name ?? "—", itemSku: l.item_sku ?? "", unit: l.item_unit ?? l.unit ?? "", required, available, enough: available >= required };
        });
        setRequirements(reqs);
      } catch (e) { Alert.alert("تعذر حساب المتطلبات", String(e)); }
    })();
  }, [selectedFinished, qty]);

  const hasShortage = useMemo(() => requirements.some((r) => !r.enough), [requirements]);
  const canExecute = !!selectedFinished && !!bom && requirements.length > 0 && !hasShortage && Number(qty) > 0;

  const execute = () => {
    if (!selectedFinished || !bom || !qty) return;
    if (hasShortage) { Alert.alert("نقص في المواد", "لا يمكن التنفيذ — بعض المواد غير كافية"); return; }
    Alert.alert("تأكيد التنفيذ", `هل تريد تنفيذ إنتاج ${qty} ${selectedFinished.unit} من «${selectedFinished.name}»؟\n\nسيتم خصم المواد من المخزون وإضافة المنتج للمخزون التام.`, [
      { text: "إلغاء", style: "cancel" },
      { text: "تنفيذ", style: "destructive", onPress: async () => {
          setLoading(true);
          try {
            const now = Date.now();
            const qtyNum = Number(qty);
            // 1) خصم المواد
            for (const r of requirements) {
              await sqlite.runAsync("UPDATE items SET stock_quantity = stock_quantity - ?, updated_at = ? WHERE id = ?", [r.required, now, r.itemId]);
              await sqlite.runAsync(`INSERT INTO stock_movements (id, source_type, source_id, item_id, warehouse_id, movement_type, quantity_in, quantity_out, planned_quantity, waste_quantity, unit_cost, created_at) VALUES (?, 'production', ?, ?, 'wh-wip', 'production_consumption', 0, ?, ?, 0, 0, ?)`, [newId(), selectedFinished.id, r.itemId, r.required, r.required, now]);
            }
            // 2) إضافة المنتج النهائي
            await sqlite.runAsync("UPDATE items SET stock_quantity = stock_quantity + ?, updated_at = ? WHERE id = ?", [qtyNum, now, selectedFinished.id]);
            await sqlite.runAsync(`INSERT INTO stock_movements (id, source_type, source_id, item_id, warehouse_id, movement_type, quantity_in, quantity_out, planned_quantity, waste_quantity, unit_cost, created_at) VALUES (?, 'production', ?, ?, 'wh-final', 'production_output', ?, 0, ?, 0, 0, ?)`, [newId(), selectedFinished.id, selectedFinished.id, qtyNum, qtyNum, now]);

            Alert.alert("تم الإنتاج بنجاح", `تم إنتاج ${qtyNum} ${selectedFinished.unit} من «${selectedFinished.name}»`);
            setQty(""); setRequirements([]);
            
            const refreshed: any = await sqlite.getAllAsync("SELECT id, sku, name, item_type as itemType, unit, stock_quantity as stockQuantity, average_cost as averageCost FROM items WHERE item_type IN ('compound_finished','finished_product') ORDER BY name");
            setFinishedItems(refreshed || []);
            const refreshedSelected = (refreshed || []).find((i: any) => i.id === selectedFinished.id);
            setSelectedFinished(refreshedSelected ?? null);
            loadHistory();
          } catch (e) { Alert.alert("تعذر التنفيذ", String(e)); } finally { setLoading(false); }
      }},
    ]);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
        
        <Pressable style={styles.back} onPress={onBack}>
          <Text style={[styles.backText, { color: colors.blue }]}>‹ العودة إلى الوحدات المحاسبية</Text>
        </Pressable>

        <BrandBanner />
        <Text style={[styles.screenTitle, { color: colors.text }]}>أمر الإنتاج</Text>
        <Text style={[styles.hint, { color: colors.textMuted }]}>أنتج كمية من المنتج النهائي. سيتم خصم المواد الخام تلقائياً حسب التركيبة، وإضافة المنتج إلى المخزون التام.</Text>

        {/* اختيار المنتج مع البحث */}
        <Text style={[styles.label, { color: colors.textMuted }]}>المنتج النهائي</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
          value={searchFinished}
          onChangeText={(text) => {
            setSearchFinished(text);
            setShowPicker(true);
            if (selectedFinished && text !== selectedFinished.name) setSelectedFinished(null);
          }}
          onFocus={() => setShowPicker(true)}
          onBlur={() => setTimeout(() => setShowPicker(false), 200)}
          placeholder="ابحث أو اكتب اسم المنتج..."
          placeholderTextColor={colors.textMuted}
          textAlign="right"
        />
        {showPicker && (
          <ScrollView style={[styles.suggestBox, { maxHeight: 200, backgroundColor: colors.surface, borderColor: colors.border }]} nestedScrollEnabled>
            {filteredFinished.length === 0 ? (
              <Text style={[styles.suggestEmpty, { color: colors.textMuted }]}>لا توجد منتجات مطابقة</Text>
            ) : (
              filteredFinished.map((it) => (
                <Pressable key={it.id} style={[styles.suggestItem, { borderBottomColor: colors.bg }]} onPress={() => { setSelectedFinished(it); setSearchFinished(it.name); setShowPicker(false); }}>
                  <Text style={[styles.suggestName, { color: colors.text }]}>{it.name}</Text>
                  <Text style={[styles.suggestMeta, { color: colors.textMuted }]}>{it.sku} · متوفر: {Number(it.stockQuantity || 0).toFixed(0)} {it.unit}</Text>
                </Pressable>
              ))
            )}
          </ScrollView>
        )}

        {/* الكمية */}
        {selectedFinished && (
          <>
            <Text style={[styles.label, { color: colors.textMuted }]}>الكمية المطلوب إنتاجها ({selectedFinished.unit})</Text>
            <TextInput style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]} value={qty} onChangeText={setQty} keyboardType="decimal-pad" textAlign="right" placeholder="مثال: 100" placeholderTextColor={colors.textMuted} />
          </>
        )}

        {/* المتطلبات */}
        {selectedFinished && qty && !bom && (
          <View style={[styles.warnBox, { backgroundColor: colors.isDark ? "#7F1D1D" : "#fef2f2" }]}>
            <Text style={[styles.warnText, { color: colors.isDark ? "#FCA5A5" : "#dc2626" }]}>⚠️ لا توجد تركيبة لهذا المنتج — أنشئها من شاشة التركيبة</Text>
          </View>
        )}

        {requirements.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>المواد المطلوبة</Text>
            <View style={styles.list}>
              {requirements.map((r) => (
                <View key={r.itemId} style={[styles.reqRow, { backgroundColor: r.enough ? colors.surface : (colors.isDark ? "#7F1D1D" : "#fef2f2"), borderColor: colors.border }]}>
                  <View style={styles.reqRight}>
                    <Text style={[styles.reqStatus, { color: r.enough ? colors.success : colors.danger }]}>{r.enough ? "✅" : "⚠️"}</Text>
                  </View>
                  <View style={styles.reqInfo}>
                    <Text style={[styles.reqName, { color: colors.text }]}>{r.itemName}</Text>
                    <Text style={[styles.reqMeta, { color: colors.textMuted }]}>{r.itemSku}</Text>
                    <Text style={[styles.reqQty, { color: colors.blue }]}>مطلوب: {r.required.toFixed(2)} {r.unit}</Text>
                    <Text style={[styles.reqAvail, { color: r.enough ? colors.success : colors.danger }]}>متوفر: {r.available.toFixed(2)} {r.unit}</Text>
                  </View>
                </View>
              ))}
            </View>
          </>
        )}

        {/* زر التنفيذ */}
        {selectedFinished && qty && (
          <Pressable style={[styles.primary, { backgroundColor: colors.orange }, (!canExecute || loading) && styles.disabled]} onPress={execute} disabled={!canExecute || loading}>
            <Text style={styles.primaryText}>{loading ? "جارٍ التنفيذ..." : hasShortage ? "⚠️ نقص في المواد" : "تنفيذ أمر الإنتاج"}</Text>
          </Pressable>
        )}

        {/* آخر العمليات */}
        {history.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>آخر عمليات الإنتاج</Text>
            <View style={styles.list}>
              {history.map((h) => (
                <View key={h.id} style={[styles.histRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Text style={[styles.histQty, { color: colors.success }]}>+{Number(h.quantity_in || 0).toFixed(0)}</Text>
                  <View style={styles.histInfo}>
                    <Text style={[styles.histName, { color: colors.text }]}>{h.item_name}</Text>
                    <Text style={[styles.histDate, { color: colors.textMuted }]}>{new Date(h.created_at).toLocaleString("ar-EG")}</Text>
                  </View>
                </View>
              ))}
            </View>
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
  picker: { borderWidth: 1, borderRadius: 8, padding: 12, flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center" },
  pickerText: { textAlign: "right", flex: 1, fontSize: 13 },
  pickerArrow: { fontSize: 12, marginLeft: 8 },
  suggestBox: { marginTop: 4, borderWidth: 1, borderRadius: 8, overflow: "hidden", maxHeight: 200 },
  suggestItem: { padding: 10, borderBottomWidth: 1 },
  suggestName: { fontWeight: "700", textAlign: "right", fontSize: 13 },
  suggestMeta: { fontSize: 11, textAlign: "right", marginTop: 2 },
  suggestEmpty: { padding: 10, textAlign: "right", fontSize: 12 },
  list: { gap: 8, marginTop: 4 },
  reqRow: { borderWidth: 1, borderRadius: 10, padding: 10, flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between" },
  reqInfo: { flex: 1, alignItems: "flex-end" },
  reqRight: { paddingRight: 8 },
  reqStatus: { fontSize: 16 },
  reqName: { fontWeight: "700", fontSize: 14, textAlign: "right" },
  reqMeta: { fontSize: 11, marginTop: 2, textAlign: "right" },
  reqQty: { fontSize: 12, marginTop: 3, textAlign: "right", fontWeight: "600" },
  reqAvail: { fontSize: 12, marginTop: 2, textAlign: "right", fontWeight: "600" },
  histRow: { borderWidth: 1, borderRadius: 12, padding: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  histInfo: { flex: 1, alignItems: "flex-end", paddingRight: 10 },
  histName: { fontWeight: "700", textAlign: "right" },
  histDate: { fontSize: 11, marginTop: 2, textAlign: "right" },
  histQty: { fontWeight: "700", fontSize: 14 },
  warnBox: { padding: 12, borderRadius: 8, marginTop: 12 },
  warnText: { fontSize: 12, textAlign: "right", fontWeight: "600" },
  primary: { padding: 14, borderRadius: 10, marginTop: 16 },
  primaryText: { color: "#fff", fontWeight: "700", textAlign: "center" },
  disabled: { opacity: 0.5 },
});
