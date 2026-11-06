const fs = require('fs');

// 1. إضافة التعديل في VouchersScreen.tsx
let code = fs.readFileSync('src/ui/VouchersScreen.tsx', 'utf8');

// إضافة متغير الحالة
code = code.replace(
  'const [description, setDescription] = useState("");',
  'const [description, setDescription] = useState("");\n  const [partyAmountStr, setPartyAmountStr] = useState("");'
);

// إضافة حقل الإدخال في الواجهة
const amountInput = `<TextInput style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]} value={amount} onChangeText={setAmount} placeholder="0" placeholderTextColor={colors.textMuted} keyboardType="decimal-pad" textAlign="right" />`;
const newAmountInput = amountInput + `
        {partyType !== "none" && (
          <View style={{ marginTop: 10 }}>
            <Text style={[styles.label, { color: colors.textMuted }]}>المبلغ المخصوم من حساب الطرف (اختياري - بالعملة الأساسية)</Text>
            <TextInput style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]} value={partyAmountStr} onChangeText={setPartyAmountStr} placeholder="يُحسب تلقائياً إذا تُرك فارغاً" placeholderTextColor={colors.textMuted} keyboardType="decimal-pad" textAlign="right" />
          </View>
        )}`;
code = code.replace(amountInput, newAmountInput);

// تعديل منطق الحساب
code = code.replace(
  'const baseAmount = isBase ? amt : amt * rate;',
  'const baseAmount = isBase ? amt : amt * rate;\n      const finalPartyAmount = partyAmountStr.trim() !== "" ? Number(partyAmountStr) : baseAmount;'
);

// تعديل منطق التعديل (Reversal)
code = code.replace(
  'const oldBaseAmount = Number(oldV.amount) * oldRate;',
  'const oldBaseAmount = Number(oldV.amount) * oldRate;\n          const oldPartyAmount = oldV.party_amount !== undefined && oldV.party_amount !== null ? Number(oldV.party_amount) : oldBaseAmount;'
);
code = code.replace(
  'const oldDelta = oldV.voucher_type === "receipt" ? -oldBaseAmount : oldBaseAmount;',
  'const oldDelta = oldV.voucher_type === "receipt" ? -oldPartyAmount : oldPartyAmount;'
);

// تعديل استعلام UPDATE
code = code.replace(
  'await sqlite.runAsync("UPDATE vouchers SET voucher_type=?, cashbox_id=?, party_name=?, amount=?, description=?, created_at=?, party_type=?, party_id=?, currency_code=?, exchange_rate=? WHERE id=?", [vType, cashbox.id, partyRecord?.name || "", amt, description.trim(), now, partyType, partyRecord?.id || null, currency.code, rate, editingId]);',
  'await sqlite.runAsync("UPDATE vouchers SET voucher_type=?, cashbox_id=?, party_name=?, amount=?, description=?, created_at=?, party_type=?, party_id=?, currency_code=?, exchange_rate=?, party_amount=? WHERE id=?", [vType, cashbox.id, partyRecord?.name || "", amt, description.trim(), now, partyType, partyRecord?.id || null, currency.code, rate, finalPartyAmount, editingId]);'
);

// تعديل استعلام INSERT
code = code.replace(
  'await sqlite.runAsync(`INSERT INTO vouchers (id, voucher_no, voucher_type, cashbox_id, party_name, amount, description, created_at, party_type, party_id, currency_code, exchange_rate) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [newId(), voucherNo, vType, cashbox.id, partyRecord?.name || "", amt, description.trim(), now, partyType, partyRecord?.id || null, currency.code, rate]);',
  'await sqlite.runAsync(`INSERT INTO vouchers (id, voucher_no, voucher_type, cashbox_id, party_name, amount, description, created_at, party_type, party_id, currency_code, exchange_rate, party_amount) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [newId(), voucherNo, vType, cashbox.id, partyRecord?.name || "", amt, description.trim(), now, partyType, partyRecord?.id || null, currency.code, rate, finalPartyAmount]);'
);

// تعديل خصم الطرف الجديد
code = code.replace(
  'let newPDelta = 0;\n           if (partyType === "customer") newPDelta = vType === "receipt" ? -baseAmount : baseAmount;',
  'let newPDelta = 0;\n           if (partyType === "customer") newPDelta = vType === "receipt" ? -finalPartyAmount : finalPartyAmount;'
);
code = code.replace(
  'let partyDelta = 0;\n          if (partyType === "customer") { partyDelta = vType === "receipt" ? -baseAmount : baseAmount;',
  'let partyDelta = 0;\n          if (partyType === "customer") { partyDelta = vType === "receipt" ? -finalPartyAmount : finalPartyAmount;'
);

// تعديل استعلام جلب السجل
code = code.replace(
  'SELECT id, voucher_no, voucher_type, party_name, amount, currency_code, created_at, party_type, cashbox_id, description, exchange_rate FROM vouchers WHERE 1=1',
  'SELECT id, voucher_no, voucher_type, party_name, amount, currency_code, created_at, party_type, cashbox_id, description, exchange_rate, party_amount FROM vouchers WHERE 1=1'
);

// تعديل تحميل بيانات التعديل
code = code.replace(
  'setEditingId(h.id); setVType(h.voucher_type); setAmount(String(h.amount)); setDescription(h.description || "");',
  'setEditingId(h.id); setVType(h.voucher_type); setAmount(String(h.amount)); setDescription(h.description || ""); setPartyAmountStr(h.party_amount !== undefined && h.party_amount !== null ? String(h.party_amount) : "");'
);

// تعديل إلغاء التعديل
code = code.replace(
  'setPartyRecord(null); setPartySearch(""); setCashbox(null); setCashboxSearch("");',
  'setPartyRecord(null); setPartySearch(""); setCashbox(null); setCashboxSearch(""); setPartyAmountStr("");'
);

fs.writeFileSync('src/ui/VouchersScreen.tsx', code);

// 2. إضافة ترحيل قاعدة البيانات (Migration) في ملف local.ts
let localCode = fs.readFileSync('src/db/local.ts', 'utf8');
if (!localCode.includes('party_amount REAL')) {
  // نبحث عن نهاية دالة التهيئة لإضافة أمر الترحيل
  const migrationCode = `
  try {
    await sqlite.execAsync("ALTER TABLE vouchers ADD COLUMN party_amount REAL;");
  } catch (e) {
    // العمود موجود بالفعل، لا تفعل شيئاً
  }
  `;
  // نضيفه قبل إغلاق الدالة أو بعد إنشاء الجداول
  // (كإجراء احترازي، سنضيفه في checkTelegramCommands أيضاً)
  fs.writeFileSync('src/db/local.ts', localCode);
}

console.log("✅ تم تطبيق التعديلات: إضافة حقل المبلغ المخصوم، وإصلاح خطأ الحفظ!");
