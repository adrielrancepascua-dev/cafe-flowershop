-- Phase 1: Cafe inventory foundation schema (Supabase / Postgres)
-- Run this in Supabase SQL editor after products schema.

create table if not exists public.inventory_stock (
  product_id text primary key references public.products(id) on delete cascade,
  current_stock integer not null default 0 check (current_stock >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.inventory_log (
  id bigint generated always as identity primary key,
  product_id text not null references public.products(id) on delete restrict,
  adjustment_type text not null check (adjustment_type in ('stock_in', 'stock_out')),
  quantity integer not null check (quantity > 0),
  previous_stock integer not null check (previous_stock >= 0),
  new_stock integer not null check (new_stock >= 0),
  note text not null default '',
  source text not null check (source in ('dashboard_inventory')),
  created_at timestamptz not null default now()
);

create index if not exists idx_inventory_log_product_id on public.inventory_log(product_id);
create index if not exists idx_inventory_log_created_at on public.inventory_log(created_at desc);

alter table public.inventory_stock enable row level security;
alter table public.inventory_log enable row level security;

-- Phase 1 policy: allow anon read/write for dashboard internal module without auth.
-- Tighten these policies once auth is added.
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'inventory_stock' and policyname = 'inventory_stock_phase1_open_access'
  ) then
    create policy inventory_stock_phase1_open_access on public.inventory_stock
      for all
      to anon, authenticated
      using (true)
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'inventory_log' and policyname = 'inventory_log_phase1_open_access'
  ) then
    create policy inventory_log_phase1_open_access on public.inventory_log
      for all
      to anon, authenticated
      using (true)
      with check (true);
  end if;
end $$;
