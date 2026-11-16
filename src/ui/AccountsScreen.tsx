import { useEffect, useMemo, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, Modal } from "react-native";
import BrandBanner from "./components/BrandBanner";
import { createAccount, deleteAccount, listAccounts, updateAccount } from "../sync/accounting";
import { sqlite } from "../db/local";
import { useTheme } from "./ThemeContext";
import DateRangePicker from "./reports/components/DateRangePicker";
import { printHtml } from "../utils/printDocument";
import { getLogoBase64 } from "../utils/logoBase64";

type Row = any;
type AccountType = "asset" | "liability" | "income" | "expense";

const TYPES: { key: AccountType; label: string; color: string }[] = [
  { key: "asset", label: "أصول", color: "#0b806c" },
  { key: "liability", label: "خصوم", color: "#dc2626" },
  { key: "income", label: "إيرادات", color: "#3b82f6" },
  { key: "expense", label: "مصروفات", color: "#f59e0b" },
];

const TYPE_MAP: Record<string, AccountType> = {
  asset: "asset", liability: "liability", income: "income", expense: "expense",
};

export default function AccountsScreen({ onBack }: { onBack: () => void }) {
  const { colors } = useTheme();
  const [rows, setRows] = useState<Row[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<AccountType>("asset");

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [parentCode, setParentCode] = useState("");
  const [parentLabel, setParentLabel] = useState("");
  const [initialBalance, setInitialBalance] = useState("");

  const [search, setSearch] = useState("");
  const [searchFocus, setSearchFocus] = useState(false);
  const [showParentPicker, setShowParentPicker] = useState(false);

  // ✅ حالة الفترة الزمنية (افتراضياً من بداية العام)
  const [from, setFrom] = useState(new Date().getFullYear() + "-01-01");
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));

  // ✅ حالة نافذة التفاصيل
  const [selectedAccount, setSelectedAccount] = useState<Row | null>(null);
  const [accountDetails, setAccountDetails] = useState<any | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const load = async () => {
    try {
      const data = await listAccounts();
      setRows(data || []);
    } catch (e) { Alert.alert("تعذر تحميل الحسابات", String(e)); }
  };

  useEffect(() => { void load(); }, []);

  const typeOf = (r: Row): AccountType => TYPE_MAP[String(r.accountType ?? "")] ?? "asset";
  const tabRows = useMemo(() => rows.filter((r) => typeOf(r) === activeTab), [rows, activeTab]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tabRows;
    return tabRows.filter((r) => `${r.code ?? ""} ${r.name ?? ""}`.toLowerCase().includes(q));
  }, [tabRows, search]);

  const counts = useMemo(() => {
    const c: Record<AccountType, number> = { asset: 0, liability: 0, income: 0, expense: 0 };
    rows.forEach((r) => { c[typeOf(r)]++; });
    return c;
  }, [rows]);

  const possibleParents = useMemo(() => {
    return rows.filter((r) => r.id !== editingId && typeOf(r) === activeTab);
  }, [rows, editingId, activeTab]);

  const nextCode = useMemo(() => {
    const prefixes: Record<AccountType, string> = { asset: "1", liability: "2", income: "4", expense: "5" };
    const prefix = prefixes[activeTab];
    const sameType = rows.filter((r) => typeOf(r) === activeTab).map((r) => String(r.code ?? "")).filter((c) => /^\d+$/.test(c));
    if (sameType.length === 0) return `${prefix}000`;
    const max = Math.max(...sameType.map((c) => parseInt(c, 10)));
    return String(max + 1);
  }, [rows, activeTab]);

  const clearForm = () => {
    setEditingId(null); setCode(""); setName(""); setParentCode(""); setParentLabel(""); setInitialBalance(""); setShowParentPicker(false);
  };

  const save = async () => {
    try {
      const trimmedCode = code.trim();
      const trimmedName = name.trim();
      if (!trimmedCode) return Alert.alert("تنبيه", "الرمز مطلوب");
      if (!trimmedName) return Alert.alert("تنبيه", "الاسم مطلوب");
      if (rows.some((r) => String(r.code ?? "").trim() === trimmedCode && r.id !== editingId)) return Alert.alert("تنبيه", "رمز الحساب مستخدم مسبقاً");
      if (rows.some((r) => String(r.name ?? "").trim().toLowerCase() === trimmedName.toLowerCase() && r.id !== editingId)) return Alert.alert("تنبيه", "يوجد حساب بهذا الاسم مسبقاً");

      const bal = Number(initialBalance) || 0;
      const input: any = { code: trimmedCode, name: trimmedName, accountType: activeTab, parentCode: parentCode || undefined, balance: bal };

      if (editingId) await updateAccount(editingId, input);
      else await createAccount(input);

      await load();
      const wasEdit = !!editingId;
      clearForm();
      Alert.alert("تم الحفظ", `تم ${wasEdit ? "تعديل" : "إضافة"} الحساب`);
    } catch (e) { Alert.alert("تعذر الحفظ", String(e)); }
  };

  const edit = (r: Row) => {
    setEditingId(r.id); setCode(String(r.code ?? "")); setName(String(r.name ?? "")); setParentCode(String(r.parentCode ?? "")); setParentLabel(rows.find((x) => x.code === r.parentCode)?.name ?? ""); setInitialBalance(String(r.balance ?? "")); setActiveTab(typeOf(r));
  };

  const remove = (r: Row) => {
    if (rows.some((x) => x.parentCode === r.code)) return Alert.alert("لا يمكن الحذف", "توجد حسابات فرعية تحت هذا الحساب. احذفها أولاً.");
    Alert.alert("تأكيد الحذف", `هل تريد حذف «${r.name}»؟`, [
      { text: "إلغاء", style: "cancel" },
      { text: "حذف", style: "destructive", onPress: async () => {
          try { await deleteAccount(r.id); await load(); if (editingId === r.id) clearForm(); } catch (e) { Alert.alert("تعذر الحذف", String(e)); }
      }},
    ]);
  };

  // ✅ جلب تفاصيل الحساب (الافتتاحي + الحركات + الرصيد النهائي) بناءً على القيود اليومية
  const loadAccountDetails = async (account: Row) => {
    setLoadingDetails(true);
    setSelectedAccount(account);
    setAccountDetails(null);
    try {
      const fromTs = new Date(from + "T00:00:00").getTime();
      const toTs = new Date(to + "T23:59:59").getTime();

      // 1. الرصيد الافتتاحي قبل بداية الفترة
      const opening: any = await sqlite.getFirstAsync(
        `SELECT SUM(jl.debit) - SUM(jl.credit) as balance
         FROM journal_lines jl
         JOIN journal_entries je ON je.id = jl.entry_id
         WHERE jl.account_code = ? AND je.created_at < ?`,
        [account.code, fromTs]
      );

      // 2. حركات الفترة
      const movements: any = await sqlite.getAllAsync(
        `SELECT jl.debit, jl.credit, jl.party_name, je.entry_no, je.description, je.created_at, je.currency_code
         FROM journal_lines jl
         JOIN journal_entries je ON je.id = jl.entry_id
         WHERE jl.account_code = ? AND je.created_at BETWEEN ? AND ?
         ORDER BY je.created_at ASC`,
        [account.code, fromTs, toTs]
      );

      let totalDebit = 0, totalCredit = 0;
      (movements || []).forEach((m: any) => {
        totalDebit += Number(m.debit) || 0;
        totalCredit += Number(m.credit) || 0;
      });

      const openingBalance = Number(opening?.balance) || 0;
      const closingBalance = openingBalance + totalDebit - totalCredit;

      setAccountDetails({ openingBalance, totalDebit, totalCredit, closingBalance, movements: movements || [] });
    } catch (e) {
      Alert.alert("خطأ", String(e));
    } finally {
      setLoadingDetails(false);
    }
  };

  // ✅ طباعة كشف الحساب التحليلي
  const printAccountStatement = async () => {
    if (!selectedAccount || !accountDetails) return;
    try {
      const logoBase64 = await getLogoBase64();
      const logoHtml = logoBase64 ? `<img src='${logoBase64}' class='logo'/>` : '';

      let running = accountDetails.openingBalance;
      const rowsHtml = accountDetails.movements.map((m: any) => {
        const debit = Number(m.debit) || 0;
        const credit = Number(m.credit) || 0;
        running += debit - credit;
        return `<tr>
          <td>${new Date(m.created_at).toLocaleDateString("ar-EG")}</td>
          <td>${m.entry_no || ""}</td>
          <td>${m.description || ""}</td>
          <td>${debit > 0 ? debit.toFixed(2) : "-"}</td>
          <td>${credit > 0 ? credit.toFixed(2) : "-"}</td>
          <td>${running.toFixed(2)}</td>
        </tr>`;
      }).join("");

      const html = `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8"/>
      <style>
        body{font-family:Arial,Tahoma;padding:24px;color:#0F172A;direction:rtl}
        .head{text-align:center;border-bottom:2px solid #F97316;padding-bottom:12px;margin-bottom:16px;position:relative}
        .brand{font-size:22px;font-weight:800;color:#1E40AF}
        .info{margin-bottom:16px;font-size:13px;line-height:1.8}
        table{width:100%;border-collapse:collapse;margin-top:12px}
        th,td{border:1px solid #D6E3F8;padding:7px;text-align:right;font-size:13px}
        th{background:#1E40AF;color:#fff}
        .totals{background:#EFF6FF;font-weight:bold}
        .logo{height:60px;position:absolute;top:0;right:0;}
      </style></head><body>
        ${logoHtml}
        <div class="head"><div class="brand">فلوكس</div><div style="font-size:12px;color:#8494B0">مسلك مجاري</div></div>
        <h2>كشف حساب تحليلي</h2>
        <div class="info">
          <div><strong>الحساب:</strong> ${selectedAccount.name} (${selectedAccount.code})</div>
          <div><strong>الفترة:</strong> ${from} → ${to}</div>
        </div>
        <table>
          <thead>
            <tr><th>التاريخ</th><th>رقم القيد</th><th>البيان</th><th>مدين</th><th>دائن</th><th>الرصيد التراكمي</th></tr>
          </thead>
          <tbody>
            <tr class="totals"><td colspan="5">الرصيد الافتتاحي</td><td>${accountDetails.openingBalance.toFixed(2)}</td></tr>
            ${rowsHtml || "<tr><td colspan='6' style='text-align:center'>لا توجد حركات</td></tr>"}
            <tr class="totals"><td colspan="3">إجمالي حركة الفترة</td><td>${accountDetails.totalDebit.toFixed(2)}</td><td>${accountDetails.totalCredit.toFixed(2)}</td><td>${accountDetails.closingBalance.toFixed(2)}</td></tr>
            <tr class="totals"><td colspan="5">الرصيد النهائي</td><td>${accountDetails.closingBalance.toFixed(2)}</td></tr>
          </tbody>
        </table>
      </body></html>`;
      await printHtml(html);
    } catch (e: any) {
      Alert.alert("خطأ في الطباعة", String(e.message || e));
    }
  };

  const balanceColor = (bal: any) => { const n = Number(bal) || 0; return n > 0 ? colors.success : n < 0 ? colors.danger : colors.textMuted; };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">

        <Pressable android_ripple={{ color: "rgba(0,0,0,0.1)" }} style={styles.back} onPress={onBack}>
          <Text style={[styles.backText, { color: colors.blue }]}>‹ العودة إلى الوحدات المحاسبية</Text>
        </Pressable>

        <BrandBanner />
        <Text style={[styles.screenTitle, { color: colors.text }]}>الحسابات الرئيسة</Text>
        <Text style={[styles.hint, { color: colors.textMuted }]}>شجرة الحسابات المحاسبية. اضغط على أي حساب لعرض تفاصيله وحركاته خلال الفترة المحددة.</Text>

        {/* ✅ مُحدد الفترة الزمنية */}
        <DateRangePicker from={from} to={to} onFromChange={setFrom} onToChange={setTo} />

        <View style={styles.tabs}>
          {TYPES.map((t) => {
            const active = activeTab === t.key;
            return (
              <Pressable android_ripple={{ color: "rgba(0,0,0,0.1)" }} key={t.key} onPress={() => { setActiveTab(t.key); clearForm(); }} style={[styles.tab, { borderColor: colors.border, backgroundColor: colors.surface }, active && { backgroundColor: t.color, borderColor: t.color }]}>
                <Text style={[styles.tabText, { color: colors.text }, active && { color: "#fff", fontWeight: "700" }]}>{t.label} ({counts[t.key]})</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.label, { color: colors.textMuted }]}>بحث</Text>
        <TextInput style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]} value={search} onChangeText={setSearch} onFocus={() => setSearchFocus(true)} onBlur={() => setTimeout(() => setSearchFocus(false), 200)} placeholder="ابحث بالرمز أو الاسم" placeholderTextColor={colors.textMuted} textAlign="right" />

        {searchFocus && search.trim().length > 0 && (
          <ScrollView style={[styles.suggestBox, { maxHeight: 200, backgroundColor: colors.surface, borderColor: colors.border }]} nestedScrollEnabled keyboardShouldPersistTaps="always">
            {filteredRows.length === 0 ? (
              <Text style={[styles.suggestEmpty, { color: colors.textMuted }]}>لا نتائج</Text>
            ) : (
              filteredRows.slice(0, 8).map((r) => (
                <Pressable android_ripple={{ color: "rgba(0,0,0,0.1)" }} key={r.id} style={[styles.suggestItem, { borderBottomColor: colors.bg }]} onPressIn={() => { loadAccountDetails(r); setSearch(""); setSearchFocus(false); }}>
                  <Text style={[styles.suggestName, { color: colors.text }]}>{r.name}</Text>
                  <Text style={[styles.suggestMeta, { color: colors.textMuted }]}>{r.code}</Text>
                </Pressable>
              ))
            )}
          </ScrollView>
        )}

        <Text style={[styles.sectionTitle, { color: colors.text }]}>{editingId ? "تعديل الحساب" : "إضافة حساب جديد"}</Text>

        <Text style={[styles.label, { color: colors.textMuted }]}>رمز الحساب</Text>
        <View style={{ flexDirection: "row-reverse", gap: 8 }}>
          <TextInput style={[styles.input, { flex: 1, backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]} value={code} onChangeText={setCode} placeholder={nextCode} placeholderTextColor={colors.textMuted} textAlign="right" editable={!editingId} />
          {!editingId && (
            <Pressable android_ripple={{ color: "rgba(0,0,0,0.1)" }} style={[styles.genBtn, { backgroundColor: colors.blue }]} onPress={() => setCode(nextCode)}>
              <Text style={{ color: "#FFF", fontSize: 12, fontWeight: "700" }}>توليد</Text>
            </Pressable>
          )}
        </View>

        <Text style={[styles.label, { color: colors.textMuted }]}>اسم الحساب</Text>
        <TextInput style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]} value={name} onChangeText={setName} placeholder="مثال: الصندوق - النقدية" placeholderTextColor={colors.textMuted} textAlign="right" />

        <Text style={[styles.label, { color: colors.textMuted }]}>الحساب الأب (اختياري)</Text>
        <Pressable android_ripple={{ color: "rgba(0,0,0,0.1)" }} style={[styles.picker, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => setShowParentPicker((v) => !v)}>
          <Text style={[styles.pickerText, { color: colors.text }]}>{parentLabel || "بدون أب (حساب رئيسي)"}</Text>
          <Text style={[styles.pickerArrow, { color: colors.textMuted }]}>▼</Text>
        </Pressable>

        {showParentPicker && (
          <ScrollView style={[styles.suggestBox, { maxHeight: 200, backgroundColor: colors.surface, borderColor: colors.border }]} nestedScrollEnabled keyboardShouldPersistTaps="always">
            <Pressable android_ripple={{ color: "rgba(0,0,0,0.1)" }} style={[styles.suggestItem, { borderBottomColor: colors.bg }]} onPressIn={() => { setParentCode(""); setParentLabel(""); setShowParentPicker(false); }}>
              <Text style={[styles.suggestName, { color: colors.text }]}>بدون أب (حساب رئيسي)</Text>
            </Pressable>
            {possibleParents.length === 0 ? (
              <Text style={[styles.suggestEmpty, { color: colors.textMuted }]}>لا توجد حسابات مناسبة</Text>
            ) : (
              possibleParents.map((p) => (
                <Pressable android_ripple={{ color: "rgba(0,0,0,0.1)" }} key={p.id} style={[styles.suggestItem, { borderBottomColor: colors.bg }]} onPressIn={() => { setParentCode(p.code); setParentLabel(`${p.code} - ${p.name}`); setShowParentPicker(false); }}>
                  <Text style={[styles.suggestName, { color: colors.text }]}>{p.name}</Text>
                  <Text style={[styles.suggestMeta, { color: colors.textMuted }]}>{p.code}</Text>
                </Pressable>
              ))
            )}
          </ScrollView>
        )}

        <Text style={[styles.label, { color: colors.textMuted }]}>الرصيد الافتتاحي (اختياري)</Text>
        <TextInput style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]} value={initialBalance} onChangeText={setInitialBalance} placeholder="0" placeholderTextColor={colors.textMuted} keyboardType="decimal-pad" textAlign="right" />

        <View style={styles.buttons}>
          <Pressable android_ripple={{ color: "rgba(0,0,0,0.1)" }} style={[styles.primary, { backgroundColor: colors.orange }]} onPress={save}>
            <Text style={styles.primaryText}>{editingId ? "حفظ التعديل" : "إضافة وحفظ"}</Text>
          </Pressable>
          {editingId && (
            <Pressable android_ripple={{ color: "rgba(0,0,0,0.1)" }} style={[styles.cancel, { borderColor: colors.border }]} onPress={clearForm}>
              <Text style={[styles.cancelText, { color: colors.text }]}>إلغاء</Text>
            </Pressable>
          )}
        </View>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>{TYPES.find((t) => t.key === activeTab)?.label} ({tabRows.length})</Text>
        <View style={styles.list}>
          {filteredRows.length === 0 ? (
            <Text style={[styles.empty, { color: colors.textMuted }]}>لا توجد حسابات في هذا التصنيف — ابدأ بالإضافة أدناه</Text>
          ) : (
            filteredRows.map((r) => (
              <Pressable android_ripple={{ color: "rgba(0,0,0,0.1)" }} key={r.id} style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => loadAccountDetails(r)}>
                <View style={styles.rowActions}>
                  <Pressable android_ripple={{ color: "rgba(0,0,0,0.1)" }} onPress={(e) => { e.stopPropagation(); edit(r); }} style={[styles.editBtn, { backgroundColor: colors.isDark ? "#1E3A8A" : "#EFF6FF" }]}><Text style={styles.editText}>✏️</Text></Pressable>
                  <Pressable android_ripple={{ color: "rgba(0,0,0,0.1)" }} onPress={(e) => { e.stopPropagation(); remove(r); }} style={[styles.delBtn, { backgroundColor: colors.isDark ? "#7F1D1D" : "#fee2e2" }]}><Text style={styles.delText}>🗑️</Text></Pressable>
                </View>
                <View style={styles.rowInfo}>
                  <Text style={[styles.rowName, { color: colors.text }]}>{r.name}</Text>
                  <Text style={[styles.rowMeta, { color: colors.textMuted }]}>{r.code}{r.parentCode ? ` · تحت ${r.parentCode}` : ""}</Text>
                </View>
              </Pressable>
            ))
          )}
        </View>
      </ScrollView>

      {/* ✅ نافذة تفاصيل الحساب */}
      <Modal visible={!!selectedAccount} transparent animationType="fade" onRequestClose={() => setSelectedAccount(null)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>تفاصيل الحساب</Text>

            {loadingDetails && <Text style={{ textAlign: "center", color: colors.textMuted, marginVertical: 20 }}>جارٍ التحميل...</Text>}

            {selectedAccount && accountDetails && (
              <View style={styles.modalDetails}>
                <Text style={[styles.modalText, { color: colors.text }]}>الحساب: {selectedAccount.name}</Text>
                <Text style={[styles.modalText, { color: colors.text }]}>الرمز: {selectedAccount.code}</Text>
                <Text style={[styles.modalText, { color: colors.textMuted, fontSize: 13 }]}>الفترة: {from} → {to}</Text>
                <View style={[styles.detailRow, { borderTopColor: colors.border, borderTopWidth: 1, marginTop: 10, paddingTop: 10 }]}>
                  <Text style={[styles.detailLabel, { color: colors.textMuted }]}>الرصيد الافتتاحي:</Text>
                  <Text style={[styles.detailValue, { color: colors.text }]}>{accountDetails.openingBalance.toFixed(2)}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: colors.textMuted }]}>إجمالي المدين (عليه):</Text>
                  <Text style={[styles.detailValue, { color: colors.blue }]}>{accountDetails.totalDebit.toFixed(2)}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: colors.textMuted }]}>إجمالي الدائن (له):</Text>
                  <Text style={[styles.detailValue, { color: colors.danger }]}>{accountDetails.totalCredit.toFixed(2)}</Text>
                </View>
                <View style={[styles.detailRow, { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8, marginTop: 4 }]}>
                  <Text style={[styles.detailLabel, { color: colors.text, fontWeight: "800" }]}>الرصيد النهائي:</Text>
                  <Text style={[styles.detailValue, { color: balanceColor(accountDetails.closingBalance), fontWeight: "800", fontSize: 18 }]}>{accountDetails.closingBalance.toFixed(2)}</Text>
                </View>
              </View>
            )}

            <View style={styles.modalActions}>
              <Pressable style={[styles.modalBtn, { backgroundColor: colors.blue }, !accountDetails && { opacity: 0.5 }]} onPress={printAccountStatement} disabled={!accountDetails}>
                <Text style={styles.modalBtnText}>🖨️ طباعة كشف تحليلي</Text>
              </Pressable>
              <Pressable style={[styles.modalBtn, { backgroundColor: colors.textMuted }]} onPress={() => setSelectedAccount(null)}>
                <Text style={styles.modalBtnText}>إغلاق</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: { backgroundColor: "transparent", paddingHorizontal: 8, paddingTop: 16, paddingBottom: 40 },
  back: { paddingVertical: 10, alignSelf: "flex-start", marginBottom: 8 },
  backText: { textAlign: "left", fontWeight: "700" },
  screenTitle: { fontSize: 20, marginBottom: 6, textAlign: "left", width: "100%", fontFamily: "CodecBold" },
  hint: { fontSize: 12, marginBottom: 12, lineHeight: 18, textAlign: "left", width: "100%" },
  tabs: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 6, marginBottom: 10 },
  tab: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 },
  tabText: { fontSize: 12 },
  sectionTitle: { fontSize: 16, marginTop: 16, marginBottom: 8, textAlign: "left", width: "100%", fontFamily: "CodecBold" },
  label: { fontSize: 12, marginTop: 8, marginBottom: 4, textAlign: "right", width: "100%" },
  input: { borderWidth: 1, borderRadius: 8, padding: 10, fontSize: 14, textAlign: "right", width: "100%" },
  genBtn: { justifyContent: "center", alignItems: "center", paddingHorizontal: 12, borderRadius: 8 },
  picker: { borderWidth: 1, borderRadius: 8, padding: 12, flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center" },
  pickerText: { textAlign: "right", flex: 1, fontSize: 14 },
  pickerArrow: { fontSize: 12, marginLeft: 8 },
  list: { gap: 8, marginTop: 4 },
  empty: { textAlign: "right", fontSize: 12, padding: 10 },
  row: { borderWidth: 1, borderRadius: 10, padding: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  rowInfo: { flex: 1, alignItems: "flex-end", paddingRight: 10 },
  rowName: { fontWeight: "700", fontSize: 14, textAlign: "right", width: "100%" },
  rowMeta: { fontSize: 11, marginTop: 3, textAlign: "right" },
  rowActions: { flexDirection: "row", gap: 6, alignItems: "center" },
  editBtn: { paddingHorizontal: 8, paddingVertical: 8, borderRadius: 8, minWidth: 36, alignItems: "center" },
  editText: { fontSize: 12 },
  delBtn: { paddingHorizontal: 8, paddingVertical: 8, borderRadius: 8, minWidth: 36, alignItems: "center" },
  delText: { fontSize: 12 },
  suggestBox: { marginTop: 4, borderWidth: 1, borderRadius: 8, overflow: "hidden", maxHeight: 200 },
  suggestItem: { padding: 10, borderBottomWidth: 1 },
  suggestName: { fontWeight: "700", textAlign: "right", fontSize: 13 },
  suggestMeta: { fontSize: 11, textAlign: "right", marginTop: 2 },
  suggestEmpty: { padding: 10, textAlign: "right", fontSize: 12 },
  buttons: { flexDirection: "row-reverse", gap: 8, marginTop: 16 },
  primary: { padding: 14, borderRadius: 10, flex: 1 },
  primaryText: { color: "#fff", fontWeight: "700", textAlign: "center" },
  cancel: { borderWidth: 1, padding: 13, borderRadius: 10 },
  cancelText: { textAlign: "center" },
  // ✅ تنسيقات النافذة المنبثقة
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", padding: 20 },
  modalContent: { width: "100%", borderRadius: 16, padding: 20, elevation: 10 },
  modalTitle: { fontSize: 20, fontFamily: "CodecBold", textAlign: "center", marginBottom: 15 },
  modalDetails: { marginBottom: 20, gap: 6 },
  modalText: { fontSize: 15, textAlign: "right", lineHeight: 22 },
  detailRow: { flexDirection: "row-reverse", justifyContent: "space-between", paddingVertical: 4, marginTop: 4 },
  detailLabel: { fontSize: 14 },
  detailValue: { fontSize: 16 },
  modalActions: { flexDirection: "row-reverse", gap: 10 },
  modalBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: "center" },
  modalBtnText: { color: "#FFF", fontWeight: "bold", fontSize: 13 },
});
