import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "flux_settings_v1";

export type AppSettings = {
  companyNameAr: string;
  companyNameEn: string;
  companyPhone1: string;
  companyPhone2: string;
  companyEmail: string;
  companyWebsite: string;
  companyAddress: string;
  taxNumber: string;
  commercialRegister: string;
  invoiceHeaderTitle: string;
  invoiceFooterText: string;
  showLogo: boolean;
  showQR: boolean;
  showSignatures: boolean;
  signatureRight: string;
  signatureLeft: string;
  reportHeaderTitle: string;
  reportFooterText: string;
  reportShowLogo: boolean;
};

export const DEFAULT_SETTINGS: AppSettings = {
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

let cache: AppSettings | null = null;

export async function getSettings(): Promise<AppSettings> {
  if (cache) return cache;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      cache = { ...DEFAULT_SETTINGS, ...parsed };
    } else {
      cache = DEFAULT_SETTINGS;
    }
  } catch {
    cache = DEFAULT_SETTINGS;
  }
  return cache!;
}

export function clearSettingsCache() {
  cache = null;
}
