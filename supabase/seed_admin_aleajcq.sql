-- Papers & Petals — owner admin account (aleajcq@gmail.com)
-- Run AFTER schema_flowers_v2.sql and add_staff_management.sql
--
-- Step 1 — Supabase Dashboard → Authentication → Users → Add user
--   Email: aleajcq@gmail.com
--   Password: 1234
--   Auto-confirm email: ON
--
-- Step 2 — Copy the new user's UUID from Authentication → Users, then run:

insert into public.flower_profiles (
  id,
  email,
  display_name,
  role,
  branch_id,
  onboarding_completed,
  is_active
)
values (
  '<AUTH_USER_UUID>',
  'aleajcq@gmail.com',
  'Papers & Petals Owner',
  'admin',
  null,
  false,
  true
)
on conflict (id) do update set
  email = excluded.email,
  display_name = excluded.display_name,
  role = 'admin',
  branch_id = null,
  onboarding_completed = false,
  is_active = true;

-- First login: temporary password 1234 → set personal password (no branch step).
