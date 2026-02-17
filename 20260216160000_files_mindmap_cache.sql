-- =====================================================================
-- Add mindmap_code cache to public.files + tighten column UPDATE grants
-- =====================================================================
-- هدفك: كاش دائم للخرائط الذهنية داخل جدول files.
-- ملاحظة مهمة (Postgres/Supabase):
-- - RLS يتحكم في الصفوف (rows) وليس الأعمدة (columns).
-- - لتقييد التحديث على أعمدة محددة نستخدم صلاحيات الأعمدة (GRANT UPDATE(col)).
--
-- هذا الـ migration:
-- 1) يضيف العمود mindmap_code.
-- 2) يقيّد UPDATE للمستخدمين الموثقين على مجموعة أعمدة آمنة فقط.
--
-- =====================================================================

alter table public.files
  add column if not exists mindmap_code text;

-- -------------------------------------------------
-- Column-level UPDATE grants
-- -------------------------------------------------
-- نجعل update مسموح فقط على الأعمدة التي يستخدمها التطبيق فعلاً
-- (ويشمل mindmap_code). هذا يمنع أي update على أعمدة أخرى مستقبلية
-- بدون تعديل صريح هنا.

revoke update on table public.files from authenticated;

grant select, insert, delete on table public.files to authenticated;

grant update (
  name,
  content,
  summary,
  pdf_path,
  file_size_bytes,
  mindmap_code
) on table public.files to authenticated;
