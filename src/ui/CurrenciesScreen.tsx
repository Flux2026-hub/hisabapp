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
  createCurrency,
  deleteCurrency,
  listCurrencies,
  updateCurrency,
} from "../sync/accounting";

type Row = any;

export default function CurrenciesScreen({ onBack }: { onBack: () => void }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [rate, setRate] = useState("");
  const [saving, setSaving] = useState(false);

  const baseCurrency = useMemo(
    () => rows.find((r) => !!r.isBase),
    [rows]
  );

  const load = async () => {
    try {
      const data = await listCurrencies();
      setRows(data || []);
    } catch (e) {
      Alert.alert("تعذر تحميل البيانات", String(e));
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const data = await listCurrencies();
        if (!data || data.length === 0) {
          // تهيئة افتراضية
          await createCurrency({
            code: "YER",
            name: "ريال يمني",
            symbol: "ر.ي",
            exchangeRate: 1,
            isBase: true,
          });
          await createCurrency({
            code: "SAR",
            name: "ريال سعودي",
            symbol: "ر.س",
            exchangeRate: 140,
            isBase: false,
          });
          const fresh = await listCurrencies();
          setRows(fresh || []);
        } else {
          setRows(data);
        }
      } catch (e) {
        Alert.alert("تعذر التهيئة", String(e));
      }
    })();
  }, []);

  const clearForm = () => {
    setEditingId(null);
    setCode("");
    setName("");
    setSymbol("");
    setRate("");
  };

  const edit = (r: Row) => {
    setEditingId(r.id);
    setCode(String(r.code ?? ""));
    setName(String(r.name ?? ""));
    setSymbol(String(r.symbol ?? ""));
    setRate(String(r.exchangeRate ?? ""));
  };

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const trimmedCode = code.trim().toUpperCase();
      const trimmedName = name.trim();
      const trimmedSymbol = symbol.trim();
      const isEditingBase = editingId && baseCurrency && baseCurrency.id === editingId;

      if (!trimmedCode) {
        Alert.alert("تنبيه", "رمز العملة مطلوب");
        return;
      }
      if (!trimmedName) {
        Alert.alert("تنبيه", "اسم العملة مطلوب");
        return;
      }
      if (!trimmedSymbol) {
        Alert.alert("تنبيه", "رمز العرض مطلوب");
        return;
      }

      const codeDup = rows.some(
        (r) =>
          String(r.code ?? "").toUpperCase() === trimmedCode &&
          r.id !== editingId
      );
      if (codeDup) {
        Alert.alert("تنبيه", "رمز العملة مستخدم مسبقاً");
        return;
      }

      // العملة الأساسية: السعر دائماً 1
      if (isEditingBase) {
        await updateCurrency(editingId!, {
          code: trimmedCode,
          name: trimmedName,
          symbol: trimmedSymbol,
          exchangeRate: 1,
          isBase: true,
        });
        await load();
        clearForm();
        Alert.alert("تم الحفظ", "تم تحديث العملة الأساسية");
        return;
      }

      const rateNum = Number(rate);
      if (!rateNum || rateNum <= 0) {
        Alert.alert("تنبيه", "سعر الصرف يجب أن يكون أكبر من صفر");
        return;
      }

      const input: any = {
        code: trimmedCode,
        name: trimmedName,
        symbol: trimmedSymbol,
        exchangeRate: rateNum,
        isBase: false,
      };

      if (editingId) {
        await updateCurrency(editingId, input);
      } else {
        await createCurrency(input);
      }

      await load();
      clearForm();
      Alert.alert("تم الحفظ", "تم حفظ بيانات العملة");
    } catch (e) {
      Alert.alert("تعذر الحفظ", String(e));
    } finally {
      setSaving(false);
    }
  };

  const remove = (r: Row) => {
    if (r.isBase) {
      Alert.alert("لا يمكن الحذف", "العملة الأساسية لا يمكن حذفها");
      return;
    }
    Alert.alert("تأكيد الحذف", `هل تريد حذف «${r.name}»؟`, [
      { text: "إلغاء", style: "cancel" },
      {
        text: "حذف",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteCurrency(r.id);
            await load();
            if (editingId === r.id) clearForm();
          } catch (e) {
            Alert.alert("تعذر الحذف", String(e));
          }
        },
      },
    ]);
  };

  const isEditingBase =
    !!editingId && !!baseCurrency && baseCurrency.id === editingId;

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

        <Text style={styles.screenTitle}>العملات وأسعار الصرف</Text>
        <Text style={styles.hint}>
          العملة الأساسية هي المرجع لكل الحسابات. باقي العملات تُحوَّل إليها
          حسب سعر الصرف الذي تحدده. يمكنك تعديل سعر الصرف في أي وقت.
        </Text>

        <Text style={styles.sectionTitle}>العملات المسجلة ({rows.length})</Text>
        <View style={styles.list}>
          {rows.map((r) => (
            <View key={r.id} style={styles.row}>
              <View style={styles.rowActions}>
                <Pressable onPress={() => edit(r)} style={styles.editBtn}>
                  <Text style={styles.editText}>تعديل</Text>
                </Pressable>
                {!r.isBase && (
                  <Pressable onPress={() => remove(r)} style={styles.delBtn}>
                    <Text style={styles.delText}>حذف</Text>
                  </Pressable>
                )}
              </View>
              <View style={styles.rowInfo}>
                <View style={styles.rowHead}>
                  <Text style={styles.rowName}>{r.name}</Text>
                  {!!r.isBase && <Text style={styles.baseBadge}>أساسية</Text>}
                </View>
                <Text style={styles.rowMeta}>
                  {r.code} · {r.symbol}
                </Text>
                {r.isBase ? (
                  <Text style={styles.rowRateBase}>المرجع (1.00)</Text>
                ) : (
                  <Text style={styles.rowRate}>
                    1 {r.code} = {Number(r.exchangeRate || 0).toFixed(2)}{" "}
                    {baseCurrency?.code ?? "YER"}
                  </Text>
                )}
              </View>
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>
          {editingId ? "تعديل العملة" : "إضافة عملة جديدة"}
        </Text>

        <Text style={styles.label}>الرمز (3 أحرف)</Text>
        <TextInput
          style={styles.input}
          value={code}
          onChangeText={(t) => setCode(t.toUpperCase().slice(0, 5))}
          placeholder="SAR"
          placeholderTextColor="#9CA3AF"
          textAlign="right"
          autoCapitalize="characters"
          editable={!isEditingBase}
        />

        <Text style={styles.label}>الاسم</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="ريال سعودي"
          placeholderTextColor="#9CA3AF"
          textAlign="right"
        />

        <Text style={styles.label}>رمز العرض</Text>
        <TextInput
          style={styles.input}
          value={symbol}
          onChangeText={setSymbol}
          placeholder="ر.س"
          placeholderTextColor="#9CA3AF"
          textAlign="right"
        />

        {isEditingBase ? (
          <View style={styles.baseNote}>
            <Text style={styles.baseNoteText}>
              هذه العملة الأساسية — سعر الصرف ثابت = 1.00
            </Text>
          </View>
        ) : (
          <>
            <Text style={styles.label}>
              سعر الصرف (كم {baseCurrency?.code ?? "YER"} = 1{" "}
              {code || "وحدة"}؟)
            </Text>
            <TextInput
              style={styles.input}
              value={rate}
              onChangeText={setRate}
              placeholder="140"
              placeholderTextColor="#9CA3AF"
              keyboardType="decimal-pad"
              textAlign="right"
            />
          </>
        )}

        <View style={styles.buttons}>
          <Pressable
            style={[styles.primary, saving && styles.primaryDisabled]}
            onPress={save}
            disabled={saving}
          >
            <Text style={styles.primaryText}>
              {saving
                ? "جارٍ الحفظ..."
                : editingId
                ? "حفظ التعديل"
                : "إضافة وحفظ"}
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
    marginBottom: 8,
  },
  hint: {
    fontSize: 12,
    color: "#8494B0",
    textAlign: "right",
    marginBottom: 12,
    lineHeight: 18,
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
  rowHead: { flexDirection: "row", alignItems: "center", gap: 6 },
  rowName: {
    fontWeight: "700",
    fontSize: 14,
    color: "#0F172A",
    textAlign: "right",
  },
  baseBadge: {
    backgroundColor: "#0b806c",
    color: "#fff",
    fontSize: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: "hidden",
  },
  rowMeta: {
    fontSize: 11,
    color: "#8494B0",
    marginTop: 3,
    textAlign: "right",
  },
  rowRate: {
    fontSize: 11,
    color: "#1E40AF",
    marginTop: 3,
    textAlign: "right",
    fontWeight: "600",
  },
  rowRateBase: {
    fontSize: 11,
    color: "#0b806c",
    marginTop: 3,
    textAlign: "right",
    fontWeight: "600",
  },
  rowActions: { flexDirection: "row", gap: 6 },
  editBtn: { backgroundColor: "#EFF6FF", padding: 8, borderRadius: 7 },
  editText: { color: "#0F172A", fontSize: 12 },
  delBtn: { backgroundColor: "#fee2e2", padding: 8, borderRadius: 7 },
  delText: { color: "#0F172A", fontSize: 12 },
  baseNote: {
    backgroundColor: "#EFF6FF",
    padding: 10,
    borderRadius: 8,
    marginTop: 12,
  },
  baseNoteText: {
    color: "#1E40AF",
    fontSize: 12,
    textAlign: "right",
    fontWeight: "600",
  },
  buttons: { flexDirection: "row", gap: 8, marginTop: 16 },
  primary: {
    backgroundColor: "#F97316",
    padding: 14,
    borderRadius: 10,
    flex: 1,
  },
  primaryDisabled: { opacity: 0.6 },
  primaryText: { color: "#fff", fontWeight: "700", textAlign: "center" },
  cancel: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    padding: 13,
    borderRadius: 10,
  },
  cancelText: { color: "#0F172A", textAlign: "center" },
});