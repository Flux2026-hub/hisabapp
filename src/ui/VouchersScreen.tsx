import { useEffect, useState } from "react";
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
import BrandBanner from "./components/BrandBanner";
import { sqlite } from "../db/local";
import DateTimePicker from "@react-native-community/datetimepicker";
import { buildVoucherHtml, printHtml } from "../utils/printDocument";

type Row = any;
type VType = "receipt" | "payment";
type PartyType = "none" | "customer" | "supplier" | "account";

const C = {
  navy: "#0B2545",
  navyLight: "#123D83",
  blue: "#1E40AF",
  blueSoft: "#D6E3F8",
  bluePale: "#EFF6FF",
  orange: "#F97316",
  orangeDark: "#FF6818",
  orangePale: "#FFF4E6",
  ink: "#0F172A",
  muted: "#8494B0",
  bg: "#F1F5F9",
  card: "#FFFFFF",
  line: "#D6E3F8",
  success: "#059669",
  danger: "#DC2626",
};

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
      "SELECT id, voucher_no, voucher_type, party_name, amount, currency_code, created_at FROM vouchers ORDER BY created_at DESC LIMIT 15"
    );
    setHistory(rows || []);
  };

  const symbol = currency?.symbol || currency?.code || "";

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
        "الصندوق يحتوي على " + Number(cashbox.balance).toFixed(2) + " فقط"
      );
      return;
    }
    Alert.alert(
      "تأكيد الحفظ",
      (vType === "receipt" ? "سند قبض" : "سند دفع") +
        " بمبلغ " +
        amt.toFixed(2) +
        " " +
        symbol +
        (partyRecord ? "\nالطرف: " + partyRecord.name : "") +
        "\nالصندوق: " +
        cashbox.name,
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
        "SELECT voucher_no FROM vouchers WHERE voucher_no LIKE ? ORDER BY created_at DESC LIMIT 1",
        [prefix + "-%"]
      );
      let nextNum = 1;
      if (last && last.length > 0) {
        nextNum = parseInt(String(last[0].voucher_no).replace(/\D/g, ""), 10) + 1;
      }
      const voucherNo = prefix + "-" + String(nextNum).padStart(3, "0");

      await sqlite.runAsync(
        "INSERT INTO vouchers (id, voucher_no, voucher_type, cashbox_id, party_name, amount, description, created_at, party_type, party_id, currency_code, exchange_rate) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
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

      const delta = vType === "receipt" ? baseAmount : -baseAmount;
      await sqlite.runAsync(
        "UPDATE cashboxes SET balance = balance + ? WHERE id = ?",
        [delta, cashbox.id]
      );

      if (partyRecord && partyType !== "none") {
        let partyDelta = 0;
        if (partyType === "customer") {
          partyDelta = vType === "receipt" ? -baseAmount : baseAmount;
          await sqlite.runAsync(
            "UPDATE customers SET balance = balance + ? WHERE id = ?",
            [partyDelta, partyRecord.id]
          );
        } else if (partyType === "supplier") {
          partyDelta = vType === "payment" ? -baseAmount : baseAmount;
          await sqlite.runAsync(
            "UPDATE suppliers SET balance = balance + ? WHERE id = ?",
            [partyDelta, partyRecord.id]
          );
        } else if (partyType === "account") {
          partyDelta = vType === "receipt" ? baseAmount : -baseAmount;
          await sqlite.runAsync(
            "UPDATE accounts SET balance = balance + ? WHERE id = ?",
            [partyDelta, partyRecord.id]
          );
        }
      }

      Alert.alert(
        "تم الحفظ بنجاح",
        "رقم السند: " + voucherNo + "\n\nهل تريد طباعة السند؟",
        [
          { text: "لاحقاً", style: "cancel" },
          {
            text: "طباعة",
            onPress: async () => {
              const html = await buildVoucherHtml({
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

  const isReceipt = vType === "receipt";

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets={true}
        contentContainerStyle={styles.scrollContent}
      >
        <Pressable style={styles.back} onPress={onBack}>
          <Text style={styles.backText}>العودة -> إلى الوحدات المحاسبية</Text>
        </Pressable>

        <BrandBanner />
        <Text style={[styles.screenTitle, { marginTop: 15 }]}>السندات (قبض / دفع)</Text>
        <Text style={styles.hint}>
          سند القبض يُضيف للصندوق، وسند الدفع يُنقص منه. يمكن ربط السند بطرف
          (عميل / مورد / حساب).
        </Text>

        {/* ===== نوع السند ===== */}
        

        <View style={styles.toggleRow}>
          <Pressable
            style={[
              styles.toggleBtn,
              isReceipt && styles.toggleBtnActive,
            ]}
            onPress={() => setVType("receipt")}
          >
            <Text
              style={[
                styles.toggleText,
                isReceipt && styles.toggleTextActive,
              ]}
            >
              قبض
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.toggleBtn,
              !isReceipt && styles.toggleBtnActive,
            ]}
            onPress={() => setVType("payment")}
          >
            <Text
              style={[
                styles.toggleText,
                !isReceipt && styles.toggleTextActive,
              ]}
            >
              دفع
            </Text>
          </Pressable>
        </View>

        {/* ===== نوع الطرف ===== */}
        

        <View style={styles.partyRow}>
          {(
            [
              ["none", "بلا طرف"],
              ["customer", "عميل"],
              ["supplier", "مورد"],
              ["account", "حساب"],
            ] as [PartyType, string][]
          ).map(([key, label]) => {
            const active = partyType === key;
            return (
              <Pressable
                key={key}
                onPress={() => changePartyType(key)}
                style={[
                  styles.partyBtn,
                  active && styles.partyBtnActive,
                ]}
              >
                <Text
                  style={[
                    styles.partyText,
                    active && styles.partyTextActive,
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>

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
                  ? partyRecord.name +
                    " (" +
                    Number(partyRecord.balance || 0).toFixed(2) +
                    ")"
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
                        {p.code} · الرصيد:{" "}
                        {Number(p.balance || 0).toFixed(2)}
                      </Text>
                    </Pressable>
                  ))
                )}
              </View>
            )}
          </>
        )}

        {/* ===== الصندوق ===== */}
        <Text style={styles.label}>الصندوق</Text>
        <Pressable
          style={styles.picker}
          onPress={() => setShowCashbox((v) => !v)}
        >
          <Text style={styles.pickerText}>
            {cashbox
              ? cashbox.name + " (" + Number(cashbox.balance).toFixed(2) + ")"
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

        {/* ===== العملة ===== */}
        <Text style={styles.label}>العملة</Text>
        <Pressable
          style={styles.picker}
          onPress={() => setShowCurrency((v) => !v)}
        >
          <Text style={styles.pickerText}>
            {currency
              ? currency.name +
                " (" +
                currency.symbol +
                ")" +
                (currency.isBase
                  ? " — أساسية"
                  : " — 1 = " + Number(currency.exchangeRate).toFixed(2) + " YER")
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
                  {c.isBase
                    ? " · أساسية"
                    : " · 1 = " + Number(c.exchangeRate).toFixed(2) + " YER"}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        {/* ===== المبلغ ===== */}
        <Text style={styles.label}>المبلغ ({symbol})</Text>
        <TextInput
          style={styles.input}
          value={amount}
          onChangeText={setAmount}
          placeholder="0"
          placeholderTextColor={C.muted}
          keyboardType="decimal-pad"
          textAlign="right"
        />

        {/* ===== البيان ===== */}
        <Text style={styles.label}>البيان (اختياري)</Text>
        <TextInput
          style={[styles.input, { minHeight: 60 }]}
          value={description}
          onChangeText={setDescription}
          placeholder="سبب العملية"
          placeholderTextColor={C.muted}
          textAlign="right"
          multiline
        />

        {/* ===== زر الحفظ ===== */}
        <Pressable
          style={[styles.primary, (!canSave || saving) && styles.disabled]}
          onPress={save}
          disabled={!canSave || saving}
        >
          <Text style={styles.primaryText}>
            {saving ? "جارٍ الحفظ..." : "حفظ السند"}
          </Text>
        </Pressable>

        {/* ===== آخر السندات ===== */}
        {history.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionAccent} />
              <Text style={styles.sectionTitle}>آخر السندات</Text>
            </View>
            {history.map((h) => (
              <View key={h.id} style={styles.histRow}>
                <View style={styles.histInfo}>
                  <Text style={styles.histName}>{h.party_name || "—"}</Text>
                  <Text style={styles.histMeta}>{h.voucher_no}</Text>
                  <Text style={styles.histDate}>{new Date(h.created_at).toLocaleString("ar-EG")}</Text>
                </View>
                <Text
                  style={[
                    styles.histAmount,
                    { color: h.voucher_type === "receipt" ? C.success : C.danger },
                  ]}
                >
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
  scrollContent: { paddingBottom: 40, paddingHorizontal: 14 },

  back: {  paddingVertical: 10, alignSelf: "flex-end", marginBottom: 4 },
  backText: {
     color: C.orange, textAlign: "right",
    fontWeight: "800",
    textAlign: "right",
    fontSize: 13,
  },

  screenTitle: {fontSize: 22,
    
    color: C.ink,
    
    marginBottom: 4,
 textAlign: "right", writingDirection: "rtl", width: "100%", fontFamily: "CodecBold"},
  hint: {fontSize: 12,
    color: C.muted,
    
    marginBottom: 16,
    lineHeight: 18,textAlign: "right", writingDirection: "rtl", width: "100%"},

  sectionHeader: {
    flexDirection: "row-reverse",
    alignItems: "center",
    marginTop: 18,
    marginBottom: 10,
    gap: 8,
  },
  sectionAccent: {
    width: 4,
    height: 20,
    backgroundColor: C.orange,
    borderRadius: 2,
  },
  sectionTitle: {fontSize: 16,
    
    color: C.ink,
    
   textAlign: "right", writingDirection: "rtl", width: "100%", fontFamily: "CodecBold"},

  // ===== Toggle =====
  toggleRow: { flexDirection: "row-reverse", gap: 10 },
  toggleBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.2,
    borderColor: C.line,
    backgroundColor: C.card,
    alignItems: "center",
  },
  toggleBtnActive: {
    backgroundColor: C.orange,
    borderColor: C.orange,
    shadowColor: C.orange,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  toggleText: {
    color: C.ink,
    fontWeight: "700",
    fontSize: 15,
  },
  toggleTextActive: { color: "#FFFFFF", fontWeight: "800" },

  // ===== Party =====
  partyRow: { flexDirection: "row-reverse", gap: 8, flexWrap: "wrap" },
  partyBtn: {
    flex: 1,
    minWidth: 70,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1.2,
    borderColor: C.line,
    backgroundColor: C.card,
    alignItems: "center",
  },
  partyBtnActive: {
    backgroundColor: C.blue,
    borderColor: C.blue,
    shadowColor: C.blue,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  partyText: { color: C.ink, fontWeight: "700", fontSize: 12 },
  partyTextActive: { color: "#FFFFFF", fontWeight: "800" },

  // ===== Picker =====
  picker: {
    backgroundColor: C.card,
    borderWidth: 1.2,
    borderColor: C.line,
    borderRadius: 12,
    padding: 14,
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
  },
  pickerText: {
    color: C.ink,
    textAlign: "right",
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
  },
  pickerArrow: { color: C.muted, fontSize: 12, marginLeft: 8 },

  // ===== Input =====
  label: {fontSize: 12,
    color: C.muted,
    
    marginTop: 12,
    marginBottom: 5,
    fontWeight: "700",textAlign: "right", writingDirection: "rtl", width: "100%"},
  input: {backgroundColor: C.card,
    borderWidth: 1.2,
    borderColor: C.line,
    borderRadius: 12,
    padding: 13,
    fontSize: 14,
    color: C.ink,
    fontWeight: "600",textAlign: "right", writingDirection: "rtl", width: "100%"},

  // ===== Primary Button =====
  primary: {
    backgroundColor: C.orange,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 22,
    shadowColor: C.orange,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 5,
  },
  primaryText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 16,
    letterSpacing: 0.5,
  },
  disabled: { opacity: 0.5 },

  // ===== Suggest =====
  suggestBox: {
    marginTop: 6,
    backgroundColor: C.card,
    borderWidth: 1.2,
    borderColor: C.line,
    borderRadius: 12,
    overflow: "hidden",
    shadowColor: C.navy,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  suggestItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.bg,
  },
  suggestName: {
    fontWeight: "700",
    color: C.ink,
    textAlign: "right",
    fontSize: 13,
  },
  suggestMeta: {
    fontSize: 11,
    color: C.muted,
    textAlign: "right",
    marginTop: 2,
  },
  suggestEmpty: {
    padding: 12,
    color: C.muted,
    textAlign: "right",
    fontSize: 12,
  },

  // ===== History =====
  histRow: { backgroundColor: "#ffffff", borderWidth: 1, borderColor: "#D6E3F8", borderRadius: 12, padding: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  histInfo: { flex: 1, alignItems: "flex-end", paddingRight: 10 },
  histName: { fontWeight: "700", fontSize: 14, color: C.ink, textAlign: "right" },
  histMeta: { fontSize: 11, color: C.blue, marginTop: 2, textAlign: "right", fontWeight: "600" },
  histDate: { fontSize: 10, color: C.muted, marginTop: 2, textAlign: "right" },
  histAmount: { fontWeight: "800", fontSize: 16 },
});
