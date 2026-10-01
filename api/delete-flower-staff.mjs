import { createClient } from '@supabase/supabase-js';

function getUserClient(token) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    const error = new Error('Server is missing Supabase configuration (URL or anon key).');
    error.statusCode = 500;
    throw error;
  }

  return createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) {
    return res.status(401).json({ error: 'Missing authorization token.' });
  }

  const userId = String(req.body?.user_id || '').trim();
  if (!userId) {
    return res.status(400).json({ error: 'User id is required.' });
  }

  try {
    const userClient = getUserClient(token);
    const { error } = await userClient.rpc('delete_flower_staff', {
      p_user_id: userId,
    });

    if (error) {
      const statusCode = /admin access required|signed in as admin/i.test(error.message)
        ? 403
        : /not found/i.test(error.message)
          ? 404
          : 400;
      return res.status(statusCode).json({ error: error.message });
    }

    return res.status(200).json({ id: userId });
  } catch (error) {
    const statusCode = error?.statusCode ?? 500;
    return res.status(statusCode).json({
      error: error instanceof Error ? error.message : 'Could not delete staff account.',
    });
  }
}
