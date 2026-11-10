const fs = require('fs');
let code = fs.readFileSync('src/utils/telegram.ts', 'utf8');

// 1. استبدال دالة sendTelegramDocument بالكامل لتستخدم FileSystem.uploadAsync
const oldSendDoc = `export const sendTelegramDocument = async (fileUri: string, filename: string, caption: string) => {
  const { token, chatId } = await getTelegramSettings();
  if (!token || !chatId) throw new Error('لم يتم إعداد التوكن أو Chat ID');
  const url = \`https://api.telegram.org/bot\${token}/sendDocument\`;
  const formData = new FormData();
  formData.append('chat_id', chatId);
  formData.append('caption', caption);
  formData.append('document', { uri: fileUri, name: filename, type: 'application/json' } as any);
  const response = await fetch(url, { method: 'POST', body: formData, headers: { 'Content-Type': 'multipart/form-data' } });
  const data = await response.json();
  if (!data.ok) throw new Error(data.description);
  return true;
};`;

const newSendDoc = `export const sendTelegramDocument = async (fileUri: string, filename: string, caption: string) => {
  const { token, chatId } = await getTelegramSettings();
  if (!token || !chatId) throw new Error('لم يتم إعداد التوكن أو Chat ID');
  const url = \`https://api.telegram.org/bot\${token}/sendDocument\`;
  
  try {
    const response = await FileSystem.uploadAsync(url, fileUri, {
      fieldName: 'document',
      httpMethod: 'POST',
      uploadType: FileSystem.FileSystemUploadType.MULTIPART,
      parameters: {
        chat_id: chatId,
        caption: caption,
      },
    });

    const data = JSON.parse(response.body);
    if (!data.ok) throw new Error(data.description);
    return true;
  } catch (error: any) {
    throw new Error(error.message || String(error));
  }
};`;

if (code.includes(oldSendDoc)) {
  code = code.replace(oldSendDoc, newSendDoc);
} else {
  // محاولة بديلة في حال تغيرت المسافات
  code = code.replace(/export const sendTelegramDocument = async[\s\S]*?return true;\n};/, newSendDoc);
}

// 2. تعديل اسم ملف الـ PDF إلى اسم إنجليزي لتجنب مشاكل الترميز
code = code.replace(
  'const filename = `كشف-حساب-${cust.name}-${new Date().toISOString().slice(0,10)}.pdf`;',
  'const filename = `statement_${Date.now()}.pdf`;'
);

fs.writeFileSync('src/utils/telegram.ts', code);
console.log("✅ تم إصلاح طريقة رفع ملفات PDF (باستخدام FileSystem.uploadAsync)!");
