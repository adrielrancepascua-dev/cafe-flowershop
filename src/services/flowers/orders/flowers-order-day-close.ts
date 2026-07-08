import type { FlowerOrder } from '../../../modules/flowers/shared/types/flower-order';
import { FLOWER_ORDER_TERMINAL_STATUSES } from '../../../modules/flowers/shared/types/flower-order';
import { scheduledForToDateKey } from '../../../modules/flowers/shared/utils/flower-format';

/** Terminal orders deduct at 7:00 PM Manila on their pickup date. */
export const INVENTORY_DEDUCTION_HOUR_MANILA = 19;

export function getPickupDateKey(iso: string): string {
  return scheduledForToDateKey(iso);
}

export function getInventoryDeductionDeadlineMs(dateKey: string): number {
  const [year, month, day] = dateKey.split('-').map(Number);
  // Philippines is UTC+8 with no DST.
  return Date.UTC(year, month - 1, day, INVENTORY_DEDUCTION_HOUR_MANILA - 8, 0, 0, 0);
}

export function isInventoryDeductionDue(dateKey: string, nowMs: number = Date.now()): boolean {
  if (!dateKey) {
    return false;
  }

  return nowMs >= getInventoryDeductionDeadlineMs(dateKey);
}

export function formatInventoryDeductionDeadlinePh(dateKey: string): string {
  return new Date(getInventoryDeductionDeadlineMs(dateKey)).toLocaleString('en-PH', {
    timeZone: 'Asia/Manila',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export function computeFlowerDayCloseStatus(
  orders: FlowerOrder[],
  dateKey: string,
  branchId?: string,
): {
  date: string;
  total_orders: number;
  open_orders: number;
  is_closed: boolean;
} {
  const dayOrders = orders.filter(
    (order) =>
      getPickupDateKey(order.scheduled_for) === dateKey &&
      order.status !== 'cancelled' &&
      (!branchId || order.branch_id === branchId),
  );

  const openOrders = dayOrders.filter(
    (order) => !FLOWER_ORDER_TERMINAL_STATUSES.includes(order.status),
  );

  return {
    date: dateKey,
    total_orders: dayOrders.length,
    open_orders: openOrders.length,
    is_closed: dayOrders.length > 0 && openOrders.length === 0,
  };
}

export function getOrdersPendingInventoryDeduction(
  orders: FlowerOrder[],
  dateKey: string,
  branchId?: string,
): FlowerOrder[] {
  return orders.filter(
    (order) =>
      getPickupDateKey(order.scheduled_for) === dateKey &&
      order.status !== 'cancelled' &&
      (!branchId || order.branch_id === branchId) &&
      FLOWER_ORDER_TERMINAL_STATUSES.includes(order.status) &&
      !order.inventory_deducted,
  );
}
