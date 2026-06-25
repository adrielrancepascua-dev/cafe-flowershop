import { isSupabaseConfigured } from '../../lib/supabase/client';

export type FlowerStorageMode = 'auto' | 'local' | 'supabase';

export function getFlowerStorageMode(): FlowerStorageMode {
  const rawMode = String(import.meta.env.VITE_FLOWER_STORAGE_MODE || 'auto').toLowerCase();

  if (rawMode === 'local' || rawMode === 'supabase' || rawMode === 'auto') {
    return rawMode;
  }

  return 'auto';
}

export function shouldUseFlowerSupabase(mode: FlowerStorageMode): boolean {
  if (mode === 'local') {
    return false;
  }

  if (mode === 'supabase') {
    return true;
  }

  return isSupabaseConfigured();
}
