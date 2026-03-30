-- Phase 1: Cafe products schema (Supabase / Postgres)
-- Run this in Supabase SQL editor.

create table if not exists public.products (
  id text primary key,
  name text not null,
  category text not null,
  price numeric(12,2) not null check (price >= 0),
  description text not null default '',
  image text not null default '',
  is_best_seller boolean not null default false,
  is_new boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_products_category on public.products(category);
create index if not exists idx_products_active on public.products(is_active);

alter table public.products enable row level security;

-- Phase 1 policy: allow anon read/write for dashboard internal module without auth.
-- Tighten these policies once auth is added.
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'products' and policyname = 'products_phase1_open_access'
  ) then
    create policy products_phase1_open_access on public.products
      for all
      to anon, authenticated
      using (true)
      with check (true);
  end if;
end $$;
