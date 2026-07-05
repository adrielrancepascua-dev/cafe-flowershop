-- Atomic inventory stock adjustment + supporting indexes
-- Run after schema_flowers_v2.sql
--
-- Why: the client previously read on_hand, computed the next value in JS, then
-- wrote it back (read-modify-write). Two concurrent operations on the same
-- branch+product (e.g. a stock-in racing an order deduction) could both read
-- the same starting value and the last write would silently clobber the other.
--
-- This function performs the increment inside a single atomic statement so
-- concurrent callers serialize on the row. If the resulting balance would be
-- negative and negatives are not allowed, the whole call rolls back.

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
security invoker
set search_path = public
as $$
declare
  v_previous integer;
  v_next integer;
begin
  if p_delta = 0 then
    raise exception 'Stock delta must be non-zero.';
  end if;

  -- Atomic upsert-with-increment: the ON CONFLICT update reads the current
  -- on_hand under a row lock held for the duration of the statement, so
  -- concurrent calls cannot clobber each other.
  insert into public.flower_inventory_stock (branch_id, product_id, on_hand, updated_at)
  values (p_branch_id, p_product_id, p_delta, now())
  on conflict (branch_id, product_id)
  do update set
    on_hand = public.flower_inventory_stock.on_hand + p_delta,
    updated_at = now()
  returning on_hand into v_next;

  v_previous := v_next - p_delta;

  if not p_allow_negative and v_next < 0 then
    -- Raising aborts the whole function, rolling back the upsert above.
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

grant execute on function public.adjust_flower_stock(text, text, integer, text, text, boolean) to authenticated;

-- Indexes for the movement listing queries (ordered by created_at, filtered by branch).
create index if not exists idx_flower_inventory_movements_created_at
  on public.flower_inventory_movements (created_at desc);
create index if not exists idx_flower_inventory_movements_branch_created_at
  on public.flower_inventory_movements (branch_id, created_at desc);
