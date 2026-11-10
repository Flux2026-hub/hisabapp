import * as SecureStore from 'expo-secure-store';
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from 'expo-file-system/legacy';
import * as Contacts from "expo-contacts/legacy";
import * as Print from "expo-print";
import { sqlite } from "../db/local";
import { parseArabicCommand } from "./gemini";

const TOKEN_KEY = 'tg_token';
const CHAT_ID_KEY = 'tg_chat_id';
const LAST_UPDATE_ID_KEY = '@flux_last_tg_update_id_v2';

export const saveTelegramSettings = async (token: string, chatId: string) => {
  try {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
    await SecureStore.setItemAsync(CHAT_ID_KEY, chatId);
    return true;
  } catch (error) { return false; }
};

export const getTelegramSettings = async () => {
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  const chatId = await SecureStore.getItemAsync(CHAT_ID_KEY);
  return { token, chatId };
};

export const sendTelegramMessage = async (message: string) => {
  const { token, chatId } = await getTelegramSettings();
  if (!token || !chatId) return;
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'HTML' }) });
  const data = await response.json();
  if (!data.ok) throw new Error(data.description);
  return true;
};

export const sendTelegramDocument = async (fileUri: string, filename: string, caption: string) => {
  const { token, chatId } = await getTelegramSettings();
  if (!token || !chatId) throw new Error('لم يتم إعداد التوكن أو Chat ID');
  const url = `https://api.telegram.org/bot${token}/sendDocument`;
  
  try {
    const response = await FileSystem.uploadAsync(url, fileUri, {
      fieldName: 'document',
      httpMethod: 'POST',
      uploadType: FileSystem.FileSystemUploadType.MULTIPART,
      parameters: { chat_id: chatId, caption: caption },
    });
    const data = JSON.parse(response.body);
    if (!data.ok) throw new Error(data.description);
    return true;
  } catch (error: any) {
    throw new Error(error.message || String(error));
  }
};

export const notifyLargeInvoice = async (invoiceData: any) => {
  const msg = `🚨 <b>فاتورة كبيرة جديدة!</b>\n\n👤 العميل: ${invoiceData.customerName}\n💰 المبلغ: ${invoiceData.total} ريال\n🧾 رقم الفاتورة: ${invoiceData.invoiceNumber}`;
  return await sendTelegramMessage(msg);
};

// ✅ القوائم والأزرار
const sendMainMenu = async () => {
  const { token, chatId } = await getTelegramSettings();
  if (!token || !chatId) return;
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const keyboard = {
    inline_keyboard: [
      [{ text: "💰 سند قبض", callback_data: "menu_receipt" }],
      [{ text: "💸 سند صرف", callback_data: "menu_payment" }],
      [{ text: "📊 كشف حساب عميل", callback_data: "menu_statement" }],
      [{ text: "📦 استعلام مخزون", callback_data: "menu_stock" }],
    ],
  };
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: "👋 مرحباً بك في <b>بوت فلوكس</b>.\n\nاختر العملية التي تريد القيام بها:", parse_mode: 'HTML', reply_markup: JSON.stringify(keyboard) }),
  });
};

const sendPersistentMenu = async () => {
  const { token, chatId } = await getTelegramSettings();
  if (!token || !chatId) return;
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const replyKeyboard = {
    keyboard: [
      [{ text: "💰 سند قبض" }, { text: "💸 سند صرف" }],
      [{ text: "📊 كشف حساب" }, { text: "📦 مخزون" }],
      [{ text: "📋 القائمة" }],
    ],
    resize_keyboard: true,
    persistent: true,
  };
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: "✅ تم تفعيل الأزرار السريعة. يمكنك استخدامها في أي وقت.", reply_markup: JSON.stringify(replyKeyboard) }),
  });
};

