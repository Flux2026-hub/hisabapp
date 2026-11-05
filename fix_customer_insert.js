const fs = require('fs');
let code = fs.readFileSync('src/utils/telegram.ts', 'utf8');

const oldQuery = `await sqlite.runAsync(
        \`INSERT INTO customers (id, code, name, phone, balance) VALUES (?, ?, ?, ?, 0)\`,
        [customerId, nextCode, parsed.partyName, parsed.phone || ""]
      );`;

const newQuery = `const now = Date.now();
      await sqlite.runAsync(
        \`INSERT INTO customers (id, code, name, phone, balance, created_at, updated_at) VALUES (?, ?, ?, ?, 0, ?, ?)\`,
        [customerId, nextCode, parsed.partyName, parsed.phone || "", now, now]
      );`;

if (code.includes(oldQuery)) {
  code = code.replace(oldQuery, newQuery);
  fs.writeFileSync('src/utils/telegram.ts', code);
  console.log("✅ تم إصلاح كود إضافة العميل بنجاح!");
} else {
  console.log("⚠️ لم يتم العثور على النص المطابق. سأحاول طريقة أخرى.");
}
