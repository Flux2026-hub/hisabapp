const fs = require('fs');

const files = [
  'src/ui/CustomersScreen.tsx',
  'src/ui/CashboxesScreen.tsx',
  'src/ui/ItemsScreen.tsx',
  'src/ui/AccountsScreen.tsx',
  'src/ui/CurrenciesScreen.tsx',
  'src/ui/SalesRepsScreen.tsx',
  'src/ui/SalesInvoiceScreen.tsx',
  'src/ui/PurchaseInvoiceScreen.tsx',
  'src/ui/TransfersScreen.tsx',
  'src/ui/JournalScreen.tsx',
  'src/ui/ProductRecipeScreen.tsx',
  'src/ui/ProductionOrderScreen.tsx'
];

files.forEach(p => {
  if (!fs.existsSync(p)) return;
  let c = fs.readFileSync(p, 'utf8');
  let orig = c;

  // 1. إضافة الاستدعاء (Import)
  if (!c.includes('useToast')) {
    const lines = c.split('\n');
    let lastImport = -1;
    for (let i = lines.length - 1; i >= 0; i--) {
      if (lines[i].trim().startsWith('import ')) {
        lastImport = i;
        break;
      }
    }
    if (lastImport !== -1) {
      lines.splice(lastImport + 1, 0, 'import { useToast } from "./ToastContext";');
      c = lines.join('\n');
    }
  }

  // 2. إضافة الهوك (Hook)
  if (!c.includes('const { showToast } = useToast();')) {
    const match = c.match(/export default function\s+\w+\s*\([^)]*\)\s*\{/);
    if (match) {
      c = c.replace(match[0], match[0] + '\n  const { showToast } = useToast();\n');
    }
  }

  // 3. تحويل رسائل النجاح إلى إشعارات
  c = c.replace(/Alert\.alert\(\s*"تم الحفظ"\s*,\s*(.+?)\);/gs, 'showToast($1, "success");');
  c = c.replace(/Alert\.alert\(\s*"تم التعديل"\s*,\s*(.+?)\);/gs, 'showToast($1, "success");');
  c = c.replace(/Alert\.alert\(\s*"تم الحذف"\s*,\s*(.+?)\);/gs, 'showToast($1, "success");');

  if (c !== orig) {
    fs.writeFileSync(p, c);
    console.log('✅ Updated:', p);
  }
});
