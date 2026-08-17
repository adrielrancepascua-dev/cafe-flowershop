-- Record who performed each inventory movement (stock in/out, transfers, order deduct).
-- Run after add_co_admin_role.sql / fix_adjust_flower_stock_security.sql
--
-- Old movement rows stay null. The app shows "Unknown (before names were logged)" for those.
-- New writes stamp the signed-in flower_profiles display name from auth.uid().

alter table public.flower_inventory_movements
  add column if not exists created_by_id text,
  add column if not exists created_by_name text not null default '';

create index if not exists idx_flower_inventory_movements_branch_product_created_at
  on public.flower_inventory_movements (branch_id, product_id, created_at desc);

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
  v_actor_id text;
  v_actor_name text;
begin
  v_role := public.flower_current_role();
  if v_role is null or v_role not in ('staff', 'admin', 'co_admin') then
    raise exception 'Unauthorized inventory update.'
      using errcode = '42501';
  end if;

  if p_delta = 0 then
    raise exception 'Stock delta must be non-zero.';
  end if;

  select p.id::text, nullif(trim(p.display_name), '')
    into v_actor_id, v_actor_name
  from public.flower_profiles p
  where p.id = auth.uid();

  v_actor_name := coalesce(v_actor_name, '');

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
    created_at,
    created_by_id,
    created_by_name
  )
  values (
    p_branch_id,
    p_product_id,
    p_movement_type,
    abs(p_delta),
    v_previous,
    v_next,
    coalesce(p_note, ''),
    now(),
    v_actor_id,
    v_actor_name
  );

  return v_next;
end;
$$;

grant execute on function public.adjust_flower_stock(text, text, integer, text, text, boolean) to authenticated;
