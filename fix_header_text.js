const fs = require('fs');
let code = fs.readFileSync('app/index.tsx', 'utf8');

// إزالة الحاوية التي كانت تجمع الشعار والنص معاً
code = code.replace(
  '<View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 15 }}>',
  '<>'
);
code = code.replace(
  '</View>\n        </View>\n      </LinearGradient>',
  '</View>\n      </LinearGradient>'
);

// تعديل محاذاة النص ليكون في أقصى اليسار
code = code.replace(/brandTextWrap: \{ alignItems: "flex-end" \}/, 'brandTextWrap: { alignItems: "flex-end", flex: 1 }');

fs.writeFileSync('app/index.tsx', code);
console.log("✅ تم إعادة النص إلى أقصى اليسار والشعار إلى أقصى اليمين!");