const handleStatus = async (token: string, chatId: string) => {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getUpdates`);
    const data = await res.json();
    const pendingCount = data.ok ? data.result.length : "غير معروف";
    const lastUpdateId = await AsyncStorage.getItem(LAST_UPDATE_ID_KEY);
    await sendTelegramMessage(
      `📊 <b>حالة النظام</b>\n\n📥 الرسائل المعلقة: ${pendingCount}\n🔢 آخر رقم رسالة تمت معالجتها: ${lastUpdateId || 'لا يوجد'}\n🤖 حالة الذكاء الاصطناعي: يعمل\n\n💡 لإلغاء الرسائل المعلقة أرسل: /cancel`
    );
  } catch (e) {
    await sendTelegramMessage("❌ تعذر جلب الحالة.");
  }
};

const handleCancel = async (token: string, chatId: string) => {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getUpdates?offset=-1`);
    const data = await res.json();
    if (data.ok && data.result.length > 0) {
      const lastUpdateId = data.result[0].update_id;
      await fetch(`https://api.telegram.org/bot${token}/getUpdates?offset=${lastUpdateId + 1}`);
      await AsyncStorage.setItem(LAST_UPDATE_ID_KEY, String(lastUpdateId));
      await sendTelegramMessage("✅ تم إلغاء جميع الأوامر المعلقة. أنت الآن تبدأ من جديد!");
    } else {
      await sendTelegramMessage("ℹ️ لا توجد أوامر معلقة لإلغائها.");
    }
  } catch (e) {
    await sendTelegramMessage("❌ تعذر إلغاء الأوامر.");
  }
};

const handleHelp = async () => {
  await sendTelegramMessage(
    `📚 <b>دليل الأوامر المتاحة</b>\n\n` +
    `<b>الأوامر النصية السريعة:</b>\n` +
    `- <code>صرفت 500 بنزين</code>\n` +
    `- <code>استلمت 1000 من أحمد</code>\n` +
    `- <code>رصيد أحمد</code>\n` +
    `- <code>كشف حساب أحمد</code>\n` +
    `- <code>مخزون ماسورة</code>\n\n` +
    `<b>الأوامر الإدارية:</b>\n` +
    `- <code>/start</code> : القائمة الرئيسية\n` +
    `- <code>/status</code> : حالة النظام\n` +
    `- <code>/cancel</code> : إلغاء الرسائل المعلقة\n` +
    `- <code>/help</code> : هذه القائمة\n\n` +
    `<b>الأوامر المعقدة (بالصوت أو النص):</b>\n` +
    `تحدث بحرية تامة.`
  );
};

// ✅ الفهم المحلي السريع (بدون إنترنت)
const localParse = (text: string): any | null => {
  const cleaned = text.trim();

  const expenseMatch = cleaned.match(/^(?:صرفت|دفعت|مصروف)\s+(\d+(?:\.\d+)?)\s*(.*)$/);
  if (expenseMatch) return { intent: "expense", amount: parseFloat(expenseMatch[1]), description: expenseMatch[2] || "مصروف", cashboxName: undefined, partyName: undefined };

  const incomeMatch = cleaned.match(/^(?:استلمت|قبضت|إيراد)\s+(\d+(?:\.\d+)?)\s*(.*)$/);
  if (incomeMatch) return { intent: "income", amount: parseFloat(incomeMatch[1]), description: incomeMatch[2] || "إيراد", cashboxName: undefined, partyName: undefined };

  const balanceMatch = cleaned.match(/^(?:كم\s+)?رصيد\s+(.+)$/);
  if (balanceMatch) return { intent: "query_customer_balance", partyName: balanceMatch[1].trim(), amount: 0, description: "استعلام رصيد" };

  const stockMatch = cleaned.match(/^(?:كم\s+)?(?:بقي\s+)?مخزون\s+(.+)$/);
  if (stockMatch) return { intent: "query_stock", itemName: stockMatch[1].trim(), amount: 0, description: "استعلام مخزون" };

  const statementMatch = cleaned.match(/^كشف\s+(?:حساب\s+)?(.+)$/);
  if (statementMatch) return { intent: "query_customer_statement", partyName: statementMatch[1].trim(), amount: 0, description: "كشف حساب" };

  const lastPaymentMatch = cleaned.match(/^(?:متى\s+)?آخر\s+سداد\s+(?:من\s+)?(.+)$/);
  if (lastPaymentMatch) return { intent: "query_last_payment", partyName: lastPaymentMatch[1].trim(), amount: 0, description: "آخر سداد" };

  return null;
};

