import { useEffect, useMemo, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { sqlite } from "../db/local";
import BrandBanner from "./components/BrandBanner";
import DateTimePicker from "@react-native-community/datetimepicker";

const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

type JLine = { 
  key: string; accountCode: string; accountName: string; 
  debit: number; credit: number; debitBase: number; creditBase: number;
  partyType: string | null; partyId: string | null; partyName: string | null;
  lineDesc: string;
};

export default function JournalScreen({ onBack }: { onBack: () => void }) {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [currencies, setCurrencies] = useState<any[]>([]);
  
  const [description, setDescription] = useState("");
  const [dateStr, setDateStr] = useState(new Date().toISOString().slice(0, 10));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [currency, setCurrency] = useState<any | null>(null);
  const [exchangeRate, setExchangeRate] = useState("1");
  const [showCurrency, setShowCurrency] = useState(false);

  const [lines, setLines] = useState<JLine[]>([]);
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<any[]>([]);

  const [pickAccount, setPickAccount] = useState<any | null>(null);
  const [pickPartyType, setPickPartyType] = useState<"none" | "customer" | "supplier">("none");
  const [pickParty, setPickParty] = useState<any | null>(null);
  const [pickDebit, setPickDebit] = useState("");
  const [pickCredit, setPickCredit] = useState("");
  const [lineDesc, setLineDesc] = useState("");

  const [showAccount, setShowAccount] = useState(false);
  const [showPartyPicker, setShowPartyPicker] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const acc: any = await sqlite.getAllAsync("SELECT id, code, name, account_type FROM accounts ORDER BY code");
        setAccounts(acc || []);
        const cust: any = await sqlite.getAllAsync("SELECT id, name, code FROM customers ORDER BY name");
        setCustomers(cust || []);
        const supp: any = await sqlite.getAllAsync("SELECT id, name, code FROM suppliers ORDER BY name");
        setSuppliers(supp || []);
        
        const cur: any = await sqlite.getAllAsync("SELECT * FROM currencies ORDER BY is_base DESC, code");
        const normalized = (cur || []).map((c: any) => ({ ...c, isBase: !!(c.is_base ?? c.isBase) }));
        setCurrencies(normalized);
        const base = normalized.find((c: any) => c.isBase);
        if (base) { setCurrency(base); setExchangeRate("1"); }

        await loadHistory();
      } catch (e) { Alert.alert("تعذر التحميل", String(e)); }
    })();
  }, []);

  const loadHistory = async () => {
    const rows: any = await sqlite.getAllAsync(`SELECT id, entry_no, description, total_debit, created_at FROM journal_entries ORDER BY created_at DESC LIMIT 5`);
    setHistory(rows || []);
  };

  const totalDebit = useMemo(() => lines.reduce((s, l) => s + l.debit, 0), [lines]);
  const totalCredit = useMemo(() => lines.reduce((s, l) => s + l.credit, 0), [lines]);
  const totalDebitBase = useMemo(() => lines.reduce((s, l) => s + l.debitBase, 0), [lines]);
  const totalCreditBase = useMemo(() => lines.reduce((s, l) => s + l.creditBase, 0), [lines]);
  
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01 && totalDebit > 0;
  const balanced = isBalanced;

  const addLine = () => {
    if (pickPartyType === "none" && !pickAccount) return Alert.alert("تنبيه", "اختر الحساب");
    if (pickPartyType !== "none" && !pickParty) return Alert.alert("تنبيه", "اختر " + (pickPartyType === "customer" ? "العميل" : "المورد"));
    
    const debit = Number(pickDebit) || 0;
    const credit = Number(pickCredit) || 0;
    const rate = Number(exchangeRate) || 1;
    
    if (debit > 0 && credit > 0) return Alert.alert("تنبيه", "أدخل قيمة في المدين أو الدائن فقط");
    if (debit === 0 && credit === 0) return Alert.alert("تنبيه", "أدخل مبلغاً في المدين أو الدائن");

    const finalCode = pickPartyType !== "none" && pickParty ? pickParty.code : pickAccount.code;
    const finalName = pickPartyType !== "none" && pickParty ? pickParty.name : pickAccount.name;

    setLines([...lines, { 
        key: newId(), accountCode: finalCode, accountName: finalName, 
        debit, credit, debitBase: debit * rate, creditBase: credit * rate,
        partyType: pickPartyType === "none" ? null : pickPartyType,
        partyId: pickParty?.id || null, partyName: pickParty?.name || null, lineDesc: lineDesc.trim()
    }]);
    
    setPickAccount(null); setPickDebit(""); setPickCredit(""); setPickPartyType("none"); setPickParty(null); setLineDesc("");
    setShowAccount(false); setShowPartyPicker(false);
  };

  const removeLine = (key: string) => setLines(lines.filter((l) => l.key !== key));
  const canSave = balanced && description.trim().length > 0 && !saving && lines.length >= 2 && currency;

  const save = async () => {
    if (!canSave || !currency) return;
    setSaving(true);
    try {
      const now = Date.now();
      const prefix = "JRN";
      const last: any = await sqlite.getAllAsync(`SELECT entry_no FROM journal_entries WHERE entry_no LIKE ? ORDER BY created_at DESC LIMIT 1`, [`${prefix}-%`]);
      let nextNum = 1;
      if (last && last.length > 0) nextNum = parseInt(String(last[0].entry_no).replace(/\D/g, ""), 10) + 1;
      const entryNo = `${prefix}-${String(nextNum).padStart(3, "0")}`;
      const entryId = newId();
      const finalDate = dateStr ? new Date(dateStr).getTime() : now;
      const rate = Number(exchangeRate) || 1;

      await sqlite.runAsync(
        `INSERT INTO journal_entries (id, entry_no, description, total_debit, total_credit, currency_code, exchange_rate, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [entryId, entryNo, description.trim(), totalDebitBase, totalCreditBase, currency.code, rate, finalDate]
      );

      for (const l of lines) {
        await sqlite.runAsync(
          `INSERT INTO journal_lines (id, entry_id, account_code, account_name, debit, credit, foreign_debit, foreign_credit, party_type, party_id, party_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [newId(), entryId, l.accountCode, l.accountName, l.debitBase, l.creditBase, l.debit, l.credit, l.partyType, l.partyId, l.partyName]
        );
      }

      Alert.alert("تم الحفظ", `رقم القيد: ${entryNo}`);
      setDescription(""); setLines([]); setDateStr(new Date().toISOString().slice(0, 10));
      await loadHistory();
    } catch (e) { Alert.alert("تعذر الحفظ", String(e)); } finally { setSaving(false); }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 40, paddingHorizontal: 4 }}>
        <Pressable style={styles.back} onPress={onBack}>
          <Text style={styles.backText}>{"->"} العودة إلى الوحدات المحاسبية</Text>
        </Pressable>

        <BrandBanner />
        <Text style={styles.screenTitle}>قيد يومية جديد</Text>
        
        <View style={styles.headerBox}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>التاريخ</Text>
            <Pressable style={[styles.input, { justifyContent: "center", height: 42 }]} onPress={() => setShowDatePicker(true)}>
              <Text style={{ textAlign: "right", color: "#0F172A", fontSize: 14 }}>{dateStr}</Text>
            </Pressable>
            {showDatePicker && (
              <DateTimePicker
                value={dateStr ? new Date(dateStr) : new Date()}
                mode="date"
                display="default"
                onChange={(event, selectedDate) => {
                  setShowDatePicker(Platform.OS === 'ios');
                  if (selectedDate) setDateStr(selectedDate.toISOString().slice(0, 10));
                }}
              />
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>العملة</Text>
            <Pressable style={styles.picker} onPress={() => setShowCurrency((v) => !v)}>
              <Text style={styles.pickerText}>{currency ? currency.code : "اختر"}</Text>
              <Text style={styles.pickerArrow}>▼</Text>
            </Pressable>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>سعر الصرف</Text>
            <TextInput style={[styles.input, currency?.isBase && { backgroundColor: "#e2e8f0" }]} value={exchangeRate} onChangeText={setExchangeRate} editable={!currency?.isBase} keyboardType="decimal-pad" textAlign="right" />
          </View>
        </View>

        {showCurrency && (
          <View style={styles.suggestBox}>
            {currencies.map((c) => (
              <Pressable key={c.id} style={styles.suggestItem} onPress={() => { setCurrency(c); setExchangeRate(c.isBase ? "1" : String(c.exchange_rate || 1)); setShowCurrency(false); }}>
                <Text style={styles.suggestName}>{c.name} ({c.code})</Text>
              </Pressable>
            ))}
          </View>
        )}

        <Text style={styles.label}>البيان العام للقيد *</Text>
        <TextInput style={styles.input} value={description} onChangeText={setDescription} placeholder="مثال: قيد إثبات مصروفات" placeholderTextColor="#9CA3AF" textAlign="right" />

        <Text style={styles.sectionTitle}>سطور القيد ({lines.length})</Text>
        <View style={styles.tableBox}>
          {lines.length === 0 ? (
            <Text style={styles.empty}>لا توجد سطور بعد. أضف سطراً من الأسفل.</Text>
          ) : (
            lines.map((l, index) => (
              <View key={l.key} style={styles.tableRow}>
                <View style={styles.rowHeader}>
                  <Text style={styles.rowIndex}>{index + 1}</Text>
                  <Pressable onPress={() => removeLine(l.key)} style={styles.delBtn}><Text style={styles.delText}>حذف</Text></Pressable>
                </View>
                <View style={styles.rowBody}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowName}>{l.accountName}</Text>
                    <Text style={styles.rowMeta}>{l.accountCode}</Text>
                    {l.partyName && <Text style={styles.rowParty}>{l.partyType === 'customer' ? 'عميل: ' : 'مورد: '}{l.partyName}</Text>}
                    {l.lineDesc ? <Text style={styles.rowDesc}>{l.lineDesc}</Text> : null}
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    {l.debit > 0 ? <Text style={styles.rowDebit}>مدين: {l.debit.toFixed(2)} {currency?.code}</Text> : null}
                    {l.credit > 0 ? <Text style={styles.rowCredit}>دائن: {l.credit.toFixed(2)} {currency?.code}</Text> : null}
                    {!currency?.isBase && <Text style={styles.rowBase}>أساسي: {(l.debitBase || l.creditBase).toFixed(2)}</Text>}
                  </View>
                </View>
              </View>
            ))
          )}
        </View>

        <View style={styles.addBox}>
          <Text style={styles.addTitle}>إضافة سطر جديد</Text>
          <Text style={styles.label}>نوع الحساب</Text>
          <View style={{ flexDirection: "row-reverse", gap: 8, marginBottom: 8 }}>
            <Pressable style={[styles.typeBtn, pickPartyType === "none" && styles.typeBtnActive]} onPress={() => { setPickPartyType("none"); setPickParty(null); }}><Text style={[styles.typeText, pickPartyType === "none" && styles.typeTextActive]}>حساب عام</Text></Pressable>
            <Pressable style={[styles.typeBtn, pickPartyType === "customer" && styles.typeBtnActive]} onPress={() => { setPickPartyType("customer"); setPickParty(null); }}><Text style={[styles.typeText, pickPartyType === "customer" && styles.typeTextActive]}>عميل</Text></Pressable>
            <Pressable style={[styles.typeBtn, pickPartyType === "supplier" && styles.typeBtnActive]} onPress={() => { setPickPartyType("supplier"); setPickParty(null); }}><Text style={[styles.typeText, pickPartyType === "supplier" && styles.typeTextActive]}>مورد</Text></Pressable>
          </View>

          {pickPartyType === "none" ? (
            <>
              <Pressable style={styles.picker} onPress={() => setShowAccount((v) => !v)}>
                <Text style={styles.pickerText}>{pickAccount ? `${pickAccount.code} - ${pickAccount.name}` : "اختر الحساب"}</Text>
                <Text style={styles.pickerArrow}>▼</Text>
              </Pressable>
              {showAccount && (
                <View style={styles.suggestBox}>
                  {accounts.map((a) => (
                    <Pressable key={a.id} style={styles.suggestItem} onPress={() => { setPickAccount(a); setShowAccount(false); }}><Text style={styles.suggestName}>{a.name}</Text><Text style={styles.suggestMeta}>{a.code}</Text></Pressable>
                  ))}
                </View>
              )}
            </>
          ) : (
            <>
              <Pressable style={styles.picker} onPress={() => setShowPartyPicker((v) => !v)}>
                <Text style={styles.pickerText}>{pickParty ? pickParty.name : `اختر ${pickPartyType === "customer" ? "العميل" : "المورد"}`}</Text>
                <Text style={styles.pickerArrow}>▼</Text>
              </Pressable>
              {showPartyPicker && (
                <View style={styles.suggestBox}>
                  {(pickPartyType === "customer" ? customers : suppliers).map((p) => (
                    <Pressable key={p.id} style={styles.suggestItem} onPress={() => { setPickParty(p); setShowPartyPicker(false); }}><Text style={styles.suggestName}>{p.name}</Text><Text style={styles.suggestMeta}>{p.code}</Text></Pressable>
                  ))}
                </View>
              )}
            </>
          )}

          <Text style={styles.label}>بيان السطر (اختياري)</Text>
          <TextInput style={styles.input} value={lineDesc} onChangeText={setLineDesc} placeholder="وصف مختصر للسطر" placeholderTextColor="#9CA3AF" textAlign="right" />

          <View style={styles.twoCols}>
            <View style={{ flex: 1 }}><Text style={styles.label}>مدين ({currency?.code})</Text><TextInput style={styles.input} value={pickDebit} onChangeText={(t) => { setPickDebit(t); if (t) setPickCredit(""); }} placeholder="0" placeholderTextColor="#9CA3AF" keyboardType="decimal-pad" textAlign="right" /></View>
            <View style={{ flex: 1 }}><Text style={styles.label}>دائن ({currency?.code})</Text><TextInput style={styles.input} value={pickCredit} onChangeText={(t) => { setPickCredit(t); if (t) setPickDebit(""); }} placeholder="0" placeholderTextColor="#9CA3AF" keyboardType="decimal-pad" textAlign="right" /></View>
          </View>

          <Pressable style={styles.addBtn} onPress={addLine}><Text style={styles.addBtnText}>+ إدراج السطر في القيد</Text></Pressable>
        </View>

        <View style={styles.balanceBox}>
          <View style={styles.balRow}><Text style={styles.balLabel}>مجموع المدين:</Text><Text style={styles.balValue}>{totalDebit.toFixed(2)} {currency?.code}</Text></View>
          <View style={styles.balRow}><Text style={styles.balLabel}>مجموع الدائن:</Text><Text style={styles.balValue}>{totalCredit.toFixed(2)} {currency?.code}</Text></View>
          {!currency?.isBase && (
            <View style={[styles.balRow, { borderTopWidth: 1, borderTopColor: "#BFDBFE", marginTop: 4, paddingTop: 4 }]}>
              <Text style={styles.balLabel}>الإجمالي بالعملة الأساسية:</Text><Text style={styles.balValue}>{totalDebitBase.toFixed(2)}</Text>
            </View>
          )}
          <View style={[styles.balStatus, { backgroundColor: balanced ? "#dcfce7" : "#fee2e2" }]}>
             <Text style={{ color: balanced ? "#166534" : "#991b1b", fontWeight: "700", textAlign: "center" }}>{balanced ? "✅ القيد متوازن" : "⚠️ القيد غير متوازن"}</Text>
          </View>
        </View>

        <Pressable style={[styles.primary, (!canSave || saving) && styles.disabled]} onPress={save} disabled={!canSave || saving}>
          <Text style={styles.primaryText}>{saving ? "جارٍ الحفظ..." : "حفظ القيد نهائياً"}</Text>
        </Pressable>
        
        {history.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>آخر القيود</Text>
            <View style={styles.list}>
              {history.map((h) => (
                <View key={h.id} style={styles.histRow}>
                  <View style={styles.histInfo}>
                    <Text style={styles.histName}>{h.description}</Text>
                    <Text style={styles.histMeta}>{h.entry_no}</Text>
                    <Text style={styles.histDate}>{new Date(h.created_at).toLocaleString("ar-EG")}</Text>
                  </View>
                  <View style={styles.histRight}>
                    <Text style={styles.histAmount}>{Number(h.total_debit).toFixed(2)}</Text>
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
  back: { alignSelf: "flex-end",  paddingVertical: 10, marginBottom: 8 },
  backText: { color: "#1E40AF", fontWeight: "700", textAlign: "right" },
  screenTitle: {fontSize: 22,  color: "#0F172A",  marginBottom: 12,  textAlign: "right", writingDirection: "rtl", width: "100%", fontFamily: "CodecBold"},
  headerBox: { flexDirection: "row-reverse", gap: 8, marginBottom: 16 },
  label: {fontSize: 12, color: "#526078",  marginTop: 8, marginBottom: 4, textAlign: "right", writingDirection: "rtl", width: "100%"},
  input: {backgroundColor: "#f8fafc", borderWidth: 1, borderColor: "#D6E3F8", borderRadius: 8, padding: 10, fontSize: 14, color: "#0F172A", textAlign: "right", writingDirection: "rtl", width: "100%"},
  sectionTitle: {fontSize: 16,  color: "#0F172A",  marginTop: 16, marginBottom: 8 ,  textAlign: "right", writingDirection: "rtl", width: "100%", fontFamily: "CodecBold"},
  tableBox: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#D6E3F8", borderRadius: 12, overflow: "hidden" },
  empty: { textAlign: "center", color: "#8494B0", fontSize: 13, padding: 20 },
  tableRow: { borderBottomWidth: 1, borderBottomColor: "#E2E8F0", padding: 12 },
  rowHeader: { flexDirection: "row-reverse", justifyContent: "space-between", marginBottom: 6 },
  rowIndex: { backgroundColor: "#EFF6FF", color: "#1E40AF", fontSize: 12, fontWeight: "700", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  delBtn: { backgroundColor: "#fee2e2", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  delText: { color: "#991b1b", fontSize: 11, fontWeight: "700" },
  rowBody: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "flex-end" },
  rowName: {fontWeight: "700", fontSize: 14, color: "#0F172A",textAlign: "right", writingDirection: "rtl", width: "100%"},
  rowMeta: { fontSize: 12, color: "#8494B0", marginTop: 2, textAlign: "right" },
  rowParty: { fontSize: 12, color: "#F97316", fontWeight: "700", marginTop: 2, textAlign: "right" },
  rowDesc: { fontSize: 11, color: "#64748b", marginTop: 2, textAlign: "right", fontStyle: "italic" },
  rowDebit: { fontSize: 14, color: "#1E40AF", fontWeight: "800" },
  rowCredit: { fontSize: 14, color: "#991b1b", fontWeight: "800" },
  rowBase: { fontSize: 11, color: "#64748b", marginTop: 4, fontWeight: "600" },
  addBox: { backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: "#D6E3F8", borderRadius: 12, padding: 12, marginTop: 16 },
  addTitle: { fontSize: 15, fontWeight: "800", color: "#0F172A", textAlign: "right", marginBottom: 8 },
  typeBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: "#D6E3F8", backgroundColor: "#fff", alignItems: "center" },
  typeBtnActive: { backgroundColor: "#1E40AF", borderColor: "#1E40AF" },
  typeText: { color: "#0F172A", fontWeight: "700", fontSize: 13 },
  typeTextActive: { color: "#fff" },
  twoCols: { flexDirection: "row-reverse", gap: 8 },
  picker: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#D6E3F8", borderRadius: 8, padding: 12, flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center" },
  pickerText: { color: "#0F172A", textAlign: "right", flex: 1, fontSize: 14 },
  pickerArrow: { color: "#8494B0", fontSize: 12, marginLeft: 8 },
  suggestBox: { marginTop: 4, backgroundColor: "#fff", borderWidth: 1, borderColor: "#D6E3F8", borderRadius: 8, overflow: "hidden", maxHeight: 200 },
  suggestItem: { padding: 10, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  suggestName: { fontWeight: "700", color: "#0F172A", textAlign: "right", fontSize: 13 },
  suggestMeta: { fontSize: 11, color: "#8494B0", textAlign: "right", marginTop: 2 },
  addBtn: { backgroundColor: "#0F172A", padding: 12, borderRadius: 8, marginTop: 12, alignItems: "center" },
  addBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  balanceBox: { backgroundColor: "#EFF6FF", padding: 12, borderRadius: 10, marginTop: 16, borderWidth: 1, borderColor: "#BFDBFE" },
  balRow: { flexDirection: "row-reverse", justifyContent: "space-between", marginBottom: 4 },
  balLabel: { color: "#1E40AF", fontWeight: "600", fontSize: 14 },
  balValue: { color: "#1E40AF", fontWeight: "800", fontSize: 15 },
  balStatus: { marginTop: 8, padding: 8, borderRadius: 6 },
  primary: { backgroundColor: "#F97316", padding: 14, borderRadius: 10, marginTop: 16 },
  primaryText: { color: "#fff", fontWeight: "800", fontSize: 16, textAlign: "center" },
  disabled: { opacity: 0.5 },
  list: { gap: 8, marginTop: 4 },
  histRow: { backgroundColor: "#ffffff", borderWidth: 1, borderColor: "#D6E3F8", borderRadius: 12, padding: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  histInfo: { flex: 1, alignItems: "flex-end", paddingRight: 10 },
  histRight: { alignItems: "flex-start" },
  histName: { fontWeight: "700", fontSize: 14, color: "#0F172A", textAlign: "right" },
  histMeta: { fontSize: 11, color: "#1E40AF", marginTop: 2, textAlign: "right", fontWeight: "600" },
  histDate: { fontSize: 10, color: "#8494B0", marginTop: 2, textAlign: "right" },
  histAmount: { fontWeight: "800", fontSize: 16, color: "#1E40AF" },
});
