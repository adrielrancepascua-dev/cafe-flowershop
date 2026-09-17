import { currentFlowerUserIsAdmin } from '../../../lib/auth/flower-auth.service';
import { requireSupabaseAuthSession } from '../../../lib/auth/flower-auth.service';
import { getSupabaseClient } from '../../../lib/supabase/client';
import { toServiceError } from '../../../lib/supabase/errors';
import type {
  CreateFlowerOrderInput,
  FlowerClaimMode,
  FlowerOrder,
  FlowerOrderStatus,
  ListFlowerOrdersOptions,
  UpdateFlowerOrderInput,
} from '../../../modules/flowers/shared/types/flower-order';
import { FLOWER_ORDER_TERMINAL_STATUSES, getInitialFlowerOrderStatus } from '../../../modules/flowers/shared/types/flower-order';
import { getLocalDayBoundsIso, formatInventoryHistoricalReconcileUndoNote, formatInventoryOrderEditDeductNote, formatInventoryOrderEditRestoreNote, formatInventoryOverDeductRestoreNote } from '../../../modules/flowers/shared/utils/flower-format';
import { normalizeFlowerPaymentMode } from '../../../modules/flowers/shared/utils/flower-payment';
import type { FlowerPaymentMode } from '../../../modules/flowers/shared/types/flower-order';
import {
  deductFlowerInventoryForOrderSupabase,
  listFlowerBranchesSupabase,
  listFlowerInventoryMovementsCreatedAfterSupabase,
  listFlowerInventoryMovementsSupabase,
  restoreFlowerInventoryForOrderSupabase,
  validateFlowerOrderStockSupabase,
} from '../inventory/flowers-inventory.supabase';
import {
  extraOrderDeductionByProduct,
  hasCompleteOrderDeduction,
  HISTORICAL_RECONCILE_BUG_STARTED_AT,
  INVENTORY_AUTO_DEDUCT_PAUSED,
  netOrderDeductedByProduct,
  planOrderInventoryDeduction,
  quantitiesToForceRestoreByProduct,
} from '../../../modules/flowers/shared/utils/flower-inventory-deduct';
import { resolveOrderAttachmentUrl, resolveOrderAttachments } from './flowers-order-attachments';
import {
  computeFlowerDayCloseStatus,
  getInventoryDeductionBuckets,
  getOrdersPendingInventoryDeduction,
  getPickupDateKey,
  isInventoryDeductionDue,
  shouldSkipOpenOrderInventoryRestore,
} from './flowers-order-day-close';
import { assertOrderContentEditable } from '../../../modules/flowers/shared/utils/flower-order-edit-policy';
import { assertRequiredDownpayment, computeOrderPaymentFields } from '../../../modules/flowers/shared/utils/flower-order-payment-fields';
import {
  isMissingProductKindColumnError,
  markProductKindColumnMissing,
  markProductKindColumnSupported,
} from '../products/flowers-products-supabase.shared';
import { validateOrderInspoPhotoForProductRows } from './flowers-order-validation';

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
  claim_mode: FlowerClaimMode;
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
  balance_payment_reference?: string;
  notes: string;
  photo_inspo_data_url: string;
  proof_dp_data_url: string;
  proof_balance_data_url: string;
  order_form_ss_data_url: string;
  ready_photo_data_url: string;
  created_by_id: string;
  created_by_name: string;
  inventory_deducted: boolean;
  created_at: string;
  content_edited_at?: string | null;
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
  balance_payment_reference,
  notes,
  photo_inspo_data_url,
  proof_dp_data_url,
  proof_balance_data_url,
  order_form_ss_data_url,
  ready_photo_data_url,
  created_by_id,
  created_by_name,
  inventory_deducted,
  created_at,
  content_edited_at,
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
  await requireSupabaseAuthSession();
  return requireSupabaseClient();
}

