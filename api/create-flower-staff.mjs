import { requireFlowerAdmin } from './_flower-admin-auth.mjs';

const TEMP_PASSWORD = '1234';

function slugifyName(value) {
  return (
    String(value || 'staff')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '.')
      .replace(/^\.+|\.+$/g, '')
      .slice(0, 28) || 'staff'
  );
}

function generateStaffEmail(displayName, domain) {
  const slug = slugifyName(displayName);
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${slug}.${suffix}@${domain}`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return res.status(500).json({
      error: 'Server is missing Supabase configuration (URL, anon key, or service role key).',
    });
  }

  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) {
    return res.status(401).json({ error: 'Missing authorization token.' });
  }

  const displayName = String(req.body?.display_name || '').trim();
  if (!displayName) {
    return res.status(400).json({ error: 'Display name is required.' });
  }

  const emailDomain =
    process.env.STAFF_EMAIL_DOMAIN ||
    process.env.VITE_STAFF_EMAIL_DOMAIN ||
    'papersandpetals.ph';

  try {
    const { adminClient, adminUserId } = await requireFlowerAdmin(token);

  let email = String(req.body?.email || '').trim().toLowerCase();
  if (!email) {
    email = generateStaffEmail(displayName, emailDomain);
  }

  let createdUser = null;
  let lastError = null;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidateEmail = attempt === 0 ? email : generateStaffEmail(displayName, emailDomain);
    const { data, error } = await adminClient.auth.admin.createUser({
      email: candidateEmail,
      password: TEMP_PASSWORD,
      email_confirm: true,
      user_metadata: {
        display_name: displayName,
        created_by_admin: adminUserId,
      },
    });

    if (!error && data.user) {
      createdUser = data.user;
      email = candidateEmail;
      break;
    }

    lastError = error;
    if (!error?.message?.toLowerCase().includes('already')) {
      break;
    }
  }

  if (!createdUser) {
    return res.status(400).json({
      error: lastError?.message ?? 'Could not create staff account.',
    });
  }

  const { error: insertError } = await adminClient.from('flower_profiles').insert({
    id: createdUser.id,
    email,
    display_name: displayName,
    role: 'staff',
    branch_id: null,
    onboarding_completed: false,
    is_active: true,
  });

  if (insertError) {
    await adminClient.auth.admin.deleteUser(createdUser.id);
    return res.status(400).json({ error: insertError.message });
  }

  return res.status(200).json({
    id: createdUser.id,
    email,
    display_name: displayName,
    role: 'staff',
    temporary_password: TEMP_PASSWORD,
    onboarding_completed: false,
  });
  } catch (error) {
    const statusCode = error?.statusCode ?? 500;
    return res.status(statusCode).json({
      error: error instanceof Error ? error.message : 'Could not create staff account.',
    });
  }
}
