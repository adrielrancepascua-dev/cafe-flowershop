import { createClient } from '@supabase/supabase-js';

const BUCKET = 'order-attachments';
const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const BATCH_LIMIT = 200;

function json(res, status, body) {
  res.status(status).json(body);
}

function isAuthorized(req) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return false;
  }

  const header = req.headers.authorization || '';
  return header === `Bearer ${cronSecret}`;
}

async function deleteStoragePaths(supabaseUrl, serviceRoleKey, paths) {
  const response = await fetch(`${supabaseUrl}/storage/v1/object/${BUCKET}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ prefixes: paths }),
  });

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const message = body?.message || body?.error || response.statusText;
    throw new Error(`Storage delete failed: ${message}`);
  }

  return Array.isArray(body) ? body.map((row) => row.name).filter(Boolean) : [];
}

export async function purgeExpiredOrderPhotos(admin, supabaseUrl, serviceRoleKey) {
  const cutoffMs = Date.now() - RETENTION_MS;
  const { data, error } = await admin.rpc('list_expired_order_attachment_paths', {
    p_limit: BATCH_LIMIT,
  });

  if (error) {
    throw new Error(error.message);
  }

  const expired = (data || []).filter((row) => {
    const createdMs = new Date(row.created_at).getTime();
    return row.object_name && Number.isFinite(createdMs) && createdMs < cutoffMs;
  });

  if (expired.length === 0) {
    return { deleted: 0, ordersUpdated: 0, remaining: false };
  }

  const deletedNames = [];
  for (let index = 0; index < expired.length; index += 100) {
    const slice = expired.slice(index, index + 100).map((row) => row.object_name);
    const removed = await deleteStoragePaths(supabaseUrl, serviceRoleKey, slice);
    deletedNames.push(...removed);
  }

  if (deletedNames.length === 0) {
    return { deleted: 0, ordersUpdated: 0, remaining: expired.length > 0 };
  }

  const { data: ordersUpdated, error: markError } = await admin.rpc('mark_order_photos_removed', {
    p_paths: deletedNames,
  });

  if (markError) {
    throw new Error(markError.message);
  }

  return {
    deleted: deletedNames.length,
    ordersUpdated: Number(ordersUpdated) || 0,
    remaining: expired.length === BATCH_LIMIT,
  };
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return json(res, 405, { error: 'Method not allowed.' });
  }

  if (!isAuthorized(req)) {
    return json(res, 401, { error: 'Unauthorized.' });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return json(res, 500, { error: 'Server is missing Supabase configuration.' });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    let deleted = 0;
    let ordersUpdated = 0;
    let remaining = true;

    for (let pass = 0; pass < 4 && remaining; pass += 1) {
      const result = await purgeExpiredOrderPhotos(admin, supabaseUrl, serviceRoleKey);
      deleted += result.deleted;
      ordersUpdated += result.ordersUpdated;
      remaining = result.remaining && result.deleted > 0;
    }

    return json(res, 200, { deleted, ordersUpdated, remaining });
  } catch (error) {
    return json(res, 500, { error: error instanceof Error ? error.message : 'Photo cleanup failed.' });
  }
}