// ✅ دالة معالجة النصوص
const processTextCommand = async (text: string) => {
  try {
    let parsed = localParse(text);
    if (!parsed) {
      parsed = await parseArabicCommand(text);
    }
    
    if (parsed.intent === "expense" && parsed.amount > 0) {
      const expenseId = `EXP-${Date.now()}`;
      const expenseNo = `EXP-${String(Date.now()).slice(-6)}`;
      const now = Date.now();
      const cashbox = await findCashbox(parsed.cashboxName);
      const cashboxId = cashbox ? cashbox.id : null;
      if (!cashboxId) return await sendTelegramMessage("❌ لا يوجد صندوق تحليلي.");
      
      let partyId = null, pType = 'none', pName = 'مصروف ذكي';
      if (parsed.accountName) {
        const acc: any = await sqlite.getFirstAsync("SELECT id, name FROM accounts WHERE name LIKE ? LIMIT 1", [`%${parsed.accountName}%`]);
        if (acc) { partyId = acc.id; pType = 'account'; pName = acc.name; }
      }
      if (!partyId && parsed.partyName) {
        const supp: any = await sqlite.getFirstAsync("SELECT id, name FROM suppliers WHERE name LIKE ? LIMIT 1", [`%${parsed.partyName}%`]);
        const cust: any = await sqlite.getFirstAsync("SELECT id, name FROM customers WHERE name LIKE ? LIMIT 1", [`%${parsed.partyName}%`]);
        if (supp) { partyId = supp.id; pType = 'supplier'; pName = supp.name; }
        else if (cust) { partyId = cust.id; pType = 'customer'; pName = cust.name; }
      }

      await sqlite.runAsync(
        `INSERT INTO vouchers (id, voucher_no, voucher_type, cashbox_id, party_name, amount, description, created_at, party_type, party_id, currency_code, exchange_rate, party_amount) VALUES (?, ?, 'payment', ?, ?, ?, ?, ?, ?, ?, 'YER', 1, ?)`,
        [expenseId, expenseNo, cashboxId, pName, parsed.amount, parsed.description || text, now, pType, partyId, parsed.amount]
      );
      await sqlite.runAsync("UPDATE cashboxes SET balance = balance - ? WHERE id = ?", [parsed.amount, cashboxId]);
      if (pType === 'supplier' && partyId) await sqlite.runAsync("UPDATE suppliers SET balance = balance - ? WHERE id = ?", [parsed.amount, partyId]);
      else if (pType === 'customer' && partyId) await sqlite.runAsync("UPDATE customers SET balance = balance + ? WHERE id = ?", [parsed.amount, partyId]);
      else if (pType === 'account' && partyId) await sqlite.runAsync("UPDATE accounts SET balance = balance - ? WHERE id = ?", [parsed.amount, partyId]);
      
      await sendTelegramMessage(`✅ تم تسجيل المصروف:\n💸 ${parsed.amount} YER\n📝 ${parsed.description}\n👤 الطرف: ${pName}\n🏦 الصندوق: ${cashbox.name}`);
    } 
    else if (parsed.intent === "income" && parsed.amount > 0) {
      const incomeId = `INC-${Date.now()}`;
      const incomeNo = `INC-${String(Date.now()).slice(-6)}`;
      const now = Date.now();
      const cashbox = await findCashbox(parsed.cashboxName);
      const cashboxId = cashbox ? cashbox.id : null;
      if (!cashboxId) return await sendTelegramMessage("❌ لا يوجد صندوق تحليلي.");

      let partyId = null, pType = 'none', pName = 'إيراد ذكي';
      if (parsed.accountName) {
        const acc: any = await sqlite.getFirstAsync("SELECT id, name FROM accounts WHERE name LIKE ? LIMIT 1", [`%${parsed.accountName}%`]);
        if (acc) { partyId = acc.id; pType = 'account'; pName = acc.name; }
      }
      if (!partyId && parsed.partyName) {
        const cust: any = await sqlite.getFirstAsync("SELECT id, name FROM customers WHERE name LIKE ? LIMIT 1", [`%${parsed.partyName}%`]);
        const supp: any = await sqlite.getFirstAsync("SELECT id, name FROM suppliers WHERE name LIKE ? LIMIT 1", [`%${parsed.partyName}%`]);
        if (cust) { partyId = cust.id; pType = 'customer'; pName = cust.name; }
        else if (supp) { partyId = supp.id; pType = 'supplier'; pName = supp.name; }
      }

      await sqlite.runAsync(
        `INSERT INTO vouchers (id, voucher_no, voucher_type, cashbox_id, party_name, amount, description, created_at, party_type, party_id, currency_code, exchange_rate, party_amount) VALUES (?, ?, 'receipt', ?, ?, ?, ?, ?, ?, ?, 'YER', 1, ?)`,
        [incomeId, incomeNo, cashboxId, pName, parsed.amount, parsed.description || text, now, pType, partyId, parsed.amount]
      );
      await sqlite.runAsync("UPDATE cashboxes SET balance = balance + ? WHERE id = ?", [parsed.amount, cashboxId]);
      if (pType === 'customer' && partyId) await sqlite.runAsync("UPDATE customers SET balance = balance - ? WHERE id = ?", [parsed.amount, partyId]);
      else if (pType === 'supplier' && partyId) await sqlite.runAsync("UPDATE suppliers SET balance = balance - ? WHERE id = ?", [parsed.amount, partyId]);
      else if (pType === 'account' && partyId) await sqlite.runAsync("UPDATE accounts SET balance = balance + ? WHERE id = ?", [parsed.amount, partyId]);
      
      await sendTelegramMessage(`✅ تم تسجيل الإيراد:\n💰 ${parsed.amount} YER\n📝 ${parsed.description}\n👤 الطرف: ${pName}\n🏦 الصندوق: ${cashbox.name}`);
    }
    else if (parsed.intent === "query_customer_balance" && parsed.partyName) {
      const cust: any = await sqlite.getFirstAsync("SELECT name, balance FROM customers WHERE name LIKE ? LIMIT 1", [`%${parsed.partyName}%`]);
      if (cust) {
        let sarRate = 140;
        try { const cur: any = await sqlite.getFirstAsync("SELECT exchange_rate FROM currencies WHERE code = 'SAR'"); if (cur?.exchange_rate) sarRate = Number(cur.exchange_rate); } catch(e) {}
        const bal = Number(cust.balance);
        await sendTelegramMessage(`👤 العميل: ${cust.name}\n💰 الرصيد الحالي: ${bal.toFixed(2)} YER\n≈ ${(bal / sarRate).toFixed(2)} SAR`);
      } else await sendTelegramMessage(`❌ لم يتم العثور على العميل "${parsed.partyName}"`);
    }
    else if (parsed.intent === "query_last_payment" && parsed.partyName) {
      const cust: any = await sqlite.getFirstAsync("SELECT id, name FROM customers WHERE name LIKE ? LIMIT 1", [`%${parsed.partyName}%`]);
      if (cust) {
        const lastVoucher: any = await sqlite.getFirstAsync("SELECT amount, created_at, description FROM vouchers WHERE party_id = ? AND voucher_type = 'receipt' ORDER BY created_at DESC LIMIT 1", [cust.id]);
        if (lastVoucher) {
          const date = new Date(lastVoucher.created_at).toLocaleDateString('ar-YE');
          await sendTelegramMessage(`👤 العميل: ${cust.name}\n📅 آخر سداد: ${date}\n💸 المبلغ: ${Number(lastVoucher.amount).toFixed(2)} YER\n📝 البيان: ${lastVoucher.description || 'بدون بيان'}`);
        } else await sendTelegramMessage(`👤 العميل: ${cust.name}\n⚠️ لا يوجد سندات قبض مسجلة.`);
      } else await sendTelegramMessage(`❌ لم يتم العثور على العميل "${parsed.partyName}"`);
    }
    else if (parsed.intent === "query_stock" && parsed.itemName) {
      const item: any = await sqlite.getFirstAsync("SELECT name, stock_quantity, unit FROM items WHERE name LIKE ? LIMIT 1", [`%${parsed.itemName}%`]);
      if (item) await sendTelegramMessage(`📦 الصنف: ${item.name}\n🔢 الكمية المتوفرة: ${Number(item.stock_quantity)} ${item.unit || ''}`);
      else await sendTelegramMessage(`❌ لم يتم العثور على الصنف "${parsed.itemName}"`);
    }
    else if (parsed.intent === "query_customer_statement" && parsed.partyName) {
      await sendTelegramMessage("⏳ جاري إعداد كشف الحساب...");
      const cust: any = await sqlite.getFirstAsync("SELECT id, name, balance, phone FROM customers WHERE name LIKE ? LIMIT 1", [`%${parsed.partyName}%`]);
      if (!cust) return await sendTelegramMessage(`❌ لم يتم العثور على العميل "${parsed.partyName}"`);

      const invoices: any = await sqlite.getAllAsync("SELECT id, invoice_no, total, created_at, invoice_type FROM invoices WHERE party_id = ? ORDER BY created_at ASC", [cust.id]);
      const vouchers: any = await sqlite.getAllAsync("SELECT id, voucher_no, amount, created_at, voucher_type FROM vouchers WHERE party_id = ? ORDER BY created_at ASC", [cust.id]);

      const transactions: any[] = [];
      invoices.forEach((inv: any) => transactions.push({ date: new Date(inv.created_at).toLocaleDateString('ar-YE'), ref: inv.invoice_no, type: inv.invoice_type === 'sales' ? 'فاتورة مبيعات' : 'فاتورة مشتريات', debit: inv.invoice_type === 'sales' ? Number(inv.total) : 0, credit: inv.invoice_type === 'purchase' ? Number(inv.total) : 0 }));
      vouchers.forEach((v: any) => transactions.push({ date: new Date(v.created_at).toLocaleDateString('ar-YE'), ref: v.voucher_no, type: v.voucher_type === 'receipt' ? 'سند قبض' : 'سند دفع', debit: v.voucher_type === 'payment' ? Number(v.amount) : 0, credit: v.voucher_type === 'receipt' ? Number(v.amount) : 0 }));
      transactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      const rowsHtml = transactions.map(t => `<tr><td>${t.date}</td><td>${t.ref}</td><td>${t.type}</td><td>${t.debit > 0 ? t.debit.toFixed(2) : '-'}</td><td>${t.credit > 0 ? t.credit.toFixed(2) : '-'}</td></tr>`).join('');

      const html = `<html><head><meta charset="utf-8"><style>body{font-family:'Cairo',sans-serif;direction:rtl;padding:20px}h1{text-align:center;color:#0B2545}.header{text-align:center;margin-bottom:30px}.info{margin-bottom:20px;font-size:14px}table{width:100%;border-collapse:collapse;margin-bottom:30px}th,td{border:1px solid #CBD5E1;padding:8px;text-align:right}th{background-color:#F1F5F9;color:#0B2545}.total{font-size:18px;font-weight:bold;text-align:left;margin-top:20px;color:#0B2545}</style></head><body><div class="header"><h1>فلوكس - كشف حساب</h1><p>لأنابيب أكثر نظافة</p></div><div class="info"><p><strong>العميل:</strong> ${cust.name}</p><p><strong>الهاتف:</strong> ${cust.phone || 'غير مسجل'}</p><p><strong>تاريخ الكشف:</strong> ${new Date().toLocaleDateString('ar-YE')}</p></div><table><thead><tr><th>التاريخ</th><th>المرجع</th><th>البيان</th><th>مدين (عليه)</th><th>دائن (له)</th></tr></thead><tbody>${rowsHtml}</tbody></table><div class="total">الرصيد الحالي: ${Number(cust.balance).toFixed(2)} YER</div></body></html>`;

      const { uri } = await Print.printToFileAsync({ html });
      const filename = `statement_${Date.now()}.pdf`;
      const newUri = FileSystem.cacheDirectory + filename;
      await FileSystem.copyAsync({ from: uri, to: newUri });
      await sendTelegramDocument(newUri, filename, `📊 كشف حساب العميل: ${cust.name}\n💰 الرصيد الحالي: ${Number(cust.balance).toFixed(2)} YER`);
    }
    else if (parsed.intent === "create_customer" && parsed.partyName) {
      let phoneNumber = parsed.phone || "";
      if (parsed.useContact || (!parsed.phone && parsed.partyName)) {
        try {
          const { status } = await Contacts.requestPermissionsAsync();
          if (status === 'granted') {
            const { data } = await Contacts.getContactsAsync({ fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Name] });
            const contact = data.find((c: any) => c.name && c.name.includes(parsed.partyName || ""));
            if (contact && contact.phoneNumbers && contact.phoneNumbers.length > 0) phoneNumber = contact.phoneNumbers[0].number || "";
          }
        } catch (e) {}
      }
      const lastCustomer: any = await sqlite.getFirstAsync("SELECT code FROM customers WHERE code LIKE 'CUS-%' ORDER BY code DESC LIMIT 1");
      let nextCode = "CUS-001";
      if (lastCustomer && lastCustomer.code) {
        const lastNum = parseInt(lastCustomer.code.replace(/\D/g, ""), 10);
        nextCode = `CUS-${String(lastNum + 1).padStart(3, "0")}`;
      }
      await sqlite.runAsync(`INSERT INTO customers (id, code, name, phone, balance, created_at, updated_at) VALUES (?, ?, ?, ?, 0, ?, ?)`, [`CUS-${Date.now()}`, nextCode, parsed.partyName, phoneNumber, Date.now(), Date.now()]);
      await sendTelegramMessage(`✅ تم إضافة العميل بنجاح:\n👤 الاسم: ${parsed.partyName}\n🔢 الكود: ${nextCode}\n📞 الهاتف: ${phoneNumber || "غير مسجل"}`);
    }
    else {
      if (parsed.error) await sendTelegramMessage(`❌ خطأ من Gemini: ${parsed.error}`);
      else await sendTelegramMessage("🤖 لم أفهم الأمر. جرب:\n- \"صرفت 500 بنزين\"\n- \"استلمت 1000 من أحمد\"\n- \"افتح حساب عميل جديد باسم...\"");
    }
  } catch (error: any) {
    await sendTelegramMessage(`❌ خطأ: ${error.message || error}`);
  }
};

