import type {
  CreateFlowerProductInput,
  FlowerProduct,
  UpdateFlowerProductInput,
} from '../../../modules/flowers/shared/types/flower-product';
import {
  createFlowerProductSupabase,
  deleteFlowerProductSupabase,
  listFlowerProductsSupabase,
  toggleFlowerProductActiveSupabase,
  updateFlowerProductSupabase,
} from './flowers-products.supabase';

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
  return listFlowerProductsSupabase();
}

export async function createFlowerProduct(input: CreateFlowerProductInput): Promise<FlowerProduct> {
  validateName(input.name);
  validateBasePrice(input.base_price);

  return createFlowerProductSupabase(input);
}

export async function updateFlowerProduct(
  productId: string,
  input: UpdateFlowerProductInput,
): Promise<FlowerProduct> {
  validateName(input.name);
  validateBasePrice(input.base_price);

  return updateFlowerProductSupabase(productId, input);
}

export async function toggleFlowerProductActive(
  productId: string,
  isActive: boolean,
): Promise<FlowerProduct> {
  return toggleFlowerProductActiveSupabase(productId, isActive);
}

export async function deleteFlowerProduct(productId: string): Promise<void> {
  if (!productId.trim()) {
    throw new Error('Product ID is required.');
  }

  return deleteFlowerProductSupabase(productId);
}
