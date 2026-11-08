import * as Print from "expo-print";
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from 'expo-file-system/legacy';
import * as Contacts from "expo-contacts/legacy";
import { sqlite } from "../db/local";
import { parseArabicCommand } from "./gemini";

const TOKEN_KEY = 'tg_token';
const CHAT_ID_KEY = 'tg_chat_id';
const LAST_UPDATE_ID_KEY = '@flux_last_tg_update_id';

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
  const formData = new FormData();
  formData.append('chat_id', chatId);
  formData.append('caption', caption);
  formData.append('document', { uri: fileUri, name: filename, type: 'application/json' } as any);
  const response = await fetch(url, { method: 'POST', body: formData, headers: { 'Content-Type': 'multipart/form-data' } });
  const data = await response.json();
  if (!data.ok) throw new Error(data.description);
  return true;
};

export const notifyLargeInvoice = async (invoiceData: any) => {
  const msg = `🚨 <b>فاتورة كبيرة جديدة!</b>\n\n👤 العميل: ${invoiceData.customerName}\n💰 المبلغ: ${invoiceData.total} ريال\n🧾 رقم الفاتورة: ${invoiceData.invoiceNumber}`;
  return await sendTelegramMessage(msg);
};

const processTextCommand = async (text: string) => {
  try {
    const parsed = await parseArabicCommand(text);
    
    if (parsed.intent === "expense" && parsed.amount > 0) {
      const expenseId = `EXP-${Date.now()}`;
      const expenseNo = `EXP-${String(Date.now()).slice(-6)}`;
      const now = Date.now();
      
      const cashbox: any = await sqlite.getFirstAsync("SELECT id FROM cashboxes WHERE cashbox_type = 'analytical' LIMIT 1");
      const cashboxId = cashbox ? cashbox.id : null;

      if (!cashboxId) {
        await sendTelegramMessage("❌ لا يوجد صندوق تحليلي مسجل في التطبيق لخصم المصروف منه.");
        return;
      }

      let partyId = null;
      let pType = 'none';
      let pName = 'مصروف ذكي';

      // البحث عن حساب في دليل الحسابات إذا تم ذكره
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
      
      if (pType === 'supplier' && partyId) {
        await sqlite.runAsync("UPDATE suppliers SET balance = balance - ? WHERE id = ?", [parsed.amount, partyId]);
      } else if (pType === 'customer' && partyId) {
        await sqlite.runAsync("UPDATE customers SET balance = balance + ? WHERE id = ?", [parsed.amount, partyId]);
      }

      await sendTelegramMessage(`✅ تم تسجيل المصروف:\n💸 ${parsed.amount} YER\n📝 ${parsed.description}\n👤 الطرف: ${pName}`);
    } 
    else if (parsed.intent === "income" && parsed.amount > 0) {
      const incomeId = `INC-${Date.now()}`;
      const incomeNo = `INC-${String(Date.now()).slice(-6)}`;
      const now = Date.now();
      
      const cashbox: any = await sqlite.getFirstAsync("SELECT id FROM cashboxes WHERE cashbox_type = 'analytical' LIMIT 1");
      const cashboxId = cashbox ? cashbox.id : null;

      if (!cashboxId) {
        await sendTelegramMessage("❌ لا يوجد صندوق تحليلي مسجل في التطبيق لإضافة الإيراد إليه.");
        return;
      }

      let partyId = null;
      let pType = 'none';
      let pName = 'إيراد ذكي';

      // البحث عن حساب في دليل الحسابات إذا تم ذكره
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
      
      if (pType === 'customer' && partyId) {
        await sqlite.runAsync("UPDATE customers SET balance = balance - ? WHERE id = ?", [parsed.amount, partyId]);
      } else if (pType === 'supplier' && partyId) {
        await sqlite.runAsync("UPDATE suppliers SET balance = balance - ? WHERE id = ?", [parsed.amount, partyId]);
      }

      await sendTelegramMessage(`✅ تم تسجيل الإيراد:\n💰 ${parsed.amount} YER\n📝 ${parsed.description}\n👤 الطرف: ${pName}`);
    }
    
    else if (parsed.intent === "query_customer_statement" && parsed.partyName) {
      try {
        await sendTelegramMessage("⏳ جاري إعداد كشف الحساب...");
        
        // 1. البحث عن العميل
        const cust: any = await sqlite.getFirstAsync("SELECT id, name, balance, phone FROM customers WHERE name LIKE ? LIMIT 1", [`%${parsed.partyName}%`]);
        if (!cust) {
          await sendTelegramMessage(`❌ لم يتم العثور على العميل "${parsed.partyName}"`);
          return;
        }

        // 2. جلب الفواتير والسندات
        const invoices: any = await sqlite.getAllAsync("SELECT id, invoice_no, total, created_at, invoice_type FROM invoices WHERE party_id = ? ORDER BY created_at ASC", [cust.id]);
        const vouchers: any = await sqlite.getAllAsync("SELECT id, voucher_no, amount, created_at, voucher_type FROM vouchers WHERE party_id = ? ORDER BY created_at ASC", [cust.id]);

        // 3. دمج الحركات وترتيبها
        const transactions: any[] = [];
        invoices.forEach((inv: any) => {
          transactions.push({
            date: new Date(inv.created_at).toLocaleDateString('ar-YE'),
            ref: inv.invoice_no,
            type: inv.invoice_type === 'sales' ? 'فاتورة مبيعات' : 'فاتورة مشتريات',
            debit: inv.invoice_type === 'sales' ? Number(inv.total) : 0, // العميل مدين
            credit: inv.invoice_type === 'purchase' ? Number(inv.total) : 0,
          });
        });
        vouchers.forEach((v: any) => {
          transactions.push({
            date: new Date(v.created_at).toLocaleDateString('ar-YE'),
            ref: v.voucher_no,
            type: v.voucher_type === 'receipt' ? 'سند قبض' : 'سند دفع',
            debit: v.voucher_type === 'payment' ? Number(v.amount) : 0,
            credit: v.voucher_type === 'receipt' ? Number(v.amount) : 0,
          });
        });

        transactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        // 4. بناء جدول HTML
        const rowsHtml = transactions.map(t => `
          <tr>
            <td>${t.date}</td>
            <td>${t.ref}</td>
            <td>${t.type}</td>
            <td>${t.debit > 0 ? t.debit.toFixed(2) : '-'}</td>
            <td>${t.credit > 0 ? t.credit.toFixed(2) : '-'}</td>
          </tr>
        `).join('');

        const html = `
          <html>
            <head>
              <meta charset="utf-8">
              <style>
                body { font-family: 'Cairo', sans-serif; direction: rtl; padding: 20px; }
                h1 { text-align: center; color: #0B2545; }
                .header { text-align: center; margin-bottom: 30px; }
                .info { margin-bottom: 20px; font-size: 14px; }
                table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
                th, td { border: 1px solid #CBD5E1; padding: 8px; text-align: right; }
                th { background-color: #F1F5F9; color: #0B2545; }
                .total { font-size: 18px; font-weight: bold; text-align: left; margin-top: 20px; color: #0B2545; }
              </style>
            </head>
            <body>
              <div class="header">
                <h1>فلوكس - كشف حساب</h1>
                <p>لأنابيب أكثر نظافة</p>
              </div>
              <div class="info">
                <p><strong>العميل:</strong> ${cust.name}</p>
                <p><strong>الهاتف:</strong> ${cust.phone || 'غير مسجل'}</p>
                <p><strong>تاريخ الكشف:</strong> ${new Date().toLocaleDateString('ar-YE')}</p>
              </div>
              <table>
                <thead>
                  <tr>
                    <th>التاريخ</th>
                    <th>المرجع</th>
                    <th>البيان</th>
                    <th>مدين (عليه)</th>
                    <th>دائن (له)</th>
                  </tr>
                </thead>
                <tbody>
                  ${rowsHtml}
                </tbody>
              </table>
              <div class="total">
                الرصيد الحالي: ${Number(cust.balance).toFixed(2)} YER
              </div>
            </body>
          </html>
        `;

        // 5. إنشاء الـ PDF وإرساله
        const { uri } = await Print.printToFileAsync({ html });
        const filename = `كشف-حساب-${cust.name}-${new Date().toISOString().slice(0,10)}.pdf`;
        
        // نسخ الملف باسم مقروء
        const newUri = FileSystem.cacheDirectory + filename;
        await FileSystem.copyAsync({ from: uri, to: newUri });
        
        // إرسال الملف عبر تليجرام
        await sendTelegramDocument(newUri, filename, `📊 كشف حساب العميل: ${cust.name}\n💰 الرصيد الحالي: ${Number(cust.balance).toFixed(2)} YER`);

      } catch (err) {
        await sendTelegramMessage(`❌ خطأ في إعداد كشف الحساب: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    else if (parsed.intent === "create_customer" && parsed.partyName) {
      let phoneNumber = parsed.phone || "";
      
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
        const lastNum = parseInt(lastCustomer.code.replace(/\D/g, ""), 10);
        nextCode = `CUS-${String(lastNum + 1).padStart(3, "0")}`;
      }
      
      const customerId = `CUS-${Date.now()}`;
      const now = Date.now();
      
      await sqlite.runAsync(
        `INSERT INTO customers (id, code, name, phone, balance, created_at, updated_at) VALUES (?, ?, ?, ?, 0, ?, ?)`,
        [customerId, nextCode, parsed.partyName, phoneNumber, now, now]
      );
      
      await sendTelegramMessage(`✅ تم إضافة العميل بنجاح:\n👤 الاسم: ${parsed.partyName}\n🔢 الكود: ${nextCode}\n📞 الهاتف: ${phoneNumber || "غير مسجل"}`);
    }
    else {
      await sendTelegramMessage("🤖 لم أفهم الأمر. جرب:\n- \"صرفت 500 بنزين\"\n- \"استلمت 1000 من أحمد\"\n- \"افتح حساب عميل جديد باسم...\"");
    }
  } catch (error) {
    console.log("Error processing text command:", error);
    await sendTelegramMessage("❌ حدث خطأ أثناء تنفيذ الأمر. تفقد السجل.");
  }
};

const processVoiceCommand = async (voice: any, token: string) => {
  try {
    await sendTelegramMessage("🎤 جاري تحليل الرسالة الصوتية...");
    const fileRes = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${voice.file_id}`);
    const fileData = await fileRes.json();
    if (!fileData.ok) throw new Error("تعذر الحصول على الملف من تليجرام");

    const filePath = fileData.result.file_path;
    const audioUrl = `https://api.telegram.org/file/bot${token}/${filePath}`;
    
    const localPath = FileSystem.cacheDirectory + `voice_${Date.now()}.ogg`;
    await FileSystem.downloadAsync(audioUrl, localPath);
    const base64Audio = await FileSystem.readAsStringAsync(localPath, { encoding: FileSystem.EncodingType.Base64 });
    
    const { GoogleGenerativeAI } = require("@google/generative-ai");
    const genAI = new GoogleGenerativeAI("AQ.Ab8RN6J7bRV7yGwhk6NI9mp3W4Giaa5iOxz_4S2sj7_-nFLRsg"); // سيتم استبداله لاحقاً
    const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash" });
    
    const result = await model.generateContent([
      "استمع لهذه الرسالة الصوتية العربية وحولها إلى نص مكتوب فقط، دون أي تعليق أو إضافة.",
      { inlineData: { data: base64Audio, mimeType: "audio/ogg" } }
    ]);
    
    const transcribedText = result.response.text().trim();
    await FileSystem.deleteAsync(localPath, { idempotent: true });
    
    if (!transcribedText) throw new Error("لم يتمكن الذكاء الاصطناعي من فهم الصوت");
    
    await sendTelegramMessage(`📝 سمعتك تقول: "${transcribedText}"\n⏳ جاري التنفيذ...`);
    
    await processTextCommand(transcribedText);
    
  } catch (error) {
    await sendTelegramMessage(`❌ تعذر معالجة الصوت.`);
  }
};

export const checkTelegramCommands = async () => {
  try {
    const { token, chatId } = await getTelegramSettings();
    if (!token || !chatId) return;

    // إنشاء الأعمدة الناقصة تلقائياً لضمان عدم فشل الأوامر
    try { await sqlite.execAsync("ALTER TABLE vouchers ADD COLUMN party_amount REAL;"); } catch(e) {}
    try { await sqlite.execAsync("ALTER TABLE customers ADD COLUMN updated_at INTEGER;"); } catch(e) {}

    const lastUpdateId = await AsyncStorage.getItem(LAST_UPDATE_ID_KEY);
    const offset = lastUpdateId ? parseInt(lastUpdateId, 10) + 1 : 0;

    const url = `https://api.telegram.org/bot${token}/getUpdates?offset=${offset}&timeout=5`;
    const response = await fetch(url);
    const data = await response.json();

    if (!data.ok || !data.result || data.result.length === 0) return;

    // جلب آخر 3 رسائل كحد أقصى لتجنب البطء
    const messagesToProcess = data.result.slice(-3); 

    for (const update of messagesToProcess) {
      const message = update.message;
      if (!message) continue;
      if (String(message.chat.id) !== String(chatId)) continue;

      // إرسال الأمر للمعالجة
      if (message.text) {
        await processTextCommand(message.text.trim());
      }
      else if (message.voice) {
        await processVoiceCommand(message.voice, token);
      }

      // حفظ رقم الرسالة التي تمت معالجتها
      await AsyncStorage.setItem(LAST_UPDATE_ID_KEY, String(update.update_id));
    }
  } catch (error) {
    console.log("Error checking Telegram commands:", error);
  }
};
