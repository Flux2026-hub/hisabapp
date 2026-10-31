import React, { useState, useEffect } from "react";
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet, Modal, ActivityIndicator } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { sqlite } from "../../db/local";
import { useTheme } from "../ThemeContext";

interface SearchResult {
  type: "customer" | "supplier" | "item" | "invoice" | "voucher";
  id: string;
  title: string;
  subtitle: string;
}

export default function GlobalSearchModal({ visible, onClose }: { visible: boolean, onClose: () => void }) {
  const { colors } = useTheme();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query.trim() || query.trim().length < 2) {
      setResults([]);
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      setLoading(true);
      try {
        const q = `%${query.trim()}%`;
        
        // البحث في العملاء
        const customers: any = await sqlite.getAllAsync(
          "SELECT id, name as title, code as subtitle FROM customers WHERE name LIKE ? OR code LIKE ? OR phone LIKE ? LIMIT 5",
          [q, q, q]
        );
        
        // البحث في الموردين
        const suppliers: any = await sqlite.getAllAsync(
          "SELECT id, name as title, code as subtitle FROM suppliers WHERE name LIKE ? OR code LIKE ? OR phone LIKE ? LIMIT 5",
          [q, q, q]
        );

        // البحث في الأصناف
        const items: any = await sqlite.getAllAsync(
          "SELECT id, name as title, sku as subtitle FROM items WHERE name LIKE ? OR sku LIKE ? LIMIT 5",
          [q, q]
        );

        // البحث في الفواتير
        const invoices: any = await sqlite.getAllAsync(
          "SELECT id, invoice_no as title, party_name as subtitle FROM invoices WHERE invoice_no LIKE ? OR party_name LIKE ? LIMIT 5",
          [q, q]
        );

        const allResults: SearchResult[] = [
          ...(customers || []).map((c: any) => ({ ...c, type: "customer" })),
          ...(suppliers || []).map((s: any) => ({ ...s, type: "supplier" })),
          ...(items || []).map((i: any) => ({ ...i, type: "item" })),
          ...(invoices || []).map((inv: any) => ({ ...inv, type: "invoice" })),
        ];

        setResults(allResults);
      } catch (e) {
        console.log("Search error", e);
      } finally {
        setLoading(false);
      }
    }, 400); // تأخير بسيط لتجنب البحث مع كل حرف

    return () => clearTimeout(delayDebounceFn);
  }, [query]);

  const getIcon = (type: string) => {
    switch (type) {
      case "customer": return "account";
      case "supplier": return "truck";
      case "item": return "package-variant";
      case "invoice": return "receipt";
      default: return "magnify";
    }
  };

  const getLabel = (type: string) => {
    switch (type) {
      case "customer": return "عميل";
      case "supplier": return "مورد";
      case "item": return "صنف";
      case "invoice": return "فاتورة";
      default: return "";
    }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent={true} onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
          
          <View style={[styles.searchBar, { backgroundColor: colors.bg, borderColor: colors.border }]}>
            <MaterialCommunityIcons name="magnify" size={24} color={colors.textMuted} />
            <TextInput
              style={[styles.input, { color: colors.text }]}
              placeholder="ابحث عن عميل، صنف، فاتورة..."
              placeholderTextColor={colors.textMuted}
              value={query}
              onChangeText={setQuery}
              autoFocus={true}
              textAlign="right"
            />
            <Pressable android_ripple={{ color: "rgba(0,0,0,0.1)" }} onPress={onClose} style={{ padding: 4 }}>
              <MaterialCommunityIcons name="close" size={24} color={colors.textMuted} />
            </Pressable>
          </View>

          {loading ? (
            <ActivityIndicator size="large" color={colors.blue} style={{ marginTop: 20 }} />
          ) : (
            <ScrollView style={{ maxHeight: 400, marginTop: 10 }} keyboardShouldPersistTaps="handled">
              {results.length === 0 && query.length >= 2 ? (
                <Text style={[styles.empty, { color: colors.textMuted }]}>لا توجد نتائج مطابقة</Text>
              ) : (
                results.map((item, index) => (
                  <View key={`${item.type}-${item.id}-${index}`} style={[styles.resultRow, { borderBottomColor: colors.border }]}>
                    <MaterialCommunityIcons name={getIcon(item.type) as any} size={20} color={colors.blue} />
                    <View style={{ flex: 1, alignItems: "flex-end", marginRight: 10 }}>
                      <Text style={[styles.resultTitle, { color: colors.text }]}>{item.title}</Text>
                      <Text style={[styles.resultSubtitle, { color: colors.textMuted }]}>{item.subtitle}</Text>
                    </View>
                    <View style={[styles.badge, { backgroundColor: colors.bg }]}>
                      <Text style={{ fontSize: 10, color: colors.textMuted }}>{getLabel(item.type)}</Text>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-start", paddingTop: 80 },
  modalContent: { marginHorizontal: 20, borderRadius: 16, padding: 16, minHeight: 200, shadowColor: "#000", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 10 },
  searchBar: { flexDirection: "row-reverse", alignItems: "center", borderWidth: 1, borderRadius: 12, paddingHorizontal: 10, height: 50 },
  input: { flex: 1, fontSize: 15, marginHorizontal: 10 },
  empty: { textAlign: "center", marginTop: 20, fontSize: 14 },
  resultRow: { flexDirection: "row-reverse", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1 },
  resultTitle: { fontSize: 14, fontWeight: "700" },
  resultSubtitle: { fontSize: 12, marginTop: 2 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
});
