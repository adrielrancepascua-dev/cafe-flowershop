import { getSupabaseClient } from '../../../lib/supabase/client';
import type {
  CreateFlowerOrderInput,
  FlowerOrder,
  ListFlowerOrdersOptions,
} from '../../../modules/flowers/shared/types/flower-order';

function requireSupabaseClient() {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  return supabase;
}

export async function listFlowerOrdersSupabase(
  _options: ListFlowerOrdersOptions = {},
): Promise<FlowerOrder[]> {
  requireSupabaseClient();
  throw new Error('Supabase flower orders v2 not wired yet. Use local storage mode.');
}

export async function createFlowerOrderSupabase(
  _input: CreateFlowerOrderInput,
): Promise<FlowerOrder> {
  requireSupabaseClient();
  throw new Error('Supabase flower orders v2 not wired yet. Use local storage mode.');
}
