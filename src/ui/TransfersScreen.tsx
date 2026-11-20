import { useEffect, useMemo, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { sqlite } from "../db/local";
import { useTheme } from "./ThemeContext";

type Cashbox = { id: string; code: string; name: string; balance: number; currency_code: string };
type Transfer = { id: string; transfer_no: string; from_account: string; to_account: string; amount: number; from_currency: string | null; to_currency: string | null; exchange_rate: number | null; description: string | null; created_at: number };
const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
const n = (v: unknown, d = 0) => Number.isFinite(Number(v)) ? Number(v) : d;
const localDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const positive = (v: unknown) => Number.isFinite(Number(v)) && Number(v) > 0;

export default function TransfersScreen({ onBack }: { onBack: () => void }) {
  const { colors } = useTheme();
  const [cashboxes, setCashboxes] = useState<Cashbox[]>([]);
  const [from, setFrom] = useState<Cashbox | null>(null), [to, setTo] = useState<Cashbox | null>(null);
  const [fromSearch, setFromSearch] = useState(""), [toSearch, setToSearch] = useState("");
  const [showFrom, setShowFrom] = useState(false), [showTo, setShowTo] = useState(false), [showDate, setShowDate] = useState(false);
  const [amount, setAmount] = useState(""), [rate, setRate] = useState("1"), [description, setDescription] = useState("");
  const [date, setDate] = useState(localDate(new Date()));
  const [editingId, setEditingId] = useState<string | null>(null), [saving, setSaving] = useState(false), [history, setHistory] = useState<Transfer[]>([]);
  const different = !!from && !!to && from.currency_code !== to.currency_code;
  const sourceAmount = n(amount), exchangeRate = different ? n(rate) : 1, targetAmount = sourceAmount * exchangeRate;

  useEffect(() => { loadData(); }, []);
  const loadData = async () => {
    try {
      const rows: any[] = await sqlite.getAllAsync(`SELECT id,code,name,balance,COALESCE(currency_code,'YER') currency_code FROM cashboxes ORDER BY name`);
      setCashboxes((rows || []).map((r: any) => ({ id: String(r.id), code: String(r.code || ""), name: String(r.name || ""), balance: n(r.balance), currency_code: String(r.currency_code || "YER") })));
      await loadHistory();
    } catch (e) { Alert.alert("تعذر التحميل", String(e)); }
  };
  const loadHistory = async () => {
    const rows: any[] = await sqlite.getAllAsync(`SELECT id,transfer_no,from_account,to_account,amount,from_currency,to_currency,exchange_rate,description,created_at FROM account_transfers ORDER BY created_at DESC LIMIT 20`);
    setHistory((rows || []) as Transfer[]);
  };
  const fromList = useMemo(() => { const q = fromSearch.trim().toLowerCase(); return cashboxes.filter(c => !q || `${c.name} ${c.code} ${c.currency_code}`.toLowerCase().includes(q)); }, [cashboxes, fromSearch]);
  const toList = useMemo(() => { const q = toSearch.trim().toLowerCase(); return cashboxes.filter(c => c.id !== from?.id && (!q || `${c.name} ${c.code} ${c.currency_code}`.toLowerCase().includes(q))); }, [cashboxes, toSearch, from]);
  const canSave = !!from && !!to && from.id !== to.id && positive(amount) && (!different || positive(rate)) && !saving;
  const reset = () => { setFrom(null); setTo(null); setFromSearch(""); setToSearch(""); setAmount(""); setRate("1"); setDescription(""); setEditingId(null); setDate(localDate(new Date())); };
  const nextNo = async () => { const r: any[] = await sqlite.getAllAsync(`SELECT transfer_no FROM account_transfers WHERE transfer_no LIKE ? ORDER BY created_at DESC LIMIT 1`, ["TRF-%"]); const x = r?.[0] ? parseInt(String(r[0].transfer_no).replace(/\D/g, ""), 10) + 1 : 1; return `TRF-${String(Number.isFinite(x) ? x : 1).padStart(3, "0")}`; };
  const save = () => { if (!canSave) return; Alert.alert(editingId ? "تأكيد التعديل" : "تأكيد التحويل", `${sourceAmount.toFixed(2)} ${from!.currency_code} ← ${targetAmount.toFixed(2)} ${to!.currency_code}`, [{ text: "إلغاء", style: "cancel" }, { text: "تنفيذ", onPress: doSave }]); };
  const doSave = async () => {
    if (!from || !to) return; setSaving(true);
    try {
      const source = n(amount), r = different ? n(rate) : 1, target = source * r;
      if (!positive(source) || (different && !positive(r))) throw new Error("المبلغ وسعر الصرف يجب أن يكونا أكبر من صفر");
      const when = new Date(`${date}T00:00:00`).getTime(); if (!Number.isFinite(when)) throw new Error("التاريخ غير صحيح");
      await sqlite.withTransactionAsync(async () => {
        if (editingId) {
          const old: any = await sqlite.getFirstAsync(`SELECT * FROM account_transfers WHERE id=?`, [editingId]); if (!old) throw new Error("التحويل غير موجود");
          const oldFrom: any = await sqlite.getFirstAsync(`SELECT id FROM cashboxes WHERE name=? LIMIT 1`, [old.from_account]);
          const oldTo: any = await sqlite.getFirstAsync(`SELECT id FROM cashboxes WHERE name=? LIMIT 1`, [old.to_account]); if (!oldFrom || !oldTo) throw new Error("تعذر العثور على الصناديق القديمة");
          const oldRate = old.from_currency === old.to_currency ? 1 : n(old.exchange_rate, 1);
          await sqlite.runAsync(`UPDATE cashboxes SET balance=balance+? WHERE id=?`, [n(old.amount), oldFrom.id]);
          await sqlite.runAsync(`UPDATE cashboxes SET balance=balance-? WHERE id=?`, [n(old.amount) * oldRate, oldTo.id]);
          await sqlite.runAsync(`UPDATE account_transfers SET from_account=?,to_account=?,amount=?,original_amount=?,description=?,created_at=?,from_currency=?,to_currency=?,exchange_rate=? WHERE id=?`, [from.name, to.name, source, source, description.trim(), when, from.currency_code, to.currency_code, r, editingId]);
        } else {
          const current: any = await sqlite.getFirstAsync(`SELECT balance FROM cashboxes WHERE id=?`, [from.id]); if (n(current?.balance) < source) throw new Error(`الرصيد غير كافٍ: ${n(current?.balance).toFixed(2)} ${from.currency_code}`);
          await sqlite.runAsync(`INSERT INTO account_transfers (id,transfer_no,from_account,to_account,amount,original_amount,description,created_at,from_currency,to_currency,exchange_rate) VALUES (?,?,?,?,?,?,?,?,?,?,?)`, [newId(), await nextNo(), from.name, to.name, source, source, description.trim(), when, from.currency_code, to.currency_code, r]);
        }
        await sqlite.runAsync(`UPDATE cashboxes SET balance=balance-? WHERE id=? AND currency_code=?`, [source, from.id, from.currency_code]);
        await sqlite.runAsync(`UPDATE cashboxes SET balance=balance+? WHERE id=? AND currency_code=?`, [target, to.id, to.currency_code]);
      });
      Alert.alert("تم بنجاح", "تم حفظ التحويل وتحديث الأرصدة"); reset(); await loadData();
    } catch (e) { Alert.alert("تعذر التنفيذ", String(e)); } finally { setSaving(false); }
  };
  const edit = (h: Transfer) => { const f = cashboxes.find(c => c.name === h.from_account), t = cashboxes.find(c => c.name === h.to_account); if (!f || !t) return Alert.alert("تعذر التعديل", "الصناديق غير موجودة"); setEditingId(h.id); setFrom(f); setTo(t); setFromSearch(f.name); setToSearch(t.name); setAmount(String(h.amount)); setRate(String(h.exchange_rate || 1)); setDescription(h.description || ""); setDate(localDate(new Date(h.created_at))); };
  const remove = (id: string) => Alert.alert("تأكيد الحذف", "سيتم عكس أثر التحويل على الأرصدة", [{ text: "إلغاء", style: "cancel" }, { text: "حذف", style: "destructive", onPress: async () => { try { await sqlite.withTransactionAsync(async () => { const h: any = await sqlite.getFirstAsync(`SELECT * FROM account_transfers WHERE id=?`, [id]); if (!h) throw new Error("التحويل غير موجود"); const f: any = await sqlite.getFirstAsync(`SELECT id FROM cashboxes WHERE name=? LIMIT 1`, [h.from_account]); const t: any = await sqlite.getFirstAsync(`SELECT id FROM cashboxes WHERE name=? LIMIT 1`, [h.to_account]); if (!f || !t) throw new Error("الصناديق غير موجودة"); const rr = h.from_currency === h.to_currency ? 1 : n(h.exchange_rate, 1); await sqlite.runAsync(`UPDATE cashboxes SET balance=balance+? WHERE id=?`, [n(h.amount), f.id]); await sqlite.runAsync(`UPDATE cashboxes SET balance=balance-? WHERE id=?`, [n(h.amount) * rr, t.id]); await sqlite.runAsync(`DELETE FROM account_transfers WHERE id=?`, [id]); }); reset(); await loadData(); } catch (e) { Alert.alert("تعذر الحذف", String(e)); } } }]);
  return <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}><ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
    <Pressable onPress={onBack}><Text style={[s.back, { color: colors.blue }]}>‹ العودة</Text></Pressable><Text style={[s.title, { color: colors.text }]}>التحويلات بين الصناديق</Text>
    <Text style={[s.label, { color: colors.textMuted }]}>من صندوق</Text><TextInput style={[s.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]} value={fromSearch} onChangeText={x => { setFromSearch(x); setShowFrom(true); if (from && x !== from.name) setFrom(null); }} onFocus={() => setShowFrom(true)} onBlur={() => setTimeout(() => setShowFrom(false), 200)} placeholder="ابحث عن الصندوق المصدر" placeholderTextColor={colors.textMuted} textAlign="right" />
    {showFrom && <ScrollView style={[s.suggest, { backgroundColor: colors.surface, borderColor: colors.border }]} nestedScrollEnabled>{fromList.map(c => <Pressable key={c.id} style={s.item} onPressIn={() => { setFrom(c); setFromSearch(c.name); setShowFrom(false); }}><Text style={[s.name, { color: colors.text }]}>{c.name}</Text><Text style={{ color: colors.textMuted }}>{c.code} · {c.currency_code} · {c.balance.toFixed(2)}</Text></Pressable>)}</ScrollView>}
    <Text style={[s.label, { color: colors.textMuted }]}>إلى صندوق</Text><TextInput style={[s.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]} value={toSearch} onChangeText={x => { setToSearch(x); setShowTo(true); if (to && x !== to.name) setTo(null); }} onFocus={() => setShowTo(true)} onBlur={() => setTimeout(() => setShowTo(false), 200)} placeholder="ابحث عن الصندوق الهدف" placeholderTextColor={colors.textMuted} textAlign="right" />
    {showTo && <ScrollView style={[s.suggest, { backgroundColor: colors.surface, borderColor: colors.border }]} nestedScrollEnabled>{toList.map(c => <Pressable key={c.id} style={s.item} onPressIn={() => { setTo(c); setToSearch(c.name); setShowTo(false); }}><Text style={[s.name, { color: colors.text }]}>{c.name}</Text><Text style={{ color: colors.textMuted }}>{c.code} · {c.currency_code} · {c.balance.toFixed(2)}</Text></Pressable>)}</ScrollView>}
    {from && to && <Text style={[s.currency, { color: colors.blue }]}>{from.currency_code} → {to.currency_code}</Text>}
    {different && <><Text style={[s.label, { color: colors.textMuted }]}>سعر الصرف: 1 {fromCurrency(from)} = ؟ {toCurrency(to)}</Text><TextInput style={[s.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]} value={rate} onChangeText={setRate} keyboardType="decimal-pad" textAlign="right" /></>}
    <Text style={[s.label, { color: colors.textMuted }]}>المبلغ ({fromCurrency(from)})</Text><TextInput style={[s.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" textAlign="right" />
    {from && to && positive(amount) && <Text style={[s.preview, { color: colors.blue }]}>سيُخصم {sourceAmount.toFixed(2)} {fromCurrency(from)} ويُضاف {targetAmount.toFixed(2)} {toCurrency(to)}</Text>}
    <Text style={[s.label, { color: colors.textMuted }]}>التاريخ</Text><Pressable style={[s.input, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => setShowDate(true)}><Text style={{ color: colors.text, textAlign: "right" }}>{date}</Text></Pressable>{showDate && <DateTimePicker value={new Date(`${date}T00:00:00`)} mode="date" onChange={(_, d) => { setShowDate(false); if (d) setDate(localDate(d)); }} />}
    <Text style={[s.label, { color: colors.textMuted }]}>البيان</Text><TextInput style={[s.input, { minHeight: 65, backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]} value={description} onChangeText={setDescription} multiline textAlign="right" />
    <View style={s.buttons}><Pressable style={[s.primary, { backgroundColor: colors.orange, opacity: canSave ? 1 : .5 }]} disabled={!canSave} onPress={save}><Text style={s.primaryText}>{saving ? "جارٍ..." : editingId ? "تحديث التحويل" : "تنفيذ التحويل"}</Text></Pressable>{editingId && <Pressable style={s.cancel} onPress={reset}><Text>إلغاء</Text></Pressable>}</View>
    <Text style={[s.section, { color: colors.text }]}>آخر التحويلات</Text>{history.map(h => { const received = n(h.amount) * (h.from_currency === h.to_currency ? 1 : n(h.exchange_rate, 1)); return <View key={h.id} style={[s.history, { backgroundColor: colors.surface, borderColor: colors.border }]}><View style={s.actions}><Pressable onPress={() => edit(h)}><Text>✏️</Text></Pressable><Pressable onPress={() => remove(h.id)}><Text>🗑️</Text></Pressable></View><View style={s.info}><Text style={{ color: colors.text, fontWeight: "700" }}>{h.from_account} → {h.to_account}</Text><Text style={{ color: colors.textMuted }}>{h.amount} {h.from_currency} → {received.toFixed(2)} {h.to_currency}</Text><Text style={{ color: colors.textMuted }}>{new Date(h.created_at).toLocaleString("ar-EG")}</Text></View></View>; })}
  </ScrollView></KeyboardAvoidingView>;
}
const fromCurrency = (c: Cashbox | null) => c?.currency_code || "YER"; const toCurrency = (c: Cashbox | null) => c?.currency_code || "YER";
const s = StyleSheet.create({ container: { padding: 12, paddingBottom: 40 }, back: { paddingVertical: 10, fontWeight: "700" }, title: { fontSize: 22, fontWeight: "800", marginBottom: 12 }, label: { textAlign: "right", marginTop: 10, marginBottom: 4, fontSize: 12 }, input: { borderWidth: 1, borderRadius: 8, padding: 11, fontSize: 14 }, suggest: { maxHeight: 210, borderWidth: 1, borderRadius: 8 }, item: { padding: 10, borderBottomWidth: 1, borderBottomColor: "#e2e8f0" }, name: { textAlign: "right", fontWeight: "700" }, currency: { textAlign: "center", fontWeight: "800", padding: 12 }, preview: { textAlign: "right", padding: 12, fontWeight: "700" }, buttons: { flexDirection: "row", gap: 10, marginTop: 16 }, primary: { flex: 1, padding: 14, borderRadius: 10 }, primaryText: { color: "#fff", textAlign: "center", fontWeight: "700" }, cancel: { padding: 14, borderRadius: 10, backgroundColor: "#e2e8f0" }, section: { fontSize: 17, fontWeight: "800", marginTop: 22, marginBottom: 8 }, history: { borderWidth: 1, borderRadius: 10, padding: 12, flexDirection: "row", marginBottom: 8 }, actions: { flexDirection: "row", gap: 10, alignItems: "center" }, info: { flex: 1, alignItems: "flex-end", paddingRight: 10 } });
