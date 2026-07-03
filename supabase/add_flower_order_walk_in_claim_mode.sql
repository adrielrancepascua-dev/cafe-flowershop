-- Allow walk_in as a claim mode on flower orders.
alter table public.flower_orders
  drop constraint if exists flower_orders_claim_mode_check;

alter table public.flower_orders
  add constraint flower_orders_claim_mode_check
  check (claim_mode in ('pickup', 'delivery', 'walk_in'));
