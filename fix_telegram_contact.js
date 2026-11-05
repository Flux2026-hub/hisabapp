const fs = require('fs');
let code = fs.readFileSync('src/utils/telegram.ts', 'utf8');

// 1. إضافة الاستيراد
if (!code.includes("expo-contacts")) {
  code = code.replace(
    'import AsyncStorage from "@react-native-async-storage/async-storage";',
    'import AsyncStorage from "@react-native-async-storage/async-storage";\nimport * as Contacts from "expo-contacts/legacy";'
  );
}

// 2. تحديث دالة create_customer
const oldCustomerBlock = `else if (parsed.intent === "create_customer" && parsed.partyName) {
    try {
      const lastCustomer: any = await sqlite.getFirstAsync("SELECT code FROM customers WHERE code LIKE 'CUS-%' ORDER BY code DESC LIMIT 1");
      let nextCode = "CUS-001";
      if (lastCustomer && lastCustomer.code) {
        const lastNum = parseInt(lastCustomer.code.replace(/\\D/g, ""), 10);
        nextCode = \`CUS-\${String(lastNum + 1).padStart(3, "0")}\`;
      }
      const customerId = \`CUS-\${Date.now()}\`;
      const now = Date.now();
      await sqlite.runAsync(
        \`INSERT INTO customers (id, code, name, phone, balance, created_at, updated_at) VALUES (?, ?, ?, ?, 0, ?, ?)\`,
        [customerId, nextCode, parsed.partyName, parsed.phone || "", now, now]
      );
      await sendTelegramMessage(\`✅ تم إضافة العميل بنجاح:\\n👤 الاسم: \${parsed.partyName}\\n🔢 الكود: \${nextCode}\\n📞 الهاتف: \${parsed.phone || "غير مسجل"}\`);
    } catch (err) {
      await sendTelegramMessage(\`❌ تعذر إضافة العميل: \${String(err)}\`);
    }
  }`;

const newCustomerBlock = `else if (parsed.intent === "create_customer" && parsed.partyName) {
    try {
      let phoneNumber = parsed.phone || "";
      
      // ✅ البحث في جهات الاتصال إذا طلب المستخدم
      if (parsed.useContact || (!parsed.phone && parsed.partyName)) {
        try {
          const { status } = await Contacts.requestPermissionsAsync();
          if (status === 'granted') {
            const { data } = await Contacts.getContactsAsync({
              fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Name],
            });
            const contact = data.find((c: any) => c.name && c.name.includes(parsed.partyName || ""));
            if (contact && contact.phoneNumbers && contact.phoneNumbers.length > 0) {
              phoneNumber = contact.phoneNumbers[0].number || "";
            }
          }
        } catch (e) { console.log("Contact search error", e); }
      }

      const lastCustomer: any = await sqlite.getFirstAsync("SELECT code FROM customers WHERE code LIKE 'CUS-%' ORDER BY code DESC LIMIT 1");
      let nextCode = "CUS-001";
      if (lastCustomer && lastCustomer.code) {
        const lastNum = parseInt(lastCustomer.code.replace(/\\D/g, ""), 10);
        nextCode = \`CUS-\${String(lastNum + 1).padStart(3, "0")}\`;
      }
      const customerId = \`CUS-\${Date.now()}\`;
      const now = Date.now();
      await sqlite.runAsync(
        \`INSERT INTO customers (id, code, name, phone, balance, created_at, updated_at) VALUES (?, ?, ?, ?, 0, ?, ?)\`,
        [customerId, nextCode, parsed.partyName, phoneNumber, now, now]
      );
      await sendTelegramMessage(\`✅ تم إضافة العميل بنجاح:\\n👤 الاسم: \${parsed.partyName}\\n🔢 الكود: \${nextCode}\\n📞 الهاتف: \${phoneNumber || "غير مسجل"}\`);
    } catch (err) {
      await sendTelegramMessage(\`❌ تعذر إضافة العميل: \${String(err)}\`);
    }
  }`;

if (code.includes(oldCustomerBlock)) {
  code = code.replace(oldCustomerBlock, newCustomerBlock);
  fs.writeFileSync('src/utils/telegram.ts', code);
  console.log("✅ تم تحديث ملف Telegram للبحث في جهات الاتصال!");
} else {
  console.log("⚠️ لم يتم العثور على الكود القديم. سأعطيك حلاً بديلاً.");
}
