const fs = require('fs');
const path = require('path');

const walk = (dir) => {
  fs.readdirSync(dir).forEach(file => {
    const p = path.join(dir, file);
    if (fs.statSync(p).isDirectory()) {
      walk(p);
    } else if (p.endsWith('.tsx') || p.endsWith('.ts')) {
      let c = fs.readFileSync(p, 'utf8');
      let orig = c;

      // 1. إصلاح خطأ السهم -> في جميع الملفات
      c = c.split('->').join('-&gt;');

      // 2. إصلاح خطأ التكرار في TransfersScreen
      c = c.replace(/paddingBottom:\s*40,\s*paddingBottom:\s*40/g, 'paddingBottom: 40');

      // 3. إصلاح استدعاء اللوجو في CashboxesReport
      if (p.includes('CashboxesReport')) {
        c = c.replace(/import\s*{\s*LOGO_BASE64\s*}\s*from\s*["']\.\.\/\.\.\/utils\/logoBase64["'];/g, 'import { getLogoBase64 } from "../../utils/logoBase64";');
        c = c.replace(/LOGO_BASE64/g, 'await getLogoBase64()');
      }

      // 4. إصلاح خطأ الفاصلة في SettingsModule
      if (p.includes('SettingsModule')) {
         c = c.replace(/alignSelf:\s*["']flex-end["']\s*},\s*alignSelf:\s*["']flex-end["']/g, 'alignSelf: "flex-end" }');
      }

      if (c !== orig) {
        fs.writeFileSync(p, c);
        console.log('✅ Fixed:', p);
      }
    }
  });
};

walk('src');
