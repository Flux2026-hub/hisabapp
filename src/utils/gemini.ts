import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = "AQ.Ab8RN6J7bRV7yGwhk6NI9mp3W4Giaa5iOxz_4S2sj7_-nFLRsg"; // سيتم وضعه لاحقاً
const genAI = new GoogleGenerativeAI(API_KEY);

export type ParsedCommand = {
  intent: "expense" | "income" | "invoice" | "create_customer" | "unknown";
  amount: number;
  description: string;
  partyName?: string;
  phone?: string;
  accountName?: string;
  useContact?: boolean;
  itemName?: string;
  quantity?: number;
  unitPrice?: number;
  currencyCode?: string;
  discountValue?: number;
  salesRepName?: string;
  error?: string;
};

export const parseArabicCommand = async (text: string): Promise<ParsedCommand> => {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash" });

    const prompt = `
      أنت مساعد محاسبي ذكي جداً وتفهم كل اللهجات العربية (خاصة اليمنية). مهمتك هي تحليل النص التالي واستخراج البيانات منه بدقة.
      النص: "${text}"

      قواعد صارمة:
      1. إذا كان النص يتحدث عن دفع أو صرف أو شراء، اجعل intent = "expense". (استخرج اسم المورد/العميل في partyName، واسم الحساب إذا ذُكر في accountName).
      2. إذا كان النص يتحدث عن استلام أو قبض أو دخل، اجعل intent = "income". (استخرج اسم العميل/المورد في partyName، واسم الحساب إذا ذُكر في accountName).
      3. إذا كان النص يطلب إضافة عميل جديد، اجعل intent = "create_customer". (استخرج الاسم في partyName، والهاتف في phone).
      4. إذا كان النص يتحدث عن إصدار فاتورة مبيعات أو بيع أصناف، اجعل intent = "invoice". (استخرج اسم العميل في partyName، اسم الصنف في itemName، الكمية في quantity، سعر الوحدة في unitPrice، العملة في currencyCode، الخصم في discountValue، اسم المندوب في salesRepName).
      5. إذا لم يكن النص محاسبياً، اجعل intent = "unknown".

      قواعد إضافية هامة:
      - لا تهتم بترتيب الكلمات، افهم المعنى العام للجملة.
      - جميع المبالغ والأرقام يجب أن تكون أرقاماً (500) وليس نصاً.
      - العملات المقبولة: YER (ريال يمني)، SAR (ريال سعودي). إذا لم تُذكر في الفاتورة، اجعلها "YER".

      أمثلة على المخرجات المطلوبة (JSON فقط بدون أي نص آخر):
      { "intent": "expense", "amount": 500, "partyName": "أحمد", "description": "بنزين" }
      { "intent": "income", "amount": 14000, "partyName": "مراد الوليدي", "description": "دفعة من العميل" }
      { "intent": "create_customer", "partyName": "حسان العشاري", "phone": "777696688", "amount": 0, "description": "إضافة عميل" }
      { "intent": "invoice", "partyName": "أحمد", "itemName": "ماسورة", "quantity": 100, "unitPrice": 500, "currencyCode": "YER", "description": "فاتورة مبيعات" }
      { "intent": "invoice", "partyName": "محلات الزعيم", "itemName": "ماسورة", "quantity": 50, "unitPrice": 10, "currencyCode": "SAR", "discountValue": 5, "salesRepName": "وليد", "description": "فاتورة مبيعات" }
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
