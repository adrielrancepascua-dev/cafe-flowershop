import type {
  CreateFlowerOrderInput,
  FlowerOrder,
  FlowerOrderStatus,
  FlowerPaymentMode,
  ListFlowerOrdersOptions,
  UpdateFlowerOrderInput,
} from '../../../modules/flowers/shared/types/flower-order';
import { getFlowerStorageMode, shouldUseFlowerSupabase } from '../storage-mode';
import {
  createFlowerOrderLocal,
  deleteFlowerOrderLocal,
  getFlowerDayCloseStatusLocal,
  getFlowerOrderLocal,
  listFlowerOrdersLocal,
  updateFlowerOrderLocal,
  updateFlowerOrderReadyPhotoLocal,
  updateFlowerOrderStatusLocal,
  markFlowerOrderBalancePaidLocal,
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

export async function markFlowerOrderBalancePaid(
  orderId: string,
  balancePaymentMode: FlowerPaymentMode,
  balancePaymentReference = '',
): Promise<FlowerOrder> {
  return withSupabaseOrders(
    async () => {
      const { markFlowerOrderBalancePaidSupabase } = await import('./flowers-orders.supabase');
      return markFlowerOrderBalancePaidSupabase(
        orderId,
        balancePaymentMode,
        balancePaymentReference,
      );
    },
    () =>
      markFlowerOrderBalancePaidLocal(orderId, balancePaymentMode, balancePaymentReference),
  );
}

export async function deleteFlowerOrder(orderId: string): Promise<void> {
  return withSupabaseOrders(
    async () => {
      const { deleteFlowerOrderSupabase } = await import('./flowers-orders.supabase');
      return deleteFlowerOrderSupabase(orderId);
    },
    () => deleteFlowerOrderLocal(orderId),
  );
}

export async function getFlowerDayCloseStatus(dateKey: string, branchId?: string) {
  return withSupabaseOrders(
    async () => {
      const { getFlowerDayCloseStatusSupabase } = await import('./flowers-orders.supabase');
      return getFlowerDayCloseStatusSupabase(dateKey, branchId);
    },
    () => getFlowerDayCloseStatusLocal(dateKey, branchId),
  );
}
