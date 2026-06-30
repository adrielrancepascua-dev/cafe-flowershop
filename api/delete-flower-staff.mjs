import { requireFlowerAdmin } from './_flower-admin-auth.mjs';

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
    const { adminClient, adminUserId } = await requireFlowerAdmin(token);

    if (userId === adminUserId) {
      return res.status(400).json({ error: 'You cannot delete your own account.' });
    }

    const { data: targetProfile, error: targetError } = await adminClient
      .from('flower_profiles')
      .select('id, email, display_name, role')
      .eq('id', userId)
      .single();

    if (targetError || !targetProfile) {
      return res.status(404).json({ error: 'User not found.' });
    }

    if (targetProfile.role !== 'staff') {
      return res.status(400).json({ error: 'Only staff accounts can be deleted.' });
    }

    const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId);
    if (deleteError) {
      return res.status(400).json({ error: deleteError.message });
    }

    return res.status(200).json({
      id: targetProfile.id,
      email: targetProfile.email,
      display_name: targetProfile.display_name,
    });
  } catch (error) {
    const statusCode = error?.statusCode ?? 500;
    return res.status(statusCode).json({
      error: error instanceof Error ? error.message : 'Could not delete staff account.',
    });
  }
}
