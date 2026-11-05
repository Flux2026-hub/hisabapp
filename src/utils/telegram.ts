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
  if (!token || !chatId) throw new Error('لم يتم إعداد التوكن أو Chat ID');
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
  const parsed = await parseArabicCommand(text);
  
  if (parsed.intent === "expense" && parsed.amount > 0) {
    const expenseId = `EXP-${Date.now()}`;
    const expenseNo = `EXP-${String(Date.now()).slice(-3)}`;
    const now = Date.now();
    await sqlite.runAsync(
      `INSERT INTO vouchers (id, voucher_no, voucher_type, party_name, amount, description, created_at, party_type, currency_code, exchange_rate) VALUES (?, ?, 'payment', 'مصروف ذكي', ?, ?, ?, 'none', 'YER', 1)`,
      [expenseId, expenseNo, parsed.amount, parsed.description || text, now]
    );
    await sqlite.runAsync("UPDATE cashboxes SET balance = balance - ? WHERE id = 'cash-main'", [parsed.amount]);
    await sendTelegramMessage(`✅ تم تسجيل المصروف:\n💸 ${parsed.amount} YER\n📝 ${parsed.description}`);
  } 
  else if (parsed.intent === "income" && parsed.amount > 0) {
    const incomeId = `INC-${Date.now()}`;
    const incomeNo = `INC-${String(Date.now()).slice(-3)}`;
    const now = Date.now();
    await sqlite.runAsync(
      `INSERT INTO vouchers (id, voucher_no, voucher_type, party_name, amount, description, created_at, party_type, currency_code, exchange_rate) VALUES (?, ?, 'receipt', 'إيراد ذكي', ?, ?, ?, 'none', 'YER', 1)`,
      [incomeId, incomeNo, parsed.amount, parsed.description || text, now]
    );
    await sqlite.runAsync("UPDATE cashboxes SET balance = balance + ? WHERE id = 'cash-main'", [parsed.amount]);
    await sendTelegramMessage(`✅ تم تسجيل الإيراد:\n💰 ${parsed.amount} YER\n📝 ${parsed.description}`);
  }
  else if (parsed.intent === "create_customer" && parsed.partyName) {
    try {
      let phoneNumber = parsed.phone || "";
      
      // ✅ البحث في جهات الاتصال
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
    } catch (err) {
      await sendTelegramMessage(`❌ تعذر إضافة العميل: ${String(err)}`);
    }
  }
  else {
    await sendTelegramMessage("🤖 لم أفهم الأمر. جرب:\n- \"صرفت 500 بنزين\"\n- \"استلمت 1000 من أحمد\"\n- \"افتح حساب عميل جديد باسم...\"\n- أو أرسل رسالة صوتية");
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
    const genAI = new GoogleGenerativeAI("AQ.Ab8RN6J44E1VOEus_it_hFS8fxm9ze4iCFEPuq2HptrK2PcQVA"); // سيتم استبداله لاحقاً
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
    await sendTelegramMessage(`❌ تعذر معالجة الصوت: ${String(error)}`);
  }
};

export const checkTelegramCommands = async () => {
  try {
    const { token, chatId } = await getTelegramSettings();
    if (!token || !chatId) return;

    const lastUpdateId = await AsyncStorage.getItem(LAST_UPDATE_ID_KEY);
    const offset = lastUpdateId ? parseInt(lastUpdateId, 10) + 1 : 0;

    const url = `https://api.telegram.org/bot${token}/getUpdates?offset=${offset}&timeout=5`;
    const response = await fetch(url);
    const data = await response.json();

    if (!data.ok || !data.result || data.result.length === 0) return;

    for (const update of data.result) {
      const message = update.message;
      if (!message) continue;
      if (String(message.chat.id) !== String(chatId)) continue;

      if (message.text) {
        await processTextCommand(message.text.trim());
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
