import type {
  CreateFlowerOrderInput,
  FlowerOrder,
  FlowerOrderStatus,
  ListFlowerOrdersOptions,
  UpdateFlowerOrderInput,
} from '../../../modules/flowers/shared/types/flower-order';
import { getFlowerStorageMode, shouldUseFlowerSupabase } from '../storage-mode';
import {
  createFlowerOrderLocal,
  getFlowerDayCloseStatusLocal,
  getFlowerOrderLocal,
  listFlowerOrdersLocal,
  updateFlowerOrderLocal,
  updateFlowerOrderStatusLocal,
} from './flowers-orders.local';

export async function listFlowerOrders(options: ListFlowerOrdersOptions = {}): Promise<FlowerOrder[]> {
  const mode = getFlowerStorageMode();

  if (shouldUseFlowerSupabase(mode)) {
    try {
      const { listFlowerOrdersSupabase } = await import('./flowers-orders.supabase');
      return await listFlowerOrdersSupabase(options);
    } catch (error) {
      if (mode === 'supabase') {
        throw error;
      }
      console.warn('Falling back to local flower orders.', error);
    }
  }

  return listFlowerOrdersLocal(options);
}

export async function getFlowerOrder(orderId: string): Promise<FlowerOrder | null> {
  return getFlowerOrderLocal(orderId);
}

export async function createFlowerOrder(input: CreateFlowerOrderInput): Promise<FlowerOrder> {
  const mode = getFlowerStorageMode();

  if (shouldUseFlowerSupabase(mode)) {
    try {
      const { createFlowerOrderSupabase } = await import('./flowers-orders.supabase');
      return await createFlowerOrderSupabase(input);
    } catch (error) {
      if (mode === 'supabase') {
        throw error;
      }
      console.warn('Falling back to local flower order create.', error);
    }
  }

  return createFlowerOrderLocal(input);
}

export async function updateFlowerOrder(input: UpdateFlowerOrderInput): Promise<FlowerOrder> {
  return updateFlowerOrderLocal(input);
}

export async function updateFlowerOrderStatus(
  orderId: string,
  status: FlowerOrderStatus,
): Promise<FlowerOrder> {
  return updateFlowerOrderStatusLocal(orderId, status);
}

export async function getFlowerDayCloseStatus(dateKey: string) {
  return getFlowerDayCloseStatusLocal(dateKey);
}
