import type {
  CreateFlowerOrderInput,
  FlowerOrder,
  ListFlowerOrdersOptions,
} from '../../../modules/flowers/shared/types/flower-order';
import { createFlowerOrderLocal, listFlowerOrdersLocal } from './flowers-orders.local';
import {
  createFlowerOrderSupabase,
  listFlowerOrdersSupabase,
} from './flowers-orders.supabase';
import { getFlowerStorageMode, shouldUseFlowerSupabase } from '../storage-mode';

function validateOrderInput(input: CreateFlowerOrderInput) {
  if (!input.branch_id) {
    throw new Error('Branch is required.');
  }

  if (!Array.isArray(input.items) || input.items.length === 0) {
    throw new Error('At least one order item is required.');
  }

  if (!Number.isFinite(input.total_amount) || input.total_amount < 0) {
    throw new Error('Total amount must be 0 or greater.');
  }

  for (const item of input.items) {
    if (!item.product_id) {
      throw new Error('Order item product is required.');
    }

    if (!item.item_name.trim()) {
      throw new Error('Order item name is required.');
    }

    if (!Number.isFinite(item.quantity) || item.quantity <= 0 || !Number.isInteger(item.quantity)) {
      throw new Error('Order item quantity must be a whole number greater than 0.');
    }

    if (!Number.isFinite(item.unit_price) || item.unit_price < 0) {
      throw new Error('Order item unit price must be 0 or greater.');
    }

    if (!Number.isFinite(item.line_total) || item.line_total < 0) {
      throw new Error('Order item line total must be 0 or greater.');
    }
  }
}

export async function listFlowerOrders(options: ListFlowerOrdersOptions = {}): Promise<FlowerOrder[]> {
  const mode = getFlowerStorageMode();

  if (shouldUseFlowerSupabase(mode)) {
    try {
      return await listFlowerOrdersSupabase(options);
    } catch (error) {
      if (mode === 'supabase') {
        throw error;
      }
      console.warn('Falling back to local flower order storage after Supabase read failure.', error);
    }
  }

  return listFlowerOrdersLocal(options);
}

export async function createFlowerOrder(input: CreateFlowerOrderInput): Promise<FlowerOrder> {
  validateOrderInput(input);

  const mode = getFlowerStorageMode();

  if (shouldUseFlowerSupabase(mode)) {
    try {
      return await createFlowerOrderSupabase(input);
    } catch (error) {
      if (mode === 'supabase') {
        throw error;
      }
      console.warn('Falling back to local flower order storage after Supabase write failure.', error);
    }
  }

  return createFlowerOrderLocal(input);
}
