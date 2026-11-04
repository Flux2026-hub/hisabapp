import { GoogleGenerativeAI } from "@google/generative-ai";

// ⚠️ ضع مفتاح API هنا (استبدل النص أدناه بمفتاحك)
const API_KEY = "AIzaSyCs2OTLP67ndXGf9GZkREKPEFjwS6Bg6gg";
const genAI = new GoogleGenerativeAI(API_KEY);

export type ParsedCommand = {
  intent: "expense" | "income" | "invoice" | "unknown";
  amount: number;
  description: string;
  partyName?: string;
  items?: { name: string; qty: number; price: number }[];
};

export const parseArabicCommand = async (text: string): Promise<ParsedCommand> => {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `
      أنت مساعد محاسبي ذكي. قم بتحليل النص التالي واستخرج منه البيانات المطلوبة بصيغة JSON فقط، دون أي نص إضافي.
      النص: "${text}"

      إذا كان النص يتحدث عن دفع أو صرف (مثل: "صرفت 500 بنزين")، اجعل intent = "expense".
      إذا كان يتحدث عن استلام أو قبض (مثل: "استلمت 1000 من أحمد")، اجعل intent = "income".
      إذا كان يتحدث عن بيع أو شراء أصناف (مثل: "بعت 3 كراتين بـ 200"), اجعل intent = "invoice".
      وإلا اجعل intent = "unknown".

      أمثلة على JSON المطلوب:
      { "intent": "expense", "amount": 500, "description": "بنزين" }
      { "intent": "income", "amount": 1000, "description": "دفعة من العميل", "partyName": "أحمد" }
      { "intent": "invoice", "amount": 200, "description": "مبيعات", "items": [{ "name": "كرتون", "qty": 3, "price": 66.6 }] }
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
