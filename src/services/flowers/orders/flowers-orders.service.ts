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
  updateFlowerOrderReadyPhotoLocal,
  updateFlowerOrderStatusLocal,
} from './flowers-orders.local';

async function withSupabaseOrders<T>(
  operation: () => Promise<T>,
  fallback: () => Promise<T>,
): Promise<T> {
  const mode = getFlowerStorageMode();

  if (shouldUseFlowerSupabase(mode)) {
    try {
      return await operation();
    } catch (error) {
      if (mode === 'supabase') {
        throw error;
      }
      console.warn('Falling back to local flower orders.', error);
    }
  }

  return fallback();
}

export async function listFlowerOrders(options: ListFlowerOrdersOptions = {}): Promise<FlowerOrder[]> {
  return withSupabaseOrders(
    async () => {
      const { listFlowerOrdersSupabase } = await import('./flowers-orders.supabase');
      return listFlowerOrdersSupabase(options);
    },
    () => listFlowerOrdersLocal(options),
  );
}

export async function getFlowerOrder(orderId: string): Promise<FlowerOrder | null> {
  return withSupabaseOrders(
    async () => {
      const { getFlowerOrderSupabase } = await import('./flowers-orders.supabase');
      return getFlowerOrderSupabase(orderId);
    },
    () => getFlowerOrderLocal(orderId),
  );
}

export async function createFlowerOrder(input: CreateFlowerOrderInput): Promise<FlowerOrder> {
  return withSupabaseOrders(
    async () => {
      const { createFlowerOrderSupabase } = await import('./flowers-orders.supabase');
      return createFlowerOrderSupabase(input);
    },
    () => createFlowerOrderLocal(input),
  );
}

export async function updateFlowerOrder(input: UpdateFlowerOrderInput): Promise<FlowerOrder> {
  return withSupabaseOrders(
    async () => {
      const { updateFlowerOrderSupabase } = await import('./flowers-orders.supabase');
      return updateFlowerOrderSupabase(input);
    },
    () => updateFlowerOrderLocal(input),
  );
}

export async function updateFlowerOrderReadyPhoto(
  orderId: string,
  readyPhotoDataUrl: string,
): Promise<FlowerOrder> {
  return withSupabaseOrders(
    async () => {
      const { updateFlowerOrderReadyPhotoSupabase } = await import('./flowers-orders.supabase');
      return updateFlowerOrderReadyPhotoSupabase(orderId, readyPhotoDataUrl);
    },
    () => updateFlowerOrderReadyPhotoLocal(orderId, readyPhotoDataUrl),
  );
}

export async function updateFlowerOrderStatus(
  orderId: string,
  status: FlowerOrderStatus,
): Promise<FlowerOrder> {
  return withSupabaseOrders(
    async () => {
      const { updateFlowerOrderStatusSupabase } = await import('./flowers-orders.supabase');
      return updateFlowerOrderStatusSupabase(orderId, status);
    },
    () => updateFlowerOrderStatusLocal(orderId, status),
  );
}

export async function getFlowerDayCloseStatus(dateKey: string) {
  return withSupabaseOrders(
    async () => {
      const { getFlowerDayCloseStatusSupabase } = await import('./flowers-orders.supabase');
      return getFlowerDayCloseStatusSupabase(dateKey);
    },
    () => getFlowerDayCloseStatusLocal(dateKey),
  );
}
