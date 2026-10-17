import { useEffect, useMemo, useState } from "react";
import {
  Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from "react-native";
import { sqlite } from "../db/local";

type Row = any;
type JLine = { key: string; accountCode: string; accountName: string; debit: number; credit: number; partyType: string | null; partyId: string | null; partyName: string | null };

const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export default function JournalScreen({ onBack }: { onBack: () => void }) {
  const [accounts, setAccounts] = useState<Row[]>([]);
  const [customers, setCustomers] = useState<Row[]>([]);
  const [suppliers, setSuppliers] = useState<Row[]>([]);
  const [pickPartyType, setPickPartyType] = useState<"none" | "customer" | "supplier">("none");
  const [pickParty, setPickParty] = useState<Row | null>(null);
  const [showPartyPicker, setShowPartyPicker] = useState(false);
  const [description, setDescription] = useState("");
  const [lines, setLines] = useState<JLine[]>([]);
  const [pickAccount, setPickAccount] = useState<Row | null>(null);
  const [pickDebit, setPickDebit] = useState("");
  const [pickCredit, setPickCredit] = useState("");
  const [showAccount, setShowAccount] = useState(false);
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<Row[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const acc: any = await sqlite.getAllAsync(
          "SELECT id, code, name, account_type FROM accounts ORDER BY code"
        );
        setAccounts(acc || []);
        const cust: any = await sqlite.getAllAsync("SELECT id, name, code FROM customers ORDER BY name");
        const supp: any = await sqlite.getAllAsync("SELECT id, name, code FROM suppliers ORDER BY name");
        setCustomers(cust || []);
        setSuppliers(supp || []);
        await loadHistory();
      } catch (e) {
        Alert.alert("تعذر التحميل", String(e));
      }
    })();
  }, []);

  const loadHistory = async () => {
    const rows: any = await sqlite.getAllAsync(
      `SELECT id, entry_no, description, total_debit, total_credit, created_at
       FROM journal_entries ORDER BY created_at DESC LIMIT 10`
    );
    setHistory(rows || []);
  };

  const totalDebit = useMemo(() => lines.reduce((s, l) => s + l.debit, 0), [lines]);
  const totalCredit = useMemo(() => lines.reduce((s, l) => s + l.credit, 0), [lines]);
  const balanced = Math.abs(totalDebit - totalCredit) < 0.01 && totalDebit > 0;

  const addLine = () => {
    if (pickPartyType === "none" && !pickAccount) return Alert.alert("تنبيه", "اختر الحساب");
    if (pickPartyType !== "none" && !pickParty) return Alert.alert("تنبيه", "اختر " + (pickPartyType === "customer" ? "العميل" : "المورد"));
    const debit = Number(pickDebit) || 0;
    const credit = Number(pickCredit) || 0;
    if (debit > 0 && credit > 0)
      return Alert.alert("تنبيه", "أدخل قيمة في المدين أو الدائن فقط");
    if (debit === 0 && credit === 0)
      return Alert.alert("تنبيه", "أدخل مبلغاً في المدين أو الدائن");

    const finalCode = pickPartyType !== "none" && pickParty ? pickParty.code : pickAccount.code;
    const finalName = pickPartyType !== "none" && pickParty ? pickParty.name : pickAccount.name;

    setLines([
      ...lines,
      { 
        key: newId(), 
        accountCode: finalCode, 
        accountName: finalName, 
        debit, 
        credit,
        partyType: pickPartyType === "none" ? null : pickPartyType,
        partyId: pickParty?.id || null,
        partyName: pickParty?.name || null,
      },
    ]);
    setPickAccount(null);
    setPickDebit("");
    setPickCredit("");
    setPickPartyType("none");
    setPickParty(null);
    setShowAccount(false);
  };

  const removeLine = (key: string) => setLines(lines.filter((l) => l.key !== key));

  const canSave = balanced && description.trim().length > 0 && !saving;

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const now = Date.now();
      const prefix = "JRN";
      const last: any = await sqlite.getAllAsync(
        `SELECT entry_no FROM journal_entries WHERE entry_no LIKE ? ORDER BY created_at DESC LIMIT 1`,
        [`${prefix}-%`]
      );
      let nextNum = 1;
      if (last && last.length > 0) {
        nextNum = parseInt(String(last[0].entry_no).replace(/\D/g, ""), 10) + 1;
      }
      const entryNo = `${prefix}-${String(nextNum).padStart(3, "0")}`;
      const entryId = newId();

      await sqlite.runAsync(
        `INSERT INTO journal_entries
         (id, entry_no, description, total_debit, total_credit, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [entryId, entryNo, description.trim(), totalDebit, totalCredit, now]
      );

      for (const l of lines) {
        await sqlite.runAsync(
          `INSERT INTO journal_lines
           (id, entry_id, account_code, account_name, debit, credit, party_type, party_id, party_name)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [newId(), entryId, l.accountCode, l.accountName, l.debit, l.credit, l.partyType, l.partyId, l.partyName]
        );
      }

      Alert.alert("تم الحفظ", `رقم القيد: ${entryNo}`);
      setDescription("");
      setLines([]);
      await loadHistory();
    } catch (e) {
      Alert.alert("تعذر الحفظ", String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets={true} contentContainerStyle={{ paddingBottom: 40, paddingHorizontal: 4 }}>
        <Pressable style={styles.back} onPress={onBack}>
          <Text style={styles.backText}>العودة -> إلى الوحدات المحاسبية</Text>
        </Pressable>

        <Text style={styles.screenTitle}>القيود اليومية</Text>
        <Text style={styles.hint}>
          قيد يدوي بحسابين أو أكثر. مجموع المدين يجب أن يساوي مجموع الدائن.
        </Text>

        <Text style={styles.label}>وصف القيد</Text>
        <TextInput
          style={styles.input}
          value={description}
          onChangeText={setDescription}
          placeholder="مثال: إثبات مصروف كهرباء"
          placeholderTextColor="#9CA3AF"
          textAlign="right"
        />

        <Text style={styles.sectionTitle}>سطور القيد ({lines.length})</Text>
        <View style={styles.list}>
          {lines.length === 0 ? (
            <Text style={styles.empty}>لا توجد سطور بعد</Text>
          ) : (
            lines.map((l) => (
              <View key={l.key} style={styles.row}>
                <View style={styles.rowActions}>
                  <Pressable onPress={() => removeLine(l.key)} style={styles.delBtn}>
                    <Text style={styles.delText}>حذف</Text>
                  </Pressable>
                </View>
                <View style={styles.rowInfo}>
                  <Text style={styles.rowName}>{l.accountName}</Text>
                  <Text style={styles.rowMeta}>{l.accountCode}</Text>
                  {l.partyName && (
                    <Text style={[styles.rowMeta, { color: "#F97316", fontWeight: "700" }]}>
                      {l.partyType === "customer" ? "عميل: " : "مورد: "} {l.partyName}
                    </Text>
                  )}
                  <Text style={styles.rowAmounts}>
                    {l.debit > 0 ? `مدين: ${l.debit.toFixed(2)}` : `دائن: ${l.credit.toFixed(2)}`}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>

        <Text style={styles.sectionTitle}>إضافة سطر</Text>
        {pickPartyType === "none" && (
          <>
            <Pressable style={styles.picker} onPress={() => setShowAccount((v) => !v)}>
              <Text style={styles.pickerText}>
                {pickAccount ? `${pickAccount.code} - ${pickAccount.name}` : "اختر الحساب"}
              </Text>
              <Text style={styles.pickerArrow}>▼</Text>
            </Pressable>
            {showAccount && (
              <View style={styles.suggestBox}>
                {accounts.length === 0 ? (
                  <Text style={styles.suggestEmpty}>لا توجد حسابات — أضفها من شاشة الحسابات</Text>
                ) : (
                  accounts.map((a) => (
                    <Pressable key={a.id} style={styles.suggestItem} onPress={() => { setPickAccount(a); setShowAccount(false); }}>
                      <Text style={styles.suggestName}>{a.name}</Text>
                      <Text style={styles.suggestMeta}>{a.code} · {a.account_type}</Text>
                    </Pressable>
                  ))
                )}
              </View>
            )}
          </>
        )}
        {showAccount && (
          <View style={styles.suggestBox}>
            {accounts.length === 0 ? (
              <Text style={styles.suggestEmpty}>لا توجد حسابات — أضفها من شاشة الحسابات</Text>
            ) : (
              accounts.map((a) => (
                <Pressable key={a.id} style={styles.suggestItem} onPress={() => { setPickAccount(a); setShowAccount(false); }}>
                  <Text style={styles.suggestName}>{a.name}</Text>
                  <Text style={styles.suggestMeta}>{a.code} · {a.account_type}</Text>
                </Pressable>
              ))
            )}
          </View>
        )}

        <View style={styles.twoCols}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>مدين</Text>
            <TextInput
              style={styles.input}
              value={pickDebit}
              onChangeText={(t) => { setPickDebit(t); if (t) setPickCredit(""); }}
              placeholder="0"
              placeholderTextColor="#9CA3AF"
              keyboardType="decimal-pad"
              textAlign="right"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>دائن</Text>
            <TextInput
              style={styles.input}
              value={pickCredit}
              onChangeText={(t) => { setPickCredit(t); if (t) setPickDebit(""); }}
              placeholder="0"
              placeholderTextColor="#9CA3AF"
              keyboardType="decimal-pad"
              textAlign="right"
            />
          </View>
        </View>

        <Text style={styles.label}>نوع الطرف (اختياري)</Text>
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
          <Pressable style={[styles.partyTypeBtn, pickPartyType === "none" && styles.partyTypeBtnActive]} onPress={() => { setPickPartyType("none"); setPickParty(null); }}>
            <Text style={[styles.partyTypeText, pickPartyType === "none" && styles.partyTypeTextActive]}>عام</Text>
          </Pressable>
          <Pressable style={[styles.partyTypeBtn, pickPartyType === "customer" && styles.partyTypeBtnActive]} onPress={() => { setPickPartyType("customer"); setPickParty(null); }}>
            <Text style={[styles.partyTypeText, pickPartyType === "customer" && styles.partyTypeTextActive]}>عميل</Text>
          </Pressable>
          <Pressable style={[styles.partyTypeBtn, pickPartyType === "supplier" && styles.partyTypeBtnActive]} onPress={() => { setPickPartyType("supplier"); setPickParty(null); }}>
            <Text style={[styles.partyTypeText, pickPartyType === "supplier" && styles.partyTypeTextActive]}>مورد</Text>
          </Pressable>
        </View>

        {pickPartyType !== "none" && (
          <>
            <Pressable style={styles.picker} onPress={() => setShowPartyPicker((v) => !v)}>
              <Text style={styles.pickerText}>{pickParty ? pickParty.name : `اختر ${pickPartyType === "customer" ? "العميل" : "المورد"}`}</Text>
              <Text style={styles.pickerArrow}>▼</Text>
            </Pressable>
            {showPartyPicker && (
              <View style={styles.suggestBox}>
                {(pickPartyType === "customer" ? customers : suppliers).length === 0 ? (
                  <Text style={styles.suggestEmpty}>لا توجد بيانات</Text>
                ) : (
                  (pickPartyType === "customer" ? customers : suppliers).map((p) => (
                    <Pressable key={p.id} style={styles.suggestItem} onPress={() => { setPickParty(p); setShowPartyPicker(false); }}>
                      <Text style={styles.suggestName}>{p.name}</Text>
                      <Text style={styles.suggestMeta}>{p.code}</Text>
                    </Pressable>
                  ))
                )}
              </View>
            )}
          </>
        )}

        <Pressable style={styles.secondary} onPress={addLine}>
          <Text style={styles.secondaryText}>+ إضافة السطر</Text>
        </Pressable>

        <View style={styles.balanceBox}>
          <Text style={styles.balanceLabel}>مجموع المدين: {totalDebit.toFixed(2)}</Text>
          <Text style={styles.balanceLabel}>مجموع الدائن: {totalCredit.toFixed(2)}</Text>
          <Text style={[styles.balanceStatus, { color: balanced ? "#0b806c" : "#dc2626" }]}>
            {balanced ? "✅ القيد متوازن" : "⚠️ القيد غير متوازن"}
          </Text>
        </View>

        <Pressable style={[styles.primary, (!canSave || saving) && styles.disabled]} onPress={save} disabled={!canSave || saving}>
          <Text style={styles.primaryText}>{saving ? "جارٍ الحفظ..." : "حفظ القيد"}</Text>
        </Pressable>

        {history.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>آخر القيود</Text>
            <View style={styles.list}>
              {history.map((h) => (
                <View key={h.id} style={styles.histRow}>
                  <View style={styles.histRight}>
                    <Text style={styles.histAmount}>{Number(h.total_debit).toFixed(2)}</Text>
                  </View>
                  <View style={styles.histInfo}>
                    <Text style={styles.histName}>{h.description}</Text>
                    <Text style={styles.histMeta}>{h.entry_no}</Text>
                    <Text style={styles.histDate}>{new Date(h.created_at).toLocaleString("ar-EG")}</Text>
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
  back: {  paddingVertical: 10, alignSelf: "flex-end", marginBottom: 8 },
  backText: {  color: "#1E40AF", textAlign: "right", fontWeight: "700", textAlign: "right" },
  screenTitle: {  fontSize: 20, fontWeight: "800", color: "#0F172A", textAlign: "right", marginBottom: 6  fontFamily: "Alexandria-Regular" },
  hint: { fontSize: 12, color: "#8494B0", textAlign: "right", marginBottom: 12, lineHeight: 18 },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: "#0F172A", textAlign: "right", marginTop: 16, marginBottom: 8 },
  label: { fontSize: 12, color: "#526078", textAlign: "right", marginTop: 8, marginBottom: 4 },
  input: { backgroundColor: "#f8fafc", borderWidth: 1, borderColor: "#D6E3F8", borderRadius: 8, padding: 10, fontSize: 14, color: "#0F172A" },
  picker: { backgroundColor: "#f8fafc", borderWidth: 1, borderColor: "#D6E3F8", borderRadius: 8, padding: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  pickerText: { color: "#0F172A", textAlign: "right", flex: 1, fontSize: 14 },
  pickerArrow: { color: "#8494B0", fontSize: 12, marginLeft: 8 },
  twoCols: { flexDirection: "row", gap: 8 },
  list: { gap: 8, marginTop: 4 },
  empty: { textAlign: "right", color: "#8494B0", fontSize: 12, padding: 10 },
  row: { backgroundColor: "#f8fafc", borderWidth: 1, borderColor: "#D6E3F8", borderRadius: 10, padding: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  rowInfo: { flex: 1, alignItems: "flex-end" },
  rowName: { fontWeight: "700", fontSize: 14, color: "#0F172A", textAlign: "right" },
  rowMeta: { fontSize: 11, color: "#8494B0", marginTop: 3, textAlign: "right" },
  rowAmounts: { fontSize: 12, color: "#1E40AF", marginTop: 3, textAlign: "right", fontWeight: "600" },
  rowActions: { flexDirection: "row", gap: 6 },
  delBtn: { backgroundColor: "#fee2e2", padding: 8, borderRadius: 7 },
  delText: { color: "#0F172A", fontSize: 12 },
  suggestBox: { marginTop: 4, backgroundColor: "#ffffff", borderWidth: 1, borderColor: "#D6E3F8", borderRadius: 8, overflow: "hidden" },
  suggestItem: { padding: 10, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  suggestName: { fontWeight: "700", color: "#0F172A", textAlign: "right", fontSize: 13 },
  suggestMeta: { fontSize: 11, color: "#8494B0", textAlign: "right", marginTop: 2 },
  suggestEmpty: { padding: 10, color: "#8494B0", textAlign: "right", fontSize: 12 },
  balanceBox: { marginTop: 16, backgroundColor: "#eef6ff", padding: 12, borderRadius: 10, gap: 4 },
  balanceLabel: { color: "#1E40AF", fontWeight: "600", fontSize: 13, textAlign: "right" },
  balanceStatus: { fontWeight: "700", fontSize: 13, textAlign: "right", marginTop: 4 },
  primary: { backgroundColor: "#F97316", padding: 14, borderRadius: 10, marginTop: 16 },
  primaryText: { color: "#fff", fontWeight: "700", textAlign: "center" },
  secondary: { backgroundColor: "#1E40AF", padding: 12, borderRadius: 8, marginTop: 8 },
  secondaryText: { color: "#fff", fontWeight: "700", textAlign: "center" },
  partyTypeBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: "#D6E3F8", backgroundColor: "#f8fafc", alignItems: "center" },
  partyTypeBtnActive: { backgroundColor: "#1E40AF", borderColor: "#1E40AF" },
  partyTypeText: { color: "#0F172A", fontWeight: "700", fontSize: 13 },
  partyTypeTextActive: { color: "#ffffff" },
  disabled: { opacity: 0.5 },
  histRow: { backgroundColor: "#f8fafc", borderWidth: 1, borderColor: "#D6E3F8", borderRadius: 10, padding: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  histInfo: { flex: 1, alignItems: "flex-end" },
  histRight: { alignItems: "flex-start", paddingRight: 8 },
  histName: { fontWeight: "700", color: "#0F172A", textAlign: "right" },
  histMeta: { fontSize: 11, color: "#1E40AF", marginTop: 2, textAlign: "right", fontWeight: "600" },
  histDate: { fontSize: 10, color: "#8494B0", marginTop: 2, textAlign: "right" },
  histAmount: { fontWeight: "800", fontSize: 15, color: "#1E40AF" },
});