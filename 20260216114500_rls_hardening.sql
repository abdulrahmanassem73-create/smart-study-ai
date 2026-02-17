-- =====================================================================
-- Supabase RLS Hardening Script (Academic AI Study System)
-- الهدف: خصوصية كاملة + Leaderboard آمن
--
-- مهم قبل التنفيذ:
-- 1) شغّل السكربت من Supabase SQL Editor بصلاحية owner.
-- 2) تأكد أن كل الجداول تحتوي عمود user_id (uuid) كما هو متوقع.
-- 3) لو عندك سياسات قديمة، هذا السكربت يحاول حذفها بأسماء محددة.
-- =====================================================================

-- -------------------------------------------------
-- 0) Tables: Enable RLS
-- -------------------------------------------------
alter table public.files enable row level security;
alter table public.quizzes enable row level security;
alter table public.chats enable row level security;
alter table public.notifications enable row level security;
alter table public.user_stats enable row level security;
alter table public.profiles enable row level security;

-- -------------------------------------------------
-- 1) Owner-only policies for user-owned tables
--    (files, quizzes, chats, notifications)
-- -------------------------------------------------

-- ===== files =====
drop policy if exists "files_owner_select" on public.files;
drop policy if exists "files_owner_insert" on public.files;
drop policy if exists "files_owner_update" on public.files;
drop policy if exists "files_owner_delete" on public.files;

create policy "files_owner_select" on public.files
for select
to authenticated
using (auth.uid() = user_id);

create policy "files_owner_insert" on public.files
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "files_owner_update" on public.files
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "files_owner_delete" on public.files
for delete
to authenticated
using (auth.uid() = user_id);


-- ===== quizzes =====
drop policy if exists "quizzes_owner_select" on public.quizzes;
drop policy if exists "quizzes_owner_insert" on public.quizzes;
drop policy if exists "quizzes_owner_update" on public.quizzes;
drop policy if exists "quizzes_owner_delete" on public.quizzes;

create policy "quizzes_owner_select" on public.quizzes
for select
to authenticated
using (auth.uid() = user_id);

create policy "quizzes_owner_insert" on public.quizzes
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "quizzes_owner_update" on public.quizzes
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "quizzes_owner_delete" on public.quizzes
for delete
to authenticated
using (auth.uid() = user_id);


-- ===== chats =====
drop policy if exists "chats_owner_select" on public.chats;
drop policy if exists "chats_owner_insert" on public.chats;
drop policy if exists "chats_owner_update" on public.chats;
drop policy if exists "chats_owner_delete" on public.chats;

create policy "chats_owner_select" on public.chats
for select
to authenticated
using (auth.uid() = user_id);

create policy "chats_owner_insert" on public.chats
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "chats_owner_update" on public.chats
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "chats_owner_delete" on public.chats
for delete
to authenticated
using (auth.uid() = user_id);


-- ===== notifications =====
drop policy if exists "notifications_owner_select" on public.notifications;
drop policy if exists "notifications_owner_insert" on public.notifications;
drop policy if exists "notifications_owner_update" on public.notifications;
drop policy if exists "notifications_owner_delete" on public.notifications;

create policy "notifications_owner_select" on public.notifications
for select
to authenticated
using (auth.uid() = user_id);

create policy "notifications_owner_insert" on public.notifications
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "notifications_owner_update" on public.notifications
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "notifications_owner_delete" on public.notifications
for delete
to authenticated
using (auth.uid() = user_id);


-- -------------------------------------------------
-- 2) profiles
--    - Public read (anon + authenticated) for Leaderboard
--    - Only owner can insert/update/delete their row
-- -------------------------------------------------

drop policy if exists "profiles_public_select" on public.profiles;
drop policy if exists "profiles_owner_insert" on public.profiles;
drop policy if exists "profiles_owner_update" on public.profiles;
drop policy if exists "profiles_owner_delete" on public.profiles;

create policy "profiles_public_select" on public.profiles
for select
to anon, authenticated
using (true);

create policy "profiles_owner_insert" on public.profiles
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "profiles_owner_update" on public.profiles
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "profiles_owner_delete" on public.profiles
for delete
to authenticated
using (auth.uid() = user_id);


