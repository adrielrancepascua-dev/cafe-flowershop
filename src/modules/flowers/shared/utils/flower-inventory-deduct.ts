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

/**
 * If staff already stocked out the exact sold qty (same product, same day),
 * 7 PM order-deduct must not remove those stems again.
 */
export function creditExactStockOutAgainstPending(
  pendingByProduct: Map<string, number>,
  stockOutByProduct: Map<string, number>,
): Map<string, number> {
  const remaining = new Map<string, number>();

  for (const [productId, pending] of pendingByProduct) {
    const stockOut = stockOutByProduct.get(productId) ?? 0;
    remaining.set(productId, stockOut === pending && pending > 0 ? 0 : pending);
  }

  return remaining;
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

export function planOrderInventoryDeduction(input: {
  orderId: string;
  branchId: string;
  items: OrderDeductLine[];
  movements: DeductibleInventoryMovement[];
  remainingAfterStockOutCredit?: Map<string, number>;
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
    let remaining = Math.max(0, item.quantity - alreadyDeducted);

    if (input.remainingAfterStockOutCredit) {
      const creditedRemaining = input.remainingAfterStockOutCredit.get(item.product_id);
      if (creditedRemaining === 0) {
        remaining = 0;
      }
    }

    if (remaining > 0) {
      planned.push({ product_id: item.product_id, quantity: remaining });
    }
  }

  return planned;
}

export function buildBatchStockOutCreditMap(input: {
  branchId: string;
  dateKey: string;
  pendingItems: OrderDeductLine[];
  movements: DeductibleInventoryMovement[];
}): Map<string, number> {
  const pendingByProduct = pendingQuantityByProduct(input.pendingItems);
  const stockOutByProduct = sumUnattributedStockOutByProduct(
    input.movements,
    input.branchId,
    input.dateKey,
  );

  return creditExactStockOutAgainstPending(pendingByProduct, stockOutByProduct);
}

export function effectiveSoldPendingAfterStockOut(
  soldPending: number,
  stockOutQuantity: number,
): number {
  if (soldPending > 0 && stockOutQuantity === soldPending) {
    return 0;
  }

  return soldPending;
}
