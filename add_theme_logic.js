const fs = require('fs');

// 1. تحديث ملف الألوان ليدعم الوضع الليلي
const themePath = 'src/ui/theme.ts';
if (fs.existsSync(themePath)) {
  let t = fs.readFileSync(themePath, 'utf8');
  if (!t.includes('getThemeColors')) {
    t += `
export const getThemeColors = (isDark: boolean, lightBg: string) => {
  if (isDark) {
    return {
      bg: "#0F172A",      // خلفية داكنة
      surface: "#1E293B", // البطاقات
      text: "#F8FAFC",    // النص الأساسي
      textMuted: "#94A3B8", // النص الثانوي
      border: "#334155",  // الحدود
      // الألوان الثابتة
      blue: "#3B82F6", navy: "#0B2545", orange: "#F97316",
      success: "#10B981", danger: "#EF4444",
    };
  }
  return {
    bg: lightBg || "#F1F5F9", // الخلفية النهارية
    surface: "#FFFFFF",
    text: "#0F172A",
    textMuted: "#8494B0",
    border: "#D6E3F8",
    blue: "#1E40AF", navy: "#0B2545", orange: "#F97316",
    success: "#059669", danger: "#DC2626",
  };
};
`;
    fs.writeFileSync(themePath, t);
    console.log('✅ تم تحديث theme.ts');
  }
}
