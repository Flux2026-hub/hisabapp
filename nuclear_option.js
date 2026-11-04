const fs = require('fs');

// 1. قراءة ملف app.json أو app.config.ts
let file = 'app.json';
if (!fs.existsSync(file)) file = 'app.config.ts';

if (fs.existsSync(file)) {
    let code = fs.readFileSync(file, 'utf8');
    
    // تغيير اسم الحزمة (Package Name) ورقم الإصدار
    // سنضيف كلمة .v2 لنجعل أندرويد يعتبره تطبيقاً جديداً
    code = code.replace(/"package":\s*"[^"]+"/g, '"package": "com.flux.hisabapp.v2"');
    code = code.replace(/"versionCode":\s*\d+/g, '"versionCode": 99');
    code = code.replace(/"version":\s*"[^"]+"/g, '"version": "2.0.0"');
    
    fs.writeFileSync(file, code);
    console.log("✅ تم تغيير هوية التطبيق بنجاح في " + file);
} else {
    console.log("⚠️ لم يتم العثور على app.json أو app.config.ts");
}
