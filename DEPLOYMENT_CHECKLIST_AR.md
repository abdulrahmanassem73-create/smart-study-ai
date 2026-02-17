# تجهيز ونشر مشروع Academic AI على Vercel (Checklist)

## 0) الملفات التي يجب أن تكون موجودة (تم تجهيزها)
- `vercel.json` (حل مشكلة 404 عند Refresh للروابط العميقة)
- `public/robots.txt` (للسماح بالأرشفة — مهم لـ AdSense)
- `src/lib/supabase.ts` يعتمد على:
  - `import.meta.env.VITE_SUPABASE_URL`
  - `import.meta.env.VITE_SUPABASE_ANON_KEY`
  مع **تحذير Console Error في وضع التطوير فقط** إذا كانت القيم ناقصة.

## 1) رفع المشروع على GitHub
1. أنشئ Repo جديد على GitHub.
2. ارفع **كل المشروع** (وليس مجلد dist فقط).
3. تأكد أن الملفات التالية ضمن الرفع:
   - `package.json`
   - `pnpm-lock.yaml`
   - `vite.config.*` (إن وجد)
   - `src/` و `public/` و `index.html` و `vercel.json`

> ملاحظة: لا ترفع مفاتيحك داخل أي ملف. استخدم Environment Variables في Vercel.

## 2) إنشاء مشروع على Vercel
1. Vercel Dashboard → Add New → Project
2. اختر الـ Repo
3. الإعدادات:
   - Framework Preset: **Vite**
   - Install Command: `pnpm install`
   - Build Command: `pnpm run build`
   - Output Directory: `dist`
4. Deploy

## 3) إضافة Environment Variables على Vercel (مهم)
Vercel → Project → Settings → Environment Variables

### أساسي (Supabase)
- **Key:** `VITE_SUPABASE_URL`
  - **Value:** رابط مشروع Supabase (مثال: `https://xxxx.supabase.co`)
- **Key:** `VITE_SUPABASE_ANON_KEY`
  - **Value:** الـ anon public key

ضعهم في:
- Production
- Preview

ثم اعمل Redeploy.

### اختياري (AdSense)
- `VITE_ADSENSE_CLIENT` مثال: `ca-pub-xxxxxxxxxxxx`
- Slots (حسب ما تستخدمه):
  - `VITE_ADSENSE_SLOT`
  - `VITE_ADSENSE_SLOT_SIDEBAR`
  - `VITE_ADSENSE_SLOT_EXPLAIN`
  - `VITE_ADSENSE_SLOT_CONTENT`
  - `VITE_ADSENSE_SLOT_EXAM`
  - `VITE_ADSENSE_SLOT_STATS_MID`
  - `VITE_ADSENSE_SLOT_STATS_BOTTOM`

> بدون client/slot سيظهر Placeholder بدل إعلان حقيقي.

## 4) ضبط Auth URLs في Supabase (لازم لتسجيل الدخول)
Supabase Dashboard → Authentication → URL Configuration

- **Site URL**: حط رابط Vercel النهائي (مثال: `https://yourapp.vercel.app`)
- **Redirect URLs**: أضف:
  - `https://yourapp.vercel.app`
  - `https://yourapp.vercel.app/#/auth`

> إذا عندك دومين مخصص، أضف الدومين أيضاً.

## 5) نشر Supabase Edge Functions (لو بتستخدم الذكاء/المكافآت)
تأكد أن Edge Functions منشورة على مشروع Supabase:
- `generate-study-content`
- `reward-ad`
- `create-checkout-session` (لو Stripe)
- `stripe-webhook` (لو Stripe)

وأن Secrets موجودة في Supabase:
- `GEMINI_API_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- (Stripe عند الحاجة)

## 6) اختبار سريع بعد النشر (QA)
1. افتح الصفحة الرئيسية.
2. جرّب تسجيل الدخول.
3. افتح المكتبة.
4. جرّب Deep Links:
   - `/#/explain/<fileId>`
   - `/#/exam/<fileId>`
   - `/#/بنك-الأسئلة/<fileId>`
   ثم اعمل Refresh وتأكد لا تظهر 404.
5. افتح `https://yourapp.vercel.app/robots.txt` وتأكد أنه ظاهر.

---

## ملاحظة مهمة عن AdSense
- لازم صفحة "سياسة الخصوصية" و"اتفاقية الاستخدام" غالباً لتسريع القبول.
- وسم "إعلان" تمت إضافته أعلى الوحدات من داخل `AdUnit`.