const processVoiceCommand = async (voice: any, token: string) => {
  try {
    await sendTelegramMessage("🎤 جاري تحليل الرسالة الصوتية...");
    const fileRes = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${voice.file_id}`);
    const fileData = await fileRes.json();
    if (!fileData.ok) throw new Error("تعذر الحصول على الملف");
    const audioUrl = `https://api.telegram.org/file/bot${token}/${fileData.result.file_path}`;
    const localPath = FileSystem.cacheDirectory + `voice_${Date.now()}.ogg`;
    await FileSystem.downloadAsync(audioUrl, localPath);
    const base64Audio = await FileSystem.readAsStringAsync(localPath, { encoding: FileSystem.EncodingType.Base64 });
    const { GoogleGenerativeAI } = require("@google/generative-ai");
    const genAI = new GoogleGenerativeAI("AQ.Ab8RN6J7bRV7yGwhk6NI9mp3W4Giaa5iOxz_4S2sj7_-nFLRsg");
    const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash" });
    const result = await model.generateContent(["استمع لهذه الرسالة الصوتية العربية وحولها إلى نص مكتوب فقط، دون أي تعليق أو إضافة.", { inlineData: { data: base64Audio, mimeType: "audio/ogg" } }]);
    const transcribedText = result.response.text().trim();
    await FileSystem.deleteAsync(localPath, { idempotent: true });
    if (!transcribedText) throw new Error("لم يتمكن الذكاء الاصطناعي من فهم الصوت");
    await sendTelegramMessage(`📝 سمعتك تقول: "${transcribedText}"\n⏳ جاري التنفيذ...`);
    await processTextCommand(transcribedText);
  } catch (error) {
    await sendTelegramMessage(`❌ تعذر معالجة الصوت.`);
  }
};

