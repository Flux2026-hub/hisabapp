# إعداد EAS وMySQL المركزي

## بناء APK للتثبيت المباشر

1. افتح https://expo.dev/signup وأنشئ حساب Expo مجانيًا.
2. من مجلد المشروع ثبت EAS CLI أو استخدم npx:

```bash
pnpm add --global eas-cli
# أو
npx eas-cli@latest login
```

3. سجل الدخول:

```bash
eas login
eas whoami
```

4. من جذر المشروع:

```bash
eas build:configure
```

المشروع يحتوي مسبقًا على `eas.json` وفيه profile اسمه `preview` بخيار `android.buildType: apk`.

5. ابدأ البناء:

```bash
npx eas-cli@latest build -p android --profile preview
```

عند انتهاء البناء سيظهر رابط APK في الطرفية ولوحة Expo. افتح الرابط على الهاتف، فعّل السماح بتثبيت التطبيقات من هذا المصدر، وثبّت الملف.

لا تحتاج عضوية Google Play لإنشاء APK للتثبيت المباشر. تحتاج عضوية Google Play فقط للنشر في المتجر.

## قاعدة MySQL المركزية

أنشئ قاعدة MySQL ثم عرّف:

```env
DATABASE_URL=mysql://USER:PASSWORD@HOST:3306/hisabapp
PORT=3000
```

ثم:

```bash
pnpm install
pnpm mysql:generate
pnpm mysql:migrate
pnpm central:dev
```

اختبر:

```bash
curl http://localhost:3000/health
```

نقطة المزامنة:

```text
POST /api/sync/push
Idempotency-Key: unique-operation-id
```

تنفذ العملية داخل Transaction واحدة، وتمنع التكرار بواسطة `operationId`.

## ملاحظات إنتاجية

- ضع الخادم خلف HTTPS.
- أضف JWT أو جلسات مستخدمين قبل الإنتاج.
- لا تقبل `companyId` من الجهاز بعد إضافة المصادقة؛ خذه من المستخدم المصادق عليه.
- أضف foreign keys وindexes ومخزن الأرصدة إلى migration.
- املأ جدول الأصناف والمخازن والحسابات المركزية واحتفظ بخريطة `localId → centralId`.
- لا تعتبر المستند مرحّلًا مركزيًا قبل نجاح استجابة الخادم.
