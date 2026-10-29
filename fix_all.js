const fs = require('fs');
const path = require('path');

function walk(dir) {
  fs.readdirSync(dir).forEach(file => {
    const p = path.join(dir, file);
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (p.endsWith('.tsx')) {
      let c = fs.readFileSync(p, 'utf8');
      let changed = false;
      
      // 1. إصلاح خطأ الرمز ->
      if (c.includes('->')) {
        c = c.split('->').join('-&gt;');
        changed = true;
      }
      
      // 2. إصلاح ملف ReportActions
      if (p.includes('ReportActions.tsx') && c.includes('from "expo-file-system";')) {
        c = c.replace('from "expo-file-system";', 'from "expo-file-system/legacy";');
        changed = true;
      }
      
      if (changed) {
        fs.writeFileSync(p, c);
        console.log('✅ تم إصلاح:', p);
      }
    }
  });
}
walk('src');

// 3. تنظيف ملف CashboxesReport من التكرار
const cbFile = 'src/ui/reports/CashboxesReport.tsx';
let cbContent = fs.readFileSync(cbFile, 'utf8');
cbContent = cbContent.replace('EOFimport', 'import');

const parts = cbContent.split('import { useEffect, useMemo, useState } from "react";');
if (parts.length > 2) {
  // الاحتفاظ بالنسخة الأخيرة (النسخة الصحيحة) وحذف القديمة
  cbContent = 'import { useEffect, useMemo, useState } from "react";' + parts[parts.length - 1];
  fs.writeFileSync(cbFile, cbContent);
  console.log('✅ تم تنظيف التكرار في: CashboxesReport.tsx');
}
