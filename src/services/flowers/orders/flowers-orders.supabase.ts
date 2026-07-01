import { getSupabaseClient } from '../../../lib/supabase/client';
import { ensureSupabaseSession } from '../../../lib/auth/flower-auth.service';
import type {
  CreateFlowerOrderInput,
  FlowerOrder,
  FlowerOrderStatus,
  ListFlowerOrdersOptions,
  UpdateFlowerOrderInput,
} from '../../../modules/flowers/shared/types/flower-order';
import { getLocalDayBoundsIso } from '../../../modules/flowers/shared/utils/flower-format';
import { normalizeFlowerPaymentMode } from '../../../modules/flowers/shared/utils/flower-payment';
import type { FlowerPaymentMode } from '../../../modules/flowers/shared/types/flower-order';
import {
  deductFlowerInventoryForOrderSupabase,
  listFlowerBranchesSupabase,
  validateFlowerOrderStockSupabase,
} from '../inventory/flowers-inventory.supabase';
import { resolveOrderAttachmentUrl, resolveOrderAttachments } from './flowers-order-attachments';
import {
  computeFlowerDayCloseStatus,
  getOrdersPendingInventoryDeduction,
  getPickupDateKey,
} from './flowers-order-day-close';

type OrderItemDbRow = {
  id: number;
  product_id: string;
  item_name: string;
  quantity: number;
};

type OrderDbRow = {
  id: string;
  branch_id: string;
  receiver: string;
  customer_social: string;
  scheduled_for: string;
  status: FlowerOrderStatus;
  claim_mode: 'pickup' | 'delivery';
  wrapper_color: string;
  greeting_card: string;
  special_instructions: string;
  downpayment: number;
  payment_mode?: string;
  payment_reference: string;
  total_amount: number;
  balance: number;
  balance_paid?: boolean;
  balance_payment_mode?: string;
  notes: string;
  photo_inspo_data_url: string;
  proof_dp_data_url: string;
  order_form_ss_data_url: string;
  ready_photo_data_url: string;
  created_by_id: string;
  created_by_name: string;
  inventory_deducted: boolean;
  created_at: string;
  flower_branches?: { name: string } | { name: string }[] | null;
  flower_order_items?: OrderItemDbRow[] | null;
};

const ORDER_SELECT = `
  id,
  branch_id,
  receiver,
  customer_social,
  scheduled_for,
  status,
  claim_mode,
  wrapper_color,
  greeting_card,
  special_instructions,
  downpayment,
  payment_mode,
  payment_reference,
  total_amount,
  balance,
  balance_paid,
  balance_payment_mode,
  notes,
  photo_inspo_data_url,
  proof_dp_data_url,
  order_form_ss_data_url,
  ready_photo_data_url,
  created_by_id,
  created_by_name,
  inventory_deducted,
  created_at,
  flower_branches ( name ),
  flower_order_items ( id, product_id, item_name, quantity )
`;

function requireSupabaseClient() {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  return supabase;
}

async function requireAuthenticatedSupabaseClient() {
  await ensureSupabaseSession();
  return requireSupabaseClient();
}

function buildOrderId(): string {
  return `PP-${Date.now()}-${Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, '0')}`;
}

function getBranchNameFromRow(row: OrderDbRow): string {
  const branch = row.flower_branches;
  if (Array.isArray(branch)) {
    return branch[0]?.name ?? row.branch_id;
  }

  return branch?.name ?? row.branch_id;
}

