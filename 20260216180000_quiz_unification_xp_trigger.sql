-- =====================================================================
-- Quiz Unification + XP Sync
-- الهدف:
-- 1) إضافة أعمدة لازمة لتوحيد مصدر بيانات الكويز
-- 2) تفعيل submitted_at + answers/score
-- 3) Trigger لتحديث user_stats XP تلقائياً عند إكمال الكويز
--
-- ملاحظة: هذا السكربت Defensive (IF NOT EXISTS) لتفادي كسر بيئات لديها أعمدة مسبقاً.
-- =====================================================================

-- -------------------------------------------------
-- 1) Ensure required columns exist on public.quizzes
-- -------------------------------------------------

do $$
begin
  -- file_id
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='quizzes' and column_name='file_id'
  ) then
    alter table public.quizzes add column file_id uuid null;
  end if;

  -- title
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='quizzes' and column_name='title'
  ) then
    alter table public.quizzes add column title text null;
  end if;

  -- questions
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='quizzes' and column_name='questions'
  ) then
    alter table public.quizzes add column questions jsonb null;
  end if;

  -- answers
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='quizzes' and column_name='answers'
  ) then
    alter table public.quizzes add column answers jsonb null;
  end if;

  -- score
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='quizzes' and column_name='score'
  ) then
    alter table public.quizzes add column score integer null;
  end if;

  -- total
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='quizzes' and column_name='total'
  ) then
    alter table public.quizzes add column total integer null;
  end if;

  -- submitted_at
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='quizzes' and column_name='submitted_at'
  ) then
    alter table public.quizzes add column submitted_at timestamptz null;
  end if;
end $$;

-- Helpful index for latest quiz per user/file
create index if not exists quizzes_user_file_created_at_idx
  on public.quizzes (user_id, file_id, created_at desc);

-- -------------------------------------------------
-- 2) XP Sync Trigger (on completion)
--    - Trigger fires when score becomes non-null (from null)
--    - Awards +20 XP +10 Coins if score/total >= 80%
--    - Updates last_active + streak_count (Africa/Cairo)
-- -------------------------------------------------

create or replace function public._aass_apply_quiz_xp()
returns trigger
language plpgsql
as $$
declare
  passed boolean;
  gain_xp integer := 0;
  gain_coins integer := 0;

  now_cairo timestamptz := timezone('Africa/Cairo', now());
  today date := (timezone('Africa/Cairo', now()))::date;
  yesterday date := (timezone('Africa/Cairo', now()) - interval '1 day')::date;

  prev_last date;
  next_streak integer;

  current_xp integer;
  current_coins integer;
  current_level integer;
  next_level integer;

begin
  -- only when transitioning from not-submitted to submitted
  if (tg_op = 'UPDATE') then
    if old.score is not null then
      return new;
    end if;
    if new.score is null then
      return new;
    end if;
  else
    -- we don't award on insert by default to allow "save immediately" without completion
    return new;
  end if;

  passed := (coalesce(new.total, 0) > 0) and (coalesce(new.score, 0)::numeric / new.total::numeric >= 0.8);
  if passed then
    gain_xp := 20;
    gain_coins := 10;
  end if;

  -- ensure user_stats row exists
  insert into public.user_stats (user_id, xp, total_xp, current_level, streak_count, last_active, coins)
  values (new.user_id, 0, 0, 1, 0, null, 0)
  on conflict (user_id) do nothing;

  select
    coalesce(xp, total_xp, 0)::int,
    coalesce(coins, 0)::int,
    coalesce(current_level, 1)::int,
    case when last_active is null then null else (timezone('Africa/Cairo', last_active))::date end
  into current_xp, current_coins, current_level, prev_last
  from public.user_stats
  where user_id = new.user_id
  for update;

  if prev_last is null then
    next_streak := 1;
  elsif prev_last = today then
    next_streak := coalesce((select streak_count from public.user_stats where user_id=new.user_id), 1);
  elsif prev_last = yesterday then
    next_streak := coalesce((select streak_count from public.user_stats where user_id=new.user_id), 0) + 1;
  else
    next_streak := 1;
  end if;

  next_level := greatest(1, floor(((current_xp + gain_xp)::numeric) / 250) + 1);

  update public.user_stats
  set
    xp = current_xp + gain_xp,
    total_xp = current_xp + gain_xp,
    coins = current_coins + gain_coins,
    current_level = next_level,
    last_active = now_cairo,
    streak_count = next_streak
  where user_id = new.user_id;

  return new;
end $$;

-- drop and recreate trigger defensively

drop trigger if exists aass_quiz_xp_trigger on public.quizzes;

create trigger aass_quiz_xp_trigger
after update of score on public.quizzes
for each row
execute function public._aass_apply_quiz_xp();
