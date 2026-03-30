-- Phase 1 optional safeguard seed:
-- Pre-create missing inventory_stock rows for existing cafe products.
-- Safe to rerun.

insert into public.inventory_stock (product_id, current_stock, updated_at)
select
  p.id as product_id,
  0 as current_stock,
  now() as updated_at
from public.products p
on conflict (product_id) do nothing;
