import type { CafeOrder, CreateCafeOrderInput } from '../../modules/shared/types/order';
import { buildOrderId } from './order-id';

const ORDERS_STORAGE_KEY = 'stay_awhile_cafe_orders_v1';
const ORDER_DEBUG_ENABLED = import.meta.env.VITE_DEBUG_ORDERS === 'true';

function logDebug(message: string, meta?: unknown) {
  if (!ORDER_DEBUG_ENABLED) {
    return;
  }

  if (meta !== undefined) {
    console.log('[OrdersDebug][orders.local]', message, meta);
    return;
  }

  console.log('[OrdersDebug][orders.local]', message);
}

function readOrdersFromStorage(): CafeOrder[] {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(ORDERS_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as CafeOrder[];
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed;
  } catch {
    return [];
  }
}

function writeOrdersToStorage(orders: CafeOrder[]) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(orders));
}

export async function listOrdersLocal(): Promise<CafeOrder[]> {
  logDebug('listOrdersLocal reached');
  const orders = readOrdersFromStorage();

  const sorted = [...orders].sort((a, b) => {
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  logDebug('listOrdersLocal returning', { count: sorted.length });
  return sorted;
}

export async function createOrderLocal(input: CreateCafeOrderInput): Promise<CafeOrder> {
  logDebug('createOrderLocal reached', {
    itemCount: input.items.length,
    subtotal: input.subtotal,
    total: input.total,
  });

  const nextOrder: CafeOrder = {
    id: buildOrderId(),
    items: input.items,
    subtotal: input.subtotal,
    total: input.total,
    createdAt: new Date().toISOString(),
    status: 'submitted',
    source: input.source ?? 'dashboard_pos',
  };

  const orders = readOrdersFromStorage();
  writeOrdersToStorage([nextOrder, ...orders]);

  logDebug('createOrderLocal saved', { orderId: nextOrder.id });

  return nextOrder;
}
