-- Inter-branch transfer requests with receiving-branch approval
-- Run after schema_flowers_v2.sql
--
-- Flow:
--   1. A branch files a transfer request with one or more products. Stock leaves
--      the source branch immediately (logged as transfer_out) and sits in transit.
--   2. The receiving branch confirms once everything arrives. Only then is stock
--      added to the receiving branch (logged as transfer_in per line item).
--   3. Rejecting or cancelling a pending request returns all reserved stock.

create table if not exists public.flower_inventory_transfers (
  id uuid primary key default gen_random_uuid(),
  from_branch_id text not null references public.flower_branches(id),
  to_branch_id text not null references public.flower_branches(id),
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'rejected', 'cancelled')),
  note text not null default '',
  requested_by_id text not null,
  requested_by_name text not null,
  resolved_by_id text,
  resolved_by_name text,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  constraint flower_inventory_transfers_distinct_branches
    check (from_branch_id <> to_branch_id)
);

create table if not exists public.flower_inventory_transfer_items (
  id bigint generated always as identity primary key,
  transfer_id uuid not null references public.flower_inventory_transfers(id) on delete cascade,
  product_id text not null references public.flower_products(id),
  quantity integer not null check (quantity > 0),
  unique (transfer_id, product_id)
);

create index if not exists idx_flower_inventory_transfers_from
  on public.flower_inventory_transfers(from_branch_id);
create index if not exists idx_flower_inventory_transfers_to
  on public.flower_inventory_transfers(to_branch_id);
create index if not exists idx_flower_inventory_transfers_status
  on public.flower_inventory_transfers(status);
create index if not exists idx_flower_inventory_transfers_created_at
  on public.flower_inventory_transfers(created_at desc);
create index if not exists idx_flower_inventory_transfer_items_transfer
  on public.flower_inventory_transfer_items(transfer_id);

alter table public.flower_inventory_transfers enable row level security;
alter table public.flower_inventory_transfer_items enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'flower_inventory_transfers'
      and policyname = 'flower_inventory_transfers_access'
  ) then
    create policy "flower_inventory_transfers_access"
      on public.flower_inventory_transfers for all
      to authenticated
      using (public.flower_current_role() in ('staff', 'admin'))
      with check (public.flower_current_role() in ('staff', 'admin'));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'flower_inventory_transfer_items'
      and policyname = 'flower_inventory_transfer_items_access'
  ) then
    create policy "flower_inventory_transfer_items_access"
      on public.flower_inventory_transfer_items for all
      to authenticated
      using (public.flower_current_role() in ('staff', 'admin'))
      with check (public.flower_current_role() in ('staff', 'admin'));
  end if;
end $$;
