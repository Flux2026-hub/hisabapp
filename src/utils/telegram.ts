import * as SecureStore from 'expo-secure-store';
import AsyncStorage from "@react-native-async-storage/async-storage";
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
      if (!message || !message.text) continue;

      if (String(message.chat.id) !== String(chatId)) continue;

      const text = message.text.trim();
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
      else {
        await sendTelegramMessage("🤖 لم أفهم الأمر. جرب: \"صرفت 500 بنزين\" أو \"استلمت 1000 من أحمد\".");
      }

      await AsyncStorage.setItem(LAST_UPDATE_ID_KEY, String(update.update_id));
    }
  } catch (error) {
    console.log("Error checking Telegram commands:", error);
  }
};
