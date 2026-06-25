import { getSupabaseClient } from '../../../lib/supabase/client';
import type { FlowerPosCatalogItem } from '../../../modules/flowers/shared/data/flowers.mock';

export async function listFlowerPosCatalogSupabase(): Promise<FlowerPosCatalogItem[]> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const { data, error } = await supabase
    .from('flower_products')
    .select('id, name, base_price, is_active, created_at')
    .eq('is_active', true)
    .order('name');

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    base_price: Number(row.base_price),
    is_active: row.is_active,
    created_at: row.created_at,
    category: 'Flowers',
    description: 'Fresh flower product.',
    image: 'https://images.unsplash.com/photo-1490750967868-88aa4486c946?auto=format&fit=crop&w=600&q=80',
  }));
}
