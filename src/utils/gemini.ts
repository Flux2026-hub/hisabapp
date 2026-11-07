import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = "AQ.Ab8RN6J7bRV7yGwhk6NI9mp3W4Giaa5iOxz_4S2sj7_-nFLRsg"; // سيتم وضعه لاحقاً
const genAI = new GoogleGenerativeAI(API_KEY);

export type ParsedCommand = {
  intent: "expense" | "income" | "invoice" | "create_customer" | "unknown";
  amount: number;
  description: string;
  partyName?: string;
  phone?: string;
  useContact?: boolean;
  items?: { name: string; qty: number; price: number }[];
  error?: string; // ✅ حقل جديد لرسالة الخطأ
};

export const parseArabicCommand = async (text: string): Promise<ParsedCommand> => {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash" });

    const prompt = `
      أنت مساعد محاسبي ذكي جداً وتفهم كل اللهجات العربية (خاصة اليمنية). مهمتك هي تحليل النص التالي واستخراج البيانات منه بدقة.
      النص: "${text}"

      قواعد صارمة:
      1. إذا كان النص يتحدث عن دفع أو صرف أو شراء (مثل: "صرفت"، "دفعت"، "اشتريت")، اجعل intent = "expense".
      2. إذا كان النص يتحدث عن استلام أو قبض أو دخل (مثل: "استلمت"، "قبضت")، اجعل intent = "income".
      3. إذا كان النص يطلب فتح حساب أو إضافة عميل (مثل: "افتح حساب"، "أضف عميل"، "سجل زبون")، اجعل intent = "create_customer".
      4. إذا قال المستخدم أن الرقم موجود في جهات الاتصال، أو لم يذكر رقماً وطلب البحث، اجعل useContact = true.
      5. استخرج اسم العميل في حقل partyName، ورقم الهاتف في حقل phone (إذا وجد).
      6. استخرج المبلغ في حقل amount.
      7. أي كلام إضافي أو وصف للعملية ضعه في description.

      أمثلة على المخرجات المطلوبة (JSON فقط):
      { "intent": "create_customer", "partyName": "حسان العشاري", "phone": "777696688", "amount": 0, "description": "إضافة عميل" }
      { "intent": "expense", "amount": 500, "description": "بنزين" }
    `;

    const result = await model.generateContent(prompt);
    const response = result.response.text();
    
    const cleanJson = response.replace(/```json/g, "").replace(/```/g, "").trim();
    return JSON.parse(cleanJson) as ParsedCommand;

  } catch (error: any) {
    console.error("Gemini parsing error:", error);
    return { intent: "unknown", amount: 0, description: "", error: String(error.message || error) };
  }
};
