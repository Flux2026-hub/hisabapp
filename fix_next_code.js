const fs = require('fs');
let code = fs.readFileSync('src/ui/CustomersScreen.tsx', 'utf8');

const oldLogic = `  const nextCode = useMemo(() => {
    const nums = rows.map((r) => parseInt(String(r.code ?? ""), 10)).filter((n) => !Number.isNaN(n));
    const next = nums.length ? Math.max(...nums) + 1 : 1;
    return String(next).padStart(3, "0");
  }, [rows]);`;

const newLogic = `  const nextCode = useMemo(() => {
    let maxNum = 0;
    rows.forEach((r) => {
      const codeStr = String(r.code ?? "");
      // استخراج الأرقام فقط من أي كود (سواء كان CUS-001 أو 001)
      const numStr = codeStr.replace(/\\D/g, "");
      if (numStr) {
        const num = parseInt(numStr, 10);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      }
    });
    const next = maxNum + 1;
    return \`CUS-\${String(next).padStart(3, "0")}\`;
  }, [rows]);`;

if (code.includes(oldLogic)) {
  code = code.replace(oldLogic, newLogic);
  fs.writeFileSync('src/ui/CustomersScreen.tsx', code);
  console.log("✅ تم إصلاح كود توليد التسلسل بنجاح!");
} else {
  console.log("⚠️ لم يتم العثور على الكود القديم. يرجى إبلاغي.");
}
