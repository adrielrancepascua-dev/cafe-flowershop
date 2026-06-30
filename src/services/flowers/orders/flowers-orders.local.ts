import {
  FLOWER_ORDERS_SEED,
} from '../../../modules/flowers/shared/data/flowers.mock';
import type {
  CreateFlowerOrderInput,
  FlowerOrder,
  FlowerOrderStatus,
  ListFlowerOrdersOptions,
  UpdateFlowerOrderInput,
} from '../../../modules/flowers/shared/types/flower-order';
import { buildOrderId } from '../../orders/order-id';
import {
  deductFlowerInventoryForOrderLocal,
  listFlowerBranchesLocal,
  validateFlowerOrderStockLocal,
} from '../inventory/flowers-inventory.local';
import {
  computeFlowerDayCloseStatus,
  getOrdersPendingInventoryDeduction,
  getPickupDateKey,
} from './flowers-order-day-close';

const ORDERS_STORAGE_KEY = 'papers_petals_flower_orders_v2';
const ORDERS_SEEDED_KEY = 'papers_petals_flower_orders_seeded_v2';

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
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return cloneOrders(FLOWER_ORDERS_SEED);
  }
}

function writeOrdersToStorage(orders: FlowerOrder[]) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(orders));
  } catch (error) {
    const isQuotaError =
      error instanceof DOMException &&
      (error.name === 'QuotaExceededError' || error.code === 22);

    if (isQuotaError) {
      throw new Error(
        'This browser has run out of demo storage space. Delete a few old orders or clear site data for this app, then try again. Production will store photos in cloud storage instead of the browser.',
      );
    }

    throw error;
  }
}

function getPickupDateKeyFromOrder(iso: string): string {
  return getPickupDateKey(iso);
}

async function maybeBatchDeductInventoryForClosedDay(dateKey: string): Promise<void> {
  const orders = readOrdersFromStorage();
  const dayOrders = orders.filter(
    (order) => getPickupDateKey(order.scheduled_for) === dateKey,
  );
  const closeStatus = computeFlowerDayCloseStatus(dayOrders, dateKey);

  if (!closeStatus.is_closed) {
    return;
  }

  const pending = getOrdersPendingInventoryDeduction(dayOrders, dateKey);

  for (const order of pending) {
    await validateFlowerOrderStockLocal(order.branch_id, order.items);

    for (const item of order.items) {
      await deductFlowerInventoryForOrderLocal({
        branchId: order.branch_id,
        productId: item.product_id,
        quantity: item.quantity,
        orderId: order.id,
      });
    }

    const index = orders.findIndex((entry) => entry.id === order.id);
    if (index !== -1) {
      orders[index] = {
        ...orders[index],
        inventory_deducted: true,
      };
    }
  }

  if (pending.length > 0) {
    writeOrdersToStorage(orders);
  }
}

export async function listFlowerOrdersLocal(
  options: ListFlowerOrdersOptions = {},
): Promise<FlowerOrder[]> {
  const orders = readOrdersFromStorage();

  const filtered = orders.filter((order) => {
    if (options.branchId && order.branch_id !== options.branchId) {
      return false;
    }

    if (options.scheduledFrom && getPickupDateKeyFromOrder(order.scheduled_for) < options.scheduledFrom) {
      return false;
    }

    if (options.scheduledTo && getPickupDateKeyFromOrder(order.scheduled_for) > options.scheduledTo) {
      return false;
    }

    return true;
  });

  return filtered.sort(
    (a, b) => new Date(b.scheduled_for).getTime() - new Date(a.scheduled_for).getTime(),
  );
}

export async function getFlowerOrderLocal(orderId: string): Promise<FlowerOrder | null> {
  const orders = readOrdersFromStorage();
  return orders.find((order) => order.id === orderId) ?? null;
}

function buildOrderFromInput(
  input: CreateFlowerOrderInput,
  branchName: string,
  existing?: FlowerOrder,
): FlowerOrder {
  const balance = Math.max(0, input.total_amount - input.downpayment);

  return {
    id: existing?.id ?? buildOrderId().replace('ORD-', 'PP-'),
    branch_id: input.branch_id,
    branch_name: branchName,
    receiver: input.receiver.trim(),
    customer_social: input.customer_social.trim(),
    scheduled_for: input.scheduled_for,
    status: existing?.status ?? 'not_started',
    claim_mode: input.claim_mode,
    wrapper_color: input.wrapper_color.trim(),
    greeting_card: input.greeting_card.trim(),
    special_instructions: input.special_instructions.trim(),
    downpayment: input.downpayment,
    payment_reference: input.payment_reference.trim(),
    total_amount: input.total_amount,
    balance,
    notes: input.notes.trim(),
    photo_inspo_data_url: input.photo_inspo_data_url,
    proof_dp_data_url: input.proof_dp_data_url,
    order_form_ss_data_url: input.order_form_ss_data_url,
    ready_photo_data_url: input.ready_photo_data_url ?? existing?.ready_photo_data_url ?? '',
    created_at: existing?.created_at ?? new Date().toISOString(),
    created_by_id: input.created_by_id,
    created_by_name: input.created_by_name,
    inventory_deducted: existing?.inventory_deducted ?? false,
    items: input.items.map((item) => ({ ...item })),
  };
}

