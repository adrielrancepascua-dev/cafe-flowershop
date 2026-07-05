-- Track the one allowed staff content edit and support same-day edit cutoff in the app.

alter table public.flower_orders
  add column if not exists content_edited_at timestamptz;
