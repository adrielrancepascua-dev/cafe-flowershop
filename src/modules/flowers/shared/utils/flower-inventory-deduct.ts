import {
  isHistoricalReconcileUndoNote,
  parseInventoryMovementOrderId,
  scheduledForToDateKey,
} from './flower-format';

export type DeductibleInventoryMovement = {
  movement_type: string;
  product_id: string;
  quantity: number;
  branch_id: string;
  note: string;
  created_at: string;
};

export type OrderDeductLine = {
  product_id: string;
  quantity: number;
};

function isOutboundSaleMovementType(movementType: string): boolean {
  return movementType === 'order_deduct' || movementType === 'stock_out' || movementType === 'out';
}

function isInboundRestoreMovementType(movementType: string): boolean {
  return movementType === 'stock_in' || movementType === 'in';
}

export function isUnattributedStockOut(movement: DeductibleInventoryMovement): boolean {
  if (movement.movement_type !== 'stock_out' && movement.movement_type !== 'out') {
    return false;
  }

  return parseInventoryMovementOrderId(movement.note) == null;
}

export function movementAlreadyDeductsOrder(
  movement: DeductibleInventoryMovement,
  orderId: string,
): boolean {
  if (!isOutboundSaleMovementType(movement.movement_type)) {
    return false;
  }

  return parseInventoryMovementOrderId(movement.note) === orderId;
}

export function movementRestoresOrder(
  movement: DeductibleInventoryMovement,
  orderId: string,
): boolean {
  if (!isInboundRestoreMovementType(movement.movement_type)) {
    return false;
  }

  return parseInventoryMovementOrderId(movement.note) === orderId;
}

/**
 * Totals manual stock-outs that are not tied to an order.
 * For warnings/display only — never skip 7 PM order_deduct based on this.
 */
export function sumUnattributedStockOutByProduct(
  movements: DeductibleInventoryMovement[],
  branchId: string,
  dateKey?: string,
): Map<string, number> {
  const totals = new Map<string, number>();

  for (const movement of movements) {
    if (movement.branch_id !== branchId || !isUnattributedStockOut(movement)) {
      continue;
    }

    if (dateKey && scheduledForToDateKey(movement.created_at) !== dateKey) {
      continue;
    }

    totals.set(movement.product_id, (totals.get(movement.product_id) ?? 0) + movement.quantity);
  }

  return totals;
}

export function alreadyDeductedQuantityForOrder(
  movements: DeductibleInventoryMovement[],
  orderId: string,
  productId: string,
): number {
  return netOrderDeductedByProduct(movements, orderId).get(productId) ?? 0;
}

/** Net stems still removed for this order after deducts minus void/edit restores. */
export function netOrderDeductedByProduct(
  movements: DeductibleInventoryMovement[],
  orderId: string,
): Map<string, number> {
  const totals = new Map<string, number>();

  for (const movement of movements) {
    if (parseInventoryMovementOrderId(movement.note) !== orderId) {
      continue;
    }

    const current = totals.get(movement.product_id) ?? 0;
    if (movementAlreadyDeductsOrder(movement, orderId)) {
      totals.set(movement.product_id, current + movement.quantity);
      continue;
    }

    if (movementRestoresOrder(movement, orderId)) {
      totals.set(movement.product_id, current - movement.quantity);
    }
  }

  for (const [productId, quantity] of totals) {
    if (quantity <= 0) {
      totals.delete(productId);
    } else {
      totals.set(productId, quantity);
    }
  }

  return totals;
}

export function pendingQuantityByProduct(items: OrderDeductLine[]): Map<string, number> {
  const totals = new Map<string, number>();

  for (const item of items) {
    if (!item.product_id || item.quantity <= 0) {
      continue;
    }

    totals.set(item.product_id, (totals.get(item.product_id) ?? 0) + item.quantity);
  }

  return totals;
}

/**
 * Stems still missing an order_deduct for this order.
 * Manual stock in/out never counts — sales and spoilage always need their own order_deduct.
 */
export function remainingOrderDeductionByProduct(input: {
  orderId: string;
  items: OrderDeductLine[];
  movements: DeductibleInventoryMovement[];
}): Map<string, number> {
  const pending = pendingQuantityByProduct(input.items);
  const netDeducted = netOrderDeductedByProduct(input.movements, input.orderId);
  const remaining = new Map<string, number>();

  for (const [productId, quantity] of pending) {
    const leftover = Math.max(0, quantity - (netDeducted.get(productId) ?? 0));
    if (leftover > 0) {
      remaining.set(productId, leftover);
    }
  }

  return remaining;
}

