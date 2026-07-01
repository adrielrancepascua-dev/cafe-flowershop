-- Papers & Petals — seed products + starting stock (run after schema_flowers_v2.sql)
-- Safe to re-run: uses ON CONFLICT upserts.

insert into public.flower_products (id, name, color, unit_cost, is_active) values
  ('stem-rose-red', 'Red Rose', 'Red', 45, true),
  ('stem-rose-pink', 'Pink Rose', 'Pink', 45, true),
  ('stem-tulip', 'Tulip', 'Mixed', 55, true),
  ('stem-sunflower', 'Sunflower', 'Yellow', 40, true),
  ('stem-carnation', 'Carnation', 'Pink', 35, true),
  ('stem-lily', 'Lily', 'White', 60, true),
  ('stem-babys-breath', 'Baby''s Breath', 'White', 25, true),
  ('stem-eucalyptus', 'Eucalyptus', 'Green', 30, true),
  ('stem-hydrangea', 'Hydrangea', 'Blue', 75, true),
  ('stem-gerbera', 'Gerbera', 'Orange', 38, true)
on conflict (id) do update set
  name = excluded.name,
  color = excluded.color,
  unit_cost = excluded.unit_cost,
  is_active = excluded.is_active;

-- Dagupan
insert into public.flower_inventory_stock (branch_id, product_id, on_hand, updated_at) values
  ('branch-dagupan', 'stem-rose-red', 120, now()),
  ('branch-dagupan', 'stem-rose-pink', 80, now()),
  ('branch-dagupan', 'stem-tulip', 60, now()),
  ('branch-dagupan', 'stem-sunflower', 40, now()),
  ('branch-dagupan', 'stem-carnation', 100, now()),
  ('branch-dagupan', 'stem-lily', 50, now()),
  ('branch-dagupan', 'stem-babys-breath', 90, now()),
  ('branch-dagupan', 'stem-eucalyptus', 70, now()),
  ('branch-dagupan', 'stem-hydrangea', 30, now()),
  ('branch-dagupan', 'stem-gerbera', 55, now())
on conflict (branch_id, product_id) do update set on_hand = excluded.on_hand, updated_at = excluded.updated_at;

-- San Carlos
insert into public.flower_inventory_stock (branch_id, product_id, on_hand, updated_at) values
  ('branch-san-carlos', 'stem-rose-red', 90, now()),
  ('branch-san-carlos', 'stem-rose-pink', 70, now()),
  ('branch-san-carlos', 'stem-tulip', 45, now()),
  ('branch-san-carlos', 'stem-sunflower', 35, now()),
  ('branch-san-carlos', 'stem-carnation', 80, now()),
  ('branch-san-carlos', 'stem-lily', 40, now()),
  ('branch-san-carlos', 'stem-babys-breath', 75, now()),
  ('branch-san-carlos', 'stem-eucalyptus', 60, now()),
  ('branch-san-carlos', 'stem-hydrangea', 25, now()),
  ('branch-san-carlos', 'stem-gerbera', 45, now())
on conflict (branch_id, product_id) do update set on_hand = excluded.on_hand, updated_at = excluded.updated_at;

-- Urdaneta
insert into public.flower_inventory_stock (branch_id, product_id, on_hand, updated_at) values
  ('branch-urdaneta', 'stem-rose-red', 100, now()),
  ('branch-urdaneta', 'stem-rose-pink', 65, now()),
  ('branch-urdaneta', 'stem-tulip', 50, now()),
  ('branch-urdaneta', 'stem-sunflower', 30, now()),
  ('branch-urdaneta', 'stem-carnation', 85, now()),
  ('branch-urdaneta', 'stem-lily', 35, now()),
  ('branch-urdaneta', 'stem-babys-breath', 80, now()),
  ('branch-urdaneta', 'stem-eucalyptus', 55, now()),
  ('branch-urdaneta', 'stem-hydrangea', 20, now()),
  ('branch-urdaneta', 'stem-gerbera', 40, now())
on conflict (branch_id, product_id) do update set on_hand = excluded.on_hand, updated_at = excluded.updated_at;
