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
  createCustomer,
  createSupplier,
  deleteCustomer,
  deleteSupplier,
  listCustomers,
  listSuppliers,
  updateCustomer,
  updateSupplier,
} from "../sync/accounting";

type Kind = "customers" | "suppliers";
type Row = any;

const CONFIG: Record<
  Kind,
  {
    singular: string;
    plural: string;
    parentAccountCode: string;
    list: () => Promise<Row[]>;
    create: (input: any) => Promise<any>;
    update: (id: string, input: any) => Promise<any>;
    remove: (id: string) => Promise<any>;
  }
> = {
  customers: {
    singular: "العميل",
    plural: "العملاء",
    parentAccountCode: "1300",
    list: listCustomers,
    create: createCustomer,
    update: updateCustomer,
    remove: deleteCustomer,
  },
  suppliers: {
    singular: "المورد",
    plural: "الموردون",
    parentAccountCode: "2100",
    list: listSuppliers,
    create: createSupplier,
    update: updateSupplier,
    remove: deleteSupplier,
  },
};

export default function CustomersScreen({
  kind,
  onBack,
}: {
  kind: Kind;
  onBack: () => void;
}) {
  const cfg = CONFIG[kind];
  const [rows, setRows] = useState<Row[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);

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
    } catch (e) {
      Alert.alert("تعذر تحميل البيانات", String(e));
    }
  };

  useEffect(() => {
    clearForm();
    setSearch("");
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  const nextCode = useMemo(() => {
    const nums = rows
      .map((r) => parseInt(String(r.code ?? ""), 10))
      .filter((n) => !Number.isNaN(n));
    const next = nums.length ? Math.max(...nums) + 1 : 1;
    return String(next).padStart(3, "0");
  }, [rows]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      `${r.code ?? ""} ${r.name ?? ""} ${r.phone ?? ""}`
        .toLowerCase()
        .includes(q)
    );
  }, [rows, search]);

  const nameSuggestions = useMemo(() => {
    const q = name.trim().toLowerCase();
    if (!q) return [];
    return rows
      .filter((r) => String(r.name ?? "").toLowerCase().includes(q))
      .slice(0, 6);
  }, [rows, name]);

  const clearForm = () => {
    setEditingId(null);
    setCode("");
    setName("");
    setPhone("+967");
    setShowCodeSuggest(false);
    setShowNameSuggest(false);
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

  const applySuggestedCode = () => {
    setCode(nextCode);
    setShowCodeSuggest(false);
  };

  const save = async () => {
    try {
      const trimmedName = name.trim();
      const trimmedCode = code.trim();
      const localPhone = normalizePhone(phone);

      if (!trimmedCode) {
        Alert.alert("تنبيه", "الرمز مطلوب");
        return;
      }
      if (!trimmedName) {
        Alert.alert("تنبيه", "الاسم مطلوب");
        return;
      }
      const codeDup = rows.some(
        (r) =>
          String(r.code ?? "").trim() === trimmedCode && r.id !== editingId
      );
      if (codeDup) {
        Alert.alert("تنبيه", "الرمز مستخدم");
        return;
      }
      const nameDup = rows.some(
        (r) =>
          String(r.name ?? "").trim().toLowerCase() ===
            trimmedName.toLowerCase() && r.id !== editingId
      );
      if (nameDup) {
        Alert.alert("تنبيه", `يوجد ${cfg.singular} بهذا الاسم مسبقًا`);
        return;
      }
      if (localPhone && !isValidYemeniPhone(localPhone)) {
        Alert.alert(
          "تنبيه",
          "رقم الهاتف غير صحيح. الصيغة: +9677XXXXXXXX"
        );
        return;
      }

      const input: any = {
        code: trimmedCode,
        name: trimmedName,
        phone: localPhone ? `+967${localPhone}` : "",
        parentAccountCode: cfg.parentAccountCode,
      };

      if (editingId) {
        await cfg.update(editingId, input);
      } else {
        await cfg.create(input);
      }

      await load();
      const wasEdit = !!editingId;
      clearForm();
      Alert.alert(
        "تم الحفظ",
        `تم ${wasEdit ? "تعديل" : "إضافة"} ${cfg.singular}`
      );
    } catch (e) {
      Alert.alert("تعذر الحفظ", String(e));
    }
  };

  const edit = (r: Row) => {
    setEditingId(r.id);
    setCode(String(r.code ?? ""));
    setName(String(r.name ?? ""));
    const p = String(r.phone ?? "");
    const local = normalizePhone(p);
    setPhone("+967" + local);
  };

  const remove = (r: Row) => {
    Alert.alert("تأكيد الحذف", `هل تريد حذف «${r.name}»؟`, [
      { text: "إلغاء", style: "cancel" },
      {
        text: "حذف",
        style: "destructive",
        onPress: async () => {
          try {
            await cfg.remove(r.id);
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
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 40, paddingHorizontal: 4 }}
      >
        <Pressable style={styles.back} onPress={onBack}>
          <Text style={styles.backText}>← العودة إلى الوحدات المحاسبية</Text>
        </Pressable>

        <Text style={styles.screenTitle}>{cfg.plural}</Text>

        <Text style={styles.label}>بحث</Text>
        <TextInput
          style={styles.input}
          value={search}
          onChangeText={setSearch}
          onFocus={() => setSearchFocus(true)}
          onBlur={() => setTimeout(() => setSearchFocus(false), 200)}
          placeholder="ابحث بالرمز أو الاسم أو الهاتف"
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
                    {r.code ?? ""} · {r.phone ?? ""}
                  </Text>
                </Pressable>
              ))
            )}
          </View>
        )}

        <Text style={styles.sectionTitle}>
          استعراض {cfg.plural} ({rows.length})
        </Text>
        <View style={styles.list}>
          {filteredRows.length === 0 ? (
            <Text style={styles.empty}>لا توجد سجلات</Text>
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
                    {r.code ?? ""} · {r.phone || "—"}
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
          {editingId ? `تعديل ${cfg.singular}` : `إضافة ${cfg.singular}`}
        </Text>

        <Text style={styles.label}>الرمز</Text>
        <TextInput
          style={styles.input}
          value={code}
          onChangeText={setCode}
          onFocus={() => !editingId && setShowCodeSuggest(true)}
          onBlur={() => setTimeout(() => setShowCodeSuggest(false), 200)}
          placeholder={nextCode}
          placeholderTextColor="#9CA3AF"
          textAlign="right"
          editable={!editingId}
        />
        {showCodeSuggest && !editingId && (
          <View style={styles.suggestBox}>
            <Pressable style={styles.suggestItem} onPress={applySuggestedCode}>
              <Text style={styles.suggestName}>{nextCode}</Text>
              <Text style={styles.suggestMeta}>اضغط لاعتماد الرمز التالي</Text>
            </Pressable>
          </View>
        )}

        <Text style={styles.label}>الاسم</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          onFocus={() => setShowNameSuggest(true)}
          onBlur={() => setTimeout(() => setShowNameSuggest(false), 200)}
          placeholder={`اسم ${cfg.singular}`}
          placeholderTextColor="#9CA3AF"
          textAlign="right"
        />
        {showNameSuggest && nameSuggestions.length > 0 && (
          <View style={styles.suggestBox}>
            {nameSuggestions.map((r) => (
              <Pressable
                key={r.id}
                style={styles.suggestItem}
                onPress={() => {
                  setName(r.name);
                  setShowNameSuggest(false);
                }}
              >
                <Text style={styles.suggestName}>{r.name}</Text>
                <Text style={styles.suggestMeta}>{r.code ?? ""}</Text>
              </Pressable>
            ))}
          </View>
        )}

        <Text style={styles.label}>الهاتف</Text>
        <TextInput
          style={styles.input}
          value={phone}
          onChangeText={onPhoneChange}
          placeholder="+9677XXXXXXXX"
          placeholderTextColor="#9CA3AF"
          keyboardType="phone-pad"
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
  screenTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0F172A",
    textAlign: "right",
    marginBottom: 12,
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
  empty: {
    textAlign: "right",
    color: "#8494B0",
    fontSize: 12,
    padding: 10,
  },
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
  rowBalance: { fontSize: 11, marginTop: 3, textAlign: "right" },
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