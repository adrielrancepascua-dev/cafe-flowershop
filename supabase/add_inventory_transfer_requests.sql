-- Inter-branch transfer requests with receiving-branch approval
-- Run after schema_flowers_v2.sql
--
-- Flow:
--   1. A branch files a transfer request. Stock leaves the source branch
--      immediately (logged as a transfer_out movement) and sits "in transit".
--   2. The receiving branch confirms once the flowers arrive. Only then is the
--      stock added to the receiving branch (logged as a transfer_in movement).
--   3. If the receiving branch rejects, or the sending branch cancels while the
--      request is still pending, the reserved stock is returned to the source.

create table if not exists public.flower_inventory_transfers (
  id uuid primary key default gen_random_uuid(),
  from_branch_id text not null references public.flower_branches(id),
  to_branch_id text not null references public.flower_branches(id),
  product_id text not null references public.flower_products(id),
  quantity integer not null check (quantity > 0),
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

create index if not exists idx_flower_inventory_transfers_from
  on public.flower_inventory_transfers(from_branch_id);
create index if not exists idx_flower_inventory_transfers_to
  on public.flower_inventory_transfers(to_branch_id);
create index if not exists idx_flower_inventory_transfers_status
  on public.flower_inventory_transfers(status);
create index if not exists idx_flower_inventory_transfers_created_at
  on public.flower_inventory_transfers(created_at desc);

alter table public.flower_inventory_transfers enable row level security;

-- Any authenticated staff/admin may file, read, and resolve transfer requests.
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
end $$;
