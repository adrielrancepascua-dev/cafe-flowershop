import { createClient } from '@supabase/supabase-js';

export function getSupabaseEnv() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  return { supabaseUrl, anonKey, serviceRoleKey };
}

export async function requireFlowerAdmin(token) {
  const { supabaseUrl, anonKey, serviceRoleKey } = getSupabaseEnv();

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    const error = new Error('Server is missing Supabase configuration (URL, anon key, or service role key).');
    error.statusCode = 500;
    throw error;
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userError } = await userClient.auth.getUser(token);
  if (userError || !userData.user) {
    const error = new Error('Invalid or expired session.');
    error.statusCode = 401;
    throw error;
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: adminProfile, error: profileError } = await adminClient
    .from('flower_profiles')
    .select('role, is_active')
    .eq('id', userData.user.id)
    .single();

  if (profileError || !adminProfile || adminProfile.role !== 'admin' || adminProfile.is_active === false) {
    const error = new Error('Admin access required.');
    error.statusCode = 403;
    throw error;
  }

  return { adminClient, adminUserId: userData.user.id };
}