-- -------------------------------------------------
-- 3) user_stats
--    طلبك فيه تضارب مهم:
--    - "اسمح للمستخدم فقط" (Owner-only)
--    - وفي نفس الوقت "اسمح للجميع بقراءة XP للـ Leaderboard".
--
--    RLS لا يقدر يخفي أعمدة (Column-level)؛ لو سمحت Select على user_stats
--    فكل الأعمدة ستكون متاحة.
--
--    الحل الإنتاجي الصحيح: اجعل user_stats Owner-only، وأنشئ View عامة
--    تعرض فقط الحقول الآمنة (user_id, xp, current_level).
-- -------------------------------------------------

drop policy if exists "user_stats_owner_select" on public.user_stats;
drop policy if exists "user_stats_owner_insert" on public.user_stats;
drop policy if exists "user_stats_owner_update" on public.user_stats;
drop policy if exists "user_stats_owner_delete" on public.user_stats;

create policy "user_stats_owner_select" on public.user_stats
for select
to authenticated
using (auth.uid() = user_id);

create policy "user_stats_owner_insert" on public.user_stats
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "user_stats_owner_update" on public.user_stats
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "user_stats_owner_delete" on public.user_stats
for delete
to authenticated
using (auth.uid() = user_id);


-- =====================================================================
-- 4) Leaderboard view (public)
-- =====================================================================

-- View اسمها leaderboard_public كما كان مستخدم في المشروع سابقاً
-- تعرض XP فقط + level (بدون coins أو أي حقول أخرى تعتبر حساسة)

drop view if exists public.leaderboard_public;
create view public.leaderboard_public as
select
  us.user_id,
  us.xp,
  us.current_level,
  p.display_name,
  p.avatar_path
from public.user_stats us
join public.profiles p on p.user_id = us.user_id;

-- السماح بالقراءة للجميع (anon + authenticated)
-- Note: views تحتاج GRANT وليس POLICY (RLS على الجدول الأساسي تظل مطبقة)
-- في Supabase: عادة grant على view يكفي مع security_barrier/definer حسب الإعداد.
-- نستخدم grant صريح:

grant select on public.leaderboard_public to anon, authenticated;

-- =====================================================================
-- 5) Storage: Buckets private + path restriction (auth.uid()/...)
-- =====================================================================
-- ملاحظة:
-- - جعل bucket "private" يتم من جدول storage.buckets
-- - سياسات الوصول تُكتب على جدول storage.objects
-- - نفترض أنك تحفظ الملفات بمسار: `${user_id}/...` (مثلاً: "<uid>/file.pdf")

-- اجعل buckets Private
update storage.buckets set public = false where id in ('pdfs', 'avatars');

-- سياسات storage.objects
-- ملاحظة: اسم الـ bucket في العمود bucket_id

-- pdfs policies

drop policy if exists "pdfs_owner_read" on storage.objects;
drop policy if exists "pdfs_owner_insert" on storage.objects;
drop policy if exists "pdfs_owner_update" on storage.objects;
drop policy if exists "pdfs_owner_delete" on storage.objects;

create policy "pdfs_owner_read" on storage.objects
for select
to authenticated
using (
  bucket_id = 'pdfs'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "pdfs_owner_insert" on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'pdfs'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "pdfs_owner_update" on storage.objects
for update
to authenticated
using (
  bucket_id = 'pdfs'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'pdfs'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "pdfs_owner_delete" on storage.objects
for delete
to authenticated
using (
  bucket_id = 'pdfs'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- avatars policies

drop policy if exists "avatars_owner_read" on storage.objects;
drop policy if exists "avatars_owner_insert" on storage.objects;
drop policy if exists "avatars_owner_update" on storage.objects;
drop policy if exists "avatars_owner_delete" on storage.objects;

create policy "avatars_owner_read" on storage.objects
for select
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "avatars_owner_insert" on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "avatars_owner_update" on storage.objects
for update
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "avatars_owner_delete" on storage.objects
for delete
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- =====================================================================
-- 6) Optional: make sure RLS is enabled on storage.objects (عادة مفعّلة)
-- =====================================================================
-- alter table storage.objects enable row level security;

-- =====================================================================
-- END
-- =====================================================================
