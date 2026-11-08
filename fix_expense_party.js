const fs = require('fs');
let code = fs.readFileSync('src/utils/telegram.ts', 'utf8');

const oldExpenseLogic = `      await sqlite.runAsync(
        \`INSERT INTO vouchers (id, voucher_no, voucher_type, cashbox_id, party_name, amount, description, created_at, party_type, currency_code, exchange_rate, party_amount) VALUES (?, ?, 'payment', ?, 'مصروف ذكي', ?, ?, ?, 'none', 'YER', 1, ?)\`,
        [expenseId, expenseNo, cashboxId, parsed.amount, parsed.description || text, now, parsed.amount]
      );
      await sqlite.runAsync("UPDATE cashboxes SET balance = balance - ? WHERE id = ?", [parsed.amount, cashboxId]);
      await sendTelegramMessage(\`✅ تم تسجيل المصروف:\\n💸 \${parsed.amount} YER\\n📝 \${parsed.description}\`);`;

const newExpenseLogic = `      let partyId = null;
      let pType = 'none';
      let pName = 'مصروف ذكي';

      if (parsed.partyName) {
        const supp: any = await sqlite.getFirstAsync("SELECT id, name FROM suppliers WHERE name LIKE ? LIMIT 1", [\`%\${parsed.partyName}%\`]);
        const cust: any = await sqlite.getFirstAsync("SELECT id, name FROM customers WHERE name LIKE ? LIMIT 1", [\`%\${parsed.partyName}%\`]);
        if (supp) { partyId = supp.id; pType = 'supplier'; pName = supp.name; }
        else if (cust) { partyId = cust.id; pType = 'customer'; pName = cust.name; }
      }

      await sqlite.runAsync(
        \`INSERT INTO vouchers (id, voucher_no, voucher_type, cashbox_id, party_name, amount, description, created_at, party_type, party_id, currency_code, exchange_rate, party_amount) VALUES (?, ?, 'payment', ?, ?, ?, ?, ?, ?, ?, 'YER', 1, ?)\`,
        [expenseId, expenseNo, cashboxId, pName, parsed.amount, parsed.description || text, now, pType, partyId, parsed.amount]
      );
      await sqlite.runAsync("UPDATE cashboxes SET balance = balance - ? WHERE id = ?", [parsed.amount, cashboxId]);
      
      if (pType === 'supplier' && partyId) {
        await sqlite.runAsync("UPDATE suppliers SET balance = balance - ? WHERE id = ?", [parsed.amount, partyId]);
      } else if (pType === 'customer' && partyId) {
        await sqlite.runAsync("UPDATE customers SET balance = balance + ? WHERE id = ?", [parsed.amount, partyId]);
      }

      await sendTelegramMessage(\`✅ تم تسجيل المصروف:\\n💸 \${parsed.amount} YER\\n📝 \${parsed.description}\\n👤 الطرف: \${pName}\`);`;

if (code.includes(oldExpenseLogic)) {
  code = code.replace(oldExpenseLogic, newExpenseLogic);
  fs.writeFileSync('src/utils/telegram.ts', code);
  console.log("✅ تم إصلاح كود المصروف ليخصم/يضيف من رصيد المورد/العميل!");
} else {
  console.log("⚠️ لم يتم العثور على الكود القديم. يرجى إبلاغي.");
}