export async function createFlowerOrderLocal(input: CreateFlowerOrderInput): Promise<FlowerOrder> {
  const branches = await listFlowerBranchesLocal();
  const branch = branches.find((entry) => entry.id === input.branch_id);

  if (!branch) {
    throw new Error('Branch not found.');
  }

  await validateFlowerOrderStockLocal(input.branch_id, input.items);

  const created = buildOrderFromInput(input, branch.name);
  const orders = readOrdersFromStorage();
  writeOrdersToStorage([created, ...orders]);

  return created;
}

export async function updateFlowerOrderLocal(input: UpdateFlowerOrderInput): Promise<FlowerOrder> {
  const orders = readOrdersFromStorage();
  const index = orders.findIndex((order) => order.id === input.id);

  if (index === -1) {
    throw new Error('Order not found.');
  }

  const existing = orders[index];
  const branches = await listFlowerBranchesLocal();
  const branch = branches.find((entry) => entry.id === input.branch_id);

  if (!branch) {
    throw new Error('Branch not found.');
  }

  const updated = buildOrderFromInput(input, branch.name, existing);

  const creditByProductId =
    existing.inventory_deducted && existing.branch_id === input.branch_id
      ? buildCreditFromOrderItems(existing.items)
      : {};

  await validateFlowerOrderStockLocal(input.branch_id, updated.items, creditByProductId);

  orders[index] = updated;
  writeOrdersToStorage(orders);

  return updated;
}

function buildCreditFromOrderItems(
  items: Array<{ product_id: string; quantity: number }>,
): Record<string, number> {
  const credit: Record<string, number> = {};

  for (const item of items) {
    credit[item.product_id] = (credit[item.product_id] ?? 0) + item.quantity;
  }

  return credit;
}

export async function updateFlowerOrderReadyPhotoLocal(
  orderId: string,
  readyPhotoDataUrl: string,
): Promise<FlowerOrder> {
  const orders = readOrdersFromStorage();
  const index = orders.findIndex((order) => order.id === orderId);

  if (index === -1) {
    throw new Error('Order not found.');
  }

  if (!readyPhotoDataUrl) {
    throw new Error('Finished order photo is required.');
  }

  const updated: FlowerOrder = {
    ...orders[index],
    ready_photo_data_url: readyPhotoDataUrl,
    items: orders[index].items.map((item) => ({ ...item })),
  };

  orders[index] = updated;
  writeOrdersToStorage(orders);

  return updated;
}

export async function deleteFlowerOrderLocal(orderId: string): Promise<void> {
  const orders = readOrdersFromStorage();
  const index = orders.findIndex((order) => order.id === orderId);

  if (index === -1) {
    throw new Error('Order not found.');
  }

  orders.splice(index, 1);
  writeOrdersToStorage(orders);
}

export async function updateFlowerOrderStatusLocal(
  orderId: string,
  status: FlowerOrderStatus,
): Promise<FlowerOrder> {
  const orders = readOrdersFromStorage();
  const index = orders.findIndex((order) => order.id === orderId);

  if (index === -1) {
    throw new Error('Order not found.');
  }

  const current = orders[index];

  const order: FlowerOrder = {
    ...current,
    status,
    items: current.items.map((item) => ({ ...item })),
  };

  orders[index] = order;
  writeOrdersToStorage(orders);

  await maybeBatchDeductInventoryForClosedDay(getPickupDateKeyFromOrder(current.scheduled_for));

  const refreshed = readOrdersFromStorage().find((entry) => entry.id === orderId);
  return refreshed ?? order;
}

export async function getFlowerDayCloseStatusLocal(
  dateKey: string,
  branchId?: string,
): Promise<{
  date: string;
  total_orders: number;
  open_orders: number;
  is_closed: boolean;
}> {
  const orders = readOrdersFromStorage();
  return computeFlowerDayCloseStatus(orders, dateKey, branchId);
}
