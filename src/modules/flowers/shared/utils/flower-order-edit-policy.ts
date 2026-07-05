import type { FlowerOrder } from '../types/flower-order';
import { parseFlowerTimestamp } from './flower-format';

/** Staff may edit order contents until 6:00 PM Manila on the creation date. */
export const ORDER_CONTENT_EDIT_CUTOFF_HOUR_MANILA = 18;

export function toManilaDateKey(iso: string): string {
  return parseFlowerTimestamp(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
}

export function getOrderContentEditDeadlineMs(createdAtIso: string): number {
  const dateKey = toManilaDateKey(createdAtIso);
  const [year, month, day] = dateKey.split('-').map(Number);
  // Philippines is UTC+8 with no DST.
  return Date.UTC(year, month - 1, day, ORDER_CONTENT_EDIT_CUTOFF_HOUR_MANILA - 8, 0, 0, 0);
}

export interface OrderContentEditPolicyResult {
  allowed: boolean;
  reason: string | null;
  deadlineMs: number;
}

export function getOrderContentEditPolicy(
  order: Pick<FlowerOrder, 'created_at' | 'content_edited_at'>,
  nowMs: number = Date.now(),
  options?: { adminUnlimitedEdits?: boolean },
): OrderContentEditPolicyResult {
  const deadlineMs = getOrderContentEditDeadlineMs(order.created_at);

  if (options?.adminUnlimitedEdits) {
    return { allowed: true, reason: null, deadlineMs };
  }

  if (order.content_edited_at) {
    return {
      allowed: false,
      reason: 'This order has already been edited once.',
      deadlineMs,
    };
  }

  if (nowMs >= deadlineMs) {
    return {
      allowed: false,
      reason: 'Orders can only be edited until 6:00 PM on the day they were created.',
      deadlineMs,
    };
  }

  return { allowed: true, reason: null, deadlineMs };
}

export function assertOrderContentEditable(
  order: Pick<FlowerOrder, 'created_at' | 'content_edited_at'>,
  nowMs: number = Date.now(),
  options?: { adminUnlimitedEdits?: boolean },
): void {
  const result = getOrderContentEditPolicy(order, nowMs, options);
  if (!result.allowed) {
    throw new Error(result.reason ?? 'This order can no longer be edited.');
  }
}

export function formatOrderContentEditDeadlinePh(createdAtIso: string): string {
  const deadlineMs = getOrderContentEditDeadlineMs(createdAtIso);
  return new Date(deadlineMs).toLocaleString('en-PH', {
    timeZone: 'Asia/Manila',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}
