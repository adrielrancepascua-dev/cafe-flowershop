import { getSupabaseClient } from '../../../lib/supabase/client';
import { ensureSupabaseSession } from '../../../lib/auth/flower-auth.service';
import type {
  CreateFlowerProductInput,
  FlowerProduct,
  UpdateFlowerProductInput,
} from '../../../modules/flowers/shared/types/flower-product';

type FlowerProductRow = {
  id: string;
  name: string;
  unit_cost: number;
  is_active: boolean;
  created_at: string;
};

function requireSupabaseClient() {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  return supabase;
}

async function requireAuthenticatedSupabaseClient() {
  await ensureSupabaseSession();
  return requireSupabaseClient();
}

function rowToFlowerProduct(row: FlowerProductRow): FlowerProduct {
  return {
    id: row.id,
    name: row.name,
    unit_cost: Number(row.unit_cost ?? 0),
    is_active: Boolean(row.is_active),
    created_at: row.created_at,
  };
}

export async function listFlowerProductsSupabase(): Promise<FlowerProduct[]> {
  const supabase = await requireAuthenticatedSupabaseClient();

  const { data, error } = await supabase
    .from('flower_products')
    .select('id, name, unit_cost, is_active, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return ((data as FlowerProductRow[] | null) ?? []).map(rowToFlowerProduct);
}

export async function createFlowerProductSupabase(input: CreateFlowerProductInput): Promise<FlowerProduct> {
  const supabase = await requireAuthenticatedSupabaseClient();

  const { data, error } = await supabase
    .from('flower_products')
    .insert({
      id: `product-${Date.now()}`,
      name: input.name.trim(),
      unit_cost: input.unit_cost,
      is_active: input.is_active ?? true,
    })
    .select('id, name, unit_cost, is_active, created_at')
    .single();

  if (error) {
    throw error;
  }

  return rowToFlowerProduct(data as FlowerProductRow);
}

export async function updateFlowerProductSupabase(
  productId: string,
  input: UpdateFlowerProductInput,
): Promise<FlowerProduct> {
  const supabase = await requireAuthenticatedSupabaseClient();

  const { data, error } = await supabase
    .from('flower_products')
    .update({
      name: input.name.trim(),
      unit_cost: input.unit_cost,
    })
    .eq('id', productId)
    .select('id, name, unit_cost, is_active, created_at')
    .single();

  if (error) {
    throw error;
  }

  return rowToFlowerProduct(data as FlowerProductRow);
}

export async function toggleFlowerProductActiveSupabase(
  productId: string,
  isActive: boolean,
): Promise<FlowerProduct> {
  const supabase = await requireAuthenticatedSupabaseClient();

  const { data, error } = await supabase
    .from('flower_products')
    .update({ is_active: isActive })
    .eq('id', productId)
    .select('id, name, unit_cost, is_active, created_at')
    .single();

  if (error) {
    throw error;
  }

  return rowToFlowerProduct(data as FlowerProductRow);
}

export async function deleteFlowerProductSupabase(productId: string): Promise<void> {
  const supabase = await requireAuthenticatedSupabaseClient();

  const { error } = await supabase.from('flower_products').delete().eq('id', productId);

  if (error) {
    if ('code' in error && error.code === '23503') {
      throw new Error(
        'Cannot delete this product because it is linked to inventory or order history. Archive it instead.',
      );
    }

    throw error;
  }
}
