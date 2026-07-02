-- Flower vs miscellaneous product catalog (wrappers, chocolates, etc.)
-- Run in Supabase SQL editor after add_flower_product_color.sql

alter table public.flower_products
  add column if not exists product_kind text not null default 'flower';

alter table public.flower_products
  drop constraint if exists flower_products_product_kind_check;

alter table public.flower_products
  add constraint flower_products_product_kind_check
  check (product_kind in ('flower', 'misc'));

update public.flower_products
set product_kind = 'flower'
where product_kind is null or product_kind = '';
