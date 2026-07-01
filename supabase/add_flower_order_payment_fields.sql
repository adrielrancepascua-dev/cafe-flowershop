-- Payment mode + balance collection (run in Supabase SQL editor)

alter table public.flower_orders
  add column if not exists payment_mode text not null default 'cash';

alter table public.flower_orders
  add column if not exists balance_paid boolean not null default false;

alter table public.flower_orders
  add column if not exists balance_payment_mode text not null default '';

alter table public.flower_orders
  add column if not exists balance_payment_reference text not null default '';

alter table public.flower_orders
  drop constraint if exists flower_orders_payment_mode_check;

alter table public.flower_orders
  add constraint flower_orders_payment_mode_check
  check (payment_mode in ('cash', 'gcash', 'bank'));

alter table public.flower_orders
  drop constraint if exists flower_orders_balance_payment_mode_check;

alter table public.flower_orders
  add constraint flower_orders_balance_payment_mode_check
  check (balance_payment_mode in ('', 'cash', 'gcash', 'bank'));
