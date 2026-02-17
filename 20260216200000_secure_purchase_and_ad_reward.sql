-- =====================================================================
-- Secure Coins  Purchases Hardening
-- 1) secure_purchase(item_id_input text)
--    - price derived server-side (prevents client tampering)
--    - atomic: lock user_stats row, deduct coins, record purchase
--    - applies effects (theme, golden_ticket) via user_settings
-- 2) reward_user_for_ad(ad_event_id text, target_user_id uuid, coins_reward int)
--    - server-only (no grant to authenticated)
--    - idempotent via ad_rewards table
-- =====================================================================

-- -------------------------------------------------
-- 0) ad_rewards table (idempotency / audit)
-- -------------------------------------------------
create table if not exists public.ad_rewards (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  coins int not null,
  created_at timestamptz not null default now()
);

alter table public.ad_rewards enable row level security;

-- No direct access for clients
revoke all on public.ad_rewards from anon, authenticated;

-- -------------------------------------------------
-- 1) secure_purchase
-- -------------------------------------------------
create or replace function public.secure_purchase(item_id_input text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  current_coins int;
  new_coins int;
  new_theme text := null;
  new_tickets int := null;
  purchase_id text;
  item_type text := null;
  item_code text := null;
  expected_price int;
begin
  if uid is null then
    raise exception 'UNAUTHORIZED';
  end if;

  if item_id_input is null or length(trim(item_id_input)) = 0 then
    raise exception 'BAD_ITEM';
  end if;

  -- Parse item id (same convention as before)
  if position(':' in item_id_input) > 0 then
    item_type := split_part(item_id_input, ':', 1);
    item_code := split_part(item_id_input, ':', 2);
  else
    item_type := item_id_input;
    item_code := item_id_input;
  end if;

  -- Server-side pricing (prevents tampering)
  expected_price := case
    when item_type = 'theme' and item_code = 'neon' then 200
    when item_type = 'theme' and item_code = 'dark-pro' then 150
    when item_type = 'golden_ticket' then 75
    when item_type = 'pro_summary' then 50
    else null
  end;

  if expected_price is null then
    raise exception 'UNKNOWN_ITEM';
  end if;

  -- Lock stats row
  select coins into current_coins
  from public.user_stats
  where user_id = uid
  for update;

  if current_coins is null then
    raise exception 'USER_STATS_NOT_FOUND';
  end if;

  if current_coins < expected_price then
    raise exception 'INSUFFICIENT_COINS';
  end if;

  new_coins := current_coins - expected_price;

  update public.user_stats
  set coins = new_coins
  where user_id = uid;

  -- Apply effect to user_settings
  if item_type = 'theme' then
    new_theme := item_code;

    insert into public.user_settings(user_id, theme, golden_tickets, updated_at)
    values (uid, new_theme, 0, now())
    on conflict (user_id)
    do update set theme = excluded.theme, updated_at = excluded.updated_at;

  elsif item_type = 'golden_ticket' then
    insert into public.user_settings(user_id, theme, golden_tickets, updated_at)
    values (uid, 'default', 1, now())
    on conflict (user_id)
    do update set golden_tickets = coalesce(public.user_settings.golden_tickets,0) + 1,
                 updated_at = excluded.updated_at;

    select golden_tickets into new_tickets
    from public.user_settings
    where user_id = uid;

  elsif item_type = 'pro_summary' then
    null;
  end if;

  -- Record purchase
  purchase_id := 'p_' || replace(item_type, ' ', '_') || '_' || replace(item_code, ' ', '_') || '_' || extract(epoch from now())::bigint::text;

  insert into public.purchases(id, user_id, item_type, item_code, coins_spent)
  values (purchase_id, uid, item_type, item_code, expected_price);

  return jsonb_build_object(
    'ok', true,
    'purchase_id', purchase_id,
    'coins_before', current_coins,
    'coins_after', new_coins,
    'theme', new_theme,
    'golden_tickets', new_tickets,
    'item_price', expected_price
  );
end;
$$;

revoke all on function public.secure_purchase(text) from public;
grant execute on function public.secure_purchase(text) to authenticated;

-- -------------------------------------------------
-- 2) reward_user_for_ad (server-only)
-- -------------------------------------------------
create or replace function public.reward_user_for_ad(
  ad_event_id text,
  target_user_id uuid,
  coins_reward int default 5
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  reward int := greatest(0, coalesce(coins_reward, 0));
  coins_before int;
  coins_after int;
begin
  if ad_event_id is null or length(trim(ad_event_id)) = 0 then
    raise exception 'BAD_EVENT_ID';
  end if;

  if target_user_id is null then
    raise exception 'BAD_USER_ID';
  end if;

  if reward = 0 then
    return jsonb_build_object('ok', true, 'skipped', true);
  end if;

  -- idempotency: if already rewarded, return current stats
  if exists(select 1 from public.ad_rewards where id = ad_event_id) then
    select coins into coins_after from public.user_stats where user_id = target_user_id;
    return jsonb_build_object('ok', true, 'duplicate', true, 'coins_after', coalesce(coins_after, 0));
  end if;

  -- lock stats row and apply
  select coins into coins_before
  from public.user_stats
  where user_id = target_user_id
  for update;

  if coins_before is null then
    raise exception 'USER_STATS_NOT_FOUND';
  end if;

  coins_after := coins_before + reward;

  update public.user_stats
  set coins = coins_after
  where user_id = target_user_id;

  insert into public.ad_rewards(id, user_id, coins)
  values (ad_event_id, target_user_id, reward);

  return jsonb_build_object(
    'ok', true,
    'coins_before', coins_before,
    'coins_after', coins_after,
    'reward', reward
  );
end;
$$;

-- IMPORTANT: no grant to authenticated (server-only)
revoke all on function public.reward_user_for_ad(text,uuid,int) from public;
