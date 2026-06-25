import { listFlowerPosCatalogLocal } from './flowers-products.local';
import { listFlowerPosCatalogSupabase } from './flowers-pos-catalog';
import { getFlowerStorageMode, shouldUseFlowerSupabase } from '../storage-mode';
import type { FlowerPosCatalogItem } from '../../../modules/flowers/shared/data/flowers.mock';

export async function listFlowerPosCatalog(): Promise<FlowerPosCatalogItem[]> {
  const mode = getFlowerStorageMode();

  if (shouldUseFlowerSupabase(mode)) {
    try {
      return await listFlowerPosCatalogSupabase();
    } catch (error) {
      if (mode === 'supabase') {
        throw error;
      }
      console.warn('Falling back to local flower POS catalog after Supabase read failure.', error);
    }
  }

  return listFlowerPosCatalogLocal();
}
