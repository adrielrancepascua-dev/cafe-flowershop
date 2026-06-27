import { listFlowerProductsSupabase } from './flowers-products.supabase';
import type { FlowerStemCatalogItem } from '../../../modules/flowers/shared/data/flowers.mock';

export async function listFlowerPosCatalogSupabase(): Promise<FlowerStemCatalogItem[]> {
  const products = await listFlowerProductsSupabase();
  return products.filter((product) => product.is_active);
}
