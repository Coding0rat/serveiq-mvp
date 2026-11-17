-- Apply this once to an existing ServeIQ Supabase project before deploying the
-- Razorpay Edge Functions. It is also present in schema.sql for fresh projects.
create extension if not exists pgcrypto;

create table if not exists public.payment_attempts (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete restrict,
  provider text not null default 'razorpay' check (provider = 'razorpay'),
  gateway_order_id text not null unique,
  gateway_payment_id text unique,
  amount_paise integer not null check (amount_paise >= 100),
  currency text not null default 'INR' check (currency = 'INR'),
  status text not null default 'created' check (status in ('created','failed','captured')),
  failure_reason text,
  signature_verified_at timestamptz,
  captured_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_payment_attempts_order on public.payment_attempts(order_id);
alter table public.payment_attempts enable row level security;
revoke all on public.payment_attempts from anon, authenticated;
drop function if exists public.mock_online_payment(uuid,boolean);