/**
 * Plan 7 PM deduct lines for one order.
 * Skips qty already written as order_deduct / order-attributed outbound for this order
 * so a repeat poll cannot remove the same stems twice.
 */
export function planOrderInventoryDeduction(input: {
  orderId: string;
  branchId: string;
  items: OrderDeductLine[];
  movements: DeductibleInventoryMovement[];
}): OrderDeductLine[] {
  return [...remainingOrderDeductionByProduct(input).entries()].map(([product_id, quantity]) => ({
    product_id,
    quantity,
  }));
}

/** Stems still missing an order_deduct for this order after prior day-close runs. */
export function missingOrderDeductionByProduct(input: {
  orderId: string;
  items: OrderDeductLine[];
  movements: DeductibleInventoryMovement[];
}): Map<string, number> {
  return remainingOrderDeductionByProduct(input);
}

export function hasCompleteOrderDeduction(input: {
  orderId: string;
  items: OrderDeductLine[];
  movements: DeductibleInventoryMovement[];
}): boolean {
  return remainingOrderDeductionByProduct(input).size === 0;
}

/** PR #13 started rewriting historical order_deducts around this time (UTC). */
export const HISTORICAL_RECONCILE_BUG_STARTED_AT = '2026-08-19T03:30:00.000Z';
/** 7:00 PM Manila on Aug 19 — stop undoing after legitimate day-close deducts begin. */
export const HISTORICAL_RECONCILE_BUG_ENDED_AT = '2026-08-19T11:00:00.000Z';

/** Emergency brake — keep false. Do not replay already-deducted history. */
export const INVENTORY_AUTO_DEDUCT_PAUSED = false;

export type HistoricalReconcileRestoreLine = {
  branchId: string;
  productId: string;
  quantity: number;
  orderId: string;
  receiver: string;
};

/**
 * Extra order_deducts written by the 14-day historical reconcile.
 * Groups by branch+product so one stock-in can undo hundreds of order lines.
 * Uses parsed timestamps so +00:00 vs Z does not skip rows.
 */
export function quantitiesToForceRestoreByProduct(
  movements: DeductibleInventoryMovement[],
  cutoffIso: string = HISTORICAL_RECONCILE_BUG_STARTED_AT,
  endedAtIso: string = HISTORICAL_RECONCILE_BUG_ENDED_AT,
): HistoricalReconcileRestoreLine[] {
  const cutoffMs = Date.parse(cutoffIso);
  const endedMs = Date.parse(endedAtIso);
  const deducted = new Map<string, number>();
  const restored = new Map<string, number>();

  for (const movement of movements) {
    const createdMs = Date.parse(movement.created_at);
    if (!Number.isFinite(createdMs)) {
      continue;
    }

    const key = `${movement.branch_id}|${movement.product_id}`;

    if (isInboundRestoreMovementType(movement.movement_type) && isHistoricalReconcileUndoNote(movement.note)) {
      restored.set(key, (restored.get(key) ?? 0) + movement.quantity);
      continue;
    }

    if (createdMs < cutoffMs || createdMs >= endedMs) {
      continue;
    }

    const isOrderDeduct =
      movement.movement_type === 'order_deduct' ||
      (isOutboundSaleMovementType(movement.movement_type) && parseInventoryMovementOrderId(movement.note) != null);

    if (!isOrderDeduct) {
      continue;
    }

    deducted.set(key, (deducted.get(key) ?? 0) + movement.quantity);
  }

  const lines: HistoricalReconcileRestoreLine[] = [];

  for (const [key, quantity] of deducted) {
    const leftover = Math.max(0, quantity - (restored.get(key) ?? 0));
    if (leftover <= 0) {
      continue;
    }

    const [branchId, productId] = key.split('|');
    lines.push({
      branchId,
      productId,
      quantity: leftover,
      orderId: 'BULK',
      receiver: 'inventory repair',
    });
  }

  return lines;
}

export function quantitiesToRestoreFromHistoricalReconcile(
  movements: DeductibleInventoryMovement[],
  cutoffIso?: string,
  endedAtIso?: string,
): HistoricalReconcileRestoreLine[] {
  return quantitiesToForceRestoreByProduct(movements, cutoffIso, endedAtIso);
}
