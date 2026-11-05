import { GoogleGenerativeAI } from "@google/generative-ai";

// ⚠️ ضع مفتاح API هنا (استبدل النص أدناه بمفتاحك)
const API_KEY = "AQ.Ab8RN6Jyd_dcQutaZBaYwd8dUmbp5xHFEc9J9pp9afB8kQxrHQ"; 
const genAI = new GoogleGenerativeAI(API_KEY);

export type ParsedCommand = {
  intent: "expense" | "income" | "invoice" | "create_customer" | "unknown";
  amount: number;
  description: string;
  partyName?: string;
  phone?: string;
  items?: { name: string; qty: number; price: number }[];
};

export const parseArabicCommand = async (text: string): Promise<ParsedCommand> => {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash" });

    const prompt = `
      أنت مساعد محاسبي ذكي. قم بتحليل النص التالي واستخرج منه البيانات المطلوبة بصيغة JSON فقط، دون أي نص إضافي.
      النص: "${text}"

      النوايا المتاحة (intent):
      1. "expense": إذا كان النص يتحدث عن دفع أو صرف (مثل: "صرفت 500 بنزين").
      2. "income": إذا كان يتحدث عن استلام أو قبض (مثل: "استلمت 1000 من أحمد").
      3. "invoice": إذا كان يتحدث عن بيع أو شراء أصناف (مثل: "بعت 3 كراتين بـ 200").
      4. "create_customer": إذا كان النص يطلب إضافة عميل جديد (مثل: "افتح حساب عميل جديد باسم أحمد علي ورقمه 777123456").
      5. "unknown": إذا لم تفهم النص.

      أمثلة على JSON المطلوب:
      { "intent": "expense", "amount": 500, "description": "بنزين" }
      { "intent": "income", "amount": 1000, "description": "دفعة من العميل", "partyName": "أحمد" }
      { "intent": "create_customer", "partyName": "أحمد علي", "phone": "777123456", "amount": 0, "description": "إضافة عميل" }
    `;

    const result = await model.generateContent(prompt);
    const response = result.response.text();
    
    const cleanJson = response.replace(/```json/g, "").replace(/```/g, "").trim();
    return JSON.parse(cleanJson) as ParsedCommand;

  } catch (error) {
    console.error("Gemini parsing error:", error);
    return { intent: "unknown", amount: 0, description: "" };
  }
};
