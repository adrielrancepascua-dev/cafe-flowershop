-- Admin-only branch billing on inter-branch transfer requests.
-- Run after add_inventory_transfer_requests.sql

alter table public.flower_inventory_transfers
  add column if not exists total_cost numeric(12, 2)
    check (total_cost is null or total_cost >= 0),
  add column if not exists cost_paid boolean not null default false;

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
  if public.flower_current_role() is distinct from 'admin' then
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

grant execute on function public.update_flower_transfer_billing(uuid, numeric, boolean) to authenticated;
