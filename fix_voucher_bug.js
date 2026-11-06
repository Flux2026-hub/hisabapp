const fs = require('fs');
let code = fs.readFileSync('src/ui/VouchersScreen.tsx', 'utf8');

// 1. تغيير طريقة توليد رقم السند لتعتمد على الوقت (تضمن عدم التكرار)
const oldVoucherLogic = `const last: any = await sqlite.getAllAsync(\`SELECT voucher_no FROM vouchers WHERE voucher_no LIKE ? ORDER BY created_at DESC LIMIT 1\`, [\`\${prefix}-%\`]);
        let nextNum = 1;
        if (last && last.length > 0) nextNum = parseInt(String(last[0].voucher_no).replace(/\\D/g, ""), 10) + 1;
        const voucherNo = \`\${prefix}-\${String(nextNum).padStart(3, "0")}\`;`;

const newVoucherLogic = `const voucherNo = \`\${prefix}-\${Date.now().toString().slice(-6)}\`;`;

if (code.includes(oldVoucherLogic)) {
  code = code.replace(oldVoucherLogic, newVoucherLogic);
} else {
  // محاولة بديلة في حال تغيرت المسافات
  code = code.replace(/const last: any = await sqlite.getAllAsync[\s\S]*?const voucherNo = .*?;/g, newVoucherLogic);
}

// 2. تحسين رسالة الخطأ لتظهر السبب الحقيقي بدلاً من "String(e)"
code = code.replace(
  'Alert.alert("تعذر الحفظ", String(e));',
  'Alert.alert("تعذر الحفظ", String(e) + "\\n\\n(ملاحظة: إذا استمرت المشكلة، أرسل هذه الرسالة للمطور)");'
);

fs.writeFileSync('src/ui/VouchersScreen.tsx', code);
console.log("✅ تم إصلاح خطأ الحفظ (تجنب تكرار أرقام السندات)!");
