import type {
  CreateFlowerProductInput,
  FlowerProduct,
  UpdateFlowerProductInput,
} from '../../../modules/flowers/shared/types/flower-product';
import {
  createFlowerProductLocal,
  deleteFlowerProductLocal,
  listFlowerProductsLocal,
  toggleFlowerProductActiveLocal,
  updateFlowerProductLocal,
} from './flowers-products.local';
import {
  createFlowerProductSupabase,
  deleteFlowerProductSupabase,
  listFlowerProductsSupabase,
  toggleFlowerProductActiveSupabase,
  updateFlowerProductSupabase,
} from './flowers-products.supabase';
import { getFlowerStorageMode, shouldUseFlowerSupabase } from '../storage-mode';

function validateName(name: string) {
  if (!name.trim()) {
    throw new Error('Product name is required.');
  }
}

function validateBasePrice(basePrice: number) {
  if (!Number.isFinite(basePrice) || basePrice < 0) {
    throw new Error('Base price must be 0 or greater.');
  }
}

export async function listFlowerProducts(): Promise<FlowerProduct[]> {
  const mode = getFlowerStorageMode();

  if (shouldUseFlowerSupabase(mode)) {
    try {
      return await listFlowerProductsSupabase();
    } catch (error) {
      if (mode === 'supabase') {
        throw error;
      }
      console.warn('Falling back to local flower product storage after Supabase read failure.', error);
    }
  }

  return listFlowerProductsLocal();
}

export async function createFlowerProduct(input: CreateFlowerProductInput): Promise<FlowerProduct> {
  validateName(input.name);
  validateBasePrice(input.base_price);

  const mode = getFlowerStorageMode();

  if (shouldUseFlowerSupabase(mode)) {
    try {
      return await createFlowerProductSupabase(input);
    } catch (error) {
      if (mode === 'supabase') {
        throw error;
      }
      console.warn('Falling back to local flower product storage after Supabase write failure.', error);
    }
  }

  return createFlowerProductLocal(input);
}

export async function updateFlowerProduct(
  productId: string,
  input: UpdateFlowerProductInput,
): Promise<FlowerProduct> {
  validateName(input.name);
  validateBasePrice(input.base_price);

  const mode = getFlowerStorageMode();

  if (shouldUseFlowerSupabase(mode)) {
    try {
      return await updateFlowerProductSupabase(productId, input);
    } catch (error) {
      if (mode === 'supabase') {
        throw error;
      }
      console.warn('Falling back to local flower product storage after Supabase update failure.', error);
    }
  }

  return updateFlowerProductLocal(productId, input);
}

export async function toggleFlowerProductActive(
  productId: string,
  isActive: boolean,
): Promise<FlowerProduct> {
  const mode = getFlowerStorageMode();

  if (shouldUseFlowerSupabase(mode)) {
    try {
      return await toggleFlowerProductActiveSupabase(productId, isActive);
    } catch (error) {
      if (mode === 'supabase') {
        throw error;
      }
      console.warn('Falling back to local flower product storage after Supabase toggle failure.', error);
    }
  }

  return toggleFlowerProductActiveLocal(productId, isActive);
}

export async function deleteFlowerProduct(productId: string): Promise<void> {
  if (!productId.trim()) {
    throw new Error('Product ID is required.');
  }

  const mode = getFlowerStorageMode();

  if (shouldUseFlowerSupabase(mode)) {
    try {
      return await deleteFlowerProductSupabase(productId);
    } catch (error) {
      if (mode === 'supabase') {
        throw error;
      }
      console.warn('Falling back to local flower product storage after Supabase delete failure.', error);
    }
  }

  return deleteFlowerProductLocal(productId);
}
