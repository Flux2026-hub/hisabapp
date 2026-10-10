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
  createAccount,
  deleteAccount,
  listAccounts,
  updateAccount,
} from "../sync/accounting";

type Row = any;
type AccountType = "asset" | "liability" | "income" | "expense";

const TYPES: { key: AccountType; label: string; color: string }[] = [
  { key: "asset", label: "أصول", color: "#0b806c" },
  { key: "liability", label: "خصوم", color: "#dc2626" },
  { key: "income", label: "إيرادات", color: "#3b82f6" },
  { key: "expense", label: "مصروفات", color: "#f59e0b" },
];

const TYPE_MAP: Record<string, AccountType> = {
  asset: "asset",
  liability: "liability",
  income: "income",
  expense: "expense",
};

export default function AccountsScreen({ onBack }: { onBack: () => void }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<AccountType>("asset");

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [parentCode, setParentCode] = useState("");
  const [parentLabel, setParentLabel] = useState("");
  const [initialBalance, setInitialBalance] = useState("");

  const [search, setSearch] = useState("");
  const [searchFocus, setSearchFocus] = useState(false);
  const [showParentPicker, setShowParentPicker] = useState(false);

  const load = async () => {
    try {
      const data = await listAccounts();
      setRows(data || []);
    } catch (e) {
      Alert.alert("تعذر تحميل الحسابات", String(e));
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const typeOf = (r: Row): AccountType =>
    TYPE_MAP[String(r.accountType ?? "")] ?? "asset";

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
    const c: Record<AccountType, number> = {
      asset: 0,
      liability: 0,
      income: 0,
      expense: 0,
    };
    rows.forEach((r) => {
      c[typeOf(r)]++;
    });
    return c;
  }, [rows]);

  const possibleParents = useMemo(() => {
    return rows.filter(
      (r) => r.id !== editingId && typeOf(r) === activeTab
    );
  }, [rows, editingId, activeTab]);

  const nextCode = useMemo(() => {
    const prefixes: Record<AccountType, string> = {
      asset: "1",
      liability: "2",
      income: "4",
      expense: "5",
    };
    const prefix = prefixes[activeTab];
    const sameType = rows
      .filter((r) => typeOf(r) === activeTab)
      .map((r) => String(r.code ?? ""))
      .filter((c) => /^\d+$/.test(c));
    if (sameType.length === 0) return `${prefix}000`;
    const max = Math.max(...sameType.map((c) => parseInt(c, 10)));
    return String(max + 1);
  }, [rows, activeTab]);

  const clearForm = () => {
    setEditingId(null);
    setCode("");
    setName("");
    setParentCode("");
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

      const dupCode = rows.some(
        (r) => String(r.code ?? "").trim() === trimmedCode && r.id !== editingId
      );
      if (dupCode) return Alert.alert("تنبيه", "رمز الحساب مستخدم مسبقاً");

      const dupName = rows.some(
        (r) =>
          String(r.name ?? "").trim().toLowerCase() ===
            trimmedName.toLowerCase() && r.id !== editingId
      );
      if (dupName) return Alert.alert("تنبيه", "يوجد حساب بهذا الاسم مسبقاً");

      const bal = Number(initialBalance) || 0;

      const input: any = {
        code: trimmedCode,
        name: trimmedName,
        accountType: activeTab,
        parentCode: parentCode || undefined,
        balance: bal,
      };

      if (editingId) await updateAccount(editingId, input);
      else await createAccount(input);

      await load();
      const wasEdit = !!editingId;
      clearForm();
      Alert.alert("تم الحفظ", `تم ${wasEdit ? "تعديل" : "إضافة"} الحساب`);
    } catch (e) {
      Alert.alert("تعذر الحفظ", String(e));
    }
  };

  const edit = (r: Row) => {
    setEditingId(r.id);
    setCode(String(r.code ?? ""));
    setName(String(r.name ?? ""));
    setParentCode(String(r.parentCode ?? ""));
    setParentLabel(
      rows.find((x) => x.code === r.parentCode)?.name ?? ""
    );
    setInitialBalance(String(r.balance ?? ""));
    setActiveTab(typeOf(r));
  };

  const remove = (r: Row) => {
    const hasChildren = rows.some((x) => x.parentCode === r.code);
    if (hasChildren) {
      Alert.alert(
        "لا يمكن الحذف",
        "توجد حسابات فرعية تحت هذا الحساب. احذفها أولاً."
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
            await deleteAccount(r.id);
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
    return "#758298";
  };

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

        <Text style={styles.screenTitle}>الحسابات الرئيسة</Text>
        <Text style={styles.hint}>
          شجرة الحسابات المحاسبية: أصول (1)، خصوم (2)، إيرادات (4)،
          مصروفات (5). كل حساب يمكن أن يكون أباً لحسابات فرعية.
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
              لا توجد حسابات في هذا التصنيف — ابدأ بالإضافة أدناه
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
                    {r.code}
                    {r.parentCode ? ` · تحت ${r.parentCode}` : ""}
                  </Text>
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
          {editingId ? "تعديل الحساب" : "إضافة حساب جديد"}
        </Text>

        <Text style={styles.label}>رمز الحساب</Text>
        <TextInput
          style={styles.input}
          value={code}
          onChangeText={setCode}
          placeholder={nextCode}
          placeholderTextColor="#9CA3AF"
          textAlign="right"
          editable={!editingId}
        />

        <Text style={styles.label}>اسم الحساب</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="مثال: الصندوق - النقدية"
          placeholderTextColor="#9CA3AF"
          textAlign="right"
        />

        <Text style={styles.label}>الحساب الأب (اختياري)</Text>
        <Pressable
          style={styles.picker}
          onPress={() => setShowParentPicker((v) => !v)}
        >
          <Text style={styles.pickerText}>
            {parentLabel || "بدون أب (حساب رئيسي)"}
          </Text>
          <Text style={styles.pickerArrow}>▼</Text>
        </Pressable>
        {showParentPicker && (
          <View style={styles.suggestBox}>
            <Pressable
              style={styles.suggestItem}
              onPress={() => {
                setParentCode("");
                setParentLabel("");
                setShowParentPicker(false);
              }}
            >
              <Text style={styles.suggestName}>بدون أب (حساب رئيسي)</Text>
            </Pressable>
            {possibleParents.length === 0 ? (
              <Text style={styles.suggestEmpty}>لا توجد حسابات مناسبة</Text>
            ) : (
              possibleParents.map((p) => (
                <Pressable
                  key={p.id}
                  style={styles.suggestItem}
                  onPress={() => {
                    setParentCode(p.code);
                    setParentLabel(`${p.code} - ${p.name}`);
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
  backText: { color: "#087f68", fontWeight: "700", textAlign: "right" },
  screenTitle: { fontSize: 20, fontWeight: "800", color: "#172033", textAlign: "right", marginBottom: 6 },
  hint: { fontSize: 12, color: "#758298", textAlign: "right", marginBottom: 12, lineHeight: 18 },
  tabs: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 10 },
  tab: { borderWidth: 1, borderColor: "#dfe5ed", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 },
  tabText: { fontSize: 12, color: "#172033" },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: "#172033", textAlign: "right", marginTop: 16, marginBottom: 8 },
  label: { fontSize: 12, color: "#526078", textAlign: "right", marginTop: 8, marginBottom: 4 },
  input: { backgroundColor: "#f8fafc", borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 8, padding: 10, fontSize: 14, color: "#172033" },
  picker: { backgroundColor: "#f8fafc", borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 8, padding: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  pickerText: { color: "#172033", textAlign: "right", flex: 1, fontSize: 14 },
  pickerArrow: { color: "#758298", fontSize: 12, marginLeft: 8 },
  list: { gap: 8, marginTop: 4 },
  empty: { textAlign: "right", color: "#758298", fontSize: 12, padding: 10 },
  row: { backgroundColor: "#f8fafc", borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 10, padding: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  rowInfo: { flex: 1, alignItems: "flex-end" },
  rowName: { fontWeight: "700", fontSize: 14, color: "#172033", textAlign: "right" },
  rowMeta: { fontSize: 11, color: "#758298", marginTop: 3, textAlign: "right" },
  rowBalance: { fontSize: 12, marginTop: 3, textAlign: "right", fontWeight: "600" },
  rowActions: { flexDirection: "row", gap: 6 },
  editBtn: { backgroundColor: "#e8f1ff", padding: 8, borderRadius: 7 },
  editText: { color: "#172033", fontSize: 12 },
  delBtn: { backgroundColor: "#fee2e2", padding: 8, borderRadius: 7 },
  delText: { color: "#172033", fontSize: 12 },
  suggestBox: { marginTop: 4, backgroundColor: "#ffffff", borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 8, overflow: "hidden" },
  suggestItem: { padding: 10, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  suggestName: { fontWeight: "700", color: "#172033", textAlign: "right", fontSize: 13 },
  suggestMeta: { fontSize: 11, color: "#758298", textAlign: "right", marginTop: 2 },
  suggestEmpty: { padding: 10, color: "#758298", textAlign: "right", fontSize: 12 },
  buttons: { flexDirection: "row", gap: 8, marginTop: 16 },
  primary: { backgroundColor: "#10a88a", padding: 14, borderRadius: 10, flex: 1 },
  primaryText: { color: "#fff", fontWeight: "700", textAlign: "center" },
  cancel: { borderWidth: 1, borderColor: "#d1d5db", padding: 13, borderRadius: 10 },
  cancelText: { color: "#172033", textAlign: "center" },
});