function mapOrderRow(row: OrderDbRow): FlowerOrder {
  return {
    id: row.id,
    branch_id: row.branch_id,
    branch_name: getBranchNameFromRow(row),
    receiver: row.receiver,
    customer_social: row.customer_social,
    scheduled_for: row.scheduled_for,
    status: row.status,
    claim_mode: row.claim_mode,
    wrapper_color: row.wrapper_color ?? '',
    greeting_card: row.greeting_card ?? '',
    special_instructions: row.special_instructions ?? '',
    downpayment: Number(row.downpayment),
    payment_mode: normalizeFlowerPaymentMode(row.payment_mode),
    payment_reference: row.payment_reference ?? '',
    total_amount: Number(row.total_amount),
    balance: Number(row.balance),
    balance_paid: Boolean(row.balance_paid),
    balance_payment_mode: row.balance_payment_mode
      ? normalizeFlowerPaymentMode(row.balance_payment_mode)
      : '',
    notes: row.notes ?? '',
    photo_inspo_data_url: row.photo_inspo_data_url ?? '',
    proof_dp_data_url: row.proof_dp_data_url ?? '',
    order_form_ss_data_url: row.order_form_ss_data_url ?? '',
    ready_photo_data_url: row.ready_photo_data_url ?? '',
    created_at: row.created_at,
    created_by_id: row.created_by_id,
    created_by_name: row.created_by_name,
    inventory_deducted: Boolean(row.inventory_deducted),
    items: (row.flower_order_items ?? []).map((item) => ({
      id: item.id,
      product_id: item.product_id,
      item_name: item.item_name,
      quantity: Number(item.quantity),
    })),
  };
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

async function fetchOrderById(orderId: string): Promise<FlowerOrder | null> {
  const supabase = await requireAuthenticatedSupabaseClient();

  const { data, error } = await supabase
    .from('flower_orders')
    .select(ORDER_SELECT)
    .eq('id', orderId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  return mapOrderRow(data as OrderDbRow);
}

async function listOrdersForPickupDate(dateKey: string): Promise<FlowerOrder[]> {
  return listFlowerOrdersSupabase({
    scheduledFrom: dateKey,
    scheduledTo: dateKey,
  });
}

async function deductInventoryForOrder(order: FlowerOrder): Promise<void> {
  await validateFlowerOrderStockSupabase(order.branch_id, order.items);

  for (const item of order.items) {
    await deductFlowerInventoryForOrderSupabase({
      branchId: order.branch_id,
      productId: item.product_id,
      quantity: item.quantity,
      orderId: order.id,
    });
  }
}

async function maybeBatchDeductInventoryForClosedDay(dateKey: string): Promise<void> {
  const dayOrders = await listOrdersForPickupDate(dateKey);
  const closeStatus = computeFlowerDayCloseStatus(dayOrders, dateKey);

  if (!closeStatus.is_closed) {
    return;
  }

  const pending = getOrdersPendingInventoryDeduction(dayOrders, dateKey);
  if (pending.length === 0) {
    return;
  }

  const supabase = await requireAuthenticatedSupabaseClient();

  for (const order of pending) {
    await deductInventoryForOrder(order);

    const { error } = await supabase
      .from('flower_orders')
      .update({ inventory_deducted: true })
      .eq('id', order.id);

    if (error) {
      throw error;
    }
  }
}

export async function listFlowerOrdersSupabase(
  options: ListFlowerOrdersOptions = {},
): Promise<FlowerOrder[]> {
  const supabase = await requireAuthenticatedSupabaseClient();

  let query = supabase.from('flower_orders').select(ORDER_SELECT);

  if (options.branchId) {
    query = query.eq('branch_id', options.branchId);
  }

  if (options.scheduledFrom) {
    const { startIso } = getLocalDayBoundsIso(options.scheduledFrom);
    query = query.gte('scheduled_for', startIso);
  }

  if (options.scheduledTo) {
    const { endIso } = getLocalDayBoundsIso(options.scheduledTo);
    query = query.lte('scheduled_for', endIso);
  }

  const { data, error } = await query.order('scheduled_for', { ascending: false });

  if (error) {
    throw error;
  }

  return ((data as OrderDbRow[] | null) ?? []).map(mapOrderRow);
}

export async function getFlowerOrderSupabase(orderId: string): Promise<FlowerOrder | null> {
  return fetchOrderById(orderId);
}

export async function createFlowerOrderSupabase(
  input: CreateFlowerOrderInput,
): Promise<FlowerOrder> {
  const supabase = await requireAuthenticatedSupabaseClient();
  const branches = await listFlowerBranchesSupabase();
  const branch = branches.find((entry) => entry.id === input.branch_id);

  if (!branch) {
    throw new Error('Branch not found.');
  }

  await validateFlowerOrderStockSupabase(input.branch_id, input.items);

  const orderId = buildOrderId();
  const attachments = await resolveOrderAttachments({
    orderId,
    photo_inspo_data_url: input.photo_inspo_data_url,
    proof_dp_data_url: input.proof_dp_data_url,
    order_form_ss_data_url: input.order_form_ss_data_url,
    ready_photo_data_url: input.ready_photo_data_url,
  });

  const balance = Math.max(0, input.total_amount - input.downpayment);
  const nowIso = new Date().toISOString();

  const orderRow = {
    id: orderId,
    branch_id: input.branch_id,
    receiver: input.receiver.trim(),
    customer_social: input.customer_social.trim(),
    scheduled_for: input.scheduled_for,
    status: 'not_started' as FlowerOrderStatus,
    claim_mode: input.claim_mode,
    wrapper_color: input.wrapper_color.trim(),
    greeting_card: input.greeting_card.trim(),
    special_instructions: input.special_instructions.trim(),
    downpayment: input.downpayment,
    payment_mode: normalizeFlowerPaymentMode(input.payment_mode),
    payment_reference: input.payment_reference.trim(),
    total_amount: input.total_amount,
    balance,
    balance_paid: balance === 0,
    balance_payment_mode: '',
    notes: input.notes.trim(),
    photo_inspo_data_url: attachments.photo_inspo_data_url,
    proof_dp_data_url: attachments.proof_dp_data_url,
    order_form_ss_data_url: attachments.order_form_ss_data_url,
    ready_photo_data_url: attachments.ready_photo_data_url,
    created_by_id: input.created_by_id,
    created_by_name: input.created_by_name,
    inventory_deducted: false,
    created_at: nowIso,
  };

  const { error: orderError } = await supabase.from('flower_orders').insert(orderRow);

  if (orderError) {
    throw orderError;
  }

  const itemRows = input.items.map((item) => ({
    order_id: orderId,
    product_id: item.product_id,
    item_name: item.item_name,
    quantity: item.quantity,
  }));

  const { error: itemsError } = await supabase.from('flower_order_items').insert(itemRows);

  if (itemsError) {
    await supabase.from('flower_orders').delete().eq('id', orderId);
    throw itemsError;
  }

  const created = await fetchOrderById(orderId);
  if (!created) {
    throw new Error('Order was created but could not be loaded.');
  }

  return created;
}

export async function updateFlowerOrderSupabase(
  input: UpdateFlowerOrderInput,
): Promise<FlowerOrder> {
  const supabase = await requireAuthenticatedSupabaseClient();
  const existing = await fetchOrderById(input.id);

  if (!existing) {
    throw new Error('Order not found.');
  }

  const branches = await listFlowerBranchesSupabase();
  const branch = branches.find((entry) => entry.id === input.branch_id);

  if (!branch) {
    throw new Error('Branch not found.');
  }

  const attachments = await resolveOrderAttachments({
    orderId: input.id,
    photo_inspo_data_url: input.photo_inspo_data_url,
    proof_dp_data_url: input.proof_dp_data_url,
    order_form_ss_data_url: input.order_form_ss_data_url,
    ready_photo_data_url: input.ready_photo_data_url || existing.ready_photo_data_url,
  });

  const nextBalance = existing.balance_paid
    ? 0
    : Math.max(0, input.total_amount - input.downpayment);
  const nextDownpayment = existing.balance_paid ? input.total_amount : input.downpayment;
  const creditByProductId =
    existing.inventory_deducted && existing.branch_id === input.branch_id
      ? buildCreditFromOrderItems(existing.items)
      : {};

  await validateFlowerOrderStockSupabase(input.branch_id, input.items, creditByProductId);

  const { error: orderError } = await supabase
    .from('flower_orders')
    .update({
      branch_id: input.branch_id,
      receiver: input.receiver.trim(),
      customer_social: input.customer_social.trim(),
      scheduled_for: input.scheduled_for,
      claim_mode: input.claim_mode,
      wrapper_color: input.wrapper_color.trim(),
      greeting_card: input.greeting_card.trim(),
      special_instructions: input.special_instructions.trim(),
      downpayment: nextDownpayment,
      payment_mode: normalizeFlowerPaymentMode(input.payment_mode),
      payment_reference: input.payment_reference.trim(),
      total_amount: input.total_amount,
      balance: nextBalance,
      balance_paid: existing.balance_paid || nextBalance === 0,
      balance_payment_mode: existing.balance_payment_mode,
      notes: input.notes.trim(),
      photo_inspo_data_url: attachments.photo_inspo_data_url,
      proof_dp_data_url: attachments.proof_dp_data_url,
      order_form_ss_data_url: attachments.order_form_ss_data_url,
      ready_photo_data_url: attachments.ready_photo_data_url || existing.ready_photo_data_url,
      created_by_id: input.created_by_id,
      created_by_name: input.created_by_name,
    })
    .eq('id', input.id);

  if (orderError) {
    throw orderError;
  }

  const { error: deleteItemsError } = await supabase
    .from('flower_order_items')
    .delete()
    .eq('order_id', input.id);

  if (deleteItemsError) {
    throw deleteItemsError;
  }

  const itemRows = input.items.map((item) => ({
    order_id: input.id,
    product_id: item.product_id,
    item_name: item.item_name,
    quantity: item.quantity,
  }));

  const { error: itemsError } = await supabase.from('flower_order_items').insert(itemRows);

  if (itemsError) {
    throw itemsError;
  }

  const updated = await fetchOrderById(input.id);
  if (!updated) {
    throw new Error('Order was updated but could not be loaded.');
  }

  return updated;
}

export async function updateFlowerOrderReadyPhotoSupabase(
  orderId: string,
  readyPhotoDataUrl: string,
): Promise<FlowerOrder> {
  const supabase = await requireAuthenticatedSupabaseClient();
  const existing = await fetchOrderById(orderId);

  if (!existing) {
    throw new Error('Order not found.');
  }

  if (!readyPhotoDataUrl) {
    throw new Error('Finished order photo is required.');
  }

  const ready_photo_data_url = await resolveOrderAttachmentUrl(
    readyPhotoDataUrl,
    orderId,
    'ready-photo',
  );

  const { error } = await supabase
    .from('flower_orders')
    .update({ ready_photo_data_url })
    .eq('id', orderId);

  if (error) {
    throw error;
  }

  const updated = await fetchOrderById(orderId);
  if (!updated) {
    throw new Error('Order photo was saved but could not be loaded.');
  }

  return updated;
}

export async function deleteFlowerOrderSupabase(orderId: string): Promise<void> {
  const supabase = await requireAuthenticatedSupabaseClient();
  const existing = await fetchOrderById(orderId);

  if (!existing) {
    throw new Error('Order not found.');
  }

  const { error } = await supabase.from('flower_orders').delete().eq('id', orderId);

  if (error) {
    throw error;
  }
}

export async function updateFlowerOrderStatusSupabase(
  orderId: string,
  status: FlowerOrderStatus,
): Promise<FlowerOrder> {
  const supabase = await requireAuthenticatedSupabaseClient();
  const existing = await fetchOrderById(orderId);

  if (!existing) {
    throw new Error('Order not found.');
  }

  if (
    (status === 'picked_up' || status === 'delivered') &&
    existing.balance > 0 &&
    !existing.balance_paid
  ) {
    throw new Error('Mark the remaining balance as paid before completing this order.');
  }

  const { error } = await supabase.from('flower_orders').update({ status }).eq('id', orderId);

  if (error) {
    throw error;
  }

  const pickupDateKey = getPickupDateKey(existing.scheduled_for);
  await maybeBatchDeductInventoryForClosedDay(pickupDateKey);

  const updated = await fetchOrderById(orderId);
  if (!updated) {
    throw new Error('Order status was updated but could not be loaded.');
  }

  return updated;
}

export async function markFlowerOrderBalancePaidSupabase(
  orderId: string,
  balancePaymentMode: FlowerPaymentMode,
): Promise<FlowerOrder> {
  const supabase = await requireAuthenticatedSupabaseClient();
  const existing = await fetchOrderById(orderId);

  if (!existing) {
    throw new Error('Order not found.');
  }

  if (existing.balance <= 0 || existing.balance_paid) {
    throw new Error('This order has no remaining balance to collect.');
  }

  const { error } = await supabase
    .from('flower_orders')
    .update({
      downpayment: existing.total_amount,
      balance: 0,
      balance_paid: true,
      balance_payment_mode: balancePaymentMode,
    })
    .eq('id', orderId);

  if (error) {
    throw error;
  }

  const updated = await fetchOrderById(orderId);
  if (!updated) {
    throw new Error('Balance was updated but the order could not be loaded.');
  }

  return updated;
}

export async function getFlowerDayCloseStatusSupabase(
  dateKey: string,
  branchId?: string,
): Promise<{
  date: string;
  total_orders: number;
  open_orders: number;
  is_closed: boolean;
}> {
  const orders = await listOrdersForPickupDate(dateKey);
  return computeFlowerDayCloseStatus(orders, dateKey, branchId);
}
