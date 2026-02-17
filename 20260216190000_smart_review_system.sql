-- =====================================================================
-- Smart Review System (post-exam analysis + deep reminders)
--
-- Adds:
-- - public.exam_attempts: wrong_items_json, study_plan_json, weak_topics
-- - public.files: last_opened_at
-- =====================================================================

-- 1) files.last_opened_at

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='files' and column_name='last_opened_at'
  ) then
    alter table public.files add column last_opened_at timestamptz null;
  end if;
end $$;

create index if not exists files_user_last_opened_idx
  on public.files (user_id, last_opened_at);

-- 2) exam_attempts structured analysis

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='exam_attempts' and column_name='wrong_items_json'
  ) then
    alter table public.exam_attempts add column wrong_items_json jsonb null;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='exam_attempts' and column_name='study_plan_json'
  ) then
    alter table public.exam_attempts add column study_plan_json jsonb null;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='exam_attempts' and column_name='weak_topics'
  ) then
    alter table public.exam_attempts add column weak_topics text[] null;
  end if;
end $$;

create index if not exists exam_attempts_user_created_idx
  on public.exam_attempts (user_id, created_at desc);
