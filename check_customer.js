const { sqlite } = require('./src/db/local');

async function check() {
  try {
    const customers = await sqlite.getAllAsync("SELECT name, balance FROM customers WHERE name LIKE '%مراد%' OR name LIKE '%الوليدي%'");
    console.log("🔍 نتائج البحث عن العميل في قاعدة البيانات:");
    if (customers.length === 0) {
      console.log("⚠️ لم يتم العثور على أي عميل يحتوي على 'مراد' أو 'الوليدي'.");
      console.log("💡 الحل: تأكد من إضافة العميل باسم 'مراد الوليدي' من شاشة العملاء في التطبيق.");
    } else {
      customers.forEach(c => console.log(`- الاسم: "${c.name}" | الرصيد: ${c.balance}`));
    }
  } catch (e) {
    console.log("❌ خطأ:", e.message);
  }
}
check();
