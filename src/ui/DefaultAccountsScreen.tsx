import { useEffect, useMemo, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import BrandBanner from "./components/BrandBanner";
import { getDefaultAccounts, saveDefaultAccounts, listAccounts } from "../sync/accounting";
import { useTheme } from "./ThemeContext";

type Row = any;

export default function DefaultAccountsScreen({ onBack }: { onBack: () => void }) {
  const { colors } = useTheme();
  const [accounts, setAccounts] = useState<Row[]>([]);
  const [saving, setSaving] = useState(false);

  const [inventoryAccount, setInventoryAccount] = useState("");
  const [inventoryLabel, setInventoryLabel] = useState("");
  const [salesRevenueAccount, setSalesRevenueAccount] = useState("");
  const [salesRevenueLabel, setSalesRevenueLabel] = useState("");
  const [cogsAccount, setCogsAccount] = useState("");
  const [cogsLabel, setCogsLabel] = useState("");
  const [commissionAccount, setCommissionAccount] = useState("");
  const [commissionLabel, setCommissionLabel] = useState("");
  const [customerAccount, setCustomerAccount] = useState("");
  const [customerLabel, setCustomerLabel] = useState("");
  const [supplierAccount, setSupplierAccount] = useState("");
  const [supplierLabel, setSupplierLabel] = useState("");
  const [purchaseAccount, setPurchaseAccount] = useState("");
  const [purchaseLabel, setPurchaseLabel] = useState("");
  const [salesReturnAccount, setSalesReturnAccount] = useState("");
  const [salesReturnLabel, setSalesReturnLabel] = useState("");
  const [purchaseReturnAccount, setPurchaseReturnAccount] = useState("");
  const [purchaseReturnLabel, setPurchaseReturnLabel] = useState("");

  const [showPicker, setShowPicker] = useState<string | null>(null);
  const [searchText, setSearchText] = useState("");

  const load = async () => {
    try {
      const accs = await listAccounts();
      setAccounts(accs || []);
      const defaults: any = await getDefaultAccounts();
      if (defaults) {
        setInventoryAccount(defaults.inventoryAccount || "");
        setInventoryLabel(accs.find((a) => a.code === defaults.inventoryAccount)?.name || "");
        setSalesRevenueAccount(defaults.salesRevenueAccount || "");
        setSalesRevenueLabel(accs.find((a) => a.code === defaults.salesRevenueAccount)?.name || "");
        setCogsAccount(defaults.cogsAccount || "");
        setCogsLabel(accs.find((a) => a.code === defaults.cogsAccount)?.name || "");
        setCommissionAccount(defaults.commissionAccount || "");
        setCommissionLabel(accs.find((a) => a.code === defaults.commissionAccount)?.name || "");
        setCustomerAccount(defaults.customerAccount || "");
        setCustomerLabel(accs.find((a) => a.code === defaults.customerAccount)?.name || "");
        setSupplierAccount(defaults.supplierAccount || "");
        setSupplierLabel(accs.find((a) => a.code === defaults.supplierAccount)?.name || "");
        setPurchaseAccount(defaults.purchaseAccount || "");
        setPurchaseLabel(accs.find((a) => a.code === defaults.purchaseAccount)?.name || "");
        setSalesReturnAccount(defaults.salesReturnAccount || "");
        setSalesReturnLabel(accs.find((a) => a.code === defaults.salesReturnAccount)?.name || "");
        setPurchaseReturnAccount(defaults.purchaseReturnAccount || "");
        setPurchaseReturnLabel(accs.find((a) => a.code === defaults.purchaseReturnAccount)?.name || "");
      }
    } catch (e) { Alert.alert("خطأ", "تعذر تحميل الحسابات"); }
  };

  useEffect(() => { void load(); }, []);

  const filteredAccounts = useMemo(() => {
    if (!searchText.trim()) return accounts;
    const q = searchText.toLowerCase();
    return accounts.filter((a) => `${a.code ?? ""} ${a.name ?? ""}`.toLowerCase().includes(q));
  }, [accounts, searchText]);

  const save = async () => {
    setSaving(true);
    try {
      await saveDefaultAccounts({
        inventoryAccount: inventoryAccount || undefined,
        salesRevenueAccount: salesRevenueAccount || undefined,
        cogsAccount: cogsAccount || undefined,
        commissionAccount: commissionAccount || undefined,
        customerAccount: customerAccount || undefined,
        supplierAccount: supplierAccount || undefined,
        purchaseAccount: purchaseAccount || undefined,
        salesReturnAccount: salesReturnAccount || undefined,
        purchaseReturnAccount: purchaseReturnAccount || undefined,
      });
      Alert.alert("نجاح", "تم حفظ الحسابات الافتراضية بنجاح!");
    } catch (e) {
      Alert.alert("خطأ", String(e));
    } finally {
      setSaving(false);
    }
  };

  const renderPicker = (title: string, currentCode: string, currentLabel: string, onSelect: (code: string, label: string) => void, pickerKey: string) => {
    const isShowing = showPicker === pickerKey;
    return (
      <View style={{ marginBottom: 15 }}>
        <Text style={[styles.label, { color: colors.textMuted }]}>{title}</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
          value={isShowing ? searchText : currentLabel}
          onChangeText={(t) => { setSearchText(t); setShowPicker(pickerKey); }}
          onFocus={() => { setSearchText(""); setShowPicker(pickerKey); }}
          onBlur={() => setTimeout(() => setShowPicker(null), 200)}
          placeholder="ابحث عن الحساب..."
          placeholderTextColor={colors.textMuted}
          textAlign="right"
        />
        {isShowing && (
          <ScrollView style={[styles.suggestBox, { maxHeight: 200, backgroundColor: colors.surface, borderColor: colors.border }]} nestedScrollEnabled keyboardShouldPersistTaps="always">
            {filteredAccounts.length === 0 ? (
              <Text style={[styles.suggestEmpty, { color: colors.textMuted }]}>لا توجد حسابات مطابقة</Text>
            ) : (
              filteredAccounts.map((a) => (
                <Pressable android_ripple={{ color: "rgba(0,0,0,0.1)" }} key={a.code} style={[styles.suggestItem, { borderBottomColor: colors.bg }]} onPressIn={() => { onSelect(a.code, a.name); setShowPicker(null); }}>
                  <Text style={[styles.suggestName, { color: colors.text }]}>{a.name}</Text>
                  <Text style={[styles.suggestMeta, { color: colors.textMuted }]}>{a.code}</Text>
                </Pressable>
              ))
            )}
          </ScrollView>
        )}
      </View>
    );
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <Pressable android_ripple={{ color: "rgba(0,0,0,0.1)" }} style={styles.back} onPress={onBack}>
          <Text style={[styles.backText, { color: colors.blue }]}>‹ العودة إلى الوحدات المحاسبية</Text>
        </Pressable>

        <BrandBanner />
        <Text style={[styles.screenTitle, { color: colors.text }]}>الحسابات الافتراضية</Text>
        <Text style={[styles.hint, { color: colors.textMuted }]}>
          ربط الحسابات هنا يسمح للنظام بإنشاء القيود المحاسبية تلقائياً عند إجراء العمليات (مثل البيع والشراء).
        </Text>

        {renderPicker("حساب المخزون (Inventory)", inventoryAccount, inventoryLabel, (c, l) => { setInventoryAccount(c); setInventoryLabel(l); }, "inventory")}
        {renderPicker("حساب إيرادات المبيعات (Sales Revenue)", salesRevenueAccount, salesRevenueLabel, (c, l) => { setSalesRevenueAccount(c); setSalesRevenueLabel(l); }, "sales")}
        {renderPicker("حساب تكلفة المبيعات (COGS)", cogsAccount, cogsLabel, (c, l) => { setCogsAccount(c); setCogsLabel(l); }, "cogs")}
        {renderPicker("حساب عمولات المناديب (Commission)", commissionAccount, commissionLabel, (c, l) => { setCommissionAccount(c); setCommissionLabel(l); }, "commission")}
        {renderPicker("حساب العملاء", customerAccount, customerLabel, (c, l) => { setCustomerAccount(c); setCustomerLabel(l); }, "customer")}
        {renderPicker("حساب الموردين", supplierAccount, supplierLabel, (c, l) => { setSupplierAccount(c); setSupplierLabel(l); }, "supplier")}
        {renderPicker("حساب المشتريات", purchaseAccount, purchaseLabel, (c, l) => { setPurchaseAccount(c); setPurchaseLabel(l); }, "purchase")}
        {renderPicker("حساب مردودات المبيعات", salesReturnAccount, salesReturnLabel, (c, l) => { setSalesReturnAccount(c); setSalesReturnLabel(l); }, "salesReturn")}
        {renderPicker("حساب مردودات المشتريات", purchaseReturnAccount, purchaseReturnLabel, (c, l) => { setPurchaseReturnAccount(c); setPurchaseReturnLabel(l); }, "purchaseReturn")}

        <Pressable android_ripple={{ color: "rgba(0,0,0,0.1)" }} style={[styles.primary, { backgroundColor: colors.orange }]} onPress={save} disabled={saving}>
          <Text style={styles.primaryText}>{saving ? "جارٍ الحفظ..." : "حفظ الإعدادات"}</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: { backgroundColor: "transparent", paddingHorizontal: 16, paddingTop: 20, paddingBottom: 40 },
  back: { paddingVertical: 10, alignSelf: "flex-start", marginBottom: 8 },
  backText: { textAlign: "left", fontWeight: "700" },
  screenTitle: { fontSize: 22, marginBottom: 6, textAlign: "left", width: "100%", fontFamily: "CodecBold" },
  hint: { fontSize: 12, marginBottom: 20, lineHeight: 18, textAlign: "left", width: "100%" },
  label: { fontSize: 12, marginBottom: 5, fontWeight: "700", textAlign: "right", width: "100%" },
  input: { borderWidth: 1.2, borderRadius: 12, padding: 13, fontSize: 14, fontWeight: "600", textAlign: "right", width: "100%" },
  primary: { paddingVertical: 16, borderRadius: 14, alignItems: "center", marginTop: 22, elevation: 5 },
  primaryText: { color: "#FFFFFF", fontWeight: "800", fontSize: 16 },
  suggestBox: { marginTop: 6, borderWidth: 1.2, borderRadius: 12, overflow: "hidden", maxHeight: 200 },
  suggestItem: { padding: 12, borderBottomWidth: 1 },
  suggestName: { fontWeight: "700", textAlign: "right", fontSize: 13 },
  suggestMeta: { fontSize: 11, textAlign: "right", marginTop: 2 },
  suggestEmpty: { padding: 12, textAlign: "right", fontSize: 12 },
});
