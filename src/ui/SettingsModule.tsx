import { useEffect, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { COLORS } from "./theme";
import { clearSettingsCache } from "../utils/getSettings";
import { exportBackup, pickBackupFile, restoreBackup } from "../utils/backup";

const STORAGE_KEY = "flux_settings_v1";

type Tab = "company" | "invoices" | "reports";

type Settings = {
  // معلومات الشركة
  companyNameAr: string;
  companyNameEn: string;
  companyPhone1: string;
  companyPhone2: string;
  companyEmail: string;
  companyWebsite: string;
  companyAddress: string;
  taxNumber: string;
  commercialRegister: string;

  // إعدادات الفواتير
  invoiceHeaderTitle: string;
  invoiceFooterText: string;
  showLogo: boolean;
  showQR: boolean;
  showSignatures: boolean;
  signatureRight: string;
  signatureLeft: string;

  // إعدادات التقارير
  reportHeaderTitle: string;
  reportFooterText: string;
  reportShowLogo: boolean;
};

const DEFAULT_SETTINGS: Settings = {
  companyNameAr: "فلوكس",
  companyNameEn: "Flux",
  companyPhone1: "",
  companyPhone2: "",
  companyEmail: "",
  companyWebsite: "",
  companyAddress: "",
  taxNumber: "",
  commercialRegister: "",

  invoiceHeaderTitle: "فاتورة",
  invoiceFooterText: "شكراً لتعاملكم معنا",
  showLogo: true,
  showQR: false,
  showSignatures: true,
  signatureRight: "توقيع المستلم",
  signatureLeft: "توقيع البائع",

  reportHeaderTitle: "فلوكس",
  reportFooterText: "نظام فلوكس المحاسبي",
  reportShowLogo: true,
};

export default function SettingsModule({ onBack }: { onBack?: () => void }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [activeTab, setActiveTab] = useState<Tab>("company");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          setSettings({ ...DEFAULT_SETTINGS, ...parsed });
        }
      } catch (e) {
        console.log("Failed to load settings", e);
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  const update = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const save = async () => {
    setSaving(true);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      clearSettingsCache();
      Alert.alert("تم الحفظ", "تم حفظ الإعدادات بنجاح");
    } catch (e) {
      Alert.alert("خطأ", "تعذر الحفظ: " + String(e));
    } finally {
      setSaving(false);
    }
  };

  const handleExport = async () => {
    try {
      const result = await exportBackup();
      if (result.success) {
        Alert.alert("تم التصدير", "تم إنشاء النسخة الاحتياطية ومشاركتها بنجاح");
      } else if (result.error !== "تم الإلغاء") {
        Alert.alert("خطأ", result.error || "تعذر التصدير");
      }
    } catch (e) {
      Alert.alert("خطأ", String(e));
    }
  };

  const handleRestore = () => {
    Alert.alert(
      "تحذير",
      "الاستعادة ستستبدل جميع البيانات الحالية بالبيانات الموجودة في الملف.\n\nهل أنت متأكد؟",
      [
        { text: "إلغاء", style: "cancel" },
        {
          text: "متابعة",
          style: "destructive",
          onPress: async () => {
            try {
              const picked = await pickBackupFile();
              if (!picked.success || !picked.backup) {
                if (picked.error !== "تم الإلغاء") {
                  Alert.alert("خطأ", picked.error || "تعذر قراءة الملف");
                }
                return;
              }
              const result = await restoreBackup(picked.backup);
              if (result.success) {
                Alert.alert("تمت الاستعادة", "تم استيراد " + result.restored + " سجلاً بنجاح");
              } else {
                Alert.alert("خطأ", result.error || "تعذر الاستعادة");
              }
            } catch (e) {
              Alert.alert("خطأ", String(e));
            }
          },
        },
      ]
    );
  };

  const reset = () => {
    Alert.alert(
      "إعادة تعيين",
      "هل تريد إرجاع كل الإعدادات للقيم الافتراضية؟",
      [
        { text: "إلغاء", style: "cancel" },
        {
          text: "إعادة تعيين",
          style: "destructive",
          onPress: async () => {
            setSettings(DEFAULT_SETTINGS);
            await AsyncStorage.removeItem(STORAGE_KEY);
            clearSettingsCache();
            Alert.alert("تم", "تم إرجاع الإعدادات الافتراضية");
          },
        },
      ]
    );
  };

  if (!loaded) {
    return (
      <View style={styles.loadingWrap}>
        <Text style={styles.loadingText}>جارٍ التحميل...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets={true}
      >
        {onBack && (
          <Pressable style={styles.back} onPress={onBack}>
            <Text style={styles.backText}>العودة -></Text>
          </Pressable>
        )}

        <Text style={styles.screenTitle}>إعدادات النظام</Text>
        <Text style={styles.hint}>
          تظهر هذه الإعدادات في ترويسة الفواتير والتقارير المطبوعة
        </Text>

        <View style={styles.tabs}>
          <Pressable
            style={[styles.tab, activeTab === "company" && styles.tabActive]}
            onPress={() => setActiveTab("company")}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === "company" && styles.tabTextActive,
              ]}
            >
              معلومات الشركة
            </Text>
          </Pressable>
          <Pressable
            style={[styles.tab, activeTab === "invoices" && styles.tabActive]}
            onPress={() => setActiveTab("invoices")}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === "invoices" && styles.tabTextActive,
              ]}
            >
              الفواتير
            </Text>
          </Pressable>
          <Pressable
            style={[styles.tab, activeTab === "reports" && styles.tabActive]}
            onPress={() => setActiveTab("reports")}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === "reports" && styles.tabTextActive,
              ]}
            >
              التقارير
            </Text>
          </Pressable>
        </View>

        {activeTab === "company" && (
          <View>
            <Text style={styles.sectionLabel}>الهوية</Text>
            <Field
              label="اسم الشركة (عربي)"
              value={settings.companyNameAr}
              onChange={(v) => update("companyNameAr", v)}
              placeholder="فلوكس"
            />
            <Field
              label="اسم الشركة (إنجليزي)"
              value={settings.companyNameEn}
              onChange={(v) => update("companyNameEn", v)}
              placeholder="Flux"
            />

            <Text style={styles.sectionLabel}>التواصل</Text>
            <Field
              label="الهاتف الأول"
              value={settings.companyPhone1}
              onChange={(v) => update("companyPhone1", v)}
              placeholder="+967 7xx xxx xxx"
              keyboardType="phone-pad"
            />
            <Field
              label="الهاتف الثاني"
              value={settings.companyPhone2}
              onChange={(v) => update("companyPhone2", v)}
              placeholder="+967 7xx xxx xxx"
              keyboardType="phone-pad"
            />
            <Field
              label="البريد الإلكتروني"
              value={settings.companyEmail}
              onChange={(v) => update("companyEmail", v)}
              placeholder="info@flux.com"
              keyboardType="email-address"
            />
            <Field
              label="الموقع الإلكتروني"
              value={settings.companyWebsite}
              onChange={(v) => update("companyWebsite", v)}
              placeholder="www.flux.com"
            />
            <Field
              label="العنوان"
              value={settings.companyAddress}
              onChange={(v) => update("companyAddress", v)}
              placeholder="صنعاء - شارع xxx"
              multiline
            />

            <Text style={styles.sectionLabel}>بيانات رسمية</Text>
            <Field
              label="الرقم الضريبي"
              value={settings.taxNumber}
              onChange={(v) => update("taxNumber", v)}
              placeholder="اختياري"
            />
            <Field
              label="السجل التجاري"
              value={settings.commercialRegister}
              onChange={(v) => update("commercialRegister", v)}
              placeholder="اختياري"
            />

            <Text style={styles.sectionLabel}>النسخ الاحتياطي</Text>
            <Text style={styles.backupHint}>احفظ نسخة من كل بياناتك في ملف واحد يمكن استعادته لاحقاً.</Text>
            <Pressable style={styles.backupBtn} onPress={handleExport}>
              <Text style={styles.backupBtnText}>📤 تصدير نسخة احتياطية</Text>
            </Pressable>
            <Pressable style={styles.restoreBtn} onPress={handleRestore}>
              <Text style={styles.restoreBtnText}>📥 استعادة نسخة احتياطية</Text>
            </Pressable>
          </View>
        )}

        {activeTab === "invoices" && (
          <View>
            <Text style={styles.sectionLabel}>الترويسة والتذييل</Text>
            <Field
              label="عنوان ترويسة الفاتورة"
              value={settings.invoiceHeaderTitle}
              onChange={(v) => update("invoiceHeaderTitle", v)}
              placeholder="فاتورة مبيعات"
            />
            <Field
              label="نص تذييل الفاتورة"
              value={settings.invoiceFooterText}
              onChange={(v) => update("invoiceFooterText", v)}
              placeholder="شكراً لتعاملكم معنا"
              multiline
            />

            <Text style={styles.sectionLabel}>عناصر مرئية</Text>
            <SwitchRow
              label="إظهار اللوجو في الفاتورة"
              value={settings.showLogo}
              onChange={(v) => update("showLogo", v)}
            />
            <SwitchRow
              label="إظهار رمز QR للتحقق"
              value={settings.showQR}
              onChange={(v) => update("showQR", v)}
            />
            <SwitchRow
              label="إظهار التوقيعات"
              value={settings.showSignatures}
              onChange={(v) => update("showSignatures", v)}
            />

            <Text style={styles.sectionLabel}>التوقيعات</Text>
            <Field
              label="نص التوقيع الأيمن"
              value={settings.signatureRight}
              onChange={(v) => update("signatureRight", v)}
              placeholder="توقيع المستلم"
            />
            <Field
              label="نص التوقيع الأيسر"
              value={settings.signatureLeft}
              onChange={(v) => update("signatureLeft", v)}
              placeholder="توقيع البائع"
            />
          </View>
        )}

        {activeTab === "reports" && (
          <View>
            <Text style={styles.sectionLabel}>الترويسة والتذييل</Text>
            <Field
              label="عنوان ترويسة التقرير"
              value={settings.reportHeaderTitle}
              onChange={(v) => update("reportHeaderTitle", v)}
              placeholder="فلوكس"
            />
            <Field
              label="نص تذييل التقرير"
              value={settings.reportFooterText}
              onChange={(v) => update("reportFooterText", v)}
              placeholder="نظام فلوكس المحاسبي"
              multiline
            />

            <Text style={styles.sectionLabel}>عناصر مرئية</Text>
            <SwitchRow
              label="إظهار اللوجو في التقرير"
              value={settings.reportShowLogo}
              onChange={(v) => update("reportShowLogo", v)}
            />
          </View>
        )}

        <View style={styles.buttons}>
          <Pressable
            style={[styles.primary, saving && styles.disabled]}
            onPress={save}
            disabled={saving}
          >
            <Text style={styles.primaryText}>
              {saving ? "جارٍ الحفظ..." : "حفظ الإعدادات"}
            </Text>
          </Pressable>
          <Pressable style={styles.secondary} onPress={reset}>
            <Text style={styles.secondaryText}>إعادة تعيين</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  keyboardType,
  multiline,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  keyboardType?: any;
  multiline?: boolean;
}) {
  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.inputMultiline]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={COLORS.textMuted}
        keyboardType={keyboardType || "default"}
        textAlign="right"
        multiline={!!multiline}
      />
    </View>
  );
}

function SwitchRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.switchRow}>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: "#CBD5E1", true: COLORS.orange }}
        thumbColor="#FFF"
      />
      <Text style={styles.switchLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  loadingText: { color: COLORS.textMuted, fontSize: 14 },
  scrollContent: { paddingBottom: 40, paddingHorizontal: 8 },
  back: {  paddingVertical: 10 }, alignSelf: "flex-end",
  backText: {
     color: COLORS.blue, textAlign: "right",
    fontWeight: "800",
    textAlign: "right",
    fontSize: 13,
  },
  screenTitle: { 
    fontSize: 22,
    fontWeight: "800",
    color: COLORS.text,
    textAlign: "right",
    marginBottom: 4,
, fontFamily: "Alexandria-Regular" },
  hint: {
    fontSize: 12,
    color: COLORS.textMuted,
    textAlign: "right",
    marginBottom: 14,
    lineHeight: 18,
  },
  tabs: {
    flexDirection: "row-reverse",
    gap: 6,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 10,
    borderWidth: 1.2,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    alignItems: "center",
  },
  tabActive: {
    backgroundColor: COLORS.blue,
    borderColor: COLORS.blue,
  },
  tabText: {
    fontSize: 12,
    color: COLORS.text,
    fontWeight: "700",
    textAlign: "center",
  },
  tabTextActive: { color: "#FFF", fontWeight: "800" },
  sectionLabel: {
    fontSize: 14,
    fontWeight: "800",
    color: COLORS.blue,
    textAlign: "right",
    marginTop: 18,
    marginBottom: 8,
  },
  label: {
    fontSize: 12,
    color: COLORS.textMuted,
    textAlign: "right",
    marginTop: 10,
    marginBottom: 5,
    fontWeight: "700",
  },
  input: {
    backgroundColor: COLORS.surface,
    borderWidth: 1.2,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: COLORS.text,
  },
  inputMultiline: { minHeight: 70, textAlignVertical: "top" },
  switchRow: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderWidth: 1.2,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
  },
  switchLabel: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: "700",
    flex: 1,
    textAlign: "right",
    marginRight: 10,
  },
  backupHint: {
    fontSize: 12,
    color: COLORS.textMuted,
    textAlign: "right",
    marginBottom: 12,
    lineHeight: 18,
  },
  backupBtn: {
    backgroundColor: COLORS.blue,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 10,
  },
  backupBtnText: { color: "#FFF", fontWeight: "800", fontSize: 14 },
  restoreBtn: {
    backgroundColor: "#FFF",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: COLORS.orange,
  },
  restoreBtnText: { color: COLORS.orange, fontWeight: "800", fontSize: 14 },
  buttons: { marginTop: 24, gap: 10 },
  primary: {
    backgroundColor: COLORS.orange,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    shadowColor: COLORS.orange,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 5,
  },
  primaryText: { color: "#FFF", fontWeight: "800", fontSize: 16 },
  secondary: {
    backgroundColor: COLORS.surface,
    borderWidth: 1.2,
    borderColor: COLORS.danger,
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: "center",
  },
  secondaryText: { color: COLORS.danger, fontWeight: "800", fontSize: 14 },
  disabled: { opacity: 0.5 },
});
