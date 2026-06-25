import { FLOWER_ORDERS_SEED } from '../../../modules/flowers/shared/data/flowers.mock';
import type {
  CreateFlowerOrderInput,
  FlowerOrder,
  ListFlowerOrdersOptions,
} from '../../../modules/flowers/shared/types/flower-order';
import { buildOrderId } from '../../orders/order-id';
import {
  deductFlowerInventoryLocal,
  listFlowerBranchesLocal,
} from '../inventory/flowers-inventory.local';

const ORDERS_STORAGE_KEY = 'stay_awhile_flower_orders_v1';
const ORDERS_SEEDED_KEY = 'stay_awhile_flower_orders_seeded_v1';

function cloneOrders(orders: FlowerOrder[]): FlowerOrder[] {
  return orders.map((order) => ({
    ...order,
    items: order.items.map((item) => ({ ...item })),
  }));
}

function readOrdersFromStorage(): FlowerOrder[] {
  if (typeof window === 'undefined') {
    return cloneOrders(FLOWER_ORDERS_SEED);
  }

  try {
    const seeded = window.localStorage.getItem(ORDERS_SEEDED_KEY);
    const raw = window.localStorage.getItem(ORDERS_STORAGE_KEY);

    if (!seeded) {
      writeOrdersToStorage(cloneOrders(FLOWER_ORDERS_SEED));
      window.localStorage.setItem(ORDERS_SEEDED_KEY, 'true');
      return cloneOrders(FLOWER_ORDERS_SEED);
    }

    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as FlowerOrder[];
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed;
  } catch {
    return cloneOrders(FLOWER_ORDERS_SEED);
  }
}

function writeOrdersToStorage(orders: FlowerOrder[]) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(orders));
}

export async function listFlowerOrdersLocal(
  options: ListFlowerOrdersOptions = {},
): Promise<FlowerOrder[]> {
  const orders = readOrdersFromStorage();

  const filtered = orders.filter((order) => {
    if (options.branchId && order.branch_id !== options.branchId) {
      return false;
    }

    if (options.scheduledOnly && !order.scheduled_for) {
      return false;
    }

    return true;
  });

  return filtered.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
}

export async function createFlowerOrderLocal(input: CreateFlowerOrderInput): Promise<FlowerOrder> {
  const branches = await listFlowerBranchesLocal();
  const branch = branches.find((entry) => entry.id === input.branch_id);

  if (!branch) {
    throw new Error('Branch not found.');
  }

  for (const item of input.items) {
    await deductFlowerInventoryLocal({
      branchId: input.branch_id,
      productId: item.product_id,
      quantity: item.quantity,
    });
  }

  const created: FlowerOrder = {
    id: buildOrderId().replace('ORD-', 'FLR-'),
    branch_id: input.branch_id,
    branch_name: branch.name,
    customer_name: input.customer_name?.trim() || null,
    scheduled_for: input.scheduled_for ?? null,
    status: 'encoded',
    total_amount: input.total_amount,
    notes: input.notes?.trim() ?? '',
    created_at: new Date().toISOString(),
    items: input.items.map((item) => ({ ...item })),
  };

  const orders = readOrdersFromStorage();
  writeOrdersToStorage([created, ...orders]);

  return created;
}
