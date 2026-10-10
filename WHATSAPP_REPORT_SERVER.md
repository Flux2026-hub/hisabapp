
## مثال إنشاء القالب عبر Graph API

بعد إنشاء/رفع asset الخاص بـ Document Header، استخدم `header_handle` الذي تعيده Meta:

```bash
curl -X POST "https://graph.facebook.com/v26.0/$WHATSAPP_BUSINESS_ACCOUNT_ID/message_templates" \
  -H "Authorization: Bearer $WHATSAPP_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "inventory_consumption_report",
    "category": "UTILITY",
    "language": "ar",
    "parameter_format": "positional",
    "components": [
      {
        "type": "HEADER",
        "format": "DOCUMENT",
        "example": {
          "header_handle": ["DOCUMENT_ASSET_HANDLE_FROM_META"]
        }
      },
      {
        "type": "BODY",
        "text": "مرحبًا {{1}}، تقرير استهلاك المواد الخام والهالك للفترة من {{2}} إلى {{3}} مرفق بهذه الرسالة.",
        "example": {
          "body_text": [["أحمد", "2026-01-01", "2026-12-31"]]
        }
      }
    ]
  }'
```

يجب انتظار حالة `APPROVED` قبل الإرسال. إذا كان حسابك يعرض رمز لغة مختلفًا للعربية في WhatsApp Manager، استخدم ذلك الرمز في `WHATSAPP_TEMPLATE_LANGUAGE`.

يمكن اختبار نقطة HisabApp بعد ضبط المتغيرات:

```bash
curl -X POST "http://localhost:3000/api/reports/material-consumption/send-whatsapp" \
  -H "x-internal-api-key: change-this-internal-key" \
  -H "Content-Type: application/json" \
  -d '{"companyId":1,"from":"2026-01-01","to":"2026-12-31","recipient":"9665XXXXXXXX","recipientName":"أحمد"}'
```
