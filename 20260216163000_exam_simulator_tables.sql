-- =====================================================================
-- Exam Simulator tables (Academic AI Study System)
-- =====================================================================
-- جداول جديدة:
-- 1) exams: تعريف الامتحان المُولد (أسئلة + إعدادات)
-- 2) exam_attempts: محاولات الطالب (إجابات + تقرير أداء)
--
-- سياسات RLS: owner-only (مثل files/quizzes)
-- =====================================================================

-- -------------------------------------------------
-- 1) exams
-- -------------------------------------------------
create table if not exists public.exams (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  file_id text null,
  title text null,
  duration_sec int not null default 1800,
  blueprint jsonb not null default '{}'::jsonb,
  questions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.exams enable row level security;

-- -------------------------------------------------
-- 2) exam_attempts
-- -------------------------------------------------
create table if not exists public.exam_attempts (
  id text primary key,
  exam_id text not null references public.exams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  answers jsonb not null default '[]'::jsonb,
  score int not null default 0,
  total int not null default 0,
  report_markdown text null,
  created_at timestamptz not null default now()
);

alter table public.exam_attempts enable row level security;

-- -------------------------------------------------
-- 3) Policies: exams (owner-only)
-- -------------------------------------------------
drop policy if exists "exams_owner_select" on public.exams;
drop policy if exists "exams_owner_insert" on public.exams;
drop policy if exists "exams_owner_update" on public.exams;
drop policy if exists "exams_owner_delete" on public.exams;

create policy "exams_owner_select" on public.exams
for select to authenticated
using (auth.uid() = user_id);

create policy "exams_owner_insert" on public.exams
for insert to authenticated
with check (auth.uid() = user_id);

create policy "exams_owner_update" on public.exams
for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "exams_owner_delete" on public.exams
for delete to authenticated
using (auth.uid() = user_id);

-- -------------------------------------------------
-- 4) Policies: exam_attempts (owner-only)
-- -------------------------------------------------
drop policy if exists "exam_attempts_owner_select" on public.exam_attempts;
drop policy if exists "exam_attempts_owner_insert" on public.exam_attempts;
drop policy if exists "exam_attempts_owner_update" on public.exam_attempts;
drop policy if exists "exam_attempts_owner_delete" on public.exam_attempts;

create policy "exam_attempts_owner_select" on public.exam_attempts
for select to authenticated
using (auth.uid() = user_id);

create policy "exam_attempts_owner_insert" on public.exam_attempts
for insert to authenticated
with check (auth.uid() = user_id);

create policy "exam_attempts_owner_update" on public.exam_attempts
for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "exam_attempts_owner_delete" on public.exam_attempts
for delete to authenticated
using (auth.uid() = user_id);

-- -------------------------------------------------
-- 5) Helpful index
-- -------------------------------------------------
create index if not exists exams_user_created_at_idx on public.exams(user_id, created_at desc);
create index if not exists exam_attempts_user_created_at_idx on public.exam_attempts(user_id, created_at desc);
create index if not exists exam_attempts_exam_idx on public.exam_attempts(exam_id);
