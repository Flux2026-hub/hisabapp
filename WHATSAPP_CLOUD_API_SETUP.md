# WhatsApp Business Cloud API — متطلبات الربط

## مصادر Meta الرسمية

- https://developers.facebook.com/documentation/business-messaging/whatsapp/get-started
- https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/overview
- https://developers.facebook.com/documentation/business-messaging/whatsapp/business-phone-numbers/media

## متطلبات Meta

- حساب Facebook أو Meta مُدار.
- تسجيل كمطور في Meta.
- Meta App باستخدام use case: Connect with customers through WhatsApp.
- Business Portfolio.
- WhatsApp Business/Messaging Account.
- رقم هاتف مفعّل للأعمال وإعداد Phone Number ID.
- Access Token؛ المؤقت للاختبار، وSystem User token دائم للتشغيل.
- Webhook عام HTTPS لحالات التسليم والقراءة والرسائل.
- قوالب Utility/Marketing/Authentication معتمدة للإرسال خارج نافذة خدمة العملاء.

## الصلاحيات الأساسية للتوكن الدائم

- business_management
- whatsapp_business_messaging
- whatsapp_business_management

## التقارير والمرفقات

يمكن إرسال PDF أو XLSX كمستند. Media IDs تنتهي بعد 30 يومًا، وروابط media URLs تنتهي بعد 5 دقائق. حد المستندات المذكور في توثيق Meta هو 100MB.

## سياسة الإرسال

خارج نافذة خدمة العملاء البالغة 24 ساعة يجب استخدام Template معتمد. الإرسال التلقائي الصامت لا يتم من Android مباشرة؛ يجب أن يتم من خادم مركزي يحتفظ بالتوكن ويستدعي Graph API، مع موافقة المستلم وإدارة القوالب.
