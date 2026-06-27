import type {
  CreateFlowerProductInput,
  FlowerProduct,
  UpdateFlowerProductInput,
} from '../../../modules/flowers/shared/types/flower-product';
import { getFlowerStorageMode, shouldUseFlowerSupabase } from '../storage-mode';
import {
  createFlowerStemLocal,
  deleteFlowerStemLocal,
  listFlowerStemsLocal,
  toggleFlowerStemActiveLocal,
  updateFlowerStemLocal,
} from './flowers-products.local';

export async function listFlowerProducts(): Promise<FlowerProduct[]> {
  const mode = getFlowerStorageMode();

  if (shouldUseFlowerSupabase(mode)) {
    try {
      const { listFlowerProductsSupabase } = await import('./flowers-products.supabase');
      return await listFlowerProductsSupabase();
    } catch (error) {
      if (mode === 'supabase') {
        throw error;
      }
      console.warn('Falling back to local flower products.', error);
    }
  }

  return listFlowerStemsLocal();
}

export async function createFlowerProduct(input: CreateFlowerProductInput): Promise<FlowerProduct> {
  const mode = getFlowerStorageMode();

  if (shouldUseFlowerSupabase(mode)) {
    try {
      const { createFlowerProductSupabase } = await import('./flowers-products.supabase');
      return await createFlowerProductSupabase(input);
    } catch (error) {
      if (mode === 'supabase') {
        throw error;
      }
    }
  }

  return createFlowerStemLocal(input);
}

export async function updateFlowerProduct(
  productId: string,
  input: UpdateFlowerProductInput,
): Promise<FlowerProduct> {
  const mode = getFlowerStorageMode();

  if (shouldUseFlowerSupabase(mode)) {
    try {
      const { updateFlowerProductSupabase } = await import('./flowers-products.supabase');
      return await updateFlowerProductSupabase(productId, input);
    } catch (error) {
      if (mode === 'supabase') {
        throw error;
      }
    }
  }

  return updateFlowerStemLocal(productId, input);
}

export async function toggleFlowerProductActive(
  productId: string,
  isActive: boolean,
): Promise<FlowerProduct> {
  const mode = getFlowerStorageMode();

  if (shouldUseFlowerSupabase(mode)) {
    try {
      const { toggleFlowerProductActiveSupabase } = await import('./flowers-products.supabase');
      return await toggleFlowerProductActiveSupabase(productId, isActive);
    } catch (error) {
      if (mode === 'supabase') {
        throw error;
      }
    }
  }

  return toggleFlowerStemActiveLocal(productId, isActive);
}

export async function deleteFlowerProduct(productId: string): Promise<void> {
  const mode = getFlowerStorageMode();

  if (shouldUseFlowerSupabase(mode)) {
    try {
      const { deleteFlowerProductSupabase } = await import('./flowers-products.supabase');
      return await deleteFlowerProductSupabase(productId);
    } catch (error) {
      if (mode === 'supabase') {
        throw error;
      }
    }
  }

  return deleteFlowerStemLocal(productId);
}
