import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// 🚀 دالة الألوان
export const getThemeColors = (isDark: boolean, lightBg: string) => {
  if (isDark) {
    return {
      bg: "#0F172A", surface: "#1E293B", text: "#F8FAFC",
      textMuted: "#94A3B8", border: "#334155",
      blue: "#3B82F6", navy: "#0B2545", orange: "#F97316",
      success: "#10B981", danger: "#EF4444",
    };
  }
  return {
    bg: lightBg || "#F1F5F9", surface: "#FFFFFF", text: "#0F172A",
    textMuted: "#8494B0", border: "#D6E3F8",
    blue: "#1E40AF", navy: "#0B2545", orange: "#F97316",
    success: "#059669", danger: "#DC2626",
  };
};

const ThemeContext = createContext<any>(null);

export const ThemeProvider = ({ children }: any) => {
  const [isDark, setIsDark] = useState(false);
  const [lightBg, setLightBg] = useState("#F1F5F9");
  
  const loadTheme = async () => {
    try {
      const raw = await AsyncStorage.getItem('flux_settings_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        setIsDark(parsed.darkMode || false);
        setLightBg(parsed.lightBgColor || "#F1F5F9");
      }
    } catch (e) { console.log("Theme load error:", e); }
  };

  useEffect(() => { loadTheme(); }, []);

  const colors = getThemeColors(isDark, lightBg);

  return (
    <ThemeContext.Provider value={{ isDark, colors, reloadTheme: loadTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
