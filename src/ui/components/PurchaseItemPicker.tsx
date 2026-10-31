import React, { useState, useMemo } from "react";
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet, Alert } from "react-native";
import { useTheme } from "../ThemeContext";

type Item = any;
type InvoiceLine = { key: string; itemId: string; itemName: string; itemSku: string; unit: string; quantity: number; unitPrice: number; };

interface Props {
  items: Item[];
  onAddLine: (line: InvoiceLine) => void;
}

export default function PurchaseItemPicker({ items, onAddLine }: Props) {
  const { colors } = useTheme();
  const [showItemPicker, setShowItemPicker] = useState(false);
  const [pickItem, setPickItem] = useState<Item | null>(null);
  const [pickQty, setPickQty] = useState("");
  const [pickPrice, setPickPrice] = useState("");
  const [searchItem, setSearchItem] = useState("");

  const filteredItems = useMemo(() => {
    if (!searchItem.trim()) return items;
    const q = searchItem.toLowerCase();
    return items.filter(i => String(i.name).toLowerCase().includes(q) || String(i.sku).toLowerCase().includes(q));
  }, [items, searchItem]);

  const handleAdd = () => {
    if (!pickItem) return Alert.alert("تنبيه", "اختر المادة/العبوة");
    const qty = Number(pickQty); const price = Number(pickPrice);
    if (!qty || qty <= 0) return Alert.alert("تنبيه", "أدخل كمية صحيحة");
    if (price < 0 || Number.isNaN(price)) return Alert.alert("تنبيه", "أدخل سعراً صحيحاً");

    onAddLine({
      key: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
      itemId: pickItem.id,
      itemName: pickItem.name,
      itemSku: pickItem.sku,
      unit: pickItem.unit,
      quantity: qty,
      unitPrice: price,
    });

    setPickItem(null); setPickQty(""); setPickPrice(""); setSearchItem(""); setShowItemPicker(false);
  };

  return (
    <View style={{ marginTop: 12 }}>
      <Pressable style={[styles.secondary, { backgroundColor: colors.blue }]} onPress={() => setShowItemPicker(!showItemPicker)}>
        <Text style={styles.secondaryText}>+ إضافة مادة / عبوة</Text>
      </Pressable>

      {showItemPicker && (
        <View style={[styles.addBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          
          <Text style={[styles.label, { color: colors.textMuted }]}>المادة / العبوة</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
            value={searchItem}
            onChangeText={setSearchItem}
            onFocus={() => setShowItemPicker(true)}
            placeholder="ابحث بالاسم أو الرمز..."
            placeholderTextColor={colors.textMuted}
            textAlign="right"
          />
          
          <ScrollView style={[styles.suggestBox, { maxHeight: 200, backgroundColor: colors.surface, borderColor: colors.border }]} nestedScrollEnabled keyboardShouldPersistTaps="always">
            {filteredItems.length === 0 ? (
              <Text style={{ padding: 10, textAlign: "right", color: colors.textMuted }}>لا نتائج</Text>
            ) : (
              filteredItems.map((i) => (
                <Pressable key={i.id} style={[styles.suggestItem, { borderBottomColor: colors.bg }, pickItem?.id === i.id && { backgroundColor: colors.bg }]} onPress={() => { setPickItem(i); setSearchItem(i.name); setPickPrice(String(i.average_cost || 0)); }}>
                  <Text style={[styles.suggestName, { color: colors.text }]}>{i.name}</Text>
                  <Text style={[styles.suggestMeta, { color: colors.textMuted }]}>متوفر: {i.stock_quantity}</Text>
                </Pressable>
              ))
            )}
          </ScrollView>

          <View style={styles.twoCols}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.label, { color: colors.textMuted }]}>الكمية</Text>
              <TextInput style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]} value={pickQty} onChangeText={setPickQty} keyboardType="decimal-pad" textAlign="right" placeholder="0" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.label, { color: colors.textMuted }]}>السعر</Text>
              <TextInput style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]} value={pickPrice} onChangeText={setPickPrice} keyboardType="decimal-pad" textAlign="right" placeholder="0" />
            </View>
          </View>

          <Pressable style={[styles.primary, { backgroundColor: colors.orange, marginTop: 12 }]} onPress={handleAdd}>
            <Text style={styles.primaryText}>إضافة للسلة</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 12, marginTop: 8, marginBottom: 4, textAlign: "right", width: "100%" },
  input: { borderWidth: 1, borderRadius: 8, padding: 10, fontSize: 14, textAlign: "right", width: "100%" },
  secondary: { padding: 12, borderRadius: 8, alignItems: "center" },
  secondaryText: { color: "#fff", fontWeight: "700" },
  addBox: { padding: 12, borderRadius: 10, marginTop: 8, borderWidth: 1 },
  suggestBox: { marginTop: 4, borderWidth: 1, borderRadius: 8, overflow: "hidden", maxHeight: 200 },
  suggestItem: { padding: 10, borderBottomWidth: 1 },
  suggestName: { fontWeight: "700", textAlign: "right", fontSize: 13 },
  suggestMeta: { fontSize: 11, textAlign: "right", marginTop: 2 },
  twoCols: { flexDirection: "row-reverse", gap: 8, marginTop: 8 },
  primary: { padding: 14, borderRadius: 10 },
  primaryText: { color: "#fff", fontWeight: "700", textAlign: "center" },
});
