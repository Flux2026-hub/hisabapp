import { useEffect, useMemo, useState } from "react";
import {
  Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from "react-native";
import * as Contacts from 'expo-contacts';
import { MaterialCommunityIcons } from "@expo/vector-icons";
import BrandBanner from "./components/BrandBanner";
import {
  createCustomer, createSupplier, deleteCustomer, deleteSupplier,
  listCustomers, listSuppliers, updateCustomer, updateSupplier,
} from "../sync/accounting";
import { sqlite } from "../db/local";
import { useTheme } from "./ThemeContext"; // 🚀 استدعاء مركز الألوان

type Kind = "customers" | "suppliers";
type Row = any;

const CONFIG: Record<Kind, any> = {
  customers: { singular: "العميل", plural: "العملاء", parentAccountCode: "1103", list: listCustomers, create: createCustomer, update: updateCustomer, remove: deleteCustomer },
  suppliers: { singular: "المورد", plural: "الموردون", parentAccountCode: "2101", list: listSuppliers, create: createSupplier, update: updateSupplier, remove: deleteSupplier },
};

export default function CustomersScreen({ kind, onBack }: { kind: Kind; onBack: () => void }) {
  const { colors } = useTheme(); // 🚀 قراءة الألوان
  const cfg = CONFIG[kind];
  const [rows, setRows] = useState<Row[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [sarRate, setSarRate] = useState(140);

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("+967");

  const [search, setSearch] = useState("");
  const [searchFocus, setSearchFocus] = useState(false);
  const [showCodeSuggest, setShowCodeSuggest] = useState(false);
  const [showNameSuggest, setShowNameSuggest] = useState(false);

  const load = async () => {
    try {
      const data = await cfg.list();
      setRows(data || []);
      const sar: any = await sqlite.getFirstAsync("SELECT exchange_rate FROM currencies WHERE code = 'SAR'");
      if (sar?.exchange_rate) setSarRate(Number(sar.exchange_rate) || 140);
    } catch (e) { Alert.alert("تعذر تحميل البيانات", String(e)); }
  };

  useEffect(() => {
    clearForm();
    setSearch("");
    void load();
  }, [kind]);

  const nextCode = useMemo(() => {
    const nums = rows.map((r) => parseInt(String(r.code ?? ""), 10)).filter((n) => !Number.isNaN(n));
    const next = nums.length ? Math.max(...nums) + 1 : 1;
    return String(next).padStart(3, "0");
  }, [rows]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => `${r.code ?? ""} ${r.name ?? ""} ${r.phone ?? ""}`.toLowerCase().includes(q));
  }, [rows, search]);

  const nameSuggestions = useMemo(() => {
    const q = name.trim().toLowerCase();
    if (!q) return [];
    return rows.filter((r) => String(r.name ?? "").toLowerCase().includes(q)).slice(0, 6);
  }, [rows, name]);

  const clearForm = () => {
    setEditingId(null); setCode(""); setName(""); setPhone("+967"); setShowCodeSuggest(false); setShowNameSuggest(false);
  };

  const normalizePhone = (raw: string) => {
    const digits = raw.replace(/\D/g, "");
    const local = digits.startsWith("967") ? digits.slice(3) : digits;
    return local.slice(0, 9);
  };

  const isValidYemeniPhone = (local: string) => /^7\d{8}$/.test(local);

  const onPhoneChange = (text: string) => {
    const local = normalizePhone(text);
    setPhone("+967" + local);
  };

  const pickContact = async () => {
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status === 'granted') {
        const contact = await Contacts.presentContactPickerAsync();
        if (contact && contact.phoneNumbers && contact.phoneNumbers.length > 0) {
          onPhoneChange(contact.phoneNumbers[0].number || "");
        }
      }
    } catch (e) { console.log("Contacts error:", e); }
  };

  const applySuggestedCode = () => { setCode(nextCode); setShowCodeSuggest(false); };

  const save = async () => {
    try {
      const trimmedName = name.trim();
      const trimmedCode = code.trim();
      const localPhone = normalizePhone(phone);

      if (!trimmedCode) return Alert.alert("تنبيه", "الرمز مطلوب");
      if (!trimmedName) return Alert.alert("تنبيه", "الاسم مطلوب");
      if (rows.some((r) => String(r.code ?? "").trim() === trimmedCode && r.id !== editingId)) return Alert.alert("تنبيه", "الرمز مستخدم");
      if (rows.some((r) => String(r.name ?? "").trim().toLowerCase() === trimmedName.toLowerCase() && r.id !== editingId)) return Alert.alert("تنبيه", `يوجد ${cfg.singular} بهذا الاسم مسبقًا`);
      if (localPhone && !isValidYemeniPhone(localPhone)) return Alert.alert("تنبيه", "رقم الهاتف غير صحيح");

      const input: any = { code: trimmedCode, name: trimmedName, phone: localPhone ? `+967${localPhone}` : "", parentAccountCode: cfg.parentAccountCode };

      if (editingId) await cfg.update(editingId, input);
      else await cfg.create(input);

      await load();
      const wasEdit = !!editingId;
      clearForm();
      Alert.alert("تم الحفظ", `تم ${wasEdit ? "تعديل" : "إضافة"} ${cfg.singular}`);
    } catch (e) { Alert.alert("تعذر الحفظ", String(e)); }
  };

  const edit = (r: Row) => {
    setEditingId(r.id); setCode(String(r.code ?? "")); setName(String(r.name ?? ""));
    const local = normalizePhone(String(r.phone ?? ""));
    setPhone("+967" + local);
  };

  const remove = (r: Row) => {
    Alert.alert("تأكيد الحذف", `هل تريد حذف «${r.name}»؟`, [
      { text: "إلغاء", style: "cancel" },
      { text: "حذف", style: "destructive", onPress: async () => {
          try { await cfg.remove(r.id); await load(); if (editingId === r.id) clearForm(); } catch (e) { Alert.alert("تعذر الحذف", String(e)); }
      }},
    ]);
  };

  const balanceColor = (bal: any) => { const n = Number(bal) || 0; return n > 0 ? "#0b806c" : n < 0 ? "#dc2626" : "#8494B0"; };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scrollContainer}>
        
        <Pressable style={styles.back} onPress={onBack}>
          <Text style={[styles.backText, { color: colors.blue }]}>‹ العودة إلى الوحدات المحاسبية</Text>
        </Pressable>

        <BrandBanner />
        <Text style={[styles.screenTitle, { marginTop: 15, color: colors.text }]}>{cfg.plural}</Text>

        <Text style={[styles.label, { color: colors.textMuted }]}>بحث</Text>
        <TextInput style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]} value={search} onChangeText={setSearch} onFocus={() => setSearchFocus(true)} onBlur={() => setTimeout(() => setSearchFocus(false), 200)} placeholder="ابحث بالرمز أو الاسم أو الهاتف" placeholderTextColor={colors.textMuted} textAlign="right" />
        
        {searchFocus && search.trim().length > 0 && (
          <ScrollView style={[styles.suggestBox, { maxHeight: 200, backgroundColor: colors.surface, borderColor: colors.border }]} nestedScrollEnabled>
            {filteredRows.length === 0 ? (
              <Text style={[styles.suggestEmpty, { color: colors.textMuted }]}>لا نتائج</Text>
            ) : (
              filteredRows.slice(0, 8).map((r) => (
                <Pressable key={r.id} style={[styles.suggestItem, { borderBottomColor: colors.bg }]} onPress={() => { edit(r); setSearch(""); setSearchFocus(false); }}>
                  <Text style={[styles.suggestName, { color: colors.text }]}>{r.name}</Text>
                  <Text style={[styles.suggestMeta, { color: colors.textMuted }]}>{r.code ?? ""} · {r.phone ?? ""}</Text>
                </Pressable>
              ))
            )}
          </ScrollView>
        )}

        <Text style={[styles.sectionTitle, { color: colors.text }]}>{editingId ? `تعديل ${cfg.singular}` : `إضافة ${cfg.singular}`}</Text>

        <Text style={[styles.label, { color: colors.textMuted }]}>الرمز</Text>
        <TextInput style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]} value={code} onChangeText={setCode} onFocus={() => !editingId && setShowCodeSuggest(true)} onBlur={() => setTimeout(() => setShowCodeSuggest(false), 200)} placeholder={nextCode} placeholderTextColor={colors.textMuted} textAlign="right" editable={!editingId} />
        
        {showCodeSuggest && !editingId && (
          <ScrollView style={[styles.suggestBox, { maxHeight: 200, backgroundColor: colors.surface, borderColor: colors.border }]} nestedScrollEnabled>
            <Pressable style={[styles.suggestItem, { borderBottomColor: colors.bg }]} onPress={applySuggestedCode}>
              <Text style={[styles.suggestName, { color: colors.text }]}>{nextCode}</Text>
              <Text style={[styles.suggestMeta, { color: colors.textMuted }]}>اضغط لاعتماد الرمز التالي</Text>
            </Pressable>
          </ScrollView>
        )}

        <Text style={[styles.label, { color: colors.textMuted }]}>الاسم</Text>
        <TextInput style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]} value={name} onChangeText={setName} onFocus={() => setShowNameSuggest(true)} onBlur={() => setTimeout(() => setShowNameSuggest(false), 200)} placeholder={`اسم ${cfg.singular}`} placeholderTextColor={colors.textMuted} textAlign="right" />
        
        {showNameSuggest && nameSuggestions.length > 0 && (
          <ScrollView style={[styles.suggestBox, { maxHeight: 200, backgroundColor: colors.surface, borderColor: colors.border }]} nestedScrollEnabled>
            {nameSuggestions.map((r) => (
              <Pressable key={r.id} style={[styles.suggestItem, { borderBottomColor: colors.bg }]} onPress={() => { setName(r.name); setShowNameSuggest(false); }}>
                <Text style={[styles.suggestName, { color: colors.text }]}>{r.name}</Text>
                <Text style={[styles.suggestMeta, { color: colors.textMuted }]}>{r.code ?? ""}</Text>
              </Pressable>
            ))}
          </ScrollView>
        )}

        <Text style={[styles.label, { color: colors.textMuted }]}>الهاتف</Text>
        <View style={styles.phoneRow}>
          <TextInput style={[styles.input, { flex: 1, backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]} value={phone} onChangeText={onPhoneChange} placeholder="+9677XXXXXXXX" placeholderTextColor={colors.textMuted} keyboardType="phone-pad" textAlign="right" />
          <Pressable style={[styles.contactBtn, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={pickContact}>
            <MaterialCommunityIcons name="contacts" size={24} color={colors.blue} />
          </Pressable>
        </View>

        <View style={styles.buttons}>
          <Pressable style={[styles.primary, { backgroundColor: colors.orange }]} onPress={save}>
            <Text style={styles.primaryText}>{editingId ? "حفظ التعديل" : "إضافة وحفظ"}</Text>
          </Pressable>
          {editingId && (
            <Pressable style={[styles.cancel, { borderColor: colors.border }]} onPress={clearForm}><Text style={[styles.cancelText, { color: colors.text }]}>إلغاء</Text></Pressable>
          )}
        </View>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>استعراض {cfg.plural} ({rows.length})</Text>
        <View style={styles.list}>
          {filteredRows.length === 0 ? (
            <Text style={[styles.empty, { color: colors.textMuted }]}>لا توجد سجلات</Text>
          ) : (
            filteredRows.map((r) => {
              const bal = Number(r.balance || 0);
              return (
                <View key={r.id} style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <View style={styles.rowActions}>
                    <Pressable onPress={() => edit(r)} style={[styles.editBtn, { backgroundColor: colors.isDark ? "#1E3A8A" : "#EFF6FF" }]}><Text style={{ fontSize: 14 }}>✏️</Text></Pressable>
                    <Pressable onPress={() => remove(r)} style={[styles.delBtn, { backgroundColor: colors.isDark ? "#7F1D1D" : "#fee2e2" }]}><Text style={{ fontSize: 14 }}>🗑️</Text></Pressable>
                  </View>
                  <View style={styles.rowInfo}>
                    <Text style={[styles.rowName, { color: colors.text }]}>{r.name}</Text>
                    <Text style={[styles.rowMeta, { color: colors.textMuted }]}>{r.code ?? ""} · {r.phone || "—"}</Text>
                    <Text style={[styles.rowBalance, { color: balanceColor(bal), fontWeight: "800", fontSize: 16 }]}>{bal.toFixed(2)} YER</Text>
                    <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2, textAlign: 'right', fontWeight: '600' }}>≈ {(bal / sarRate).toFixed(2)} SAR</Text>
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
  screenTitle: { fontSize: 20, marginBottom: 12, textAlign: "left", width: "100%", fontFamily: "CodecBold" },
  sectionTitle: { fontSize: 16, marginTop: 16, marginBottom: 8, textAlign: "left", width: "100%", fontFamily: "CodecBold" },
  label: { fontSize: 12, marginTop: 8, marginBottom: 4, textAlign: "right", width: "100%" },
  input: { borderWidth: 1, borderRadius: 8, padding: 10, fontSize: 14, textAlign: "right", width: "100%" },
  phoneRow: { flexDirection: "row-reverse", gap: 8, alignItems: "center" },
  contactBtn: { padding: 10, borderRadius: 8, borderWidth: 1 },
  list: { gap: 8, marginTop: 4 },
  empty: { textAlign: "right", fontSize: 12, padding: 10 },
  row: { borderWidth: 1, borderRadius: 12, padding: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  rowInfo: { flex: 1, alignItems: "flex-end", paddingRight: 10 },
  rowName: { fontWeight: "700", fontSize: 14, textAlign: "right", width: "100%" },
  rowMeta: { fontSize: 11, marginTop: 3, textAlign: "right" },
  rowBalance: { fontSize: 11, marginTop: 3, textAlign: "right" },
  rowActions: { flexDirection: "row", gap: 6, alignItems: "center" },
  editBtn: { paddingHorizontal: 8, paddingVertical: 8, borderRadius: 8, minWidth: 36, alignItems: "center" },
  delBtn: { paddingHorizontal: 8, paddingVertical: 8, borderRadius: 8, minWidth: 36, alignItems: "center" },
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
