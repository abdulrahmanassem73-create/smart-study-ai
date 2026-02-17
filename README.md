# Academic AI Study System

منصة تعليمية ذكية (واجهة React) تساعد الطالب على:
- رفع ملفات المحاضرات (PDF/صور)
- استخراج النص داخل المتصفح
- توليد شرح Markdown وأسئلة (عبر Gemini لكن **من خلال Supabase Edge Functions**)
- اختبار تفاعلي + لوحة نتائج ورسوم بيانية
- مكتبة للمستخدم (Caching محلي + حفظ سحابي عند تسجيل الدخول)

## التقنيات المستخدمة
- React 19 + TypeScript + Vite
- Tailwind CSS v4 + shadcn/ui
- RTL + Dark Mode
- framer-motion (Animations)
- recharts (Charts)
- react-markdown + remark-gfm + KaTeX (LaTeX)
- pdfjs-dist (PDF text extraction)
- tesseract.js (OCR للصور)

## التشغيل محلياً
```bash
pnpm install
pnpm dev
```

## بناء نسخة Production
```bash
pnpm build
pnpm preview
```

## ملاحظات مهمة
- **Gemini (مؤمّن):** لا يوجد أي مفتاح API داخل الواجهة الأمامية. جميع الاستدعاءات تتم عبر **Supabase Edge Functions** مع Secret (`GEMINI_API_KEY`).
- **RLS (حماية البيانات):** تم إعداد سياسات Row Level Security لضمان أن كل مستخدم يرى/يعدل بياناته فقط.
- استخراج النص من ملفات Word (DOC/DOCX) غير مفعّل حالياً.

## النشر (Deployment)

### 1) نشر الواجهة (Vite)
المشروع جاهز للنشر على منصات Static مثل:
- Vercel
- Netlify

قم برفع مشروع Vite (مجلد `dist`) أو اربط المستودع ثم فعّل Build Command: `pnpm build` و Output: `dist`.

### 2) تفعيل Edge Functions + Secrets (Supabase)

- الدالة المستخدمة: `generate-study-content`
- مكانها في المشروع: `supabase/functions/generate-study-content/`

إعداد Secret (مرة واحدة):
```bash
supabase secrets set GEMINI_API_KEY="<YOUR_GEMINI_KEY>"
```

نشر الدالة:
```bash
supabase functions deploy generate-study-content
```

### 3) تطبيق سياسات RLS (Supabase)
تم إضافة سكربت السياسات داخل المشروع:
- `supabase/migrations/20260216114500_rls_hardening.sql`

لتطبيقه على مشروع Supabase:
```bash
supabase login
supabase link --project-ref <YOUR_PROJECT_REF>
supabase db push
```

> بديل سريع: انسخ محتوى ملف الـ SQL وافتح Supabase Dashboard → SQL Editor → Run.
