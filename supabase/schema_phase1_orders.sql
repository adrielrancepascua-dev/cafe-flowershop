-- Phase 1: Cafe orders schema (Supabase / Postgres)
-- Run this in Supabase SQL editor.

create table if not exists public.orders (
  id text primary key,
  created_at timestamptz not null default now(),
  status text not null check (status in ('submitted')),
  source text not null check (source in ('dashboard_pos')),
  subtotal numeric(12,2) not null check (subtotal >= 0),
  total numeric(12,2) not null check (total >= 0)
);

create table if not exists public.order_items (
  id bigint generated always as identity primary key,
  order_id text not null references public.orders(id) on delete cascade,
  product_id text not null,
  name text not null,
  category text not null,
  unit_price numeric(12,2) not null check (unit_price >= 0),
  quantity integer not null check (quantity > 0),
  line_total numeric(12,2) not null check (line_total >= 0)
);

create index if not exists idx_orders_created_at on public.orders(created_at desc);
create index if not exists idx_order_items_order_id on public.order_items(order_id);

alter table public.orders enable row level security;
alter table public.order_items enable row level security;

-- Phase 1 policy: allow anon read/write for dashboard internal module without auth.
-- Tighten these policies once auth is added.
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'orders' and policyname = 'orders_phase1_open_access'
  ) then
    create policy orders_phase1_open_access on public.orders
      for all
      to anon, authenticated
      using (true)
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'order_items' and policyname = 'order_items_phase1_open_access'
  ) then
    create policy order_items_phase1_open_access on public.order_items
      for all
      to anon, authenticated
      using (true)
      with check (true);
  end if;
end $$;
