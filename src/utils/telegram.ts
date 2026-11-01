import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'tg_token';
const CHAT_ID_KEY = 'tg_chat_id';

export const saveTelegramSettings = async (token: string, chatId: string) => {
  try {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
    await SecureStore.setItemAsync(CHAT_ID_KEY, chatId);
    return true;
  } catch (error) {
    console.error('خطأ في حفظ إعدادات تليجرام:', error);
    return false;
  }
};

export const getTelegramSettings = async () => {
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  const chatId = await SecureStore.getItemAsync(CHAT_ID_KEY);
  return { token, chatId };
};

export const sendTelegramMessage = async (message: string) => {
  const { token, chatId } = await getTelegramSettings();
  
  if (!token || !chatId) {
    throw new Error('لم يتم إعداد التوكن أو Chat ID بعد.');
  }

  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'HTML' }),
  });

  const data = await response.json();
  if (!data.ok) throw new Error(data.description || 'فشل إرسال الرسالة');
  return true;
};

export const notifyLargeInvoice = async (invoiceData: any) => {
  const msg = `🚨 <b>فاتورة كبيرة جديدة!</b>\n\n` +
              `👤 العميل: ${invoiceData.customerName || 'غير محدد'}\n` +
              `💰 المبلغ: ${invoiceData.total} ريال\n` +
              `🧾 رقم الفاتورة: ${invoiceData.invoiceNumber || '---'}\n` +
              `📅 التاريخ: ${new Date().toLocaleDateString('ar-YE')}`;
  return await sendTelegramMessage(msg);
};
