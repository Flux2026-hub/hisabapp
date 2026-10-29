import { useEffect, useMemo, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { sqlite } from "../db/local";
import BrandBanner from "./components/BrandBanner";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useTheme } from "./ThemeContext"; // 🚀 استدعاء مركز الألوان

const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

type JLine = {
  key: string; accountCode: string; accountName: string;
  debit: number; credit: number; debitBase: number; creditBase: number;
  partyType: string | null; partyId: string | null; partyName: string | null;
  lineDesc: string;
};

export default function JournalScreen({ onBack }: { onBack: () => void }) {
  const { colors } = useTheme(); // 🚀 قراءة الألوان
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
  const [currencySearch, setCurrencySearch] = useState(""); // 🚀 بحث العملة

  const [lines, setLines] = useState<JLine[]>([]);
  const [saving, setSaving] = useState(false);                                                                                      
  const [history, setHistory] = useState<any[]>([]);

  // حالة السطر الجديد
  const [pickAccount, setPickAccount] = useState<any | null>(null);
  const [accountSearch, setAccountSearch] = useState(""); // 🚀 بحث الحساب
  const [pickPartyType, setPickPartyType] = useState<"none" | "customer" | "supplier">("none");
  const [pickParty, setPickParty] = useState<any | null>(null);
  const [partySearch, setPartySearch] = useState(""); // 🚀 بحث الطرف
  const [pickDebit, setPickDebit] = useState("");
  const [pickCredit, setPickCredit] = useState("");
  const [lineDesc, setLineDesc] = useState("");
                                                                                                                                    const [showAccount, setShowAccount] = useState(false);
  const [showPartyPicker, setShowPartyPicker] = useState(false);                                                                    
  const [lineCurrency, setLineCurrency] = useState<any | null>(null);
  const [lineExchangeRate, setLineExchangeRate] = useState("1");
  const [showLineCurrency, setShowLineCurrency] = useState(false);
  const [lineCurrencySearch, setLineCurrencySearch] = useState(""); // 🚀 بحث عملة السطر

  useEffect(() => {
    (async () => {
      try {
        const acc: any = await sqlite.getAllAsync("SELECT id, code, name, account_type FROM accounts ORDER BY code");                     setAccounts(acc || []);
        const cust: any = await sqlite.getAllAsync("SELECT id, name, code FROM customers ORDER BY name");                                 setCustomers(cust || []);
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

  const isBalanced = Math.abs(totalDebitBase - totalCreditBase) < 0.01 && totalDebitBase > 0;
  const balanced = isBalanced;
  const canSave = balanced && description.trim().length > 0 && !saving && lines.length >= 2 && currency;

  // 🚀 دوال الفلترة للبحث
  const filteredCurrencies = useMemo(() => {
    if (!currencySearch.trim()) return currencies;
    const q = currencySearch.toLowerCase();
    return currencies.filter(c => String(c.name).toLowerCase().includes(q) || String(c.code).toLowerCase().includes(q));
  }, [currencies, currencySearch]);

  const filteredAccounts = useMemo(() => {
    if (!accountSearch.trim()) return accounts;
    const q = accountSearch.toLowerCase();
    return accounts.filter(a => String(a.name).toLowerCase().includes(q) || String(a.code).toLowerCase().includes(q));
  }, [accounts, accountSearch]);

  const filteredParties = useMemo(() => {
    const list = pickPartyType === "customer" ? customers : suppliers;
    if (!partySearch.trim()) return list;
    const q = partySearch.toLowerCase();
    return list.filter(p => String(p.name).toLowerCase().includes(q) || String(p.code).toLowerCase().includes(q));
  }, [pickPartyType, customers, suppliers, partySearch]);

  const filteredLineCurrencies = useMemo(() => {
    if (!lineCurrencySearch.trim()) return currencies;
    const q = lineCurrencySearch.toLowerCase();
    return currencies.filter(c => String(c.name).toLowerCase().includes(q) || String(c.code).toLowerCase().includes(q));
  }, [currencies, lineCurrencySearch]);

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

    let finalRate = 1;
    if (lineCurrency) { finalRate = Number(lineExchangeRate) || 1; } else if (currency) { finalRate = Number(exchangeRate) || 1; }

    setLines([...lines, {
        key: newId(), accountCode: finalCode, accountName: finalName,
        debit, credit, debitBase: debit * finalRate, creditBase: credit * finalRate,
        partyType: pickPartyType === "none" ? null : pickPartyType,
        partyId: pickParty?.id || null, partyName: pickParty?.name || null, lineDesc: lineDesc.trim()
    }]);

    setPickAccount(null); setAccountSearch(""); setPickDebit(""); setPickCredit(""); setPickPartyType("none"); setPickParty(null); setPartySearch(""); setLineDesc("");
    setLineCurrency(null); setLineExchangeRate("1"); setLineCurrencySearch(""); setShowLineCurrency(false);
    setShowAccount(false); setShowPartyPicker(false);
  };
                                                                                                                                    const removeLine = (key: string) => setLines(lines.filter((l) => l.key !== key));                                                                                                                                                                                                                                      
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

  const deleteEntry = (id: string) => {
    Alert.alert("تأكيد الحذف", "هل أنت متأكد من حذف هذا القيد؟", [
      { text: "إلغاء", style: "cancel" },
      { text: "حذف", style: "destructive", onPress: async () => {
          try {
            await sqlite.runAsync("DELETE FROM journal_lines WHERE entry_id = ?", [id]);
            await sqlite.runAsync("DELETE FROM journal_entries WHERE id = ?", [id]);
            await loadHistory();
          } catch (e) { Alert.alert("تعذر الحذف", String(e)); }
      }},
    ]);                                                                                                                             
  };

  const editEntry = async (h: any) => {
    try {
      const lines: any = await sqlite.getAllAsync("SELECT * FROM journal_lines WHERE entry_id = ?", [h.id]);
      const newLines = lines.map((l: any) => ({                                                                                           
        key: newId(),
        accountCode: l.account_code,
        accountName: l.account_name,
        debit: Number(l.foreign_debit) || Number(l.debit) || 0, // 🚀 تم تصحيح الأعمدة هنا لجلب القيمة الأصلية
        credit: Number(l.foreign_credit) || Number(l.credit) || 0,
        debitBase: Number(l.debit) || 0,
        creditBase: Number(l.credit) || 0,
        partyType: l.party_type,
        partyId: l.party_id,
        partyName: l.party_name,
        lineDesc: l.line_desc || ""
      }));
      setDescription(h.description);
      setLines(newLines);
      await sqlite.runAsync("DELETE FROM journal_lines WHERE entry_id = ?", [h.id]);
      await sqlite.runAsync("DELETE FROM journal_entries WHERE id = ?", [h.id]);
      await loadHistory();
      Alert.alert("للتعديل", "تم تحميل القيد في النموذج. قم بتعديله واضغط حفظ.");
    } catch (e) { Alert.alert("تعذر التعديل", String(e)); }
  };
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
        
        <Pressable style={styles.back} onPress={onBack}>
          <Text style={[styles.backText, { color: colors.blue }]}>‹ العودة إلى الوحدات المحاسبية</Text>
        </Pressable>

        <BrandBanner />
        <Text style={[styles.screenTitle, { color: colors.text }]}>قيد يومية جديد</Text>

        <View style={styles.headerBox}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.label, { color: colors.textMuted }]}>التاريخ</Text>
            <Pressable style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, justifyContent: "center", height: 42 }]} onPress={() => setShowDatePicker(true)}>
              <Text style={{ textAlign: "right", color: colors.text, fontSize: 14 }}>{dateStr}</Text>
            </Pressable>
            {showDatePicker && (
              <DateTimePicker value={dateStr ? new Date(dateStr) : new Date()} mode="date" display="default" onChange={(event, selectedDate) => { setShowDatePicker(Platform.OS === 'ios'); if (selectedDate) setDateStr(selectedDate.toISOString().slice(0, 10)); }} />
            )}
          </View>
          <View style={{ flex: 1 }}>                                                                                                          
            <Text style={[styles.label, { color: colors.textMuted }]}>العملة</Text>                                                                                          
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
              value={currencySearch}
              onChangeText={(text) => { setCurrencySearch(text); setShowCurrency(true); }}
              onFocus={() => setShowCurrency(true)}
              onBlur={() => setTimeout(() => setShowCurrency(false), 200)}
              placeholder={currency ? currency.code : "اختر"}
              placeholderTextColor={colors.textMuted}
              textAlign="right"
            />
            {showCurrency && (
              <ScrollView style={[styles.suggestBox, { maxHeight: 200, backgroundColor: colors.surface, borderColor: colors.border }]} nestedScrollEnabled>
                {filteredCurrencies.map((c) => (                                                                                                            
                  <Pressable key={c.id} style={[styles.suggestItem, { borderBottomColor: colors.bg }]} onPress={() => { setCurrency(c); setCurrencySearch(c.name); setExchangeRate(c.isBase ? "1" : String(c.exchange_rate || 1)); setShowCurrency(false); }}>
                    <Text style={[styles.suggestName, { color: colors.text }]}>{c.name} ({c.code})</Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.label, { color: colors.textMuted }]}>سعر الصرف</Text>
            <TextInput style={[styles.input, { backgroundColor: currency?.isBase ? colors.bg : colors.surface, borderColor: colors.border, color: colors.text }]} value={exchangeRate} onChangeText={setExchangeRate} editable={!currency?.isBase} keyboardType="decimal-pad" textAlign="right" />
          </View>
        </View>                                                                                                                   
                                                                                                                                          
        <Text style={[styles.label, { color: colors.textMuted }]}>البيان العام للقيد *</Text>
        <TextInput style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]} value={description} onChangeText={setDescription} placeholder="مثال: قيد إثبات مصروفات" placeholderTextColor={colors.textMuted} textAlign="right" />                                                                                 
        
        <Text style={[styles.sectionTitle, { color: colors.text }]}>سطور القيد ({lines.length})</Text>                                                              
        <View style={[styles.tableBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {lines.length === 0 ? (
            <Text style={[styles.empty, { color: colors.textMuted }]}>لا توجد سطور بعد. أضف سطراً من الأسفل.</Text>
          ) : (
            lines.map((l, index) => (
              <View key={l.key} style={[styles.tableRow, { borderBottomColor: colors.border }]}>
                <View style={styles.rowHeader}>
                  <Text style={[styles.rowIndex, { backgroundColor: colors.isDark ? "#1E3A8A" : "#EFF6FF", color: colors.blue }]}>{index + 1}</Text>
                  <Pressable onPress={() => removeLine(l.key)} style={[styles.delBtn, { backgroundColor: colors.isDark ? "#7F1D1D" : "#fee2e2" }]}><Text style={[styles.delText, { color: colors.isDark ? "#FCA5A5" : "#991b1b" }]}>حذف</Text></Pressable>
                </View>
                <View style={styles.rowBody}>
                  <View style={{ flex: 1 }}>                                                                                                          
                    <Text style={[styles.rowName, { color: colors.text }]}>{l.accountName}</Text>
                    <Text style={[styles.rowMeta, { color: colors.textMuted }]}>{l.accountCode}</Text>
                    {l.partyName && <Text style={[styles.rowParty, { color: colors.orange }]}>{l.partyType === 'customer' ? 'عميل: ' : 'مورد: '}{l.partyName}</Text>}
                    {l.lineDesc ? <Text style={[styles.rowDesc, { color: colors.textMuted }]}>{l.lineDesc}</Text> : null}
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    {l.debit > 0 ? <Text style={[styles.rowDebit, { color: colors.blue }]}>مدين: {l.debit.toFixed(2)} {currency?.code}</Text> : null}
                    {l.credit > 0 ? <Text style={[styles.rowCredit, { color: colors.danger }]}>دائن: {l.credit.toFixed(2)} {currency?.code}</Text> : null}
                    {!currency?.isBase && <Text style={[styles.rowBase, { color: colors.textMuted }]}>أساسي: {(l.debitBase || l.creditBase).toFixed(2)}</Text>}
                  </View>
                </View>
              </View>                                                                                                                         
            ))
          )}
        </View>

        <View style={[styles.addBox, { backgroundColor: colors.bg, borderColor: colors.border }]}>
          <Text style={[styles.addTitle, { color: colors.text }]}>إضافة سطر جديد</Text>
          <Text style={[styles.label, { color: colors.textMuted }]}>نوع الحساب</Text>
          <View style={{ flexDirection: "row-reverse", gap: 8, marginBottom: 8 }}>
            <Pressable style={[styles.typeBtn, { backgroundColor: colors.surface, borderColor: colors.border }, pickPartyType === "none" && { backgroundColor: colors.blue, borderColor: colors.blue }]} onPress={() => { setPickPartyType("none"); setPickParty(null); setPartySearch(""); }}><Text style={[styles.typeText, { color: colors.text }, pickPartyType === "none" && { color: "#fff" }]}>حساب عام</Text></Pressable>
            <Pressable style={[styles.typeBtn, { backgroundColor: colors.surface, borderColor: colors.border }, pickPartyType === "customer" && { backgroundColor: colors.blue, borderColor: colors.blue }]} onPress={() => { setPickPartyType("customer"); setPickParty(null); setPartySearch(""); }}><Text style={[styles.typeText, { color: colors.text }, pickPartyType === "customer" && { color: "#fff" }]}>عميل</Text></Pressable>
            <Pressable style={[styles.typeBtn, { backgroundColor: colors.surface, borderColor: colors.border }, pickPartyType === "supplier" && { backgroundColor: colors.blue, borderColor: colors.blue }]} onPress={() => { setPickPartyType("supplier"); setPickParty(null); setPartySearch(""); }}><Text style={[styles.typeText, { color: colors.text }, pickPartyType === "supplier" && { color: "#fff" }]}>مورد</Text></Pressable>
          </View>

          {pickPartyType === "none" ? (
            <>
              <TextInput
                style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                value={accountSearch}
                onChangeText={(text) => { setAccountSearch(text); setShowAccount(true); if (pickAccount && text !== pickAccount.name) setPickAccount(null); }}
                onFocus={() => setShowAccount(true)}
                onBlur={() => setTimeout(() => setShowAccount(false), 200)}
                placeholder="ابحث أو اكتب اسم الحساب..."
                placeholderTextColor={colors.textMuted}
                textAlign="right"
              />
              {showAccount && (
                <ScrollView style={[styles.suggestBox, { maxHeight: 200, backgroundColor: colors.surface, borderColor: colors.border }]} nestedScrollEnabled>                                                                                                    
                  {filteredAccounts.map((a) => (
                    <Pressable key={a.id} style={[styles.suggestItem, { borderBottomColor: colors.bg }]} onPress={() => { setPickAccount(a); setAccountSearch(a.name); setShowAccount(false); }}><Text style={[styles.suggestName, { color: colors.text }]}>{a.name}</Text><Text style={[styles.suggestMeta, { color: colors.textMuted }]}>{a.code}</Text></Pressable>
                  ))}
                </ScrollView>
              )}
            </>
          ) : (
            <>
              <TextInput
                style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                value={partySearch}
                onChangeText={(text) => { setPartySearch(text); setShowPartyPicker(true); if (pickParty && text !== pickParty.name) setPickParty(null); }}
                onFocus={() => setShowPartyPicker(true)}
                onBlur={() => setTimeout(() => setShowPartyPicker(false), 200)}
                placeholder={`ابحث أو اكتب اسم ${pickPartyType === "customer" ? "العميل" : "المورد"}...`}
                placeholderTextColor={colors.textMuted}
                textAlign="right"
              />
              {showPartyPicker && (
                <ScrollView style={[styles.suggestBox, { maxHeight: 200, backgroundColor: colors.surface, borderColor: colors.border }]} nestedScrollEnabled>
                  {filteredParties.map((p) => (
                    <Pressable key={p.id} style={[styles.suggestItem, { borderBottomColor: colors.bg }]} onPress={() => { setPickParty(p); setPartySearch(p.name); setShowPartyPicker(false); }}><Text style={[styles.suggestName, { color: colors.text }]}>{p.name}</Text><Text style={[styles.suggestMeta, { color: colors.textMuted }]}>{p.code}</Text></Pressable>
                  ))}                                                                                                                             
                </ScrollView>
              )}
            </>
          )}
                                                                                                                                            
          <Text style={[styles.label, { color: colors.textMuted }]}>بيان السطر (اختياري)</Text>                                                                            
          <TextInput style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]} value={lineDesc} onChangeText={setLineDesc} placeholder="وصف مختصر للسطر" placeholderTextColor={colors.textMuted} textAlign="right" />

          <Text style={[styles.label, { color: colors.textMuted }]}>عملة السطر</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
            value={lineCurrencySearch}
            onChangeText={(text) => { setLineCurrencySearch(text); setShowLineCurrency(true); if (lineCurrency && text !== lineCurrency.name) setLineCurrency(null); }}
            onFocus={() => setShowLineCurrency(true)}
            onBlur={() => setTimeout(() => setShowLineCurrency(false), 200)}
            placeholder={lineCurrency ? lineCurrency.code : (currency ? currency.code : "العملة الأساسية")}
            placeholderTextColor={colors.textMuted}
            textAlign="right"
          />
          {showLineCurrency && (
            <ScrollView style={[styles.suggestBox, { maxHeight: 200, backgroundColor: colors.surface, borderColor: colors.border }]} nestedScrollEnabled>
              <Pressable style={[styles.suggestItem, { borderBottomColor: colors.bg }]} onPress={() => { setLineCurrency(null); setLineCurrencySearch(""); setShowLineCurrency(false); }}>                       
                <Text style={[styles.suggestName, { color: colors.text }]}>العملة الأساسية</Text>
              </Pressable>
              {filteredLineCurrencies.map((c) => (
                <Pressable key={c.id} style={[styles.suggestItem, { borderBottomColor: colors.bg }]} onPress={() => { setLineCurrency(c); setLineCurrencySearch(c.name); setLineExchangeRate(c.isBase ? "1" : String(c.exchange_rate || 1)); setShowLineCurrency(false); }}>
                  <Text style={[styles.suggestName, { color: colors.text }]}>{c.name} ({c.code})</Text>
                </Pressable>
              ))}
            </ScrollView>                                                                                                                         
          )}
          
          {lineCurrency && !lineCurrency.isBase && (
            <>
              <Text style={[styles.label, { color: colors.textMuted }]}>سعر الصرف</Text>
              <TextInput style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]} value={lineExchangeRate} onChangeText={setLineExchangeRate} keyboardType="decimal-pad" textAlign="right" />
            </>
          )}

          <View style={styles.twoCols}>
            <View style={{ flex: 1 }}><Text style={[styles.label, { color: colors.textMuted }]}>مدين ({lineCurrency ? lineCurrency.code : currency?.code})</Text><TextInput style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]} value={pickDebit} onChangeText={(t) => { setPickDebit(t); if (t) setPickCredit(""); }} placeholder="0" placeholderTextColor={colors.textMuted} keyboardType="decimal-pad" textAlign="right" /></View>
            <View style={{ flex: 1 }}><Text style={[styles.label, { color: colors.textMuted }]}>دائن ({lineCurrency ? lineCurrency.code : currency?.code})</Text><TextInput style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]} value={pickCredit} onChangeText={(t) => { setPickCredit(t); if (t) setPickDebit(""); }} placeholder="0" placeholderTextColor={colors.textMuted} keyboardType="decimal-pad" textAlign="right" /></View>
          </View>
                                                                                                                                            
          <Pressable style={[styles.addBtn, { backgroundColor: colors.navy }]} onPress={addLine}><Text style={styles.addBtnText}>+ إدراج السطر في القيد</Text></Pressable>
        </View>

        <View style={[styles.balanceBox, { backgroundColor: colors.isDark ? "#1E3A8A" : "#EFF6FF", borderColor: colors.blue }]}>
          <View style={styles.balRow}><Text style={[styles.balLabel, { color: colors.blue }]}>مجموع المدين (أساسي):</Text><Text style={[styles.balValue, { color: colors.blue }]}>{totalDebitBase.toFixed(2)} {currency?.code || "YER"}</Text></View>                                                                             
          <View style={styles.balRow}><Text style={[styles.balLabel, { color: colors.blue }]}>مجموع الدائن (أساسي):</Text><Text style={[styles.balValue, { color: colors.blue }]}>{totalCreditBase.toFixed(2)} {currency?.code || "YER"}</Text></View>
          {(!currency?.isBase) && (
            <View style={[styles.balRow, { borderTopWidth: 1, borderTopColor: colors.blue, marginTop: 4, paddingTop: 4 }]}>
              <Text style={[styles.balLabel, { color: colors.blue }]}>إجمالي المدين الأصلي:</Text><Text style={[styles.balValue, { color: colors.blue }]}>{totalDebit.toFixed(2)}</Text>
            </View>
          )}
          <View style={[styles.balStatus, { backgroundColor: balanced ? (colors.isDark ? "#064E3B" : "#dcfce7") : (colors.isDark ? "#7F1D1D" : "#fee2e2") }]}>
             <Text style={{ color: balanced ? colors.success : colors.danger, fontWeight: "700", textAlign: "center" }}>{balanced ? "✅ القيد متوازن" : "⚠️ القيد غير متوازن"}</Text>
          </View>
        </View>

        <Pressable style={[styles.primary, { backgroundColor: colors.orange }, (!canSave || saving) && styles.disabled]} onPress={save} disabled={!canSave || saving}>
          <Text style={styles.primaryText}>{saving ? "جارٍ الحفظ..." : "حفظ القيد نهائياً"}</Text>                                          
        </Pressable>

        {history.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>آخر القيود</Text>
            <View style={styles.list}>
              {history.map((h) => (
                <View key={h.id} style={[styles.histRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>                                                                                            
                  <View style={styles.histActions}>
                    <Pressable onPress={() => editEntry(h)} style={[styles.iconBtn, { backgroundColor: colors.isDark ? "#1E3A8A" : "#EFF6FF" }]}><Text style={{ fontSize: 14 }}>✏️</Text></Pressable>
                    <Pressable onPress={() => deleteEntry(h.id)} style={[styles.iconBtn, { backgroundColor: colors.isDark ? "#7F1D1D" : "#FEE2E2" }]}><Text style={{ fontSize: 14 }}>🗑️</Text></Pressable>
                  </View>
                  <View style={styles.histInfo}>
                    <Text style={[styles.histName, { color: colors.text }]}>{h.description}</Text>
                    <Text style={[styles.histMeta, { color: colors.blue }]}>{h.entry_no}</Text>
                    <Text style={[styles.histDate, { color: colors.textMuted }]}>{new Date(h.created_at).toLocaleString("ar-EG")}</Text>
                  </View>
                  <Text style={[styles.histAmount, { color: colors.blue }]}>{Number(h.total_debit).toFixed(2)}</Text>
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
  back: { alignSelf: "flex-start", paddingVertical: 10, marginBottom: 8 },
  backText: { fontWeight: "700", textAlign: "left" },
  screenTitle: { fontSize: 22, marginBottom: 12, textAlign: "left", width: "100%", fontFamily: "CodecBold" },
  headerBox: { flexDirection: "row-reverse", gap: 8, marginBottom: 16 },
  label: { fontSize: 12, marginTop: 8, marginBottom: 4, textAlign: "right", width: "100%" },
  input: { borderWidth: 1, borderRadius: 8, padding: 10, fontSize: 14, textAlign: "right", width: "100%" },
  sectionTitle: { fontSize: 16, marginTop: 16, marginBottom: 8, textAlign: "left", width: "100%", fontFamily: "CodecBold" },
  tableBox: { borderWidth: 1, borderRadius: 12, overflow: "hidden" },
  empty: { textAlign: "center", fontSize: 13, padding: 20 },
  tableRow: { borderBottomWidth: 1, padding: 12 },
  rowHeader: { flexDirection: "row-reverse", justifyContent: "space-between", marginBottom: 6 },
  rowIndex: { fontSize: 12, fontWeight: "700", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  delBtn: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  delText: { fontSize: 11, fontWeight: "700" },
  rowBody: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "flex-end" },                               
  rowName: { fontWeight: "700", fontSize: 14, textAlign: "right", width: "100%" },
  rowMeta: { fontSize: 12, marginTop: 2, textAlign: "right" },
  rowParty: { fontSize: 12, fontWeight: "700", marginTop: 2, textAlign: "right" },
  rowDesc: { fontSize: 11, marginTop: 2, textAlign: "right", fontStyle: "italic" },
  rowDebit: { fontSize: 14, fontWeight: "800" },
  rowCredit: { fontSize: 14, fontWeight: "800" },
  rowBase: { fontSize: 11, marginTop: 4, fontWeight: "600" },
  addBox: { borderWidth: 1, borderRadius: 12, padding: 12, marginTop: 16 },
  addTitle: { fontSize: 15, fontWeight: "800", textAlign: "right", marginBottom: 8 },
  typeBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 1, alignItems: "center" },
  typeText: { fontWeight: "700", fontSize: 13 },
  twoCols: { flexDirection: "row-reverse", gap: 8 },
  suggestBox: { marginTop: 4, borderWidth: 1, borderRadius: 8, overflow: "hidden", maxHeight: 200 },
  suggestItem: { padding: 10, borderBottomWidth: 1 },
  suggestName: { fontWeight: "700", textAlign: "right", fontSize: 13 },
  suggestMeta: { fontSize: 11, textAlign: "right", marginTop: 2 },
  addBtn: { padding: 12, borderRadius: 8, marginTop: 12, alignItems: "center" },
  addBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  balanceBox: { padding: 12, borderRadius: 10, marginTop: 16, borderWidth: 1 },
  balRow: { flexDirection: "row-reverse", justifyContent: "space-between", marginBottom: 4 },
  balLabel: { fontWeight: "600", fontSize: 14 },
  balValue: { fontWeight: "800", fontSize: 15 },
  balStatus: { marginTop: 8, padding: 8, borderRadius: 6 },
  primary: { padding: 14, borderRadius: 10, marginTop: 16 },
  primaryText: { color: "#fff", fontWeight: "800", fontSize: 16, textAlign: "center" },
  disabled: { opacity: 0.5 },
  list: { gap: 8, marginTop: 4 },
  histRow: { borderWidth: 1, borderRadius: 12, padding: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  histInfo: { flex: 1, alignItems: "flex-end", paddingRight: 10 },
  histRight: { alignItems: "flex-start" },
  histName: { fontWeight: "700", fontSize: 14, textAlign: "right" },
  histMeta: { fontSize: 11, marginTop: 2, textAlign: "right", fontWeight: "600" },
  histDate: { fontSize: 10, marginTop: 2, textAlign: "right" },
  histAmount: { fontWeight: "800", fontSize: 16, textAlign: "left" },
  histActions: { flexDirection: "row", gap: 6, alignItems: "center" },
  iconBtn: { paddingHorizontal: 8, paddingVertical: 8, borderRadius: 8, minWidth: 36, alignItems: "center" },
});