async function validateOrderInspoPhotoSupabase(
  supabase: ReturnType<typeof requireSupabaseClient>,
  items: Array<{ product_id: string }>,
  photoInspoDataUrl: string,
  claimMode: FlowerClaimMode,
): Promise<void> {
  const productIds = [...new Set(items.map((item) => item.product_id))];
  if (productIds.length === 0) {
    return;
  }

  const withKind = await supabase
    .from('flower_products')
    .select('id, product_kind')
    .in('id', productIds);

  let productRows: Array<{ id: string; product_kind: string }>;

  if (withKind.error && isMissingProductKindColumnError(withKind.error)) {
    markProductKindColumnMissing();
    const legacy = await supabase.from('flower_products').select('id').in('id', productIds);
    if (legacy.error) {
      throw toServiceError(legacy.error, 'Could not validate order items.');
    }
    productRows = ((legacy.data as Array<{ id: string }> | null) ?? []).map((row) => ({
      id: row.id,
      product_kind: 'flower',
    }));
  } else if (withKind.error) {
    throw toServiceError(withKind.error, 'Could not validate order items.');
  } else {
    markProductKindColumnSupported();
    productRows = (withKind.data as Array<{ id: string; product_kind: string }> | null) ?? [];
  }

  validateOrderInspoPhotoForProductRows(items, photoInspoDataUrl, productRows, claimMode);
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
    payment_mode: normalizeFlowerPaymentMode(
      row.payment_mode,
      row.branch_id,
      getBranchNameFromRow(row),
    ),
    payment_reference: row.payment_reference ?? '',
    total_amount: Number(row.total_amount),
    balance: Number(row.balance),
    balance_paid: Boolean(row.balance_paid),
    balance_payment_mode: row.balance_payment_mode
      ? normalizeFlowerPaymentMode(
          row.balance_payment_mode,
          row.branch_id,
          getBranchNameFromRow(row),
        )
      : '',
    balance_payment_reference: row.balance_payment_reference ?? '',
    notes: row.notes ?? '',
    photo_inspo_data_url: row.photo_inspo_data_url ?? '',
    proof_dp_data_url: row.proof_dp_data_url ?? '',
    proof_balance_data_url: row.proof_balance_data_url ?? '',
    order_form_ss_data_url: row.order_form_ss_data_url ?? '',
    ready_photo_data_url: row.ready_photo_data_url ?? '',
    created_at: row.created_at,
    created_by_id: row.created_by_id,
    created_by_name: row.created_by_name,
    inventory_deducted: Boolean(row.inventory_deducted),
    content_edited_at: row.content_edited_at ?? null,
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

/** When an order was already day-close deducted, editing items must restore/deduct the net delta. */
async function reconcileInventoryAfterOrderContentEditSupabase(input: {
  existing: FlowerOrder;
  nextBranchId: string;
  nextReceiver: string;
  nextItems: Array<{ product_id: string; quantity: number }>;
}): Promise<void> {
  const { existing, nextBranchId, nextReceiver, nextItems } = input;
  if (!existing.inventory_deducted) {
    return;
  }

  const orderId = existing.id;
  const editRestoreNote = formatInventoryOrderEditRestoreNote(orderId, nextReceiver);
  const editDeductNote = formatInventoryOrderEditDeductNote(orderId, nextReceiver);
  const movements = await listFlowerInventoryMovementsSupabase({
    branchId: existing.branch_id,
    orderId,
    limit: 5000,
  });
  const previousQtyMap = netOrderDeductedByProduct(movements, orderId);
  const previousQty = Object.fromEntries(previousQtyMap);

  if (existing.branch_id !== nextBranchId) {
    for (const [productId, quantity] of previousQtyMap) {
      await restoreFlowerInventoryForOrderSupabase({
        branchId: existing.branch_id,
        productId,
        quantity,
        orderId,
        receiver: existing.receiver,
        note: editRestoreNote,
      });
    }

    for (const item of nextItems) {
      if (item.quantity <= 0) {
        continue;
      }
      await deductFlowerInventoryForOrderSupabase({
        branchId: nextBranchId,
        productId: item.product_id,
        quantity: item.quantity,
        orderId,
        receiver: nextReceiver,
        note: editDeductNote,
      });
    }

    return;
  }

  const nextQty = buildCreditFromOrderItems(nextItems);
  const productIds = new Set([...Object.keys(previousQty), ...Object.keys(nextQty)]);

  for (const productId of productIds) {
    const delta = (nextQty[productId] ?? 0) - (previousQty[productId] ?? 0);
    if (delta > 0) {
      await deductFlowerInventoryForOrderSupabase({
        branchId: nextBranchId,
        productId,
        quantity: delta,
        orderId,
        receiver: nextReceiver,
        note: editDeductNote,
      });
    } else if (delta < 0) {
      await restoreFlowerInventoryForOrderSupabase({
        branchId: nextBranchId,
        productId,
        quantity: Math.abs(delta),
        orderId,
        receiver: nextReceiver,
        note: editRestoreNote,
      });
    }
  }
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

async function listMovementsForOrderDeduct(order: FlowerOrder) {
  // CRITICAL: look up by order id in the note, NOT by pickup-date created_at window.
  // Early/force deduct writes movements "today". If pickup was yesterday (or any
  // other day), a same-day window misses them → completeness fails → claim is
  // released → 60s poll re-deducts the full order forever.
  return listFlowerInventoryMovementsSupabase({
    branchId: order.branch_id,
    orderId: order.id,
    limit: 5000,
  });
}

async function deductInventoryForOrder(order: FlowerOrder): Promise<{ wrote: boolean }> {
  await validateFlowerOrderStockSupabase(order.branch_id, order.items);

  const movements = await listMovementsForOrderDeduct(order);

  const planned = planOrderInventoryDeduction({
    orderId: order.id,
    branchId: order.branch_id,
    items: order.items,
    movements,
  });

  // Already fully covered by prior order_deduct rows — keep the claim, do nothing.
  if (planned.length === 0) {
    return { wrote: false };
  }

  for (const item of planned) {
    await deductFlowerInventoryForOrderSupabase({
      branchId: order.branch_id,
      productId: item.product_id,
      quantity: item.quantity,
      orderId: order.id,
      receiver: order.receiver,
    });
  }

  const latestMovements = await listMovementsForOrderDeduct(order);

  if (
    !hasCompleteOrderDeduction({
      orderId: order.id,
      items: order.items,
      movements: latestMovements,
    })
  ) {
    throw new Error(`Inventory deduction incomplete for order ${order.id}.`);
  }

  return { wrote: true };
}

async function restoreInventoryIfDeductedSupabase(order: FlowerOrder): Promise<void> {
  if (!order.inventory_deducted) {
    return;
  }

  const movements = await listMovementsForOrderDeduct(order);
  const netDeducted = netOrderDeductedByProduct(movements, order.id);

  for (const [productId, quantity] of netDeducted) {
    await restoreFlowerInventoryForOrderSupabase({
      branchId: order.branch_id,
      productId,
      quantity,
      orderId: order.id,
      receiver: order.receiver,
    });
  }
}

/**
 * PR #25 wrongly deducted Not started / Ready drafts at 7 PM / force deduct.
 * Put remaining order_deduct stems back for every open order (even if the
 * inventory_deducted flag was already cleared without a stock restore).
 *
 * Re-reads each order before restoring: if it became finished while this loop
 * ran, skip so we do not void a legitimate just-written order_deduct.
 */
export async function restoreWronglyDeductedOpenOrdersSupabase(): Promise<{
  restoredOrders: number;
  restoredUnits: number;
}> {
  const supabase = await requireAuthenticatedSupabaseClient();
  const { data, error } = await supabase
    .from('flower_orders')
    .select(ORDER_SELECT)
    .in('status', ['not_started', 'ready']);

  if (error) {
    throw toServiceError(error, 'Failed to load open orders for inventory restore.');
  }

  const orders = ((data as OrderDbRow[] | null) ?? []).map(mapOrderRow);
  let restoredOrders = 0;
  let restoredUnits = 0;

  for (const order of orders) {
    const live = await fetchOrderById(order.id);
    if (!live || shouldSkipOpenOrderInventoryRestore(live.status)) {
      continue;
    }

    const movements = await listMovementsForOrderDeduct(live);
    const netDeducted = netOrderDeductedByProduct(movements, live.id);
    const units = [...netDeducted.values()].reduce((sum, quantity) => sum + quantity, 0);

    if (units <= 0 && !live.inventory_deducted) {
      continue;
    }

    // Re-check after the (slow) movement lookup — status may have flipped mid-flight.
    const stillOpen = await fetchOrderById(live.id);
    if (!stillOpen || shouldSkipOpenOrderInventoryRestore(stillOpen.status)) {
      continue;
    }

    for (const [productId, quantity] of netDeducted) {
      await restoreFlowerInventoryForOrderSupabase({
        branchId: stillOpen.branch_id,
        productId,
        quantity,
        orderId: stillOpen.id,
        receiver: stillOpen.receiver,
      });
    }

    if (stillOpen.inventory_deducted) {
      const { error: clearError } = await supabase
        .from('flower_orders')
        .update({ inventory_deducted: false })
        .eq('id', stillOpen.id)
        .eq('inventory_deducted', true)
        .in('status', ['not_started', 'ready']);

      if (clearError) {
        console.warn('Failed to clear inventory_deducted after open-order restore.', {
          orderId: stillOpen.id,
          clearError,
        });
        continue;
      }
    }

    if (units > 0) {
      restoredOrders += 1;
      restoredUnits += units;
    }
  }

  return { restoredOrders, restoredUnits };
}

/**
 * Finished orders deducted 2×/3×: put back only the surplus stems.
 * Leaves the legitimate first deduct in place and keeps inventory_deducted true.
 *
 * Do NOT call from the 60s poll / force button for all-time history — old loop
 * leftovers can be thousands of phantom stems and inflate on_hand. Scoped repair only.
 */
export async function restoreOverDeductedOrderInventorySupabase(): Promise<{
  restoredOrders: number;
  restoredUnits: number;
}> {
  const supabase = await requireAuthenticatedSupabaseClient();
  const { data, error } = await supabase
    .from('flower_orders')
    .select(ORDER_SELECT)
    .in('status', FLOWER_ORDER_TERMINAL_STATUSES);

  if (error) {
    throw toServiceError(error, 'Failed to load finished orders for over-deduct restore.');
  }

  const orders = ((data as OrderDbRow[] | null) ?? []).map(mapOrderRow);
  let restoredOrders = 0;
  let restoredUnits = 0;

  for (const order of orders) {
    const movements = await listMovementsForOrderDeduct(order);
    const extras = extraOrderDeductionByProduct({
      orderId: order.id,
      items: order.items,
      movements,
    });
    const units = [...extras.values()].reduce((sum, quantity) => sum + quantity, 0);
    if (units <= 0) {
      continue;
    }

    const note = formatInventoryOverDeductRestoreNote(order.id, order.receiver);
    for (const [productId, quantity] of extras) {
      await restoreFlowerInventoryForOrderSupabase({
        branchId: order.branch_id,
        productId,
        quantity,
        orderId: order.id,
        receiver: order.receiver,
        note,
      });
    }

    restoredOrders += 1;
    restoredUnits += units;
  }

  return { restoredOrders, restoredUnits };
}

/** Claim + deduct one finished order immediately (does not wait for 7 PM). */
async function claimAndDeductOrderSupabase(order: FlowerOrder): Promise<boolean> {
  if (INVENTORY_AUTO_DEDUCT_PAUSED) {
    return false;
  }

  if (
    order.status === 'cancelled' ||
    order.inventory_deducted ||
    !FLOWER_ORDER_TERMINAL_STATUSES.includes(order.status)
  ) {
    return false;
  }

  const supabase = await requireAuthenticatedSupabaseClient();

  // Heal stale false flags: movements already cover the order — set claim, do not re-deduct.
  try {
    const existingMovements = await listMovementsForOrderDeduct(order);
    if (
      hasCompleteOrderDeduction({
        orderId: order.id,
        items: order.items,
        movements: existingMovements,
      }) &&
      netOrderDeductedByProduct(existingMovements, order.id).size > 0
    ) {
      await supabase.from('flower_orders').update({ inventory_deducted: true }).eq('id', order.id);
      return false;
    }
  } catch (healError) {
    console.warn('Pre-claim deduct completeness check failed.', { orderId: order.id, healError });
  }

  const { data: claimed, error: claimError } = await supabase
    .from('flower_orders')
    .update({ inventory_deducted: true })
    .eq('id', order.id)
    .eq('inventory_deducted', false)
    .select('id')
    .maybeSingle();

  if (claimError) {
    console.warn('Inventory deduct claim failed.', { orderId: order.id, claimError });
    return false;
  }

  if (!claimed) {
    return false;
  }

  let wrote = false;
  try {
    const result = await deductInventoryForOrder(order);
    wrote = result.wrote;
    return true;
  } catch (error) {
    // Never release after a successful write, or when any order_deduct already exists.
    // Releasing here is what lets the 60s poll / force button deduct the full order again.
    if (!wrote) {
      try {
        const movements = await listMovementsForOrderDeduct(order);
        const alreadyDeducted = netOrderDeductedByProduct(movements, order.id);
        if (alreadyDeducted.size === 0) {
          await supabase
            .from('flower_orders')
            .update({ inventory_deducted: false })
            .eq('id', order.id);
        }
      } catch (releaseError) {
        console.warn('Failed to evaluate deduct claim release.', { orderId: order.id, releaseError });
      }
    }
    console.warn('Inventory deduction failed for order.', { orderId: order.id, error });
    return false;
  }
}

export async function restoreHistoricalReconcileDeductionsSupabase(): Promise<{
  restoredUnits: number;
  productCount: number;
}> {
  const movements = await listFlowerInventoryMovementsCreatedAfterSupabase(
    HISTORICAL_RECONCILE_BUG_STARTED_AT,
  );
  const toRestore = quantitiesToForceRestoreByProduct(movements);

  for (let index = 0; index < toRestore.length; index += 8) {
    const batch = toRestore.slice(index, index + 8);
    await Promise.all(
      batch.map((line) =>
        restoreFlowerInventoryForOrderSupabase({
          branchId: line.branchId,
          productId: line.productId,
          quantity: line.quantity,
          orderId: line.orderId,
          receiver: line.receiver,
          note: formatInventoryHistoricalReconcileUndoNote(line.orderId, line.receiver),
        }),
      ),
    );
  }

  return {
    restoredUnits: toRestore.reduce((sum, line) => sum + line.quantity, 0),
    productCount: toRestore.length,
  };
}

async function maybeBatchDeductInventoryForClosedDay(
  dateKey: string,
  branchId: string,
  options?: { skipTimeGate?: boolean },
): Promise<number> {
  if (INVENTORY_AUTO_DEDUCT_PAUSED) {
    return 0;
  }

  const dayOrders = await listOrdersForPickupDate(dateKey);

  if (!options?.skipTimeGate && !isInventoryDeductionDue(dateKey)) {
    return 0;
  }

  const pending = getOrdersPendingInventoryDeduction(dayOrders, dateKey, branchId);
  if (pending.length === 0) {
    return 0;
  }

  let deducted = 0;

  for (const order of pending) {
    if (await claimAndDeductOrderSupabase(order)) {
      deducted += 1;
    }
  }

  return deducted;
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

  await validateOrderInspoPhotoSupabase(supabase, input.items, input.photo_inspo_data_url, input.claim_mode);
  await validateFlowerOrderStockSupabase(input.branch_id, input.items);
  assertRequiredDownpayment(input.total_amount, input.downpayment);

  const orderId = buildOrderId();
  if (!input.proof_dp_data_url?.trim()) {
    throw new Error('Proof of DP is required.');
  }
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
    status: getInitialFlowerOrderStatus(
      input.claim_mode,
      input.total_amount,
      input.downpayment,
      input.scheduled_for,
    ),
    claim_mode: input.claim_mode,
    wrapper_color: input.wrapper_color.trim(),
    greeting_card: input.greeting_card.trim(),
    special_instructions: input.special_instructions.trim(),
    downpayment: input.downpayment,
    payment_mode: normalizeFlowerPaymentMode(
      input.payment_mode,
      input.branch_id,
      branch.name,
    ),
    payment_reference: input.payment_reference.trim(),
    total_amount: input.total_amount,
    balance,
    balance_paid: balance === 0,
    balance_payment_mode: '',
    balance_payment_reference: '',
    notes: input.notes.trim(),
    photo_inspo_data_url: attachments.photo_inspo_data_url,
    proof_dp_data_url: attachments.proof_dp_data_url,
    proof_balance_data_url: '',
    order_form_ss_data_url: attachments.order_form_ss_data_url,
    ready_photo_data_url: attachments.ready_photo_data_url,
    created_by_id: input.created_by_id,
    created_by_name: input.created_by_name,
    inventory_deducted: false,
    created_at: nowIso,
  };

  const { error: orderError } = await supabase.from('flower_orders').insert(orderRow);

  if (orderError) {
    throw toServiceError(orderError, 'Failed to save order.');
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
    throw toServiceError(itemsError, 'Failed to save order items.');
  }

  const created = await fetchOrderById(orderId);
  if (!created) {
    throw new Error('Order was created but could not be loaded.');
  }

  await claimAndDeductOrderSupabase(created);
  return (await fetchOrderById(orderId)) ?? created;
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

  const adminUnlimitedEdits = currentFlowerUserIsAdmin();
  assertOrderContentEditable(existing, Date.now(), { adminUnlimitedEdits });

  await validateOrderInspoPhotoSupabase(supabase, input.items, input.photo_inspo_data_url, input.claim_mode);

  assertRequiredDownpayment(input.total_amount, input.downpayment);
  if (!input.proof_dp_data_url?.trim()) {
    throw new Error('Proof of DP is required.');
  }

  const attachments = await resolveOrderAttachments({
    orderId: input.id,
    photo_inspo_data_url: input.photo_inspo_data_url,
    proof_dp_data_url: input.proof_dp_data_url,
    order_form_ss_data_url: input.order_form_ss_data_url,
    ready_photo_data_url: input.ready_photo_data_url || existing.ready_photo_data_url,
  });

  const payment = computeOrderPaymentFields(input.total_amount, input.downpayment, {
    balance_paid: existing.balance_paid,
    balance_payment_mode: existing.balance_payment_mode,
    balance_payment_reference: existing.balance_payment_reference,
  });
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
      downpayment: payment.downpayment,
      payment_mode: normalizeFlowerPaymentMode(
      input.payment_mode,
      input.branch_id,
      branch.name,
    ),
      payment_reference: input.payment_reference.trim(),
      total_amount: payment.total_amount,
      balance: payment.balance,
      balance_paid: payment.balance_paid,
      balance_payment_mode: payment.balance_payment_mode,
      balance_payment_reference: payment.balance_payment_reference,
      notes: input.notes.trim(),
      photo_inspo_data_url: attachments.photo_inspo_data_url,
      proof_dp_data_url: attachments.proof_dp_data_url,
      proof_balance_data_url: existing.proof_balance_data_url ?? '',
      order_form_ss_data_url: attachments.order_form_ss_data_url,
      ready_photo_data_url: attachments.ready_photo_data_url || existing.ready_photo_data_url,
      created_by_id: input.created_by_id,
      created_by_name: input.created_by_name,
      content_edited_at: adminUnlimitedEdits
        ? existing.content_edited_at
        : existing.content_edited_at ?? new Date().toISOString(),
    })
    .eq('id', input.id);

  if (orderError) {
    throw toServiceError(orderError, 'Failed to save order.');
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

  await reconcileInventoryAfterOrderContentEditSupabase({
    existing,
    nextBranchId: input.branch_id,
    nextReceiver: input.receiver.trim(),
    nextItems: input.items,
  });

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

  if (existing.inventory_deducted) {
    await restoreInventoryIfDeductedSupabase(existing);
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
    FLOWER_ORDER_TERMINAL_STATUSES.includes(status) &&
    existing.balance > 0 &&
    !existing.balance_paid
  ) {
    throw new Error('Mark the remaining balance as paid before completing this order.');
  }

  if (status === 'cancelled' && existing.inventory_deducted) {
    await restoreInventoryIfDeductedSupabase(existing);
    const { error: cancelError } = await supabase
      .from('flower_orders')
      .update({ status: 'cancelled', inventory_deducted: false })
      .eq('id', orderId);

    if (cancelError) {
      throw cancelError;
    }
  } else {
    const { error } = await supabase.from('flower_orders').update({ status }).eq('id', orderId);

    if (error) {
      throw error;
    }
  }

  const pickupDateKey = getPickupDateKey(existing.scheduled_for);
  const updatedForDeduct = await fetchOrderById(orderId);
  if (updatedForDeduct) {
    await claimAndDeductOrderSupabase(updatedForDeduct);
  }
  await maybeBatchDeductInventoryForClosedDay(pickupDateKey, existing.branch_id);

  const updated = await fetchOrderById(orderId);
  if (!updated) {
    throw new Error('Order status was updated but could not be loaded.');
  }

  return updated;
}

