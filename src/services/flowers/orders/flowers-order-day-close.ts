import type { FlowerOrder } from '../../../modules/flowers/shared/types/flower-order';
import { FLOWER_ORDER_TERMINAL_STATUSES } from '../../../modules/flowers/shared/types/flower-order';
import { scheduledForToDateKey } from '../../../modules/flowers/shared/utils/flower-format';

export function getPickupDateKey(iso: string): string {
  return scheduledForToDateKey(iso);
}

export function computeFlowerDayCloseStatus(
  orders: FlowerOrder[],
  dateKey: string,
): {
  date: string;
  total_orders: number;
  open_orders: number;
  is_closed: boolean;
} {
  const dayOrders = orders.filter(
    (order) => getPickupDateKey(order.scheduled_for) === dateKey && order.status !== 'cancelled',
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
): FlowerOrder[] {
  return orders.filter(
    (order) =>
      getPickupDateKey(order.scheduled_for) === dateKey &&
      order.status !== 'cancelled' &&
      FLOWER_ORDER_TERMINAL_STATUSES.includes(order.status) &&
      !order.inventory_deducted,
  );
}
