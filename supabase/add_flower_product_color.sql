-- Add color categorization to flower products (run in Supabase SQL editor)

alter table public.flower_products
  add column if not exists color text not null default '';

-- Backfill demo/seed products when names include a color word
update public.flower_products set color = 'Red' where id = 'stem-rose-red';
update public.flower_products set color = 'Pink' where id = 'stem-rose-pink';
update public.flower_products set color = 'Yellow' where id = 'stem-sunflower';
update public.flower_products set color = 'White' where id = 'stem-lily';
update public.flower_products set color = 'White' where id = 'stem-babys-breath';
update public.flower_products set color = 'Green' where id = 'stem-eucalyptus';
update public.flower_products set color = 'Blue' where id = 'stem-hydrangea';
update public.flower_products set color = 'Orange' where id = 'stem-gerbera';
update public.flower_products set color = 'Mixed' where id = 'stem-tulip';
update public.flower_products set color = 'Pink' where id = 'stem-carnation';
