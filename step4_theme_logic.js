const fs = require('fs');
const themePath = 'src/ui/theme.ts';
if (fs.existsSync(themePath)) {
  let t = fs.readFileSync(themePath, 'utf8');
  if (!t.includes('getThemeColors')) {
    t += `
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
`;
    fs.writeFileSync(themePath, t);
  }
}
console.log('✅ الخطوة 4: تم إضافة منطق الألوان');
