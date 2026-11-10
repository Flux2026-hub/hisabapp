const fs = require('fs');

// 1. تحديث ملف local.ts لإنشاء جدول التذكيرات
let localCode = fs.readFileSync('src/db/local.ts', 'utf8');
if (!localCode.includes('CREATE TABLE IF NOT EXISTS reminders')) {
  // إضافة الجدول بعد إنشاء جدول vouchers أو في نهاية الدالة
  localCode = localCode.replace(
    /\);/g, // البحث عن أول إغلاق لدالة الإنشاء (تقريبي)
    `);
    try {
      await db.execute(\`CREATE TABLE IF NOT EXISTS reminders (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        due_date INTEGER NOT NULL,
        is_sent INTEGER DEFAULT 0,
        created_at INTEGER NOT NULL
      );\`);
    } catch (e) { console.log("Reminders table error:", e); }
  `
  );
  fs.writeFileSync('src/db/local.ts', localCode);
  console.log("✅ تم إنشاء جدول التذكيرات في قاعدة البيانات!");
}

// 2. إضافة دوال التذكيرات في telegram.ts
let tgCode = fs.readFileSync('src/utils/telegram.ts', 'utf8');

const reminderFunctions = `
// ✅ دالة فحص وإرسال التذكيرات المستحقة
export const checkReminders = async () => {
  try {
    const now = Date.now();
    const dueReminders: any = await sqlite.getAllAsync(
      "SELECT id, title, due_date FROM reminders WHERE due_date <= ? AND is_sent = 0",
      [now]
    );

    for (const rem of dueReminders) {
      await sendTelegramMessage(\`⏰ <b>تذكير مستحق:</b>\\n\${rem.title}\\n📅 التاريخ: \${new Date(rem.due_date).toLocaleDateString('ar-YE')}\`);
      await sqlite.runAsync("UPDATE reminders SET is_sent = 1 WHERE id = ?", [rem.id]);
    }
  } catch (e) {
    console.log("Reminders check error:", e);
  }
};

// ✅ دالة إضافة تذكير جديد
export const addReminder = async (title: string, dueDate: number) => {
  try {
    const id = \`REM-\${Date.now()}\`;
    const now = Date.now();
    await sqlite.runAsync(
      "INSERT INTO reminders (id, title, due_date, is_sent, created_at) VALUES (?, ?, ?, 0, ?)",
      [id, title, dueDate, now]
    );
    return true;
  } catch (e) {
    console.log("Add reminder error:", e);
    return false;
  }
};
`;

if (!tgCode.includes('checkReminders')) {
  tgCode = tgCode.replace('const processTextCommand = async (text: string) => {', reminderFunctions + '\n' + 'const processTextCommand = async (text: string) => {');
  fs.writeFileSync('src/utils/telegram.ts', tgCode);
  console.log("✅ تم إضافة دوال التذكيرات في telegram.ts!");
}
