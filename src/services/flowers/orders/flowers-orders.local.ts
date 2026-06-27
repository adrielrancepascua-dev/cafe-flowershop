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
import { FLOWER_ORDER_TERMINAL_STATUSES } from '../../../modules/flowers/shared/types/flower-order';
import { buildOrderId } from '../../orders/order-id';
import {
  deductFlowerInventoryForOrderLocal,
  listFlowerBranchesLocal,
} from '../inventory/flowers-inventory.local';

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

  window.localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(orders));
}

function getPickupDateKey(iso: string): string {
  return iso.slice(0, 10);
}

export async function listFlowerOrdersLocal(
  options: ListFlowerOrdersOptions = {},
): Promise<FlowerOrder[]> {
  const orders = readOrdersFromStorage();

  const filtered = orders.filter((order) => {
    if (options.branchId && order.branch_id !== options.branchId) {
      return false;
    }

    if (options.scheduledFrom && getPickupDateKey(order.scheduled_for) < options.scheduledFrom) {
      return false;
    }

    if (options.scheduledTo && getPickupDateKey(order.scheduled_for) > options.scheduledTo) {
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
  orders[index] = updated;
  writeOrdersToStorage(orders);

  return updated;
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

  const order = orders[index];
  order.status = status;

  if (status === 'completed' && !order.inventory_deducted) {
    for (const item of order.items) {
      await deductFlowerInventoryForOrderLocal({
        branchId: order.branch_id,
        productId: item.product_id,
        quantity: item.quantity,
        orderId: order.id,
      });
    }

    order.inventory_deducted = true;
  }

  orders[index] = order;
  writeOrdersToStorage(orders);

  return order;
}

export async function getFlowerDayCloseStatusLocal(dateKey: string): Promise<{
  date: string;
  total_orders: number;
  open_orders: number;
  is_closed: boolean;
}> {
  const orders = readOrdersFromStorage().filter(
    (order) => getPickupDateKey(order.scheduled_for) === dateKey && order.status !== 'cancelled',
  );

  const openOrders = orders.filter(
    (order) => !FLOWER_ORDER_TERMINAL_STATUSES.includes(order.status),
  );

  return {
    date: dateKey,
    total_orders: orders.length,
    open_orders: openOrders.length,
    is_closed: orders.length > 0 && openOrders.length === 0,
  };
}
