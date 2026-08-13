-- Daily inventory counts (audit only — does not change stock)
-- Run after schema_flowers_v2.sql and add_co_admin_role.sql
--
-- Staff submit actual counts for flowers + gift items (no wrappers).
-- Expected on hand = system on hand minus today's completed sales not yet
-- deducted at 7:00 PM Manila. Variance = actual − expected.
-- Counts are snapshots; reviewing later does not auto-adjust inventory.

create table if not exists public.flower_daily_inventory_counts (
  id uuid primary key default gen_random_uuid(),
  branch_id text not null references public.flower_branches(id),
  count_date date not null,
  status text not null default 'submitted'
    check (status = 'submitted'),
  submitted_by_id text not null,
  submitted_by_name text not null,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (branch_id, count_date)
);

create table if not exists public.flower_daily_inventory_count_lines (
  id uuid primary key default gen_random_uuid(),
  count_id uuid not null references public.flower_daily_inventory_counts(id) on delete cascade,
  product_id text not null references public.flower_products(id),
  product_name text not null,
  product_kind text not null default 'flower',
  product_color text not null default '',
  product_flower_type text not null default '',
  system_on_hand integer not null,
  sold_pending_deduction integer not null default 0,
  expected_on_hand integer not null,
  actual_count integer not null check (actual_count >= 0),
  variance integer not null,
  unique (count_id, product_id)
);

create index if not exists idx_flower_daily_inventory_counts_branch_date
  on public.flower_daily_inventory_counts(branch_id, count_date desc);
create index if not exists idx_flower_daily_inventory_counts_date
  on public.flower_daily_inventory_counts(count_date desc);
create index if not exists idx_flower_daily_inventory_count_lines_count
  on public.flower_daily_inventory_count_lines(count_id);

alter table public.flower_daily_inventory_counts enable row level security;
alter table public.flower_daily_inventory_count_lines enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'flower_daily_inventory_counts'
      and policyname = 'flower_daily_inventory_counts_access'
  ) then
    create policy "flower_daily_inventory_counts_access"
      on public.flower_daily_inventory_counts for all
      to authenticated
      using (public.flower_current_role() in ('staff', 'admin', 'co_admin'))
      with check (public.flower_current_role() in ('staff', 'admin', 'co_admin'));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'flower_daily_inventory_count_lines'
      and policyname = 'flower_daily_inventory_count_lines_access'
  ) then
    create policy "flower_daily_inventory_count_lines_access"
      on public.flower_daily_inventory_count_lines for all
      to authenticated
      using (public.flower_current_role() in ('staff', 'admin', 'co_admin'))
      with check (public.flower_current_role() in ('staff', 'admin', 'co_admin'));
  end if;
end $$;
