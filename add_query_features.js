const fs = require('fs');
let code = fs.readFileSync('src/utils/telegram.ts', 'utf8');

const queryHandlers = `
    else if (parsed.intent === "query_customer_balance" && parsed.partyName) {
      try {
        const cust: any = await sqlite.getFirstAsync("SELECT name, balance FROM customers WHERE name LIKE ? LIMIT 1", [\`%\${parsed.partyName}%\`]);
        if (cust) {
          let sarRate = 140;
          try {
            const cur: any = await sqlite.getFirstAsync("SELECT exchange_rate FROM currencies WHERE code = 'SAR'");
            if (cur?.exchange_rate) sarRate = Number(cur.exchange_rate);
          } catch(e) {}
          
          const bal = Number(cust.balance);
          await sendTelegramMessage(\`👤 العميل: \${cust.name}\\n💰 الرصيد الحالي: \${bal.toFixed(2)} YER\\n≈ \${(bal / sarRate).toFixed(2)} SAR\`);
        } else {
          await sendTelegramMessage(\`❌ لم يتم العثور على العميل "\${parsed.partyName}"\`);
        }
      } catch (err) {
        await sendTelegramMessage(\`❌ خطأ في جلب رصيد العميل\`);
      }
    }
    else if (parsed.intent === "query_last_payment" && parsed.partyName) {
      try {
        const cust: any = await sqlite.getFirstAsync("SELECT id, name FROM customers WHERE name LIKE ? LIMIT 1", [\`%\${parsed.partyName}%\`]);
        if (cust) {
          const lastVoucher: any = await sqlite.getFirstAsync("SELECT amount, created_at, description FROM vouchers WHERE party_id = ? AND voucher_type = 'receipt' ORDER BY created_at DESC LIMIT 1", [cust.id]);
          if (lastVoucher) {
            const date = new Date(lastVoucher.created_at).toLocaleDateString('ar-YE');
            await sendTelegramMessage(\`👤 العميل: \${cust.name}\\n📅 آخر سداد: \${date}\\n💸 المبلغ: \${Number(lastVoucher.amount).toFixed(2)} YER\\n📝 البيان: \${lastVoucher.description || 'بدون بيان'}\`);
          } else {
            await sendTelegramMessage(\`👤 العميل: \${cust.name}\\n⚠️ لا يوجد سندات قبض مسجلة لهذا العميل.\`);
          }
        } else {
          await sendTelegramMessage(\`❌ لم يتم العثور على العميل "\${parsed.partyName}"\`);
        }
      } catch (err) {
        await sendTelegramMessage(\`❌ خطأ في جلب آخر سداد\`);
      }
    }
    else if (parsed.intent === "query_stock" && parsed.itemName) {
      try {
        const item: any = await sqlite.getFirstAsync("SELECT name, stock_quantity, unit FROM items WHERE name LIKE ? LIMIT 1", [\`%\${parsed.itemName}%\`]);
        if (item) {
          await sendTelegramMessage(\`📦 الصنف: \${item.name}\\n🔢 الكمية المتوفرة: \${Number(item.stock_quantity)} \${item.unit || ''}\`);
        } else {
          await sendTelegramMessage(\`❌ لم يتم العثور على الصنف "\${parsed.itemName}"\`);
        }
      } catch (err) {
        await sendTelegramMessage(\`❌ خطأ في جلب المخزون\`);
      }
    }
`;

const targetStr = `      } catch (err) {
        await sendTelegramMessage(\`❌ خطأ في إنشاء الفاتورة: \${err instanceof Error ? err.message : String(err)}\`);
      }
    }
    else if (parsed.intent === "create_customer"`;

const replacementStr = `      } catch (err) {
        await sendTelegramMessage(\`❌ خطأ في إنشاء الفاتورة: \${err instanceof Error ? err.message : String(err)}\`);
      }
    }
${queryHandlers}
    else if (parsed.intent === "create_customer"`;

if (code.includes(targetStr)) {
  code = code.replace(targetStr, replacementStr);
  fs.writeFileSync('src/utils/telegram.ts', code);
  console.log("✅ تمت إضافة ميزات الاستعلام بنجاح!");
} else {
  console.log("⚠️ لم يتم العثور على الكود القديم. سأستخدم خطة بديلة.");
}
