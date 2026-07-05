-- Quick production sanity check for Papers & Petals.
-- Run in Supabase SQL editor. All checks should return at least one row where noted.

-- 1) Atomic stock RPC exists and is callable by authenticated users
select
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  p.prosecdef as is_security_definer
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'adjust_flower_stock';

-- 2) Inter-branch transfer tables exist
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'flower_inventory_transfers',
    'flower_inventory_transfer_items',
    'flower_inventory_stock',
    'flower_inventory_movements'
  )
order by table_name;

-- 3) Supplies tables exist (admin Supplies tab)
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('flower_supply_transfers', 'flower_supply_transfer_items')
order by table_name;

-- 4) Active staff/admin profiles (should match your live users)
select id, email, display_name, role, branch_id, is_active
from public.flower_profiles
where is_active = true
order by role, email;

-- 5) Transfer table upgraded to line items (legacy product_id column removed)
--    If this returns rows, run supabase/add_inventory_transfer_items.sql
select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'flower_inventory_transfers'
  and column_name in ('product_id', 'quantity');
