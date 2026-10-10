import { useEffect, useState } from "react";
import {
  Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from "react-native";
import { sqlite } from "../db/local";
import { buildVoucherHtml, printHtml } from "../utils/printDocument";

type Row = any;
type VType = "receipt" | "payment";
type PartyType = "none" | "customer" | "supplier" | "account";

const newId = () =>
  `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export default function VouchersScreen({ onBack }: { onBack: () => void }) {
  const [vType, setVType] = useState<VType>("receipt");
  const [partyType, setPartyType] = useState<PartyType>("none");
  const [partyRecord, setPartyRecord] = useState<Row | null>(null);

  const [cashboxes, setCashboxes] = useState<Row[]>([]);
  const [currencies, setCurrencies] = useState<Row[]>([]);
  const [customers, setCustomers] = useState<Row[]>([]);
  const [suppliers, setSuppliers] = useState<Row[]>([]);
  const [accounts, setAccounts] = useState<Row[]>([]);

  const [cashbox, setCashbox] = useState<Row | null>(null);
  const [currency, setCurrency] = useState<Row | null>(null);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");

  const [showCashbox, setShowCashbox] = useState(false);
  const [showCurrency, setShowCurrency] = useState(false);
  const [showParty, setShowParty] = useState(false);

  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<Row[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const cb: any = await sqlite.getAllAsync(
          "SELECT id, code, name, balance FROM cashboxes ORDER BY name"
        );
        const cur: any = await sqlite.getAllAsync(
          "SELECT id, code, name, symbol, exchange_rate, is_base FROM currencies ORDER BY is_base DESC, code"
        );
        const cust: any = await sqlite.getAllAsync(
          "SELECT id, code, name, phone, balance FROM customers ORDER BY name"
        );
        const sup: any = await sqlite.getAllAsync(
          "SELECT id, code, name, phone, balance FROM suppliers ORDER BY name"
        );
        const acc: any = await sqlite.getAllAsync(
          "SELECT id, code, name, account_type, balance FROM accounts ORDER BY code"
        );

        setCashboxes(cb || []);
        setCustomers(cust || []);
        setSuppliers(sup || []);
        setAccounts(acc || []);

        const normalized = (cur || []).map((x: any) => ({
          id: x.id,
          code: x.code,
          name: x.name,
          symbol: x.symbol,
          exchangeRate: Number(x.exchange_rate ?? x.exchangeRate ?? 1) || 1,
          isBase: !!(x.is_base ?? x.isBase),
        }));
        setCurrencies(normalized);

        const baseCur = normalized.find((x: any) => x.isBase);
        if (baseCur) setCurrency(baseCur);

        await loadHistory();
      } catch (e) {
        Alert.alert("تعذر التحميل", String(e));
      }
    })();
  }, []);

  const loadHistory = async () => {
    const rows: any = await sqlite.getAllAsync(
      `SELECT id, voucher_no, voucher_type, party_name, amount, currency_code, created_at
       FROM vouchers ORDER BY created_at DESC LIMIT 15`
    );
    setHistory(rows || []);
  };

  const symbol = currency?.symbol || currency?.code || "";

  // قائمة الأطراف المتاحة حسب النوع
  const partyOptions: Row[] =
    partyType === "customer"
      ? customers
      : partyType === "supplier"
      ? suppliers
      : partyType === "account"
      ? accounts
      : [];

  const canSave =
    !!cashbox &&
    !!currency &&
    Number(amount) > 0 &&
    (partyType === "none" || !!partyRecord) &&
    !saving;

  const resetParty = () => {
    setPartyRecord(null);
  };

  const changePartyType = (t: PartyType) => {
    setPartyType(t);
    setPartyRecord(null);
    setShowParty(false);
  };

  const save = () => {
    if (!canSave || !cashbox || !currency) return;
    const amt = Number(amount);
    if (vType === "payment" && amt > Number(cashbox.balance)) {
      Alert.alert(
        "رصيد غير كافٍ",
        `الصندوق يحتوي على ${Number(cashbox.balance).toFixed(2)} فقط`
      );
      return;
    }
    Alert.alert(
      "تأكيد الحفظ",
      `${vType === "receipt" ? "سند قبض" : "سند دفع"} بمبلغ ${amt.toFixed(2)} ${symbol}\n` +
        (partyRecord ? `الطرف: ${partyRecord.name}\n` : "") +
        `الصندوق: ${cashbox.name}`,
      [
        { text: "إلغاء", style: "cancel" },
        { text: "حفظ", onPress: doSave },
      ]
    );
  };

  const doSave = async () => {
    if (!cashbox || !currency) return;
    setSaving(true);
    try {
      const now = Date.now();
      const amt = Number(amount);
      const rate = Number(currency.exchangeRate) || 1;
      const isBase = !!currency.isBase;
      const baseAmount = isBase ? amt : amt * rate;

      const prefix = vType === "receipt" ? "RCP" : "PAY";
      const last: any = await sqlite.getAllAsync(
        `SELECT voucher_no FROM vouchers WHERE voucher_no LIKE ? ORDER BY created_at DESC LIMIT 1`,
        [`${prefix}-%`]
      );
      let nextNum = 1;
      if (last && last.length > 0) {
        nextNum = parseInt(String(last[0].voucher_no).replace(/\D/g, ""), 10) + 1;
      }
      const voucherNo = `${prefix}-${String(nextNum).padStart(3, "0")}`;

      await sqlite.runAsync(
        `INSERT INTO vouchers
         (id, voucher_no, voucher_type, cashbox_id, party_name, amount, description, created_at,
          party_type, party_id, currency_code, exchange_rate)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          newId(),
          voucherNo,
          vType,
          cashbox.id,
          partyRecord?.name || "",
          amt,
          description.trim(),
          now,
          partyType,
          partyRecord?.id || null,
          currency.code,
          rate,
        ]
      );

      // 1) تحديث رصيد الصندوق
      const delta = vType === "receipt" ? baseAmount : -baseAmount;
      await sqlite.runAsync(
        "UPDATE cashboxes SET balance = balance + ? WHERE id = ?",
        [delta, cashbox.id]
      );

      // 2) تحديث رصيد الطرف (إن وُجد)
      if (partyRecord && partyType !== "none") {
        // قبض من عميل → ينقص رصيده (سدد ما عليه)
        // دفع لعميل → يزيد رصيده (دفعنا له)
        // قبض لمورد → يزيد رصيده (دفعنا له)... لكن هذا سند قبض من مورد = رجع لنا فلوس
        // دفع لمورد → ينقص رصيده (سددنا ما لنا)

        let partyDelta = 0;
        if (partyType === "customer") {
          // العميل: له علينا (balance موجب) أو علينا له (سالب)
          // قبض من عميل → ينقص رصيده
          partyDelta = vType === "receipt" ? -baseAmount : baseAmount;
          await sqlite.runAsync(
            "UPDATE customers SET balance = balance + ? WHERE id = ?",
            [partyDelta, partyRecord.id]
          );
        } else if (partyType === "supplier") {
          // المورد: له علينا (balance موجب = علينا له)
          // دفع لمورد → ينقص ما علينا له
          partyDelta = vType === "payment" ? -baseAmount : baseAmount;
          await sqlite.runAsync(
            "UPDATE suppliers SET balance = balance + ? WHERE id = ?",
            [partyDelta, partyRecord.id]
          );
        } else if (partyType === "account") {
          // حساب عام: قبض → زيادة، دفع → نقصان
          partyDelta = vType === "receipt" ? baseAmount : -baseAmount;
          await sqlite.runAsync(
            "UPDATE accounts SET balance = balance + ? WHERE id = ?",
            [partyDelta, partyRecord.id]
          );
        }
      }

      Alert.alert(
        "تم الحفظ بنجاح",
        `رقم السند: ${voucherNo}\n\nهل تريد طباعة السند؟`,
        [
          { text: "لاحقاً", style: "cancel" },
          {
            text: "طباعة",
            onPress: () => {
              const html = buildVoucherHtml({
                voucherNo,
                voucherType: vType,
                createdAt: now,
                partyName: partyRecord?.name || "—",
                cashboxName: cashbox.name,
                amount: amt,
                currencySymbol: currency.symbol || currency.code,
                description: description.trim() || undefined,
              });
              printHtml(html);
            },
          },
        ]
      );

      setAmount("");
      setDescription("");
      setCashbox(null);
      setPartyRecord(null);
      setPartyType("none");

      const refreshed: any = await sqlite.getAllAsync(
        "SELECT id, code, name, balance FROM cashboxes ORDER BY name"
      );
      setCashboxes(refreshed || []);
      await loadHistory();
    } catch (e) {
      Alert.alert("تعذر الحفظ", String(e));
    } finally {
      setSaving(false);
    }
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

        <Text style={styles.screenTitle}>السندات (قبض / دفع)</Text>
        <Text style={styles.hint}>
          سند القبض يُضيف للصندوق، وسند الدفع يُنقص منه. يمكن ربط السند بطرف
          (عميل / مورد / حساب).
        </Text>

        {/* نوع السند */}
        <Text style={styles.label}>نوع السند</Text>
        <View style={styles.toggleRow}>
          <Pressable
            style={[styles.toggleBtn, vType === "receipt" && styles.toggleActive]}
            onPress={() => setVType("receipt")}
          >
            <Text
              style={[styles.toggleText, vType === "receipt" && styles.toggleTextActive]}
            >
              قبض
            </Text>
          </Pressable>
          <Pressable
            style={[styles.toggleBtn, vType === "payment" && styles.toggleActive]}
            onPress={() => setVType("payment")}
          >
            <Text
              style={[styles.toggleText, vType === "payment" && styles.toggleTextActive]}
            >
              دفع
            </Text>
          </Pressable>
        </View>

        {/* نوع الطرف */}
        <Text style={styles.label}>نوع الطرف</Text>
        <View style={styles.tabsRow}>
          {(
            [
              ["none", "بلا طرف"],
              ["customer", "عميل"],
              ["supplier", "مورد"],
              ["account", "حساب"],
            ] as [PartyType, string][]
          ).map(([key, label]) => (
            <Pressable
              key={key}
              onPress={() => changePartyType(key)}
              style={[styles.partyTab, partyType === key && styles.partyTabActive]}
            >
              <Text
                style={[
                  styles.partyTabText,
                  partyType === key && styles.partyTabTextActive,
                ]}
              >
                {label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* اختيار الطرف */}
        {partyType !== "none" && (
          <>
            <Text style={styles.label}>
              {partyType === "customer"
                ? "اختر العميل"
                : partyType === "supplier"
                ? "اختر المورد"
                : "اختر الحساب"}
            </Text>
            <Pressable
              style={styles.picker}
              onPress={() => setShowParty((v) => !v)}
            >
              <Text style={styles.pickerText}>
                {partyRecord
                  ? `${partyRecord.name} ${
                      partyRecord.balance !== undefined
                        ? `(${Number(partyRecord.balance || 0).toFixed(2)})`
                        : ""
                    }`
                  : "اختر..."}
              </Text>
              <Text style={styles.pickerArrow}>▼</Text>
            </Pressable>
            {showParty && (
              <View style={styles.suggestBox}>
                {partyOptions.length === 0 ? (
                  <Text style={styles.suggestEmpty}>لا توجد عناصر</Text>
                ) : (
                  partyOptions.map((p) => (
                    <Pressable
                      key={p.id}
                      style={styles.suggestItem}
                      onPress={() => {
                        setPartyRecord(p);
                        setShowParty(false);
                      }}
                    >
                      <Text style={styles.suggestName}>{p.name}</Text>
                      <Text style={styles.suggestMeta}>
                        {p.code}
                        {p.balance !== undefined
                          ? ` · الرصيد: ${Number(p.balance || 0).toFixed(2)}`
                          : ""}
                      </Text>
                    </Pressable>
                  ))
                )}
              </View>
            )}
          </>
        )}

        {/* الصندوق */}
        <Text style={styles.label}>الصندوق</Text>
        <Pressable style={styles.picker} onPress={() => setShowCashbox((v) => !v)}>
          <Text style={styles.pickerText}>
            {cashbox
              ? `${cashbox.name} (${Number(cashbox.balance).toFixed(2)})`
              : "اختر الصندوق"}
          </Text>
          <Text style={styles.pickerArrow}>▼</Text>
        </Pressable>
        {showCashbox && (
          <View style={styles.suggestBox}>
            {cashboxes.length === 0 ? (
              <Text style={styles.suggestEmpty}>لا توجد صناديق</Text>
            ) : (
              cashboxes.map((c) => (
                <Pressable
                  key={c.id}
                  style={styles.suggestItem}
                  onPress={() => {
                    setCashbox(c);
                    setShowCashbox(false);
                  }}
                >
                  <Text style={styles.suggestName}>{c.name}</Text>
                  <Text style={styles.suggestMeta}>
                    {c.code} · الرصيد: {Number(c.balance || 0).toFixed(2)}
                  </Text>
                </Pressable>
              ))
            )}
          </View>
        )}

        {/* العملة */}
        <Text style={styles.label}>العملة</Text>
        <Pressable style={styles.picker} onPress={() => setShowCurrency((v) => !v)}>
          <Text style={styles.pickerText}>
            {currency
              ? `${currency.name} (${currency.symbol})${
                  currency.isBase
                    ? " — أساسية"
                    : ` — 1 = ${Number(currency.exchangeRate).toFixed(2)} YER`
                }`
              : "اختر عملة"}
          </Text>
          <Text style={styles.pickerArrow}>▼</Text>
        </Pressable>
        {showCurrency && (
          <View style={styles.suggestBox}>
            {currencies.map((c) => (
              <Pressable
                key={c.id}
                style={styles.suggestItem}
                onPress={() => {
                  setCurrency(c);
                  setShowCurrency(false);
                }}
              >
                <Text style={styles.suggestName}>
                  {c.name} ({c.symbol})
                </Text>
                <Text style={styles.suggestMeta}>
                  {c.code}
                  {c.isBase ? " · أساسية" : ` · 1 = ${Number(c.exchangeRate).toFixed(2)} YER`}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        {/* المبلغ */}
        <Text style={styles.label}>المبلغ ({symbol})</Text>
        <TextInput
          style={styles.input}
          value={amount}
          onChangeText={setAmount}
          placeholder="0"
          placeholderTextColor="#9CA3AF"
          keyboardType="decimal-pad"
          textAlign="right"
        />

        {/* البيان */}
        <Text style={styles.label}>البيان (اختياري)</Text>
        <TextInput
          style={[styles.input, { minHeight: 60 }]}
          value={description}
          onChangeText={setDescription}
          placeholder="سبب العملية"
          placeholderTextColor="#9CA3AF"
          textAlign="right"
          multiline
        />

        <Pressable
          style={[styles.primary, (!canSave || saving) && styles.disabled]}
          onPress={save}
          disabled={!canSave || saving}
        >
          <Text style={styles.primaryText}>
            {saving ? "جارٍ الحفظ..." : "حفظ السند"}
          </Text>
        </Pressable>

        {/* آخر السندات */}
        {history.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>آخر السندات</Text>
            <View style={styles.list}>
              {history.map((h) => (
                <View key={h.id} style={styles.histRow}>
                  <View style={styles.histRight}>
                    <Text
                      style={[
                        styles.histAmount,
                        {
                          color:
                            h.voucher_type === "receipt" ? "#0b806c" : "#dc2626",
                        },
                      ]}
                    >
                      {h.voucher_type === "receipt" ? "+" : "-"}
                      {Number(h.amount).toFixed(2)}
                    </Text>
                  </View>
                  <View style={styles.histInfo}>
                    <Text style={styles.histName}>{h.party_name || "—"}</Text>
                    <Text style={styles.histMeta}>{h.voucher_no}</Text>
                    <Text style={styles.histDate}>
                      {new Date(h.created_at).toLocaleString("ar-EG")}
                    </Text>
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
  back: { paddingVertical: 10, marginBottom: 8 },
  backText: { color: "#087f68", fontWeight: "700", textAlign: "right" },
  screenTitle: { fontSize: 20, fontWeight: "800", color: "#172033", textAlign: "right", marginBottom: 6 },
  hint: { fontSize: 12, color: "#758298", textAlign: "right", marginBottom: 12, lineHeight: 18 },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: "#172033", textAlign: "right", marginTop: 16, marginBottom: 8 },
  label: { fontSize: 12, color: "#526078", textAlign: "right", marginTop: 8, marginBottom: 4 },
  input: { backgroundColor: "#f8fafc", borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 8, padding: 10, fontSize: 14, color: "#172033" },
  picker: { backgroundColor: "#f8fafc", borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 8, padding: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  pickerText: { color: "#172033", textAlign: "right", flex: 1, fontSize: 13 },
  pickerArrow: { color: "#758298", fontSize: 12, marginLeft: 8 },
  toggleRow: { flexDirection: "row", gap: 8 },
  toggleBtn: { flex: 1, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: "#dfe5ed", alignItems: "center" },
  toggleActive: { backgroundColor: "#10a88a", borderColor: "#10a88a" },
  toggleText: { color: "#172033", fontWeight: "600" },
  toggleTextActive: { color: "#fff", fontWeight: "700" },
  tabsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  partyTab: { borderWidth: 1, borderColor: "#dfe5ed", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  partyTabActive: { backgroundColor: "#315b85", borderColor: "#315b85" },
  partyTabText: { fontSize: 12, color: "#172033", fontWeight: "600" },
  partyTabTextActive: { color: "#fff", fontWeight: "700" },
  list: { gap: 8, marginTop: 4 },
  suggestBox: { marginTop: 4, backgroundColor: "#ffffff", borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 8, overflow: "hidden" },
  suggestItem: { padding: 10, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  suggestName: { fontWeight: "700", color: "#172033", textAlign: "right", fontSize: 13 },
  suggestMeta: { fontSize: 11, color: "#758298", textAlign: "right", marginTop: 2 },
  suggestEmpty: { padding: 10, color: "#758298", textAlign: "right", fontSize: 12 },
  primary: { backgroundColor: "#10a88a", padding: 14, borderRadius: 10, marginTop: 16 },
  primaryText: { color: "#fff", fontWeight: "700", textAlign: "center" },
  disabled: { opacity: 0.5 },
  histRow: { backgroundColor: "#f8fafc", borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 10, padding: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  histInfo: { flex: 1, alignItems: "flex-end" },
  histRight: { alignItems: "flex-start" },
  histName: { fontWeight: "700", color: "#172033", textAlign: "right" },
  histMeta: { fontSize: 11, color: "#315b85", marginTop: 2, textAlign: "right", fontWeight: "600" },
  histDate: { fontSize: 10, color: "#758298", marginTop: 2, textAlign: "right" },
  histAmount: { fontWeight: "800", fontSize: 14 },
});