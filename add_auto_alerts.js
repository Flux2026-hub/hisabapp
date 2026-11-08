const fs = require('fs');
let code = fs.readFileSync('src/ui/SalesInvoiceScreen.tsx', 'utf8');

// 1. إضافة الاستيرادات
if (!code.includes('from "../utils/telegram"')) {
  code = code.replace(
    'import SalesItemPicker from "./components/SalesItemPicker";',
    'import SalesItemPicker from "./components/SalesItemPicker";\nimport { sendTelegramMessage } from "../utils/telegram";'
  );
}

// 2. إضافة دالة التنبيهات
const alertFunction = `
  const sendAutoAlerts = async (invoiceTotal: number, currencySymbol: string, linesToCheck: any[]) => {
    try {
      // 1. تنبيه الفاتورة الكبيرة (أكثر من 50,000 ريال يمني أو ما يعادلها)
      const threshold = 50000;
      const baseCur = currencies.find(c => c.isBase);
      const currentRate = baseCur?.code === currency?.code ? 1 : (Number(currency?.exchangeRate) || 1);
      const baseTotal = invoiceTotal * currentRate;

      if (baseTotal >= threshold) {
        await sendTelegramMessage(\`🚨 <b>تنبيه: فاتورة كبيرة!</b>\\n👤 العميل: \${customer?.name || 'غير محدد'}\\n💰 المبلغ: \${invoiceTotal.toFixed(2)} \${currencySymbol}\\n🧾 رقم الفاتورة: \${editingNo || 'جديدة'}\`);
      }

      // 2. تنبيه نقص المخزون (أقل من 5 وحدات)
      for (const line of linesToCheck) {
        const item: any = await sqlite.getFirstAsync("SELECT name, stock_quantity, unit FROM items WHERE id = ?", [line.itemId]);
        if (item && Number(item.stock_quantity) <= 5) {
          await sendTelegramMessage(\`⚠️ <b>تنبيه: نقص مخزون!</b>\\n📦 الصنف: \${item.name}\\n🔢 المتبقي: \${Number(item.stock_quantity)} \${item.unit || ''}\\n(بعد بيع \${line.quantity})\`);
        }
      }
    } catch (e) {
      console.log("Auto alerts error:", e);
    }
  };
`;

// إدخال الدالة قبل دالة `doSave`
const marker = '  const doSave = async () => {';
if (!code.includes('sendAutoAlerts')) {
  code = code.replace(marker, alertFunction + '\n' + marker);
}

// 3. استدعاء الدالة بعد حفظ الفاتورة بنجاح
const successMarker = `      setCustomer(null); setCustomerSearch(""); setLines([]); setNotes(""); setSalesRep(null); setDiscountValue(""); setDiscountType("percent"); setEditingId(null); setEditingNo(null); setDateStr(new Date().toISOString().slice(0, 10)); if (paymentType === "cash") setCashbox(null);`;
if (code.includes(successMarker) && !code.includes('sendAutoAlerts(total')) {
  code = code.replace(
    successMarker,
    successMarker + `\n      sendAutoAlerts(total, currency.symbol || currency.code, lines).catch(console.error);`
  );
}

fs.writeFileSync('src/ui/SalesInvoiceScreen.tsx', code);
console.log("✅ تم إضافة التنبيهات التلقائية (المخزون + الفواتير الكبيرة)!");
