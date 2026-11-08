const fs = require('fs');
let code = fs.readFileSync('src/utils/telegram.ts', 'utf8');

// 1. إضافة الاستيراد
if (!code.includes('import * as Print')) {
  code = code.replace(
    'import * as FileSystem from "expo-file-system/legacy";',
    'import * as FileSystem from "expo-file-system/legacy";\nimport * as Print from "expo-print";'
  );
}

// 2. إضافة الكود قبل "else if (parsed.intent === "create_customer""
const statementHandler = `
    else if (parsed.intent === "query_customer_statement" && parsed.partyName) {
      try {
        await sendTelegramMessage("⏳ جاري إعداد كشف الحساب...");
        
        // 1. البحث عن العميل
        const cust: any = await sqlite.getFirstAsync("SELECT id, name, balance, phone FROM customers WHERE name LIKE ? LIMIT 1", [\`%\${parsed.partyName}%\`]);
        if (!cust) {
          await sendTelegramMessage(\`❌ لم يتم العثور على العميل "\${parsed.partyName}"\`);
          return;
        }

        // 2. جلب الفواتير والسندات
        const invoices: any = await sqlite.getAllAsync("SELECT id, invoice_no, total, created_at, invoice_type FROM invoices WHERE party_id = ? ORDER BY created_at ASC", [cust.id]);
        const vouchers: any = await sqlite.getAllAsync("SELECT id, voucher_no, amount, created_at, voucher_type FROM vouchers WHERE party_id = ? ORDER BY created_at ASC", [cust.id]);

        // 3. دمج الحركات وترتيبها
        const transactions: any[] = [];
        invoices.forEach((inv) => {
          transactions.push({
            date: new Date(inv.created_at).toLocaleDateString('ar-YE'),
            ref: inv.invoice_no,
            type: inv.invoice_type === 'sales' ? 'فاتورة مبيعات' : 'فاتورة مشتريات',
            debit: inv.invoice_type === 'sales' ? Number(inv.total) : 0, // العميل مدين
            credit: inv.invoice_type === 'purchase' ? Number(inv.total) : 0,
          });
        });
        vouchers.forEach((v) => {
          transactions.push({
            date: new Date(v.created_at).toLocaleDateString('ar-YE'),
            ref: v.voucher_no,
            type: v.voucher_type === 'receipt' ? 'سند قبض' : 'سند دفع',
            debit: v.voucher_type === 'payment' ? Number(v.amount) : 0,
            credit: v.voucher_type === 'receipt' ? Number(v.amount) : 0,
          });
        });

        transactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        // 4. بناء جدول HTML
        const rowsHtml = transactions.map(t => \`
          <tr>
            <td>\${t.date}</td>
            <td>\${t.ref}</td>
            <td>\${t.type}</td>
            <td>\${t.debit > 0 ? t.debit.toFixed(2) : '-'}</td>
            <td>\${t.credit > 0 ? t.credit.toFixed(2) : '-'}</td>
          </tr>
        \`).join('');

        const html = \`
          <html>
            <head>
              <meta charset="utf-8">
              <style>
                body { font-family: 'Cairo', sans-serif; direction: rtl; padding: 20px; }
                h1 { text-align: center; color: #0B2545; }
                .header { text-align: center; margin-bottom: 30px; }
                .info { margin-bottom: 20px; font-size: 14px; }
                table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
                th, td { border: 1px solid #CBD5E1; padding: 8px; text-align: right; }
                th { background-color: #F1F5F9; color: #0B2545; }
                .total { font-size: 18px; font-weight: bold; text-align: left; margin-top: 20px; color: #0B2545; }
              </style>
            </head>
            <body>
              <div class="header">
                <h1>فلوكس - كشف حساب</h1>
                <p>لأنابيب أكثر نظافة</p>
              </div>
              <div class="info">
                <p><strong>العميل:</strong> \${cust.name}</p>
                <p><strong>الهاتف:</strong> \${cust.phone || 'غير مسجل'}</p>
                <p><strong>تاريخ الكشف:</strong> \${new Date().toLocaleDateString('ar-YE')}</p>
              </div>
              <table>
                <thead>
                  <tr>
                    <th>التاريخ</th>
                    <th>المرجع</th>
                    <th>البيان</th>
                    <th>مدين (عليه)</th>
                    <th>دائن (له)</th>
                  </tr>
                </thead>
                <tbody>
                  \${rowsHtml}
                </tbody>
              </table>
              <div class="total">
                الرصيد الحالي: \${Number(cust.balance).toFixed(2)} YER
              </div>
            </body>
          </html>
        \`;

        // 5. إنشاء الـ PDF وإرساله
        const { uri } = await Print.printToFileAsync({ html });
        const filename = \`كشف-حساب-\${cust.name}-\${new Date().toISOString().slice(0,10)}.pdf\`;
        
        // نسخ الملف باسم مقروء
        const newUri = FileSystem.cacheDirectory + filename;
        await FileSystem.copyAsync({ from: uri, to: newUri });
        
        // إرسال الملف عبر تليجرام
        await sendTelegramDocument(newUri, filename, \`📊 كشف حساب العميل: \${cust.name}\\n💰 الرصيد الحالي: \${Number(cust.balance).toFixed(2)} YER\`);

      } catch (err) {
        await sendTelegramMessage(\`❌ خطأ في إعداد كشف الحساب: \${err instanceof Error ? err.message : String(err)}\`);
      }
    }
`;

// إدخال كود كشف الحساب قبل "create_customer"
const marker = 'else if (parsed.intent === "create_customer"';
if (!code.includes('parsed.intent === "query_customer_statement"')) {
  code = code.replace(marker, statementHandler + '\n    ' + marker);
  fs.writeFileSync('src/utils/telegram.ts', code);
  console.log("✅ تم إضافة كود كشف الحساب (PDF) بنجاح!");
} else {
  console.log("⚠️ كود كشف الحساب موجود بالفعل.");
}
