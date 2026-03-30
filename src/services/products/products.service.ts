import type { CafeProduct } from '../../modules/shared/types/product';
import { isSupabaseConfigured } from '../../lib/supabase/client';
import {
  listProductsLocal,
  updateProductActiveLocal,
  updateProductPriceLocal,
} from './products.local';
import {
  listProductsSupabase,
  updateProductActiveSupabase,
  updateProductPriceSupabase,
} from './products.supabase';
import type { ListProductsOptions } from './products.types';

export type { ListProductsOptions } from './products.types';

type ProductStorageMode = 'auto' | 'local' | 'supabase';

function getConfiguredMode(): ProductStorageMode {
  const rawMode = String(import.meta.env.VITE_PRODUCT_STORAGE_MODE || 'auto').toLowerCase();

  if (rawMode === 'local' || rawMode === 'supabase' || rawMode === 'auto') {
    return rawMode;
  }

  return 'auto';
}

function shouldUseSupabase(mode: ProductStorageMode): boolean {
  if (mode === 'local') {
    return false;
  }

  if (mode === 'supabase') {
    return true;
  }

  return isSupabaseConfigured();
}

export async function listProducts(options: ListProductsOptions = {}): Promise<CafeProduct[]> {
  const mode = getConfiguredMode();

  if (shouldUseSupabase(mode)) {
    try {
      return await listProductsSupabase(options);
    } catch (error) {
      if (mode === 'supabase') {
        throw error;
      }
      console.warn('Falling back to local product storage after Supabase read failure.', error);
    }
  }

  return listProductsLocal(options);
}

export async function listProductCategories(options: ListProductsOptions = {}): Promise<string[]> {
  const products = await listProducts(options);
  return [...new Set(products.map((product) => product.category))];
}

export async function updateProductPrice(productId: string, nextPrice: number): Promise<CafeProduct> {
  const mode = getConfiguredMode();

  if (nextPrice < 0) {
    throw new Error('Price cannot be negative.');
  }

  if (shouldUseSupabase(mode)) {
    try {
      return await updateProductPriceSupabase(productId, nextPrice);
    } catch (error) {
      if (mode === 'supabase') {
        throw error;
      }
      console.warn('Falling back to local product storage after Supabase update failure.', error);
    }
  }

  return updateProductPriceLocal(productId, nextPrice);
}

export async function updateProductActive(productId: string, isActive: boolean): Promise<CafeProduct> {
  const mode = getConfiguredMode();

  if (shouldUseSupabase(mode)) {
    try {
      return await updateProductActiveSupabase(productId, isActive);
    } catch (error) {
      if (mode === 'supabase') {
        throw error;
      }
      console.warn('Falling back to local product storage after Supabase update failure.', error);
    }
  }

  return updateProductActiveLocal(productId, isActive);
}
