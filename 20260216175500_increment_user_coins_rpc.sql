-- =====================================================================
-- Helper RPC: increment_user_coins(uid uuid, delta int)
-- Used ONLY by webhook/service role.
-- =====================================================================

create or replace function public.increment_user_coins(uid uuid, delta int)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if uid is null then
    raise exception 'BAD_UID';
  end if;
  if delta is null or delta = 0 then
    return;
  end if;

  update public.user_stats
  set coins = coalesce(coins,0) + delta
  where user_id = uid;

  if not found then
    -- create row if missing
    insert into public.user_stats(user_id, xp, total_xp, current_level, streak_count, last_active, coins)
    values (uid, 0, 0, 1, 0, null, delta)
    on conflict (user_id)
    do update set coins = coalesce(public.user_stats.coins,0) + delta;
  end if;
end;
$$;

revoke all on function public.increment_user_coins(uuid,int) from public;
-- Only service role should execute; don't grant to authenticated.
