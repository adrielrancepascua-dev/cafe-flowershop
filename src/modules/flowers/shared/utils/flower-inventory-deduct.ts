import { parseInventoryMovementOrderId, scheduledForToDateKey } from './flower-format';

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
  let total = 0;

  for (const movement of movements) {
    if (movement.product_id !== productId || !movementAlreadyDeductsOrder(movement, orderId)) {
      continue;
    }

    total += movement.quantity;
  }

  return total;
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
  const planned: OrderDeductLine[] = [];

  for (const item of input.items) {
    if (!item.product_id || item.quantity <= 0) {
      continue;
    }

    const alreadyDeducted = alreadyDeductedQuantityForOrder(
      input.movements,
      input.orderId,
      item.product_id,
    );
    const remaining = Math.max(0, item.quantity - alreadyDeducted);
    if (remaining > 0) {
      planned.push({ product_id: item.product_id, quantity: remaining });
    }
  }

  return planned;
}
