-- =====================================================================
-- Real Coins Top-up System (Stripe-ready)
-- Tables:
-- 1) coin_packages: تعريف باقات الشحن (سعر/عملة/coins)
-- 2) coin_topups: سجلات الشحن (pending/succeeded/failed)
--
-- Notes:
-- - نحن لا نزيد coins مباشرة من العميل.
-- - الزيادة تتم فقط من Webhook (Edge Function) بعد تأكيد الدفع.
-- =====================================================================

-- -------------------------------------------------
-- 1) coin_packages (admin-managed)
-- -------------------------------------------------
create table if not exists public.coin_packages (
  id text primary key,
  title text not null,
  coins int not null,
  price_cents int not null,
  currency text not null default 'usd',
  stripe_price_id text null,
  is_active boolean not null default true,
  sort_order int not null default 100,
  created_at timestamptz not null default now()
);

alter table public.coin_packages enable row level security;

-- Public read (anon+authenticated) so shop can show packages
drop policy if exists "coin_packages_public_select" on public.coin_packages;
create policy "coin_packages_public_select" on public.coin_packages
for select to anon, authenticated
using (is_active = true);

-- (Optional) Lock writes to service role only by not granting to authenticated
revoke insert, update, delete on public.coin_packages from anon, authenticated;

-- -------------------------------------------------
-- 2) coin_topups (user-owned)
-- -------------------------------------------------
create table if not exists public.coin_topups (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  package_id text not null references public.coin_packages(id),
  status text not null check (status in ('pending','succeeded','failed')),
  amount_cents int not null,
  currency text not null,
  coins int not null,
  stripe_checkout_session_id text null,
  stripe_payment_intent_id text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.coin_topups enable row level security;

drop policy if exists "coin_topups_owner_select" on public.coin_topups;
drop policy if exists "coin_topups_owner_insert" on public.coin_topups;
drop policy if exists "coin_topups_owner_update" on public.coin_topups;

create policy "coin_topups_owner_select" on public.coin_topups
for select to authenticated
using (auth.uid() = user_id);

create policy "coin_topups_owner_insert" on public.coin_topups
for insert to authenticated
with check (auth.uid() = user_id);

-- منع تحديث الحالة من العميل (يتم من webhook/service role)
-- نسمح فقط بتحديث أعمدة غير حساسة (مثلاً: لا شيء). سنقفل update بالكامل.
revoke update on public.coin_topups from authenticated;

-- helpful indexes
create index if not exists coin_topups_user_created_at_idx on public.coin_topups(user_id, created_at desc);
create index if not exists coin_topups_session_idx on public.coin_topups(stripe_checkout_session_id);

-- -------------------------------------------------
-- Seed packages (يمكن تعديلها لاحقاً)
-- -------------------------------------------------
insert into public.coin_packages (id, title, coins, price_cents, currency, stripe_price_id, is_active, sort_order)
values
  ('coins_200', '200 Coins', 200, 199, 'usd', null, true, 10),
  ('coins_600', '600 Coins', 600, 499, 'usd', null, true, 20),
  ('coins_1500', '1500 Coins', 1500, 999, 'usd', null, true, 30)
on conflict (id) do nothing;