const findCashbox = async (cashboxName?: string) => {
  if (cashboxName) {
    const cb: any = await sqlite.getFirstAsync("SELECT id, name FROM cashboxes WHERE name LIKE ? AND cashbox_type = 'analytical' LIMIT 1", [`%${cashboxName}%`]);
    if (cb) return cb;
  }
  const yemeni: any = await sqlite.getFirstAsync("SELECT id, name FROM cashboxes WHERE cashbox_type = 'analytical' AND (name LIKE '%نقدي%' OR name LIKE '%يمني%' OR name LIKE '%كاش%') LIMIT 1");
  if (yemeni) return yemeni;
  const first: any = await sqlite.getFirstAsync("SELECT id, name FROM cashboxes WHERE cashbox_type = 'analytical' LIMIT 1");
  return first;
};

export const checkTelegramCommands = async () => {
  try {
    const { token, chatId } = await getTelegramSettings();
    if (!token || !chatId) return;

    // ترحيل الجداول
    try { await sqlite.execAsync("ALTER TABLE vouchers ADD COLUMN party_amount REAL;"); } catch(e) {}
    try { await sqlite.execAsync("ALTER TABLE customers ADD COLUMN updated_at INTEGER;"); } catch(e) {}
    try { await sqlite.execAsync("CREATE TABLE IF NOT EXISTS reminders (id TEXT PRIMARY KEY, title TEXT NOT NULL, due_date INTEGER NOT NULL, is_sent INTEGER DEFAULT 0, created_at INTEGER NOT NULL);"); } catch(e) {}

    const lastUpdateId = await AsyncStorage.getItem(LAST_UPDATE_ID_KEY);
    const offset = lastUpdateId ? parseInt(lastUpdateId, 10) + 1 : 0;

    const url = `https://api.telegram.org/bot${token}/getUpdates?offset=${offset}&timeout=5`;
    const response = await fetch(url);
    const data = await response.json();

    if (!data.ok || !data.result || data.result.length === 0) return;

    for (const update of data.result) {
      // ✅ الأزرار (Callback)
      if (update.callback_query) {
        const cb = update.callback_query;
        if (cb.data === "menu_receipt") await sendTelegramMessage("💰 اختر العميل لسند القبض:");
        else if (cb.data === "menu_payment") await sendTelegramMessage("💸 اختر الطرف لسند الصرف:");
        else if (cb.data === "menu_statement") await sendTelegramMessage("📊 اختر العميل لكشف الحساب:");
        else if (cb.data === "menu_stock") await sendTelegramMessage("📦 اختر الصنف للاستعلام عن المخزون:");
        try { await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ callback_query_id: cb.id }) }); } catch (e) {}
        await AsyncStorage.setItem(LAST_UPDATE_ID_KEY, String(update.update_id));
        continue;
      }

      const message = update.message;
      if (!message) continue;
      if (String(message.chat.id) !== String(chatId)) continue;

      // ✅ معالجة الأوامر الإدارية فوراً (قبل أي شيء آخر)
      if (message.text) {
        const txt = message.text.trim();
        if (txt === '/start' || txt === '📋 القائمة') {
          await sendPersistentMenu();
          await AsyncStorage.setItem(LAST_UPDATE_ID_KEY, String(update.update_id));
          continue;
        }
        if (txt === '/status') { await handleStatus(token, chatId); await AsyncStorage.setItem(LAST_UPDATE_ID_KEY, String(update.update_id)); continue; }
        if (txt === '/cancel' || txt === 'الغي') { await handleCancel(token, chatId); await AsyncStorage.setItem(LAST_UPDATE_ID_KEY, String(update.update_id)); continue; }
        if (txt === '/help') { await handleHelp(); await AsyncStorage.setItem(LAST_UPDATE_ID_KEY, String(update.update_id)); continue; }
        
        // الأزرار الثابتة
        if (txt === '💰 سند قبض') { await sendTelegramMessage("💰 تم اختيار سند قبض. اكتب: استلمت [المبلغ] من [الاسم]"); await AsyncStorage.setItem(LAST_UPDATE_ID_KEY, String(update.update_id)); continue; }
        if (txt === '💸 سند صرف') { await sendTelegramMessage("💸 تم اختيار سند صرف. اكتب: صرفت [المبلغ] [البيان]"); await AsyncStorage.setItem(LAST_UPDATE_ID_KEY, String(update.update_id)); continue; }
        if (txt === '📊 كشف حساب') { await sendTelegramMessage("📊 تم اختيار كشف حساب. اكتب: كشف [اسم العميل]"); await AsyncStorage.setItem(LAST_UPDATE_ID_KEY, String(update.update_id)); continue; }
        if (txt === '📦 مخزون') { await sendTelegramMessage("📦 تم اختيار المخزون. اكتب: مخزون [اسم الصنف]"); await AsyncStorage.setItem(LAST_UPDATE_ID_KEY, String(update.update_id)); continue; }
        
        // التذكيرات
        if (txt.startsWith('ذكرني')) {
          const match = txt.match(/ذكرني\s+(.+?)\s+بعد\s+(\d+)\s+أيام?/);
          if (match) {
            const title = match[1].trim();
            const days = parseInt(match[2], 10);
            const dueDate = Date.now() + (days * 24 * 60 * 60 * 1000);
            const id = `REM-${Date.now()}`;
            try {
              await sqlite.runAsync("INSERT INTO reminders (id, title, due_date, is_sent, created_at) VALUES (?, ?, ?, 0, ?)", [id, title, dueDate, Date.now()]);
              await sendTelegramMessage(`✅ تم إضافة التذكير:\n📝 ${title}\n📅 بعد ${days} أيام (${new Date(dueDate).toLocaleDateString('ar-YE')})`);
            } catch (e) { await sendTelegramMessage("❌ تعذر إضافة التذكير."); }
            await AsyncStorage.setItem(LAST_UPDATE_ID_KEY, String(update.update_id));
            continue;
          }
        }

        // معالجة النصوص العادية
        await processTextCommand(txt);
      }
      else if (message.voice) {
        await processVoiceCommand(message.voice, token);
      }

      await AsyncStorage.setItem(LAST_UPDATE_ID_KEY, String(update.update_id));
    }
  } catch (error) {
    console.log("Error checking Telegram commands:", error);
  }
};

// ✅ فحص التذكيرات المستحقة
export const checkReminders = async () => {
  try {
    const now = Date.now();
    const dueReminders: any = await sqlite.getAllAsync("SELECT id, title, due_date FROM reminders WHERE due_date <= ? AND is_sent = 0", [now]);
    for (const rem of dueReminders) {
      await sendTelegramMessage(`⏰ <b>تذكير مستحق:</b>\n${rem.title}\n📅 التاريخ: ${new Date(rem.due_date).toLocaleDateString('ar-YE')}`);
      await sqlite.runAsync("UPDATE reminders SET is_sent = 1 WHERE id = ?", [rem.id]);
    }
  } catch (e) {
    console.log("Reminders check error:", e);
  }
};
