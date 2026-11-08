const fs = require('fs');
let code = fs.readFileSync('app/_layout.tsx', 'utf8');

// إضافة فحص دوري للنسخة الاحتياطية (كل ساعة)
const marker = `    // ✅ بدء المؤقت التلقائي
        startPolling();`;
const addition = `    // ✅ بدء المؤقت التلقائي
        startPolling();
        
        // ✅ فحص النسخة الاحتياطية كل ساعة (بالإضافة للفحص عند الفتح)
        const backupInterval = setInterval(() => {
          checkAndSendAutoBackup().catch(console.error);
        }, 60 * 60 * 1000); // كل ساعة`;

if (code.includes(marker) && !code.includes('backupInterval')) {
  code = code.replace(marker, addition);
  // تنظيف المؤقت عند إغلاق التطبيق
  code = code.replace(
    'return () => {\n      if (intervalId) clearInterval(intervalId);',
    'return () => {\n      if (intervalId) clearInterval(intervalId);\n      if (typeof backupInterval !== "undefined") clearInterval(backupInterval);'
  );
  fs.writeFileSync('app/_layout.tsx', code);
  console.log("✅ تم تحديث النسخة الاحتياطية لتعمل دورياً (كل ساعة)!");
} else {
  console.log("⚠️ الكود موجود بالفعل أو لم يتم العثور على المكان.");
}
