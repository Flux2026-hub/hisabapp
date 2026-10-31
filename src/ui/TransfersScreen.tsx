import { useEffect, useMemo, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { sqlite } from "../db/local";
import DateTimePicker from "@react-native-community/datetimepicker";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "./ThemeContext";

type Row = any;
const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export default function TransfersScreen({ onBack }: { onBack: () => void }) {
  const { colors } = useTheme();
  const [cashboxes, setCashboxes] = useState<Row[]>([]);
  const [currencies, setCurrencies] = useState<Row[]>([]);

  const [from, setFrom] = useState<Row | null>(null);
  const [to, setTo] = useState<Row | null>(null);
  const [fromCurrency, setFromCurrency] = useState<Row | null>(null);
  const [toCurrency, setToCurrency] = useState<Row | null>(null);
  const [exchangeRate, setExchangeRate] = useState("1");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [dateStr, setDateStr] = useState(new Date().toISOString().slice(0, 10));
  const [showDatePicker, setShowDatePicker] = useState(false);

  // 🚀 إضافة حالات البحث
  const [fromSearch, setFromSearch] = useState("");
  const [toSearch, setToSearch] = useState("");
  const [fromCurSearch, setFromCurSearch] = useState("");
  const [toCurSearch, setToCurSearch] = useState("");

  const [showFrom, setShowFrom] = useState(false);
  const [showTo, setShowTo] = useState(false);
  const [showFromCur, setShowFromCur] = useState(false);
  const [showToCur, setShowToCur] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<Row[]>([]);                                                                                                            

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const cb: any = await sqlite.getAllAsync("SELECT id, code, name, balance FROM cashboxes ORDER BY name");
      setCashboxes(cb || []);

      const cur: any = await sqlite.getAllAsync("SELECT id, code, name, symbol, exchange_rate, is_base FROM currencies ORDER BY is_base DESC, code");
      const normCur = (cur || []).map((x: any) => ({ ...x, isBase: !!(x.is_base ?? x.isBase), exchangeRate: Number(x.exchange_rate) || 1 }));
      setCurrencies(normCur);

      const base = normCur.find((x: any) => x.isBase);
      if (base && !fromCurrency) setFromCurrency(base);
      if (base && !toCurrency) setToCurrency(base);

      await loadHistory();
    } catch (e) {
      Alert.alert("تعذر التحميل", String(e));
    }
  };

  const loadHistory = async () => {
    const rows: any = await sqlite.getAllAsync(
      `SELECT id, transfer_no, from_account, to_account, amount, original_amount, from_currency, to_currency, exchange_rate, description, created_at FROM account_transfers ORDER BY created_at DESC LIMIT 10`
    );
    setHistory(rows || []);
  };

  // 🚀 دوال الفلترة للبحث
  const filteredFromBoxes = useMemo(() => {
    if (!fromSearch.trim()) return cashboxes;
    const q = fromSearch.toLowerCase();
    return cashboxes.filter(c => String(c.name).toLowerCase().includes(q) || String(c.code).toLowerCase().includes(q));
  }, [cashboxes, fromSearch]);

  const filteredToBoxes = useMemo(() => {
    const list = cashboxes.filter((c) => c.id !== from?.id);
    if (!toSearch.trim()) return list;
    const q = toSearch.toLowerCase();
    return list.filter(c => String(c.name).toLowerCase().includes(q) || String(c.code).toLowerCase().includes(q));
  }, [cashboxes, toSearch, from]);

  const filteredFromCur = useMemo(() => {
    if (!fromCurSearch.trim()) return currencies;
    const q = fromCurSearch.toLowerCase();
    return currencies.filter(c => String(c.name).toLowerCase().includes(q) || String(c.code).toLowerCase().includes(q));
  }, [currencies, fromCurSearch]);

  const filteredToCur = useMemo(() => {
    if (!toCurSearch.trim()) return currencies;
    const q = toCurSearch.toLowerCase();
    return currencies.filter(c => String(c.name).toLowerCase().includes(q) || String(c.code).toLowerCase().includes(q));
  }, [currencies, toCurSearch]);

  const canSave = !!from && !!to && from.id !== to.id && Number(amount) > 0 && !!fromCurrency && !!toCurrency && !saving;

  const save = () => {                                                                                                                                              
    if (!canSave || !from || !to) return;
    const amt = Number(amount);
    let finalRate = Number(exchangeRate) || 1;
    if (!fromCurrency || !toCurrency || fromCurrency.code === toCurrency.code) finalRate = 1;
    const baseAmount = amt * finalRate;

    Alert.alert("تأكيد", editingId ? "تأكيد تعديل التحويل" : "تأكيد التحويل", [
      { text: "إلغاء", style: "cancel" },
      { text: "تنفيذ", onPress: doSave }
    ]);
  };

  const doSave = async () => {
    if (!from || !to || !fromCurrency || !toCurrency) return;
    setSaving(true);
    try {
      const now = dateStr ? new Date(dateStr).getTime() : Date.now();
      const amt = Number(amount);
      let finalRate = Number(exchangeRate) || 1;
      if (fromCurrency.code === toCurrency.code) finalRate = 1;
      const baseAmount = amt * finalRate;

      if (editingId) {                                                                                                                                                  
        const oldT: any = await sqlite.getFirstAsync("SELECT * FROM account_transfers WHERE id = ?", [editingId]);                                                      
        if (oldT) {
           const oldRate = Number(oldT.exchange_rate) || 1;
           const oldBase = Number(oldT.amount) * oldRate;
           await sqlite.runAsync("UPDATE cashboxes SET balance = balance + ? WHERE name = ?", [oldBase, oldT.from_account]);
           await sqlite.runAsync("UPDATE cashboxes SET balance = balance - ? WHERE name = ?", [oldBase, oldT.to_account]);
        }

        await sqlite.runAsync(
          `UPDATE account_transfers SET from_account=?, to_account=?, amount=?, description=?, created_at=?, from_currency=?, to_currency=?, exchange_rate=?, original_amount=? WHERE id=?`,
          [from.name, to.name, amt, description.trim(), now, fromCurrency.code, toCurrency.code, finalRate, amt, editingId]
        );

        await sqlite.runAsync("UPDATE cashboxes SET balance = balance - ? WHERE id = ?", [baseAmount, from.id]);
        await sqlite.runAsync("UPDATE cashboxes SET balance = balance + ? WHERE id = ?", [baseAmount, to.id]);

        Alert.alert("تم التعديل", "تم تحديث التحويل بنجاح");
        setEditingId(null);
      } else {                                                                                                                                                          
        const prefix = "TRF";
        const last: any = await sqlite.getAllAsync(`SELECT transfer_no FROM account_transfers WHERE transfer_no LIKE ? ORDER BY created_at DESC LIMIT 1`, [`${prefix}-%`]);
        let nextNum = 1;
        if (last && last.length > 0) nextNum = parseInt(String(last[0].transfer_no).replace(/\D/g, ""), 10) + 1;
        const transferNo = `${prefix}-${String(nextNum).padStart(3, "0")}`;
                                                                                                                                                                        
        await sqlite.runAsync(
          `INSERT INTO account_transfers (id, transfer_no, from_account, to_account, amount, description, created_at, from_currency, to_currency, exchange_rate, original_amount) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [newId(), transferNo, from.name, to.name, amt, description.trim(), now, fromCurrency.code, toCurrency.code, finalRate, amt]                                   
        );
                                                                                                                                                                        
        await sqlite.runAsync("UPDATE cashboxes SET balance = balance - ? WHERE id = ?", [baseAmount, from.id]);
        await sqlite.runAsync("UPDATE cashboxes SET balance = balance + ? WHERE id = ?", [baseAmount, to.id]);
        Alert.alert("تم التحويل بنجاح", `رقم التحويل: ${transferNo}`);
      }                                                                                                                                                         
      setFrom(null); setTo(null); setAmount(""); setDescription(""); setFromSearch(""); setToSearch("");
      setEditingId(null);
      await loadData();
    } catch (e) {
      Alert.alert("تعذر التحويل", String(e));
    } finally {
      setSaving(false);
    }
  };

  const editTransfer = async (h: any) => {                                                                                                                           
    setEditingId(h.id);
     const f = cashboxes.find(c => c.name === h.from_account);
     const t = cashboxes.find(c => c.name === h.to_account);
     setFrom(f || null); if (f) setFromSearch(f.name);
     setTo(t || null); if (t) setToSearch(t.name);
     setAmount(String(h.amount));
     setDescription(h.description || "");
     if (h.created_at) setDateStr(new Date(h.created_at).toISOString().slice(0, 10));

     const fc = currencies.find(c => c.code === h.from_currency);
     const tc = currencies.find(c => c.code === h.to_currency);
     if (fc) { setFromCurrency(fc); setFromCurSearch(fc.name); }
     if (tc) { setToCurrency(tc); setToCurSearch(tc.name); }
     if (h.exchange_rate) setExchangeRate(String(h.exchange_rate));                                                                                               
  };
                                                                                                                                                                  
  const deleteTransfer = (id: string) => {
    Alert.alert("تأكيد الحذف", "هل تريد حذف هذا التحويل وعكس تأثيره على الأرصدة؟", [
      { text: "إلغاء", style: "cancel" },
      { text: "حذف", style: "destructive", onPress: async () => {
          try {
            const t: any = await sqlite.getFirstAsync("SELECT * FROM account_transfers WHERE id = ?", [id]);
            if (t) {
               const rate = Number(t.exchange_rate) || 1;
               const base = Number(t.amount) * rate;                                                                                                                   
               await sqlite.runAsync("UPDATE cashboxes SET balance = balance + ? WHERE name = ?", [base, t.from_account]);                                             
               await sqlite.runAsync("UPDATE cashboxes SET balance = balance - ? WHERE name = ?", [base, t.to_account]);
               await sqlite.runAsync("DELETE FROM account_transfers WHERE id = ?", [id]);
               await loadData();
            }
          } catch (e) { Alert.alert("تعذر الحذف", String(e)); }
      }}
    ]);
  };
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
        
        <Pressable style={styles.back} onPress={onBack}>
          <Text style={[styles.backText, { color: colors.blue }]}>‹ العودة إلى الوحدات المحاسبية</Text>
        </Pressable>
                                                                                                                                                                        
        <Text style={[styles.screenTitle, { color: colors.text }]}>التحويلات بين الصناديق</Text>

        <Text style={[styles.label, { color: colors.textMuted }]}>من صندوق</Text>                                                                                                                      
        <TextInput
          style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
          value={fromSearch}
          onChangeText={(text) => { setFromSearch(text); setShowFrom(true); if (from && text !== from.name) setFrom(null); }}
          onFocus={() => setShowFrom(true)}
          onBlur={() => setTimeout(() => setShowFrom(false), 200)}
          placeholder="ابحث أو اكتب اسم الصندوق..."
          placeholderTextColor={colors.textMuted}
          textAlign="right"
        />
        {showFrom && (
          <ScrollView style={[styles.suggestBox, { maxHeight: 200, backgroundColor: colors.surface, borderColor: colors.border }]} nestedScrollEnabled keyboardShouldPersistTaps="always">
            {filteredFromBoxes.length === 0 ? <Text style={[styles.suggestEmpty, { color: colors.textMuted }]}>لا نتائج</Text> : 
              filteredFromBoxes.map((c) => (
                <Pressable key={c.id} style={[styles.suggestItem, { borderBottomColor: colors.bg }]} onPressIn={() => { setFrom(c); setFromSearch(c.name); setShowFrom(false); }}>
                  <Text style={[styles.suggestName, { color: colors.text }]}>{c.name}</Text>
                  <Text style={[styles.suggestMeta, { color: colors.textMuted }]}>{c.code} · الرصيد: {Number(c.balance || 0).toFixed(2)}</Text>
                </Pressable>
              ))
            }
          </ScrollView>
        )}

        <Text style={[styles.label, { color: colors.textMuted }]}>إلى صندوق</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
          value={toSearch}
          onChangeText={(text) => { setToSearch(text); setShowTo(true); if (to && text !== to.name) setTo(null); }}
          onFocus={() => setShowTo(true)}
          onBlur={() => setTimeout(() => setShowTo(false), 200)}
          placeholder="ابحث أو اكتب اسم الصندوق..."
          placeholderTextColor={colors.textMuted}
          textAlign="right"
        />
        {showTo && (
          <ScrollView style={[styles.suggestBox, { maxHeight: 200, backgroundColor: colors.surface, borderColor: colors.border }]} nestedScrollEnabled keyboardShouldPersistTaps="always">
            {filteredToBoxes.length === 0 ? <Text style={[styles.suggestEmpty, { color: colors.textMuted }]}>لا نتائج</Text> : 
              filteredToBoxes.map((c) => (
                <Pressable key={c.id} style={[styles.suggestItem, { borderBottomColor: colors.bg }]} onPressIn={() => { setTo(c); setToSearch(c.name); setShowTo(false); }}>
                  <Text style={[styles.suggestName, { color: colors.text }]}>{c.name}</Text>
                  <Text style={[styles.suggestMeta, { color: colors.textMuted }]}>{c.code} · الرصيد: {Number(c.balance || 0).toFixed(2)}</Text>
                </Pressable>
              ))
            }
          </ScrollView>
        )}                                                                                                                                                      
        
        <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.label, { color: colors.textMuted }]}>عملة الصندوق المصدر</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
              value={fromCurSearch}
              onChangeText={(text) => { setFromCurSearch(text); setShowFromCur(true); }}
              onFocus={() => setShowFromCur(true)}
              onBlur={() => setTimeout(() => setShowFromCur(false), 200)}
              placeholder="العملة..."
              placeholderTextColor={colors.textMuted}
              textAlign="right"
            />
            {showFromCur && (
              <ScrollView style={[styles.suggestBox, { maxHeight: 200, backgroundColor: colors.surface, borderColor: colors.border }]} nestedScrollEnabled keyboardShouldPersistTaps="always">
                {filteredFromCur.map((c) => (
                  <Pressable key={c.id} style={[styles.suggestItem, { borderBottomColor: colors.bg }]} onPressIn={() => { setFromCurrency(c); setFromCurSearch(c.name); setShowFromCur(false); }}>
                    <Text style={[styles.suggestName, { color: colors.text }]}>{c.code} - {c.name}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.label, { color: colors.textMuted }]}>عملة الصندوق الهدف</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
              value={toCurSearch}
              onChangeText={(text) => { setToCurSearch(text); setShowToCur(true); }}
              onFocus={() => setShowToCur(true)}
              onBlur={() => setTimeout(() => setShowToCur(false), 200)}
              placeholder="العملة..."
              placeholderTextColor={colors.textMuted}
              textAlign="right"
            />
            {showToCur && (
              <ScrollView style={[styles.suggestBox, { maxHeight: 200, backgroundColor: colors.surface, borderColor: colors.border }]} nestedScrollEnabled keyboardShouldPersistTaps="always">
                {filteredToCur.map((c) => (
                  <Pressable key={c.id} style={[styles.suggestItem, { borderBottomColor: colors.bg }]} onPressIn={() => { setToCurrency(c); setToCurSearch(c.name); setShowToCur(false); }}>
                    <Text style={[styles.suggestName, { color: colors.text }]}>{c.code} - {c.name}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}
          </View>                                                                                                                                                       
        </View>

        {fromCurrency && toCurrency && fromCurrency.code !== toCurrency.code && (
          <View>
            <Text style={[styles.label, { color: colors.textMuted }]}>سعر الصرف</Text>
            <TextInput style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]} value={exchangeRate} onChangeText={setExchangeRate} keyboardType="decimal-pad" textAlign="right" />
          </View>
        )}

        <Text style={[styles.label, { color: colors.textMuted }]}>المبلغ ({fromCurrency?.code || ""})</Text>
        <TextInput style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" textAlign="right" />

        {fromCurrency && toCurrency && fromCurrency.code !== toCurrency.code && (
          <View style={{ marginTop: 10, padding: 12, backgroundColor: colors.isDark ? "#1E3A8A" : "#EFF6FF", borderRadius: 8, borderWidth: 1, borderColor: colors.blue }}>
            <Text style={{ textAlign: "right", fontWeight: "700", color: colors.blue, fontSize: 14 }}>
              المبلغ المعادل بالعملة الأساسية: {(Number(amount) * Number(exchangeRate)).toFixed(2)} YER                                                                     
            </Text>
          </View>
        )}

        <Text style={[styles.label, { color: colors.textMuted }]}>التاريخ</Text>
        <Pressable style={[styles.picker, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => setShowDatePicker(true)}>
          <Text style={[styles.pickerText, { color: colors.text }]}>{dateStr}</Text>
          <MaterialCommunityIcons name="calendar" size={20} color={colors.textMuted} />
        </Pressable>
        {showDatePicker && (
          <DateTimePicker value={dateStr ? new Date(dateStr) : new Date()} mode="date" display="default" onChange={(e, d) => { setShowDatePicker(Platform.OS === "ios"); if (d) setDateStr(d.toISOString().slice(0, 10)); }} />
        )}

        <Text style={[styles.label, { color: colors.textMuted }]}>البيان (اختياري)</Text>
        <TextInput style={[styles.input, { minHeight: 60, backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]} value={description} onChangeText={setDescription} textAlign="right" multiline />

        <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
          <Pressable style={[styles.primary, { flex: 1, backgroundColor: colors.orange }, (!canSave || saving) && styles.disabled]} onPress={save} disabled={!canSave || saving}>
            <Text style={styles.primaryText}>{saving ? "جارٍ..." : (editingId ? "تحديث التحويل" : "تنفيذ التحويل")}</Text>
          </Pressable>
          {editingId && (                                                                                                                                                   
            <Pressable style={[styles.cancelBtn, { backgroundColor: colors.isDark ? "#334155" : "#f1f5f9" }]} onPress={() => { setEditingId(null); setAmount(""); setDescription(""); setFrom(null); setTo(null); setFromSearch(""); setToSearch(""); }}>
              <Text style={[styles.cancelBtnText, { color: colors.text }]}>إلغاء</Text>
            </Pressable>
          )}
        </View>
                                                                                                                                                                        
        {history.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>آخر التحويلات</Text>
            <View style={styles.list}>
              {history.map((h) => (
                <View key={h.id} style={[styles.histRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <View style={styles.histActions}>
                    <Pressable onPress={() => editTransfer(h)} style={[styles.iconBtn, { backgroundColor: colors.isDark ? "#1E3A8A" : "#EFF6FF" }]}><Text style={{fontSize:14}}>✏️</Text></Pressable>                                              
                    <Pressable onPress={() => deleteTransfer(h.id)} style={[styles.iconBtn, { backgroundColor: colors.isDark ? "#7F1D1D" : "#FEE2E2" }]}><Text style={{fontSize:14}}>🗑️</Text></Pressable>                                       
                  </View>                                                                                                                                                         
                  <View style={styles.histInfo}>
                    <Text style={[styles.histName, { color: colors.text }]}>{h.from_account} → {h.to_account}</Text>                                                                                          
                    <Text style={[styles.histMeta, { color: colors.blue }]}>{h.transfer_no}</Text>
                    <Text style={[styles.histDate, { color: colors.textMuted }]}>{new Date(h.created_at).toLocaleString("ar-EG")}</Text>                                                                         
                  </View>
                  <View style={styles.histRight}>                                                                                                                                   
                    <Text style={[styles.histAmount, { color: colors.blue }]}>{Number(h.amount).toFixed(2)} {h.from_currency || ""}</Text>
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
  screenTitle: { fontSize: 22, marginBottom: 12, textAlign: "left", fontFamily: "CodecBold", width: "100%" },                                  
  sectionTitle: { fontSize: 16, fontWeight: "700", textAlign: "left", marginTop: 16, marginBottom: 8, fontFamily: "CodecBold" },
  label: { fontSize: 12, textAlign: "right", marginTop: 8, marginBottom: 4 },
  input: { borderWidth: 1, borderRadius: 8, padding: 10, fontSize: 14, textAlign: "right" },
  picker: { borderWidth: 1, borderRadius: 8, padding: 12, flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center" },
  pickerText: { textAlign: "right", flex: 1, fontSize: 14 },                                                                                    
  pickerArrow: { fontSize: 12, marginLeft: 8 },
  suggestBox: { marginTop: 4, borderWidth: 1, borderRadius: 8, overflow: "hidden", maxHeight: 200 },
  suggestItem: { padding: 10, borderBottomWidth: 1 },
  suggestName: { fontWeight: "700", textAlign: "right", fontSize: 13 },
  suggestMeta: { fontSize: 11, textAlign: "right", marginTop: 2 },
  suggestEmpty: { padding: 10, textAlign: "right", fontSize: 12 },
  primary: { padding: 14, borderRadius: 10 },
  primaryText: { color: "#fff", fontWeight: "700", textAlign: "center" },
  disabled: { opacity: 0.5 },
  cancelBtn: { padding: 14, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  cancelBtnText: { fontWeight: '700' },                                                                                                         
  list: { gap: 8, marginTop: 4 },
  histRow: { borderWidth: 1, borderRadius: 12, padding: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  histActions: { flexDirection: "row", gap: 6, alignItems: "center" },
  iconBtn: { paddingHorizontal: 8, paddingVertical: 8, borderRadius: 8, minWidth: 36, alignItems: "center" },
  histInfo: { flex: 1, alignItems: "flex-end", paddingRight: 10 },
  histName: { fontWeight: "700", fontSize: 14, textAlign: "right" },
  histMeta: { fontSize: 11, marginTop: 2, textAlign: "right", fontWeight: "600" },                                                              
  histDate: { fontSize: 10, marginTop: 2, textAlign: "right" },
  histRight: { alignItems: "flex-start", minWidth: 80 },
  histAmount: { fontWeight: "800", fontSize: 15, textAlign: "left" },                                                                         
});
