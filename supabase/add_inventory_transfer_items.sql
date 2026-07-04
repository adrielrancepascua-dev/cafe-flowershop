-- Upgrade single-product transfer requests to multi-product line items.
-- Run after add_inventory_transfer_requests.sql if that migration used the
-- older schema with product_id and quantity on flower_inventory_transfers.

create table if not exists public.flower_inventory_transfer_items (
  id bigint generated always as identity primary key,
  transfer_id uuid not null references public.flower_inventory_transfers(id) on delete cascade,
  product_id text not null references public.flower_products(id),
  quantity integer not null check (quantity > 0),
  unique (transfer_id, product_id)
);

create index if not exists idx_flower_inventory_transfer_items_transfer
  on public.flower_inventory_transfer_items(transfer_id);

alter table public.flower_inventory_transfer_items enable row level security;

do $$
begin
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

-- Migrate legacy single-product rows into line items, then drop old columns.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'flower_inventory_transfers'
      and column_name = 'product_id'
  ) then
    insert into public.flower_inventory_transfer_items (transfer_id, product_id, quantity)
    select t.id, t.product_id, t.quantity
    from public.flower_inventory_transfers t
    where t.product_id is not null
    on conflict (transfer_id, product_id) do nothing;

    alter table public.flower_inventory_transfers
      drop column if exists product_id,
      drop column if exists quantity;
  end if;
end $$;
