-- =====================================================================
-- Ads placeholders toggle
-- Adds: user_settings.ads_enabled (default true)
-- =====================================================================

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='user_settings' and column_name='ads_enabled'
  ) then
    alter table public.user_settings add column ads_enabled boolean not null default true;
  end if;
end $$;
