import { getSupabaseClient } from '../../../lib/supabase/client';
import type {
  CreateFlowerProductInput,
  FlowerProduct,
  UpdateFlowerProductInput,
} from '../../../modules/flowers/shared/types/flower-product';

type FlowerProductRow = {
  id: string;
  name: string;
  base_price: number;
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

function rowToFlowerProduct(row: FlowerProductRow): FlowerProduct {
  return {
    id: row.id,
    name: row.name,
    base_price: Number(row.base_price),
    is_active: Boolean(row.is_active),
    created_at: row.created_at,
  };
}

export async function listFlowerProductsSupabase(): Promise<FlowerProduct[]> {
  const supabase = requireSupabaseClient();

  const { data, error } = await supabase
    .from('flower_products')
    .select('id, name, base_price, is_active, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return ((data as FlowerProductRow[] | null) ?? []).map(rowToFlowerProduct);
}

export async function createFlowerProductSupabase(input: CreateFlowerProductInput): Promise<FlowerProduct> {
  const supabase = requireSupabaseClient();

  const { data, error } = await supabase
    .from('flower_products')
    .insert({
      name: input.name.trim(),
      base_price: input.base_price,
      is_active: input.is_active ?? true,
    })
    .select('id, name, base_price, is_active, created_at')
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
  const supabase = requireSupabaseClient();

  const { data, error } = await supabase
    .from('flower_products')
    .update({
      name: input.name.trim(),
      base_price: input.base_price,
    })
    .eq('id', productId)
    .select('id, name, base_price, is_active, created_at')
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
  const supabase = requireSupabaseClient();

  const { data, error } = await supabase
    .from('flower_products')
    .update({
      is_active: isActive,
    })
    .eq('id', productId)
    .select('id, name, base_price, is_active, created_at')
    .single();

  if (error) {
    throw error;
  }

  return rowToFlowerProduct(data as FlowerProductRow);
}

export async function deleteFlowerProductSupabase(productId: string): Promise<void> {
  const supabase = requireSupabaseClient();

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
