import { useEffect, useState, useMemo } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import BrandBanner from "./components/BrandBanner";
import { sqlite } from "../db/local";
import DateTimePicker from "@react-native-community/datetimepicker";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { buildVoucherHtml, printHtml } from "../utils/printDocument";
import { useTheme } from "./ThemeContext";

type Row = any;
type VType = "receipt" | "payment";
type PartyType = "none" | "customer" | "supplier" | "account";                                                                                                  

const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export default function VouchersScreen({ onBack }: { onBack: () => void }) {
  const { colors } = useTheme();
  const [vType, setVType] = useState<VType>("receipt");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dateStr, setDateStr] = useState(new Date().toISOString().slice(0, 10));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [partyType, setPartyType] = useState<PartyType>("none");
  const [partyRecord, setPartyRecord] = useState<Row | null>(null);
  const [partySearch, setPartySearch] = useState(""); // 🚀 للبحث بالكتابة

  const [cashboxes, setCashboxes] = useState<Row[]>([]);                                                                                                          
  const [currencies, setCurrencies] = useState<Row[]>([]);
  const [customers, setCustomers] = useState<Row[]>([]);
  const [suppliers, setSuppliers] = useState<Row[]>([]);
  const [accounts, setAccounts] = useState<Row[]>([]);

  const [cashbox, setCashbox] = useState<Row | null>(null);
  const [cashboxSearch, setCashboxSearch] = useState(""); // 🚀 للبحث بالكتابة
  const [currency, setCurrency] = useState<Row | null>(null);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");

  const [showCashbox, setShowCashbox] = useState(false);
  const [showCurrency, setShowCurrency] = useState(false);
  const [showParty, setShowParty] = useState(false);                                                                                                            
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<Row[]>([]);

  const [filterVType, setFilterVType] = useState<"all" | "receipt" | "payment">("all");
  const [filterParty, setFilterParty] = useState<"all" | "customer" | "supplier">("all");
                                                                                                                                                                  
  useEffect(() => {
    (async () => {
      try {
        const cb: any = await sqlite.getAllAsync("SELECT id, code, name, balance, cashbox_type FROM cashboxes ORDER BY name");
        const cur: any = await sqlite.getAllAsync("SELECT id, code, name, symbol, exchange_rate, is_base FROM currencies ORDER BY is_base DESC, code");
        const cust: any = await sqlite.getAllAsync("SELECT id, code, name, phone, balance FROM customers ORDER BY name");
        const sup: any = await sqlite.getAllAsync("SELECT id, code, name, phone, balance FROM suppliers ORDER BY name");
        const acc: any = await sqlite.getAllAsync("SELECT id, code, name, account_type, balance FROM accounts ORDER BY code");

        setCashboxes(cb || []);
        setCustomers(cust || []);
        setSuppliers(sup || []);
        setAccounts(acc || []);

        const normalized = (cur || []).map((x: any) => ({
          id: x.id, code: x.code, name: x.name, symbol: x.symbol,
          exchangeRate: Number(x.exchange_rate ?? x.exchangeRate ?? 1) || 1,
          isBase: !!(x.is_base ?? x.isBase),
        }));
        setCurrencies(normalized);
        const baseCur = normalized.find((x: any) => x.isBase);                                                                                                          
        if (baseCur) setCurrency(baseCur);
      } catch (e) { Alert.alert("تعذر التحميل", String(e)); }
    })();
  }, []);

  useEffect(() => { loadHistory(); }, [filterVType, filterParty]);

  const loadHistory = async () => {
    try {
      let query = "SELECT id, voucher_no, voucher_type, party_name, amount, currency_code, created_at, party_type, cashbox_id, description, exchange_rate FROM vouchers WHERE 1=1";
      const params: any[] = [];
      if (filterVType !== "all") { query += " AND voucher_type = ?"; params.push(filterVType); }
      if (filterParty !== "all") { query += " AND party_type = ?"; params.push(filterParty); }
      query += " ORDER BY created_at DESC LIMIT 30";
      const rows: any = await sqlite.getAllAsync(query, params);
      setHistory(rows || []);                                                                                                                                       
    } catch (e) { console.log("History error", e); }
  };

  const symbol = currency?.symbol || currency?.code || "";
  const sarRate = currencies.find((c: any) => c.code === "SAR")?.exchangeRate || 140;

  const partyOptions: Row[] = partyType === "customer" ? customers : partyType === "supplier" ? suppliers : partyType === "account" ? accounts : [];
  
  const filteredParties = useMemo(() => {
    if (!partySearch.trim()) return partyOptions;
    const q = partySearch.toLowerCase();
    return partyOptions.filter(p => String(p.name).toLowerCase().includes(q) || String(p.code).toLowerCase().includes(q));
  }, [partyOptions, partySearch]);

  const availableCashboxes = cashboxes.filter((c: any) => c.cashbox_type === "analytical" || c.id === cashbox?.id);
  
  const filteredCashboxes = useMemo(() => {
    if (!cashboxSearch.trim()) return availableCashboxes;
    const q = cashboxSearch.toLowerCase();
    return availableCashboxes.filter(c => String(c.name).toLowerCase().includes(q) || String(c.code).toLowerCase().includes(q));
  }, [availableCashboxes, cashboxSearch]);

  const canSave = !!cashbox && !!currency && Number(amount) > 0 && (partyType === "none" || !!partyRecord) && !saving;

  const changePartyType = (t: PartyType) => { setPartyType(t); setPartyRecord(null); setPartySearch(""); setShowParty(false); };

  const save = () => {
    if (!canSave || !cashbox || !currency) return;
    const amt = Number(amount);
    Alert.alert("تأكيد الحفظ", (vType === "receipt" ? "سند قبض" : "سند دفع") + " بمبلغ " + amt.toFixed(2) + " " + symbol + (partyRecord ? "\nالطرف: " + partyRecord.name : "") + "\nالصندوق: " + cashbox.name,
      [{ text: "إلغاء", style: "cancel" }, { text: "حفظ", onPress: doSave }]
    );
  };
                                                                                                                                                                  
  const doSave = async () => {
    if (!cashbox || !currency) return;
    setSaving(true);
    try {
      const now = dateStr ? new Date(dateStr).getTime() : Date.now();                                                                                                 
      const amt = Number(amount);
      const rate = Number(currency.exchangeRate) || 1;
      const isBase = !!currency.isBase;
      const baseAmount = isBase ? amt : amt * rate;

      if (editingId) {
        const oldV: any = await sqlite.getFirstAsync("SELECT * FROM vouchers WHERE id = ?", [editingId]);
        if (oldV) {
          const oldRate = Number(oldV.exchange_rate) || 1;
          const oldBaseAmount = Number(oldV.amount) * oldRate;
          const oldDelta = oldV.voucher_type === "receipt" ? -oldBaseAmount : oldBaseAmount;
          await sqlite.runAsync("UPDATE cashboxes SET balance = balance + ? WHERE id = ?", [oldDelta, oldV.cashbox_id]);
          if (oldV.party_id && oldV.party_type !== "none") {
            let oldPDelta = 0;
            if (oldV.party_type === "customer") oldPDelta = oldV.voucher_type === "receipt" ? oldBaseAmount : -oldBaseAmount;
            else if (oldV.party_type === "supplier") oldPDelta = oldV.voucher_type === "payment" ? oldBaseAmount : -oldBaseAmount;
            else if (oldV.party_type === "account") oldPDelta = oldV.voucher_type === "receipt" ? -oldBaseAmount : oldBaseAmount;
            if (oldV.party_type === "customer") await sqlite.runAsync("UPDATE customers SET balance = balance + ? WHERE id = ?", [oldPDelta, oldV.party_id]);
            else if (oldV.party_type === "supplier") await sqlite.runAsync("UPDATE suppliers SET balance = balance + ? WHERE id = ?", [oldPDelta, oldV.party_id]);
            else if (oldV.party_type === "account") await sqlite.runAsync("UPDATE accounts SET balance = balance + ? WHERE id = ?", [oldPDelta, oldV.party_id]);
          }
        }                                                                                                                                                       
        await sqlite.runAsync("UPDATE vouchers SET voucher_type=?, cashbox_id=?, party_name=?, amount=?, description=?, created_at=?, party_type=?, party_id=?, currency_code=?, exchange_rate=? WHERE id=?", [vType, cashbox.id, partyRecord?.name || "", amt, description.trim(), now, partyType, partyRecord?.id || null, currency.code, rate, editingId]);
        const newDelta = vType === "receipt" ? baseAmount : -baseAmount;
        await sqlite.runAsync("UPDATE cashboxes SET balance = balance + ? WHERE id = ?", [newDelta, cashbox.id]);
        if (partyRecord && partyType !== "none") {                                                                                                                         
           let newPDelta = 0;
           if (partyType === "customer") newPDelta = vType === "receipt" ? -baseAmount : baseAmount;
           else if (partyType === "supplier") newPDelta = vType === "payment" ? -baseAmount : baseAmount;
           else if (partyType === "account") newPDelta = vType === "receipt" ? baseAmount : -baseAmount;
           if (partyType === "customer") await sqlite.runAsync("UPDATE customers SET balance = balance + ? WHERE id = ?", [newPDelta, partyRecord.id]);
           else if (partyType === "supplier") await sqlite.runAsync("UPDATE suppliers SET balance = balance + ? WHERE id = ?", [newPDelta, partyRecord.id]);
           else if (partyType === "account") await sqlite.runAsync("UPDATE accounts SET balance = balance + ? WHERE id = ?", [newPDelta, partyRecord.id]);
        }
        Alert.alert("تم التعديل", "تم تحديث السند وتعديل الأرصدة بنجاح");                                                                                               cancelEdit();
      } else {
        const prefix = vType === "receipt" ? "RCP" : "PAY";
        const last: any = await sqlite.getAllAsync(`SELECT voucher_no FROM vouchers WHERE voucher_no LIKE ? ORDER BY created_at DESC LIMIT 1`, [`${prefix}-%`]);
        let nextNum = 1;
        if (last && last.length > 0) nextNum = parseInt(String(last[0].voucher_no).replace(/\D/g, ""), 10) + 1;
        const voucherNo = `${prefix}-${String(nextNum).padStart(3, "0")}`;
        await sqlite.runAsync(`INSERT INTO vouchers (id, voucher_no, voucher_type, cashbox_id, party_name, amount, description, created_at, party_type, party_id, currency_code, exchange_rate) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [newId(), voucherNo, vType, cashbox.id, partyRecord?.name || "", amt, description.trim(), now, partyType, partyRecord?.id || null, currency.code, rate]);
        const delta = vType === "receipt" ? baseAmount : -baseAmount;
        await sqlite.runAsync("UPDATE cashboxes SET balance = balance + ? WHERE id = ?", [delta, cashbox.id]);
        if (partyRecord && partyType !== "none") {
          let partyDelta = 0;                                                                                                                                             
          if (partyType === "customer") { partyDelta = vType === "receipt" ? -baseAmount : baseAmount; await sqlite.runAsync("UPDATE customers SET balance = balance + ? WHERE id = ?", [partyDelta, partyRecord.id]);
          } else if (partyType === "supplier") { partyDelta = vType === "payment" ? -baseAmount : baseAmount; await sqlite.runAsync("UPDATE suppliers SET balance = balance + ? WHERE id = ?", [partyDelta, partyRecord.id]);
          } else if (partyType === "account") { partyDelta = vType === "receipt" ? baseAmount : -baseAmount; await sqlite.runAsync("UPDATE accounts SET balance = balance + ? WHERE id = ?", [partyDelta, partyRecord.id]);
          }
        }                                                                                                                                                       
        Alert.alert("تم الحفظ بنجاح", "رقم السند: " + voucherNo + "\n\nهل تريد طباعة السند؟",
          [{ text: "لاحقاً", style: "cancel" }, { text: "طباعة", onPress: async () => {
                const html = await buildVoucherHtml({ voucherNo, voucherType: vType, createdAt: now, partyName: partyRecord?.name || "—", cashboxName: cashbox.name, amount: amt, currencySymbol: currency.symbol || currency.code, description: description.trim() || undefined });
                printHtml(html);
            }},]
        );
      }

      setAmount(""); setDescription(""); setCashbox(null); setCashboxSearch(""); setPartyRecord(null); setPartyType("none"); setPartySearch(""); setEditingId(null);
      const refreshed: any = await sqlite.getAllAsync("SELECT id, code, name, balance, cashbox_type FROM cashboxes ORDER BY name");
      setCashboxes(refreshed || []);
      await loadHistory();
    } catch (e) {
      Alert.alert("تعذر الحفظ", String(e));
    } finally {
      setSaving(false);
    }                                                                                                                                                             
  };

  const printVoucher = async (h: any) => {
    try {                                                                                                                                                             
      const html = await buildVoucherHtml({ voucherNo: h.voucher_no, voucherType: h.voucher_type, createdAt: h.created_at, partyName: h.party_name || "—", cashboxName: cashboxes.find(c=>c.id === h.cashbox_id)?.name || "—", amount: Number(h.amount), currencySymbol: h.currency_code || "YER", description: h.description });
      printHtml(html);
    } catch (e) { Alert.alert("تعذر الطباعة", String(e)); }
  };

  const editVoucher = async (h: any) => {
    setEditingId(h.id); setVType(h.voucher_type); setAmount(String(h.amount)); setDescription(h.description || ""); setDateStr(h.created_at ? new Date(h.created_at).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10));
    setPartyType(h.party_type || "none");
    if (h.party_id && h.party_type !== "none") {
      let p = null;
      if (h.party_type === "customer") p = customers.find((c:any) => c.id === h.party_id);
      else if (h.party_type === "supplier") p = suppliers.find((s:any) => s.id === h.party_id);
      else if (h.party_type === "account") p = accounts.find((a:any) => a.id === h.party_id);
      setPartyRecord(p || null); setPartySearch(p ? p.name : "");                                                                                                                                    
    } else { setPartyRecord(null); setPartySearch(""); }
    if (h.cashbox_id) { const cb = cashboxes.find((c:any) => c.id === h.cashbox_id); setCashbox(cb || null); setCashboxSearch(cb ? cb.name : ""); }
    if (h.currency_code) { const cur = currencies.find((c:any) => c.code === h.currency_code); if (cur) setCurrency(cur); }
  };

  const cancelEdit = () => {
    setEditingId(null); setVType("receipt"); setAmount(""); setDescription(""); setDateStr(new Date().toISOString().slice(0, 10)); setPartyType("none"); setPartyRecord(null); setPartySearch(""); setCashbox(null); setCashboxSearch("");
  };

  const deleteVoucher = (id: string) => {
    Alert.alert("تأكيد الحذف", "هل أنت متأكد من حذف هذا السند؟ سيتم عكس تأثيره على الصندوق والطرف.", [
      { text: "إلغاء", style: "cancel" },                                                                                                                             
      { text: "حذف", style: "destructive", onPress: async () => {
          try {
            const v: any = await sqlite.getFirstAsync("SELECT * FROM vouchers WHERE id = ?", [id]);
            if (!v) return;
            const rate = Number(v.exchange_rate) || 1;                                                                                                                      
            const baseAmount = Number(v.amount) * rate;
            const delta = v.voucher_type === "receipt" ? -baseAmount : baseAmount;
            await sqlite.runAsync("UPDATE cashboxes SET balance = balance + ? WHERE id = ?", [delta, v.cashbox_id]);
            if (v.party_id && v.party_type !== "none") {
               let pDelta = 0;
               if (v.party_type === "customer") pDelta = v.voucher_type === "receipt" ? baseAmount : -baseAmount;
               else if (v.party_type === "supplier") pDelta = v.voucher_type === "payment" ? baseAmount : -baseAmount;
               else if (v.party_type === "account") pDelta = v.voucher_type === "receipt" ? -baseAmount : baseAmount;
               if (v.party_type === "customer") await sqlite.runAsync("UPDATE customers SET balance = balance + ? WHERE id = ?", [pDelta, v.party_id]);
               else if (v.party_type === "supplier") await sqlite.runAsync("UPDATE suppliers SET balance = balance + ? WHERE id = ?", [pDelta, v.party_id]);
               else if (v.party_type === "account") await sqlite.runAsync("UPDATE accounts SET balance = balance + ? WHERE id = ?", [pDelta, v.party_id]);
            }
            await sqlite.runAsync("DELETE FROM vouchers WHERE id = ?", [id]);
            await loadHistory();
            Alert.alert("تم الحذف", "تم حذف السند وعكس تأثيره.");
          } catch (e) { Alert.alert("تعذر الحذف", String(e)); }
      }},
    ]);
  };

  const isReceipt = vType === "receipt";
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets={true} contentContainerStyle={styles.scrollContent}>
        
        <Pressable style={styles.back} onPress={onBack}>
          <Text style={[styles.backText, { color: colors.blue }]}>‹ العودة إلى الوحدات المحاسبية</Text>
        </Pressable>

        <BrandBanner />
        <Text style={[styles.screenTitle, { color: colors.text }]}>السندات (قبض / دفع)</Text>
        <Text style={[styles.hint, { color: colors.textMuted }]}>سند القبض يُضيف للصندوق، وسند الدفع يُنقص منه. يمكن ربط السند بطرف (عميل / مورد / حساب).</Text>

        <View style={styles.toggleRow}>
          <Pressable style={[styles.toggleBtn, { backgroundColor: colors.surface, borderColor: colors.border }, isReceipt && { backgroundColor: colors.orange, borderColor: colors.orange }]} onPress={() => setVType("receipt")}>
            <Text style={[styles.toggleText, { color: colors.text }, isReceipt && { color: "#FFF", fontWeight: "800" }]}>قبض</Text>
          </Pressable>
          <Pressable style={[styles.toggleBtn, { backgroundColor: colors.surface, borderColor: colors.border }, !isReceipt && { backgroundColor: colors.orange, borderColor: colors.orange }]} onPress={() => setVType("payment")}>
            <Text style={[styles.toggleText, { color: colors.text }, !isReceipt && { color: "#FFF", fontWeight: "800" }]}>دفع</Text>                                           
          </Pressable>
        </View>

        <View style={styles.partyRow}>
          {([["none", "بلا طرف"], ["customer", "عميل"], ["supplier", "مورد"], ["account", "حساب"]] as [PartyType, string][]).map(([key, label]) => {
            const active = partyType === key;
            return (
              <Pressable key={key} onPress={() => changePartyType(key)} style={[styles.partyBtn, { backgroundColor: colors.surface, borderColor: colors.border }, active && { backgroundColor: colors.blue, borderColor: colors.blue }]}>
                <Text style={[styles.partyText, { color: colors.text }, active && { color: "#FFF", fontWeight: "800" }]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>

        {partyType !== "none" && (
          <>
            <Text style={[styles.label, { color: colors.textMuted }]}>{partyType === "customer" ? "اختر العميل" : partyType === "supplier" ? "اختر المورد" : "اختر الحساب"}</Text>                                                                                                                                                         
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
              value={partySearch}
              onChangeText={(text) => {
                setPartySearch(text);
                setShowParty(true);
                if (partyRecord && text !== partyRecord.name) setPartyRecord(null);
              }}
              onFocus={() => setShowParty(true)}
              onBlur={() => setTimeout(() => setShowParty(false), 200)}
              placeholder="ابحث أو اكتب الاسم..."
              placeholderTextColor={colors.textMuted}
              textAlign="right"
            />
            {showParty && (
              <ScrollView style={[styles.suggestBox, { maxHeight: 200, backgroundColor: colors.surface, borderColor: colors.border }]} nestedScrollEnabled keyboardShouldPersistTaps="always">
                {filteredParties.length === 0 ? (
                  <Text style={[styles.suggestEmpty, { color: colors.textMuted }]}>لا توجد نتائج مطابقة</Text>
                ) : (
                  filteredParties.map((p) => {
                    const bal = Number(p.balance || 0);
                    const sarEq = bal / sarRate;
                    return (
                      <Pressable key={p.id} style={[styles.suggestItem, { borderBottomColor: colors.bg }]} onPressIn={() => { setPartyRecord(p); setPartySearch(p.name); setShowParty(false); }}>
                        <Text style={[styles.suggestName, { color: colors.text }]}>{p.name}</Text>
                        <Text style={[styles.suggestMeta, { color: colors.textMuted }]}>{p.code} · الرصيد: {bal.toFixed(2)} YER (≈ {sarEq.toFixed(2)} SAR)</Text>
                      </Pressable>
                    );
                  })
                )}
              </ScrollView>                                                                                                                                                       
            )}
          </>
        )}

        <Text style={[styles.label, { color: colors.textMuted }]}>الصندوق (تحليلي فقط)</Text>                                                                                                          
        <TextInput
          style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
          value={cashboxSearch}
          onChangeText={(text) => {
            setCashboxSearch(text);
            setShowCashbox(true);
            if (cashbox && text !== cashbox.name) setCashbox(null);
          }}
          onFocus={() => setShowCashbox(true)}
          onBlur={() => setTimeout(() => setShowCashbox(false), 200)}
          placeholder="ابحث أو اكتب اسم الصندوق..."
          placeholderTextColor={colors.textMuted}
          textAlign="right"
        />
        {showCashbox && (
          <ScrollView style={[styles.suggestBox, { maxHeight: 200, backgroundColor: colors.surface, borderColor: colors.border }]} nestedScrollEnabled keyboardShouldPersistTaps="always">
            {filteredCashboxes.length === 0 ? (
              <Text style={[styles.suggestEmpty, { color: colors.textMuted }]}>لا توجد صناديق تحليلية مطابقة</Text>
            ) : (
              filteredCashboxes.map((c) => (
                <Pressable key={c.id} style={[styles.suggestItem, { borderBottomColor: colors.bg }]} onPressIn={() => { setCashbox(c); setCashboxSearch(c.name); setShowCashbox(false); }}>                                                                                                                                                                 
                  <Text style={[styles.suggestName, { color: colors.text }]}>{c.name}</Text>
                  <Text style={[styles.suggestMeta, { color: colors.textMuted }]}>{c.code} · الرصيد: {Number(c.balance || 0).toFixed(2)}</Text>
                </Pressable>
              ))
            )}
          </ScrollView>
        )}

        <Text style={[styles.label, { color: colors.textMuted }]}>العملة</Text>
        <Pressable style={[styles.picker, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => setShowCurrency((v) => !v)}>
          <Text style={[styles.pickerText, { color: colors.text }]}>{currency ? currency.name + " (" + currency.symbol + ")" + (currency.isBase ? " — أساسية" : " — 1 = " + Number(currency.exchangeRate).toFixed(2) + " YER") : "اختر عملة"}</Text>
          <Text style={[styles.pickerArrow, { color: colors.textMuted }]}>▼</Text>
        </Pressable>
        {showCurrency && (
          <ScrollView style={[styles.suggestBox, { maxHeight: 200, backgroundColor: colors.surface, borderColor: colors.border }]} nestedScrollEnabled keyboardShouldPersistTaps="always">
            {currencies.map((c) => (
              <Pressable key={c.id} style={[styles.suggestItem, { borderBottomColor: colors.bg }]} onPressIn={() => { setCurrency(c); setShowCurrency(false); }}>
                <Text style={[styles.suggestName, { color: colors.text }]}>{c.name} ({c.symbol})</Text>
                <Text style={[styles.suggestMeta, { color: colors.textMuted }]}>{c.code} {c.isBase ? " · أساسية" : " · 1 = " + Number(c.exchangeRate).toFixed(2) + " YER"}</Text>                                                                                                                                                       
              </Pressable>
            ))}
          </ScrollView>
        )}
                                                                                                                                                                        
        <Text style={[styles.label, { color: colors.textMuted }]}>التاريخ</Text>
        <Pressable style={[styles.picker, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => setShowDatePicker(true)}>
          <Text style={[styles.pickerText, { color: colors.text }]}>{dateStr}</Text>
          <MaterialCommunityIcons name="calendar" size={20} color={colors.textMuted} />
        </Pressable>
        {showDatePicker && (                                                                                                                                              
          <DateTimePicker value={dateStr ? new Date(dateStr) : new Date()} mode="date" display="default" onChange={(e, d) => { setShowDatePicker(Platform.OS === "ios"); if (d) setDateStr(d.toISOString().slice(0, 10)); }} />
        )}
                                                                                                                                                                        
        <Text style={[styles.label, { color: colors.textMuted }]}>المبلغ ({symbol})</Text>
        <TextInput style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]} value={amount} onChangeText={setAmount} placeholder="0" placeholderTextColor={colors.textMuted} keyboardType="decimal-pad" textAlign="right" />

        <Text style={[styles.label, { color: colors.textMuted }]}>البيان (اختياري)</Text>
        <TextInput style={[styles.input, { minHeight: 60, backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]} value={description} onChangeText={setDescription} placeholder="سبب العملية" placeholderTextColor={colors.textMuted} textAlign="right" multiline />

        <View style={{ flexDirection: "row", gap: 10 }}>
          <Pressable style={[styles.primary, { flex: 1, backgroundColor: colors.orange }, (!canSave || saving) && styles.disabled]} onPress={save} disabled={!canSave || saving}>
            <Text style={styles.primaryText}>{saving ? "جارٍ الحفظ..." : (editingId ? "تحديث السند" : "حفظ السند")}</Text>
          </Pressable>
          {editingId && (
            <Pressable style={[styles.cancelBtn, { backgroundColor: colors.isDark ? "#334155" : "#f1f5f9" }]} onPress={cancelEdit}>
              <Text style={[styles.cancelBtnText, { color: colors.text }]}>إلغاء</Text>
            </Pressable>
          )}
        </View>

        {history.length > 0 && (
          <>
            <View style={styles.filterContainer}>
              <View style={styles.filterRow}>
                <Pressable onPress={() => setFilterVType("all")} style={[styles.filterBtn, { backgroundColor: colors.surface, borderColor: colors.border }, filterVType === "all" && { backgroundColor: colors.blue, borderColor: colors.blue }]}><Text style={[styles.filterText, { color: colors.textMuted }, filterVType === "all" && { color: "#FFF" }]}>الكل</Text></Pressable>
                <Pressable onPress={() => setFilterVType("receipt")} style={[styles.filterBtn, { backgroundColor: colors.surface, borderColor: colors.border }, filterVType === "receipt" && { backgroundColor: colors.blue, borderColor: colors.blue }]}><Text style={[styles.filterText, { color: colors.textMuted }, filterVType === "receipt" && { color: "#FFF" }]}>قبض</Text></Pressable>
                <Pressable onPress={() => setFilterVType("payment")} style={[styles.filterBtn, { backgroundColor: colors.surface, borderColor: colors.border }, filterVType === "payment" && { backgroundColor: colors.blue, borderColor: colors.blue }]}><Text style={[styles.filterText, { color: colors.textMuted }, filterVType === "payment" && { color: "#FFF" }]}>دفع</Text></Pressable>
              </View>                                                                                                                                                         
              <View style={styles.filterRow}>
                <Pressable onPress={() => setFilterParty("all")} style={[styles.filterBtn, { backgroundColor: colors.surface, borderColor: colors.border }, filterParty === "all" && { backgroundColor: colors.blue, borderColor: colors.blue }]}><Text style={[styles.filterText, { color: colors.textMuted }, filterParty === "all" && { color: "#FFF" }]}>الكل</Text></Pressable>
                <Pressable onPress={() => setFilterParty("customer")} style={[styles.filterBtn, { backgroundColor: colors.surface, borderColor: colors.border }, filterParty === "customer" && { backgroundColor: colors.blue, borderColor: colors.blue }]}><Text style={[styles.filterText, { color: colors.textMuted }, filterParty === "customer" && { color: "#FFF" }]}>عملاء</Text></Pressable>
                <Pressable onPress={() => setFilterParty("supplier")} style={[styles.filterBtn, { backgroundColor: colors.surface, borderColor: colors.border }, filterParty === "supplier" && { backgroundColor: colors.blue, borderColor: colors.blue }]}><Text style={[styles.filterText, { color: colors.textMuted }, filterParty === "supplier" && { color: "#FFF" }]}>موردين</Text></Pressable>
              </View>
            </View>

            {history.map((h) => (
              <View key={h.id} style={[styles.histRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.histActions}>                                                                                                                                 
                  <Pressable onPress={() => printVoucher(h)} style={[styles.iconBtn, { backgroundColor: colors.isDark ? "#1E3A8A" : "#EFF6FF" }]}><Text style={{ fontSize: 14 }}>🖨️</Text></Pressable>
                  <Pressable onPress={() => editVoucher(h)} style={[styles.iconBtn, { backgroundColor: colors.isDark ? "#1E3A8A" : "#EFF6FF" }]}><Text style={{ fontSize: 14 }}>✏️</Text></Pressable>
                  <Pressable onPress={() => deleteVoucher(h.id)} style={[styles.iconBtn, { backgroundColor: colors.isDark ? "#7F1D1D" : "#FEE2E2" }]}><Text style={{ fontSize: 14 }}>🗑️</Text></Pressable>
                </View>
                <View style={styles.histInfo}>
                  <Text style={[styles.histName, { color: colors.text }]}>{h.party_name || "—"}</Text>
                  <Text style={[styles.histMeta, { color: colors.blue }]}>{h.voucher_no} {h.currency_code ? `(${h.currency_code})` : ""}</Text>
                  <Text style={[styles.histDate, { color: colors.textMuted }]}>{new Date(h.created_at).toLocaleString("ar-EG")}</Text>
                </View>
                <Text style={[styles.histAmount, { color: h.voucher_type === "receipt" ? colors.success : colors.danger }]}>
                  {h.voucher_type === "receipt" ? "+" : "-"}{Number(h.amount).toFixed(2)}
                </Text>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scrollContent: { backgroundColor: "transparent", paddingHorizontal: 8, paddingTop: 16, paddingBottom: 40 },
  back: { paddingVertical: 10, alignSelf: "flex-start", marginBottom: 4 },
  backText: { textAlign: "left", fontWeight: "800", fontSize: 13 },
  screenTitle: { fontSize: 22, marginBottom: 4, textAlign: "left", width: "100%", fontFamily: "CodecBold" },
  hint: { fontSize: 12, marginBottom: 16, lineHeight: 18, textAlign: "left", width: "100%" },
  toggleRow: { flexDirection: "row-reverse", gap: 10, marginBottom: 16 },
  toggleBtn: { flex: 1, paddingVertical: 14, borderRadius: 14, borderWidth: 1.2, alignItems: "center" },            
  toggleText: { fontWeight: "700", fontSize: 15 },
  partyRow: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  partyBtn: { flex: 1, minWidth: 70, paddingVertical: 12, borderRadius: 14, borderWidth: 1.2, alignItems: "center" },
  partyText: { fontWeight: "700", fontSize: 12 },
  picker: { borderWidth: 1.2, borderRadius: 12, padding: 14, flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center" },
  pickerText: { textAlign: "right", flex: 1, fontSize: 13, fontWeight: "600" },
  pickerArrow: { fontSize: 12, marginLeft: 8 },
  label: { fontSize: 12, marginTop: 12, marginBottom: 5, fontWeight: "700", textAlign: "right", width: "100%" },
  input: { borderWidth: 1.2, borderRadius: 12, padding: 13, fontSize: 14, fontWeight: "600", textAlign: "right", width: "100%" },
  primary: { paddingVertical: 16, borderRadius: 14, alignItems: "center", marginTop: 22, shadowColor: "#000", shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.3, shadowRadius: 14, elevation: 5 },
  primaryText: { color: "#FFFFFF", fontWeight: "800", fontSize: 16, letterSpacing: 0.5 },
  disabled: { opacity: 0.5 },
  cancelBtn: { padding: 14, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  cancelBtnText: { fontWeight: '700' },
  suggestBox: { marginTop: 6, borderWidth: 1.2, borderRadius: 12, overflow: "hidden", maxHeight: 200 },
  suggestItem: { padding: 12, borderBottomWidth: 1 },                                                                                    
  suggestName: { fontWeight: "700", textAlign: "right", fontSize: 13 },
  suggestMeta: { fontSize: 11, textAlign: "right", marginTop: 2 },
  suggestEmpty: { padding: 12, textAlign: "right", fontSize: 12 },
  histRow: { borderWidth: 1, borderRadius: 12, padding: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },                                                                                                                   
  histInfo: { flex: 1, alignItems: "flex-end", paddingRight: 10 },
  histName: { fontWeight: "700", fontSize: 14, textAlign: "right" },
  histMeta: { fontSize: 11, marginTop: 2, textAlign: "right", fontWeight: "600" },
  histDate: { fontSize: 10, marginTop: 2, textAlign: "right" },
  histAmount: { fontWeight: "800", fontSize: 16, textAlign: "left" },
  histActions: { flexDirection: "row", gap: 6, alignItems: "center" },
  iconBtn: { paddingHorizontal: 8, paddingVertical: 8, borderRadius: 8, minWidth: 36, alignItems: "center" },
  filterContainer: { marginBottom: 15, gap: 8, marginTop: 16 }, // 🚀 تمت إضافة marginTop هنا لتعويض مساحة العنوان المحذوف
  filterRow: { flexDirection: "row-reverse", gap: 8 },
  filterBtn: { flex: 1, borderWidth: 1, paddingVertical: 8, borderRadius: 8, alignItems: "center" },
  filterText: { fontSize: 12, fontWeight: "700" },
});
