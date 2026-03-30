import { getSupabaseClient } from '../../lib/supabase/client';
import type { CafeProduct } from '../../modules/shared/types/product';
import type { ListProductsOptions } from './products.types';

type ProductRow = {
  id: string;
  name: string;
  category: string;
  price: number;
  description: string;
  image: string;
  is_best_seller: boolean;
  is_new: boolean;
  is_active: boolean;
};

function rowToProduct(row: ProductRow): CafeProduct {
  return {
    id: row.id,
    name: row.name,
    category: row.category as CafeProduct['category'],
    price: Number(row.price),
    description: row.description,
    image: row.image,
    is_best_seller: Boolean(row.is_best_seller),
    is_new: Boolean(row.is_new),
    is_active: Boolean(row.is_active),
  };
}

function requireSupabaseClient() {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  return supabase;
}

export async function listProductsSupabase(options: ListProductsOptions = {}): Promise<CafeProduct[]> {
  const { includeInactive = false } = options;
  const supabase = requireSupabaseClient();

  let query = supabase
    .from('products')
    .select(
      'id, name, category, price, description, image, is_best_seller, is_new, is_active',
    )
    .order('category', { ascending: true })
    .order('name', { ascending: true });

  if (!includeInactive) {
    query = query.eq('is_active', true);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return (data as ProductRow[] | null)?.map(rowToProduct) ?? [];
}

export async function updateProductPriceSupabase(productId: string, nextPrice: number): Promise<CafeProduct> {
  const supabase = requireSupabaseClient();

  const { data, error } = await supabase
    .from('products')
    .update({
      price: nextPrice,
      updated_at: new Date().toISOString(),
    })
    .eq('id', productId)
    .select('id, name, category, price, description, image, is_best_seller, is_new, is_active')
    .single();

  if (error) {
    throw error;
  }

  return rowToProduct(data as ProductRow);
}

export async function updateProductActiveSupabase(productId: string, isActive: boolean): Promise<CafeProduct> {
  const supabase = requireSupabaseClient();

  const { data, error } = await supabase
    .from('products')
    .update({
      is_active: isActive,
      updated_at: new Date().toISOString(),
    })
    .eq('id', productId)
    .select('id, name, category, price, description, image, is_best_seller, is_new, is_active')
    .single();

  if (error) {
    throw error;
  }

  return rowToProduct(data as ProductRow);
}
