-- Flower type / category for color variations (Local Rose, Lily, etc.)
-- Run in Supabase SQL editor after add_flower_product_kind.sql

alter table public.flower_products
  add column if not exists flower_type text not null default '';

-- Backfill: use product name as the type when empty (matches app fallback logic).
update public.flower_products
set flower_type = trim(name)
where product_kind = 'flower'
  and (flower_type is null or flower_type = '');

update public.flower_products
set flower_type = ''
where product_kind = 'misc';