export async function markFlowerOrderBalancePaidSupabase(
  orderId: string,
  balancePaymentMode: FlowerPaymentMode,
  balancePaymentReference = '',
  proofBalanceDataUrl = '',
): Promise<FlowerOrder> {
  const supabase = await requireAuthenticatedSupabaseClient();
  const existing = await fetchOrderById(orderId);

  if (!existing) {
    throw new Error('Order not found.');
  }

  const isCorrection = existing.balance_paid;
  if (!isCorrection && (existing.balance <= 0 || existing.balance_paid)) {
    throw new Error('This order has no remaining balance to collect.');
  }

  const normalizedMode = normalizeFlowerPaymentMode(
    balancePaymentMode,
    existing.branch_id,
    existing.branch_name,
  );

  if (!balancePaymentMode || !normalizedMode) {
    throw new Error('Please choose a balance payment mode.');
  }

  if (normalizedMode !== 'cash' && !balancePaymentReference.trim()) {
    throw new Error('Reference # is required for non-cash balance payments.');
  }

  const proofSource = proofBalanceDataUrl.trim() || existing.proof_balance_data_url.trim();
  if (!proofSource) {
    throw new Error('Proof of balance payment is required.');
  }

  const proof_balance_data_url = await resolveOrderAttachmentUrl(
    proofSource,
    orderId,
    'proof-balance',
  );

  if (!proof_balance_data_url.trim()) {
    throw new Error('Proof of balance payment is required.');
  }

  const { data, error } = await supabase
    .from('flower_orders')
    .update(
      isCorrection
        ? {
            balance_payment_mode: normalizedMode,
            balance_payment_reference:
              normalizedMode === 'cash' ? '' : balancePaymentReference.trim(),
            proof_balance_data_url,
          }
        : {
            balance: 0,
            balance_paid: true,
            balance_payment_mode: normalizedMode,
            balance_payment_reference:
              normalizedMode === 'cash' ? '' : balancePaymentReference.trim(),
            proof_balance_data_url,
          },
    )
    .eq('id', orderId)
    .select('id')
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error(
      isCorrection
        ? 'Could not update balance payment mode. Please refresh and try again.'
        : 'Could not mark balance as paid. Please refresh and try again.',
    );
  }

  const updated = await fetchOrderById(orderId);
  if (!updated) {
    throw new Error(
      isCorrection
        ? 'Balance payment mode was updated but the order could not be loaded.'
        : 'Balance was updated but the order could not be loaded.',
    );
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

export async function runDueInventoryDeductionsSupabase(): Promise<number> {
  try {
    const restored = await restoreWronglyDeductedOpenOrdersSupabase();
    if (restored.restoredOrders > 0) {
      console.info('Restored wrongly deducted open orders.', restored);
    }
  } catch (restoreError) {
    console.warn('Open-order inventory restore failed.', restoreError);
  }

  if (INVENTORY_AUTO_DEDUCT_PAUSED) {
    return 0;
  }

  const supabase = await requireAuthenticatedSupabaseClient();
  const { data, error } = await supabase
    .from('flower_orders')
    .select('id, scheduled_for, branch_id, status, inventory_deducted')
    .eq('inventory_deducted', false)
    .in('status', FLOWER_ORDER_TERMINAL_STATUSES);

  if (error) {
    throw toServiceError(error, 'Failed to check scheduled inventory deductions.');
  }

  const buckets = getInventoryDeductionBuckets(data ?? []);
  let deducted = 0;

  for (const { dateKey, branchId } of buckets) {
    try {
      deducted += await maybeBatchDeductInventoryForClosedDay(dateKey, branchId);
    } catch (deductError) {
      console.warn('Scheduled inventory deduction failed.', { dateKey, branchId, deductError });
    }
  }

  return deducted;
}

/** Admin-triggered: restore bad open-order deducts, then deduct finished pending orders now. */
export async function forceRunInventoryDeductionsSupabase(): Promise<number> {
  try {
    const restored = await restoreWronglyDeductedOpenOrdersSupabase();
    if (restored.restoredOrders > 0) {
      console.info('Restored wrongly deducted open orders.', restored);
    }
  } catch (restoreError) {
    console.warn('Open-order inventory restore failed.', restoreError);
  }

  if (INVENTORY_AUTO_DEDUCT_PAUSED) {
    return 0;
  }

  const supabase = await requireAuthenticatedSupabaseClient();
  const { data, error } = await supabase
    .from('flower_orders')
    .select('id, scheduled_for, branch_id, status, inventory_deducted')
    .eq('inventory_deducted', false)
    .in('status', FLOWER_ORDER_TERMINAL_STATUSES);

  if (error) {
    throw toServiceError(error, 'Failed to check pending inventory deductions.');
  }

  const buckets = getInventoryDeductionBuckets(data ?? [], Date.now(), { skipTimeGate: true });
  let deducted = 0;

  for (const { dateKey, branchId } of buckets) {
    try {
      deducted += await maybeBatchDeductInventoryForClosedDay(dateKey, branchId, { skipTimeGate: true });
    } catch (deductError) {
      console.warn('Force inventory deduction failed.', { dateKey, branchId, deductError });
    }
  }

  return deducted;
}
