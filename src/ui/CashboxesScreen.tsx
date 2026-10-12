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
  createCashbox,
  deleteCashbox,
  listCashboxes,
  updateCashbox,
} from "../sync/accounting";

type Row = any;
type CashboxType = "main" | "sub" | "analytical";

const TYPES: { key: CashboxType; label: string; color: string }[] = [
  { key: "main", label: "صناديق رئيسية", color: "#0b806c" },
  { key: "sub", label: "صناديق فرعية", color: "#3b82f6" },
  { key: "analytical", label: "صناديق تحليلية", color: "#f59e0b" },
];

const TYPE_MAP: Record<string, CashboxType> = {
  main: "main",
  sub: "sub",
  analytical: "analytical",
};

export default function CashboxesScreen({ onBack }: { onBack: () => void }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<CashboxType>("main");

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState<string | null>(null);
  const [parentLabel, setParentLabel] = useState("");
  const [initialBalance, setInitialBalance] = useState("");

  const [search, setSearch] = useState("");
  const [searchFocus, setSearchFocus] = useState(false);
  const [showParentPicker, setShowParentPicker] = useState(false);

  const load = async () => {
    try {
      const data = await listCashboxes();
      setRows(data || []);
    } catch (e) {
      Alert.alert("تعذر تحميل الصناديق", String(e));
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const typeOf = (r: Row): CashboxType =>
    TYPE_MAP[String(r.cashboxType ?? "")] ?? "main";

  const tabRows = useMemo(
    () => rows.filter((r) => typeOf(r) === activeTab),
    [rows, activeTab]
  );

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tabRows;
    return tabRows.filter((r) =>
      `${r.code ?? ""} ${r.name ?? ""}`.toLowerCase().includes(q)
    );
  }, [tabRows, search]);

  const counts = useMemo(() => {
    const c: Record<CashboxType, number> = { main: 0, sub: 0, analytical: 0 };
    rows.forEach((r) => {
      c[typeOf(r)]++;
    });
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
    const prefix =
      activeTab === "main" ? "CB" : activeTab === "sub" ? "SB" : "AB";
    const nums = rows
      .filter((r) => String(r.code ?? "").startsWith(prefix))
      .map((r) => parseInt(String(r.code ?? "").replace(/\D/g, ""), 10))
      .filter((n) => !Number.isNaN(n));
    const next = nums.length ? Math.max(...nums) + 1 : 1;
    return `${prefix}-${String(next).padStart(3, "0")}`;
  }, [rows, activeTab]);

  const clearForm = () => {
    setEditingId(null);
    setCode("");
    setName("");
    setParentId(null);
    setParentLabel("");
    setInitialBalance("");
    setShowParentPicker(false);
  };

  const save = async () => {
    try {
      const trimmedCode = code.trim();
      const trimmedName = name.trim();

      if (!trimmedCode) return Alert.alert("تنبيه", "الرمز مطلوب");
      if (!trimmedName) return Alert.alert("تنبيه", "الاسم مطلوب");
      if (activeTab !== "main" && !parentId)
        return Alert.alert("تنبيه", "اختر الصندوق الأب");

      const dupCode = rows.some(
        (r) => String(r.code ?? "").trim() === trimmedCode && r.id !== editingId
      );
      if (dupCode) return Alert.alert("تنبيه", "الرمز مستخدم مسبقاً");

      const dupName = rows.some(
        (r) =>
          String(r.name ?? "").trim().toLowerCase() ===
            trimmedName.toLowerCase() && r.id !== editingId
      );
      if (dupName) return Alert.alert("تنبيه", "يوجد صندوق بهذا الاسم مسبقاً");

      const bal = Number(initialBalance) || 0;

      const input: any = {
        code: trimmedCode,
        name: trimmedName,
        parentId: activeTab === "main" ? undefined : parentId,
        cashboxType: activeTab,
        balance: bal,
      };

      if (editingId) await updateCashbox(editingId, input);
      else await createCashbox(input);

      await load();
      const wasEdit = !!editingId;
      clearForm();
      Alert.alert("تم الحفظ", `تم ${wasEdit ? "تعديل" : "إضافة"} الصندوق`);
    } catch (e) {
      Alert.alert("تعذر الحفظ", String(e));
    }
  };

  const edit = (r: Row) => {
    setEditingId(r.id);
    setCode(String(r.code ?? ""));
    setName(String(r.name ?? ""));
    setParentId(r.parentId ?? null);
    setParentLabel(rows.find((x) => x.id === r.parentId)?.name ?? "");
    setInitialBalance(String(r.balance ?? ""));
    setActiveTab(typeOf(r));
  };

  const remove = (r: Row) => {
    const hasChildren = rows.some((x) => x.parentId === r.id);
    if (hasChildren) {
      Alert.alert(
        "لا يمكن الحذف",
        "يوجد صناديق فرعية مرتبطة بهذا الصندوق. احذفها أولاً."
      );
      return;
    }
    Alert.alert("تأكيد الحذف", `هل تريد حذف «${r.name}»؟`, [
      { text: "إلغاء", style: "cancel" },
      {
        text: "حذف",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteCashbox(r.id);
            await load();
            if (editingId === r.id) clearForm();
          } catch (e) {
            Alert.alert("تعذر الحذف", String(e));
          }
        },
      },
    ]);
  };

  const balanceColor = (bal: any) => {
    const n = Number(bal) || 0;
    if (n > 0) return "#0b806c";
    if (n < 0) return "#dc2626";
    return "#8494B0";
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
          <Text style={styles.backText}>← العودة إلى الوحدات المحاسبية</Text>
        </Pressable>

        <Text style={styles.screenTitle}>الصناديق</Text>
        <Text style={styles.hint}>
          الصناديق الرئيسية تحتوي الصناديق الفرعية، والتحليلية تُستخدم لتقسيم
          دقيق. الرصيد المعروض يعكس الحركات المسجلة.
        </Text>

        <View style={styles.tabs}>
          {TYPES.map((t) => {
            const active = activeTab === t.key;
            return (
              <Pressable
                key={t.key}
                onPress={() => {
                  setActiveTab(t.key);
                  clearForm();
                }}
                style={[
                  styles.tab,
                  active && { backgroundColor: t.color, borderColor: t.color },
                ]}
              >
                <Text
                  style={[
                    styles.tabText,
                    active && { color: "#fff", fontWeight: "700" },
                  ]}
                >
                  {t.label} ({counts[t.key]})
                </Text>
              </Pressable>
            );
          })}
        </View>

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
                  <Text style={styles.suggestMeta}>{r.code}</Text>
                </Pressable>
              ))
            )}
          </View>
        )}

        <Text style={styles.sectionTitle}>
          {TYPES.find((t) => t.key === activeTab)?.label} ({tabRows.length})
        </Text>
        <View style={styles.list}>
          {filteredRows.length === 0 ? (
            <Text style={styles.empty}>
              لا توجد صناديق في هذا التصنيف — ابدأ بالإضافة أدناه
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
                  <Text style={styles.rowMeta}>{r.code}</Text>
                  <Text
                    style={[
                      styles.rowBalance,
                      { color: balanceColor(r.balance) },
                    ]}
                  >
                    الرصيد: {Number(r.balance || 0).toFixed(2)}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>

        <Text style={styles.sectionTitle}>
          {editingId ? "تعديل الصندوق" : "إضافة صندوق جديد"}
        </Text>

        <Text style={styles.label}>الرمز</Text>
        <TextInput
          style={styles.input}
          value={code}
          onChangeText={setCode}
          placeholder={nextCode}
          placeholderTextColor="#9CA3AF"
          textAlign="right"
          editable={!editingId}
        />

        <Text style={styles.label}>الاسم</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="مثال: الصندوق الرئيسي - الكاش"
          placeholderTextColor="#9CA3AF"
          textAlign="right"
        />

        {activeTab !== "main" && (
          <>
            <Text style={styles.label}>الصندوق الأب</Text>
            <Pressable
              style={styles.picker}
              onPress={() => setShowParentPicker((v) => !v)}
            >
              <Text style={styles.pickerText}>
                {parentLabel || "اختر الصندوق الأب"}
              </Text>
              <Text style={styles.pickerArrow}>▼</Text>
            </Pressable>
            {showParentPicker && (
              <View style={styles.suggestBox}>
                {possibleParents.length === 0 ? (
                  <Text style={styles.suggestEmpty}>
                    لا توجد صناديق مناسبة كآباء
                  </Text>
                ) : (
                  possibleParents.map((p) => (
                    <Pressable
                      key={p.id}
                      style={styles.suggestItem}
                      onPress={() => {
                        setParentId(p.id);
                        setParentLabel(p.name);
                        setShowParentPicker(false);
                      }}
                    >
                      <Text style={styles.suggestName}>{p.name}</Text>
                      <Text style={styles.suggestMeta}>{p.code}</Text>
                    </Pressable>
                  ))
                )}
              </View>
            )}
          </>
        )}

        <Text style={styles.label}>الرصيد الافتتاحي (اختياري)</Text>
        <TextInput
          style={styles.input}
          value={initialBalance}
          onChangeText={setInitialBalance}
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
  back: { paddingVertical: 10, marginBottom: 8 },
  backText: { color: "#1E40AF", fontWeight: "700", textAlign: "right" },
  screenTitle: { fontSize: 20, fontWeight: "800", color: "#0F172A", textAlign: "right", marginBottom: 6 },
  hint: { fontSize: 12, color: "#8494B0", textAlign: "right", marginBottom: 12, lineHeight: 18 },
  tabs: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 10 },
  tab: { borderWidth: 1, borderColor: "#D6E3F8", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 },
  tabText: { fontSize: 12, color: "#0F172A" },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: "#0F172A", textAlign: "right", marginTop: 16, marginBottom: 8 },
  label: { fontSize: 12, color: "#526078", textAlign: "right", marginTop: 8, marginBottom: 4 },
  input: { backgroundColor: "#f8fafc", borderWidth: 1, borderColor: "#D6E3F8", borderRadius: 8, padding: 10, fontSize: 14, color: "#0F172A" },
  picker: { backgroundColor: "#f8fafc", borderWidth: 1, borderColor: "#D6E3F8", borderRadius: 8, padding: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  pickerText: { color: "#0F172A", textAlign: "right", flex: 1, fontSize: 14 },
  pickerArrow: { color: "#8494B0", fontSize: 12, marginLeft: 8 },
  list: { gap: 8, marginTop: 4 },
  empty: { textAlign: "right", color: "#8494B0", fontSize: 12, padding: 10 },
  row: { backgroundColor: "#f8fafc", borderWidth: 1, borderColor: "#D6E3F8", borderRadius: 10, padding: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  rowInfo: { flex: 1, alignItems: "flex-end" },
  rowName: { fontWeight: "700", fontSize: 14, color: "#0F172A", textAlign: "right" },
  rowMeta: { fontSize: 11, color: "#8494B0", marginTop: 3, textAlign: "right" },
  rowBalance: { fontSize: 12, marginTop: 3, textAlign: "right", fontWeight: "600" },
  rowActions: { flexDirection: "row", gap: 6 },
  editBtn: { backgroundColor: "#EFF6FF", padding: 8, borderRadius: 7 },
  editText: { color: "#0F172A", fontSize: 12 },
  delBtn: { backgroundColor: "#fee2e2", padding: 8, borderRadius: 7 },
  delText: { color: "#0F172A", fontSize: 12 },
  suggestBox: { marginTop: 4, backgroundColor: "#ffffff", borderWidth: 1, borderColor: "#D6E3F8", borderRadius: 8, overflow: "hidden" },
  suggestItem: { padding: 10, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  suggestName: { fontWeight: "700", color: "#0F172A", textAlign: "right", fontSize: 13 },
  suggestMeta: { fontSize: 11, color: "#8494B0", textAlign: "right", marginTop: 2 },
  suggestEmpty: { padding: 10, color: "#8494B0", textAlign: "right", fontSize: 12 },
  buttons: { flexDirection: "row", gap: 8, marginTop: 16 },
  primary: { backgroundColor: "#F97316", padding: 14, borderRadius: 10, flex: 1 },
  primaryText: { color: "#fff", fontWeight: "700", textAlign: "center" },
  cancel: { borderWidth: 1, borderColor: "#d1d5db", padding: 13, borderRadius: 10 },
  cancelText: { color: "#0F172A", textAlign: "center" },
});