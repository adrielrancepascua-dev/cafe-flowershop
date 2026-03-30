import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let clientCache: SupabaseClient | null | undefined;
const ORDER_DEBUG_ENABLED = import.meta.env.VITE_DEBUG_ORDERS === 'true';

function readSupabaseEnv() {
  const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL || '').trim();
  const supabaseAnonKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

  return {
    supabaseUrl,
    supabaseAnonKey,
  };
}

function logDebug(message: string, meta?: unknown) {
  if (!ORDER_DEBUG_ENABLED) {
    return;
  }

  if (meta !== undefined) {
    console.log('[OrdersDebug][supabase.client]', message, meta);
    return;
  }

  console.log('[OrdersDebug][supabase.client]', message);
}

export function isSupabaseConfigured(): boolean {
  const { supabaseUrl, supabaseAnonKey } = readSupabaseEnv();
  const configured = Boolean(supabaseUrl && supabaseAnonKey);

  logDebug('Supabase env detection', {
    configured,
    hasUrl: Boolean(supabaseUrl),
    hasAnonKey: Boolean(supabaseAnonKey),
  });

  return configured;
}

export function getSupabaseClient(): SupabaseClient | null {
  if (clientCache !== undefined) {
    logDebug('Returning cached client state', { hasClient: Boolean(clientCache) });
    return clientCache;
  }

  if (!isSupabaseConfigured()) {
    logDebug('Client not created because env is incomplete');
    clientCache = null;
    return clientCache;
  }

  const { supabaseUrl, supabaseAnonKey } = readSupabaseEnv();
  logDebug('Creating Supabase client instance');
  clientCache = createClient(supabaseUrl, supabaseAnonKey);
  return clientCache;
}
