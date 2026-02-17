-- =====================================================================
-- RPC: process_purchase(item_id_input text, item_price_input int)
-- هدفها: خصم Coins بشكل آمن + تسجيل مشتريات + تفعيل ميزة/ثيم داخل user_settings
-- =====================================================================
-- ملاحظات:
-- - Postgres functions تُنفذ داخل نفس transaction تلقائياً.
-- - نستخدم SELECT ... FOR UPDATE لقفل صف user_stats أثناء الخصم.
-- - SECURITY DEFINER لتشغيل العملية بشكل موثوق مع التأكد من auth.uid().
-- =====================================================================

create or replace function public.process_purchase(item_id_input text, item_price_input int)
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
begin
  if uid is null then
    raise exception 'UNAUTHORIZED';
  end if;

  if item_price_input is null or item_price_input <= 0 then
    raise exception 'BAD_PRICE';
  end if;

  -- Lock stats row
  select coins into current_coins
  from public.user_stats
  where user_id = uid
  for update;

  if current_coins is null then
    raise exception 'USER_STATS_NOT_FOUND';
  end if;

  if current_coins < item_price_input then
    raise exception 'INSUFFICIENT_COINS';
  end if;

  new_coins := current_coins - item_price_input;

  update public.user_stats
  set coins = new_coins
  where user_id = uid;

  -- Parse item id (simple convention)
  -- Examples expected from frontend:
  -- - theme:neon
  -- - theme:dark-pro
  -- - golden_ticket:+5_questions
  -- - pro_summary
  if position(':' in item_id_input) > 0 then
    item_type := split_part(item_id_input, ':', 1);
    item_code := split_part(item_id_input, ':', 2);
  else
    item_type := item_id_input;
    item_code := item_id_input;
  end if;

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
    -- حالياً لا يوجد إعداد محدد، نكتفي بتسجيل الشراء
    null;
  end if;

  -- Record purchase (best effort)
  purchase_id := 'p_' || replace(item_type, ' ', '_') || '_' || replace(item_code, ' ', '_') || '_' || extract(epoch from now())::bigint::text;

  insert into public.purchases(id, user_id, item_type, item_code, coins_spent)
  values (purchase_id, uid, item_type, item_code, item_price_input);

  return jsonb_build_object(
    'ok', true,
    'purchase_id', purchase_id,
    'coins_before', current_coins,
    'coins_after', new_coins,
    'theme', new_theme,
    'golden_tickets', new_tickets
  );
end;
$$;

-- Grants
revoke all on function public.process_purchase(text,int) from public;
grant execute on function public.process_purchase(text,int) to authenticated;
