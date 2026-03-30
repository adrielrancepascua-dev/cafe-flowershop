import type { CafeOrder, CreateCafeOrderInput } from '../../modules/shared/types/order';
import { isSupabaseConfigured } from '../../lib/supabase/client';
import { createOrderLocal, listOrdersLocal } from './orders.local';
import { createOrderSupabase, listOrdersSupabase } from './orders.supabase';

type OrderStorageMode = 'auto' | 'local' | 'supabase';
const ORDER_DEBUG_ENABLED = import.meta.env.VITE_DEBUG_ORDERS === 'true';

function logDebug(message: string, meta?: unknown) {
  if (!ORDER_DEBUG_ENABLED) {
    return;
  }

  if (meta !== undefined) {
    console.log('[OrdersDebug][orders.service]', message, meta);
    return;
  }

  console.log('[OrdersDebug][orders.service]', message);
}

function getConfiguredMode(): OrderStorageMode {
  const rawMode = String(import.meta.env.VITE_ORDER_STORAGE_MODE || 'auto').toLowerCase();

  logDebug('Resolved VITE_ORDER_STORAGE_MODE', { rawMode });

  if (rawMode === 'local' || rawMode === 'supabase' || rawMode === 'auto') {
    logDebug('Using configured storage mode', { mode: rawMode });
    return rawMode;
  }

  logDebug('Invalid storage mode value, defaulting to auto', { rawMode });
  return 'auto';
}

function shouldUseSupabase(mode: OrderStorageMode): boolean {
  if (mode === 'local') {
    logDebug('Storage mode local forces local adapter');
    return false;
  }

  if (mode === 'supabase') {
    logDebug('Storage mode supabase forces Supabase adapter');
    return true;
  }

  const configured = isSupabaseConfigured();
  logDebug('Auto mode checked Supabase configuration', { configured });
  return configured;
}

export async function listOrders(): Promise<CafeOrder[]> {
  const mode = getConfiguredMode();
  const useSupabase = shouldUseSupabase(mode);

  logDebug('listOrders reached', { mode, useSupabase });

  if (useSupabase) {
    logDebug('Attempting Supabase list adapter');
    try {
      const orders = await listOrdersSupabase();
      logDebug('Supabase list adapter succeeded', { count: orders.length });
      return orders;
    } catch (error) {
      logDebug('Supabase list adapter failed', {
        reason: error instanceof Error ? error.message : String(error),
      });
      if (mode === 'supabase') {
        logDebug('Mode is supabase, rethrowing adapter error');
        throw error;
      }
      console.warn('Falling back to local order storage after Supabase read failure.', error);
      logDebug('Falling back to local adapter from auto mode after read failure');
    }
  }

  logDebug('Using local list adapter');
  return listOrdersLocal();
}

export async function createOrder(input: CreateCafeOrderInput): Promise<CafeOrder> {
  const mode = getConfiguredMode();
  const useSupabase = shouldUseSupabase(mode);

  logDebug('createOrder reached', {
    mode,
    useSupabase,
    itemCount: input.items.length,
    subtotal: input.subtotal,
    total: input.total,
    source: input.source ?? 'dashboard_pos',
  });

  if (useSupabase) {
    logDebug('Attempting Supabase create adapter');
    try {
      const order = await createOrderSupabase(input);
      logDebug('Supabase create adapter succeeded', { orderId: order.id });
      return order;
    } catch (error) {
      logDebug('Supabase create adapter failed', {
        reason: error instanceof Error ? error.message : String(error),
      });
      if (mode === 'supabase') {
        logDebug('Mode is supabase, rethrowing adapter error');
        throw error;
      }
      console.warn('Falling back to local order storage after Supabase write failure.', error);
      logDebug('Falling back to local adapter from auto mode after write failure');
    }
  }

  logDebug('Using local create adapter');
  return createOrderLocal(input);
}
