-- Papers & Petals — co-admin account (coadmin@papersandpetals.ph)
-- Run AFTER add_co_admin_role.sql
--
-- Step 1 — Supabase Dashboard → Authentication → Users → Add user
--   Email: coadmin@papersandpetals.ph
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
  'coadmin@papersandpetals.ph',
  'Papers & Petals Co-admin',
  'co_admin',
  null,
  false,
  true
)
on conflict (id) do update set
  email = excluded.email,
  display_name = excluded.display_name,
  role = 'co_admin',
  branch_id = null,
  onboarding_completed = false,
  is_active = true;

-- First login: temporary password 1234 → set personal password (no branch step).
-- Reports: same as admin except COGS and Net sales are hidden in the app.
