-- Add finished-order photo field (staff upload before pick up / delivery deadline).
alter table public.flower_orders
  add column if not exists ready_photo_data_url text not null default '';
