-- Co-admin role: same back-office access as admin.
-- App UI hides COGS + Net sales for co_admin only.
-- Run in Supabase SQL editor before creating coadmin@papersandpetals.ph

alter table public.flower_profiles
  drop constraint if exists flower_profiles_role_check;

alter table public.flower_profiles
  add constraint flower_profiles_role_check
  check (role in ('staff', 'admin', 'co_admin'));

create or replace function public.flower_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.flower_current_role() in ('admin', 'co_admin'), false);
$$;

grant execute on function public.flower_is_admin() to authenticated;

-- Profiles
drop policy if exists "flower_profiles_select_admin" on public.flower_profiles;
create policy "flower_profiles_select_admin"
  on public.flower_profiles for select
  to authenticated
  using (public.flower_is_admin());

drop policy if exists "flower_profiles_update_admin" on public.flower_profiles;
create policy "flower_profiles_update_admin"
  on public.flower_profiles for update
  to authenticated
  using (public.flower_is_admin())
  with check (public.flower_is_admin());

-- Branches
drop policy if exists "flower_branches_read" on public.flower_branches;
create policy "flower_branches_read"
  on public.flower_branches for select
  to authenticated
  using (public.flower_current_role() in ('staff', 'admin', 'co_admin'));

-- Core operational tables
drop policy if exists "flower_orders_access" on public.flower_orders;
create policy "flower_orders_access"
  on public.flower_orders for all
  to authenticated
  using (public.flower_current_role() in ('staff', 'admin', 'co_admin'))
  with check (public.flower_current_role() in ('staff', 'admin', 'co_admin'));

drop policy if exists "flower_order_items_access" on public.flower_order_items;
create policy "flower_order_items_access"
  on public.flower_order_items for all
  to authenticated
  using (public.flower_current_role() in ('staff', 'admin', 'co_admin'))
  with check (public.flower_current_role() in ('staff', 'admin', 'co_admin'));

drop policy if exists "flower_products_access" on public.flower_products;
create policy "flower_products_access"
  on public.flower_products for all
  to authenticated
  using (public.flower_current_role() in ('staff', 'admin', 'co_admin'))
  with check (public.flower_current_role() in ('staff', 'admin', 'co_admin'));

drop policy if exists "flower_inventory_stock_access" on public.flower_inventory_stock;
create policy "flower_inventory_stock_access"
  on public.flower_inventory_stock for all
  to authenticated
  using (public.flower_current_role() in ('staff', 'admin', 'co_admin'))
  with check (public.flower_current_role() in ('staff', 'admin', 'co_admin'));

drop policy if exists "flower_inventory_movements_access" on public.flower_inventory_movements;
create policy "flower_inventory_movements_access"
  on public.flower_inventory_movements for all
  to authenticated
  using (public.flower_current_role() in ('staff', 'admin', 'co_admin'))
  with check (public.flower_current_role() in ('staff', 'admin', 'co_admin'));

drop policy if exists "flower_staff_expenses_access" on public.flower_staff_expenses;
create policy "flower_staff_expenses_access"
  on public.flower_staff_expenses for all
  to authenticated
  using (public.flower_current_role() in ('staff', 'admin', 'co_admin'))
  with check (public.flower_current_role() in ('staff', 'admin', 'co_admin'));

drop policy if exists "flower_supplier_costs_access" on public.flower_supplier_costs;
create policy "flower_supplier_costs_access"
  on public.flower_supplier_costs for all
  to authenticated
  using (public.flower_current_role() in ('staff', 'admin', 'co_admin'))
  with check (public.flower_current_role() in ('staff', 'admin', 'co_admin'));

-- Inter-branch transfers
drop policy if exists "flower_inventory_transfers_access" on public.flower_inventory_transfers;
create policy "flower_inventory_transfers_access"
  on public.flower_inventory_transfers for all
  to authenticated
  using (public.flower_current_role() in ('staff', 'admin', 'co_admin'))
  with check (public.flower_current_role() in ('staff', 'admin', 'co_admin'));

drop policy if exists "flower_inventory_transfer_items_access" on public.flower_inventory_transfer_items;
create policy "flower_inventory_transfer_items_access"
  on public.flower_inventory_transfer_items for all
  to authenticated
  using (public.flower_current_role() in ('staff', 'admin', 'co_admin'))
  with check (public.flower_current_role() in ('staff', 'admin', 'co_admin'));

-- Supply transfers (admin-level)
drop policy if exists "flower_supply_transfers_admin" on public.flower_supply_transfers;
create policy "flower_supply_transfers_admin"
  on public.flower_supply_transfers for all
  to authenticated
  using (public.flower_is_admin())
  with check (public.flower_is_admin());

drop policy if exists "flower_supply_transfer_items_admin" on public.flower_supply_transfer_items;
create policy "flower_supply_transfer_items_admin"
  on public.flower_supply_transfer_items for all
  to authenticated
  using (public.flower_is_admin())
  with check (public.flower_is_admin());

-- Admin / co-admin onboarding (password only — no branch)
create or replace function public.complete_admin_onboarding()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.flower_current_role() not in ('admin', 'co_admin') then
    raise exception 'Only admin accounts can complete admin onboarding.';
  end if;

  update public.flower_profiles
  set onboarding_completed = true
  where id = auth.uid()
    and onboarding_completed = false;
end;
$$;

-- Transfer billing
create or replace function public.update_flower_transfer_billing(
  p_transfer_id uuid,
  p_total_cost numeric,
  p_cost_paid boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.flower_is_admin() then
    raise exception 'Only admins can update transfer billing.'
      using errcode = '42501';
  end if;

  if p_total_cost is not null and p_total_cost < 0 then
    raise exception 'Total cost cannot be negative.';
  end if;

  update public.flower_inventory_transfers
  set
    total_cost = p_total_cost,
    cost_paid = coalesce(p_cost_paid, false)
  where id = p_transfer_id;

  if not found then
    raise exception 'Transfer request not found.';
  end if;
end;
$$;

-- Stock adjust RPC
create or replace function public.adjust_flower_stock(
  p_branch_id text,
  p_product_id text,
  p_delta integer,
  p_movement_type text,
  p_note text default '',
  p_allow_negative boolean default false
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_previous integer;
  v_next integer;
begin
  v_role := public.flower_current_role();
  if v_role is null or v_role not in ('staff', 'admin', 'co_admin') then
    raise exception 'Unauthorized inventory update.'
      using errcode = '42501';
  end if;

  if p_delta = 0 then
    raise exception 'Stock delta must be non-zero.';
  end if;

  insert into public.flower_inventory_stock (branch_id, product_id, on_hand, updated_at)
  values (p_branch_id, p_product_id, p_delta, now())
  on conflict (branch_id, product_id)
  do update set
    on_hand = public.flower_inventory_stock.on_hand + p_delta,
    updated_at = now()
  returning on_hand into v_next;

  v_previous := v_next - p_delta;

  if not p_allow_negative and v_next < 0 then
    raise exception 'Insufficient stock. Stock out would result in negative balance.'
      using errcode = 'check_violation';
  end if;

  insert into public.flower_inventory_movements (
    branch_id,
    product_id,
    movement_type,
    quantity,
    previous_on_hand,
    new_on_hand,
    note,
    created_at
  )
  values (
    p_branch_id,
    p_product_id,
    p_movement_type,
    abs(p_delta),
    v_previous,
    v_next,
    coalesce(p_note, ''),
    now()
  );

  return v_next;
end;
$$;
