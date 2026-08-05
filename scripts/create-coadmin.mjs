/**
 * Create coadmin@papersandpetals.ph in Supabase Auth + flower_profiles.
 *
 * Requires env:
 *   VITE_SUPABASE_URL or SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Usage:
 *   node --env-file=.env scripts/create-coadmin.mjs
 */

import { createClient } from '@supabase/supabase-js';

const EMAIL = 'coadmin@papersandpetals.ph';
const TEMP_PASSWORD = '1234';
const DISPLAY_NAME = 'Papers & Petals Co-admin';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    'Missing SUPABASE_URL/VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Create the user via Supabase Dashboard + seed_coadmin.sql instead.',
  );
  process.exit(1);
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: listed, error: listError } = await admin.auth.admin.listUsers({
  page: 1,
  perPage: 200,
});

if (listError) {
  console.error('Failed to list users:', listError.message);
  process.exit(1);
}

let user = listed.users.find((entry) => entry.email?.toLowerCase() === EMAIL);

if (!user) {
  const { data, error } = await admin.auth.admin.createUser({
    email: EMAIL,
    password: TEMP_PASSWORD,
    email_confirm: true,
    user_metadata: { display_name: DISPLAY_NAME },
  });

  if (error || !data.user) {
    console.error('Failed to create auth user:', error?.message ?? 'unknown error');
    process.exit(1);
  }

  user = data.user;
  console.log('Created auth user:', user.id);
} else {
  console.log('Auth user already exists:', user.id);
  const { error: passwordError } = await admin.auth.admin.updateUserById(user.id, {
    password: TEMP_PASSWORD,
    email_confirm: true,
  });
  if (passwordError) {
    console.warn('Could not reset temporary password:', passwordError.message);
  }
}

const { error: profileError } = await admin.from('flower_profiles').upsert(
  {
    id: user.id,
    email: EMAIL,
    display_name: DISPLAY_NAME,
    role: 'co_admin',
    branch_id: null,
    onboarding_completed: false,
    is_active: true,
  },
  { onConflict: 'id' },
);

if (profileError) {
  console.error('Failed to upsert flower_profiles:', profileError.message);
  console.error('Did you run supabase/add_co_admin_role.sql first?');
  process.exit(1);
}

console.log('Co-admin ready.');
console.log(`  Email: ${EMAIL}`);
console.log(`  Temporary password: ${TEMP_PASSWORD}`);
console.log('  First login: set a personal password (no branch step).');
