-- Proof photo when remaining balance is collected (run in Supabase SQL editor).
alter table public.flower_orders
  add column if not exists proof_balance_data_url text not null default '';
