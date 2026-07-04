-- Branch supply transfer vouchers (Dagupan liability tracking)
-- Run after schema_flowers_v2.sql

create table if not exists public.flower_supply_transfers (
  id text primary key,
  transfer_type text not null check (transfer_type in ('new_arrival', 'old_stock')),
  arrived_at_branch_id text references public.flower_branches(id),
  supplier text not null default '',
  amount_paid_supplies numeric(12,2) not null default 0 check (amount_paid_supplies >= 0),
  amount_paid_transpo numeric(12,2) not null default 0 check (amount_paid_transpo >= 0),
  original_arrival_date date,
  from_branch_id text not null references public.flower_branches(id),
  to_branch_id text not null references public.flower_branches(id),
  prepared_by text not null default '',
  received_by text not null default '',
  flower_liability numeric(12,2) not null default 0 check (flower_liability >= 0),
  total_liability numeric(12,2) not null default 0 check (total_liability >= 0),
  created_by_id text not null,
  created_by_name text not null,
  created_at timestamptz not null default now(),
  constraint flower_supply_transfers_distinct_branches
    check (from_branch_id <> to_branch_id)
);

create table if not exists public.flower_supply_transfer_items (
  id bigint generated always as identity primary key,
  transfer_id text not null references public.flower_supply_transfers(id) on delete cascade,
  product_id text not null references public.flower_products(id),
  product_name text not null,
  product_color text not null default '',
  quantity integer not null check (quantity > 0),
  unit_cost numeric(12,2) not null default 0 check (unit_cost >= 0),
  line_liability numeric(12,2) not null default 0 check (line_liability >= 0)
);

create index if not exists idx_flower_supply_transfers_created_at
  on public.flower_supply_transfers(created_at desc);
create index if not exists idx_flower_supply_transfers_to_branch
  on public.flower_supply_transfers(to_branch_id);
create index if not exists idx_flower_supply_transfer_items_transfer
  on public.flower_supply_transfer_items(transfer_id);

alter table public.flower_supply_transfers enable row level security;
alter table public.flower_supply_transfer_items enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'flower_supply_transfers'
      and policyname = 'flower_supply_transfers_admin'
  ) then
    create policy "flower_supply_transfers_admin"
      on public.flower_supply_transfers for all
      to authenticated
      using (public.flower_current_role() = 'admin')
      with check (public.flower_current_role() = 'admin');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'flower_supply_transfer_items'
      and policyname = 'flower_supply_transfer_items_admin'
  ) then
    create policy "flower_supply_transfer_items_admin"
      on public.flower_supply_transfer_items for all
      to authenticated
      using (public.flower_current_role() = 'admin')
      with check (public.flower_current_role() = 'admin');
  end if;
end $$;
