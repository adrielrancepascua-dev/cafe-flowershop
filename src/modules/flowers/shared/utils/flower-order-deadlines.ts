import type { FlowerClaimMode, FlowerOrder, FlowerOrderStatus } from '../types/flower-order';
import { parseFlowerTimestamp, scheduledForToDateKey, toDateKey } from './flower-format';

const PICKUP_PHOTO_LEAD_MS = 30 * 60 * 1000;
const DELIVERY_PHOTO_LEAD_MS = 60 * 60 * 1000;

const PHOTO_BLOCK_STATUSES: FlowerOrderStatus[] = [
  'ready',
  'picked_up',
  'delivered',
  'completed',
];

export type OrderPrepDeadlineUrgency = 'none' | 'notice' | 'warning' | 'critical' | 'overdue';

export interface OrderPrepDeadlineInfo {
  orderId: string;
  prepDeadlineIso: string;
  scheduledForIso: string;
  claimMode: FlowerClaimMode;
  leadMinutes: number;
  minutesUntilDeadline: number;
  urgency: OrderPrepDeadlineUrgency;
  message: string;
  detail: string;
}

function getPhotoLeadMs(claimMode: FlowerClaimMode): number {
  if (claimMode === 'delivery') {
    return DELIVERY_PHOTO_LEAD_MS;
  }

  return PICKUP_PHOTO_LEAD_MS;
}

function getPhotoLeadMinutes(claimMode: FlowerClaimMode): number {
  if (claimMode === 'delivery') {
    return 60;
  }

  return 30;
}

function formatMinutesRemaining(totalMinutes: number): string {
  const absMinutes = Math.abs(Math.round(totalMinutes));
  if (absMinutes < 60) {
    return `${absMinutes}m`;
  }

  const hours = Math.floor(absMinutes / 60);
  const minutes = absMinutes % 60;
  return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
}

export function formatFinishedPhotoRequirementLabel(claimMode: FlowerClaimMode): string {
  if (claimMode === 'delivery') {
    return 'Delivery — upload finished order photo 1 hour before delivery';
  }

  if (claimMode === 'walk_in') {
    return 'Walk in — finished order photo is optional';
  }

  return 'Pick up — upload finished order photo 30 minutes before pick up';
}

export function formatPrepDeadlineTimePh(iso: string): string {
  return parseFlowerTimestamp(iso).toLocaleString('en-PH', {
    timeZone: 'Asia/Manila',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export function formatRemainingTimeLabel(minutesUntilDeadline: number): string {
  if (minutesUntilDeadline < 0) {
    return `${formatMinutesRemaining(minutesUntilDeadline)} overdue`;
  }

  return `${formatMinutesRemaining(minutesUntilDeadline)} remaining`;
}

function resolveUrgency(
  minutesUntilDeadline: number,
  status: FlowerOrderStatus,
): OrderPrepDeadlineUrgency {
  if (minutesUntilDeadline < 0) {
    return 'overdue';
  }

  const nearMultiplier = status === 'not_started' ? 1 : 0.85;

  if (minutesUntilDeadline <= 30 * nearMultiplier) {
    return 'critical';
  }

  if (minutesUntilDeadline <= 120 * nearMultiplier) {
    return 'warning';
  }

  if (minutesUntilDeadline <= 480) {
    return 'notice';
  }

  return 'none';
}

function buildPhotoMessage(
  claimMode: FlowerClaimMode,
  minutesUntilDeadline: number,
): string {
  const timeLabel = formatMinutesRemaining(minutesUntilDeadline);

  if (minutesUntilDeadline < 0) {
    return `Submit photo (${timeLabel} overdue)`;
  }

  if (claimMode === 'delivery') {
    return `Submit photo (${timeLabel} remaining)`;
  }

  return `Submit photo (${timeLabel} remaining)`;
}

export function getOrderPrepDeadlineInfo(
  order: Pick<
    FlowerOrder,
    'id' | 'status' | 'scheduled_for' | 'claim_mode' | 'ready_photo_data_url'
  >,
  nowMs: number = Date.now(),
): OrderPrepDeadlineInfo | null {
  if (order.claim_mode === 'walk_in' || order.ready_photo_data_url) {
    return null;
  }

  if (
    order.status === 'cancelled' ||
    order.status === 'picked_up' ||
    order.status === 'delivered' ||
    order.status === 'completed'
  ) {
    return null;
  }

  const scheduledMs = parseFlowerTimestamp(order.scheduled_for).getTime();
  if (Number.isNaN(scheduledMs)) {
    return null;
  }

  const pickupDayKey = scheduledForToDateKey(order.scheduled_for);
  const todayKey = toDateKey(new Date());
  if (pickupDayKey < todayKey) {
    return null;
  }

  const leadMs = getPhotoLeadMs(order.claim_mode);
  const leadMinutes = getPhotoLeadMinutes(order.claim_mode);
  const prepDeadlineMs = scheduledMs - leadMs;
  const minutesUntilDeadline = (prepDeadlineMs - nowMs) / 60_000;
  const urgency = resolveUrgency(minutesUntilDeadline, order.status);

  const claimLabel = order.claim_mode === 'delivery' ? 'delivery' : 'pick up';
  const detail =
    order.claim_mode === 'delivery'
      ? `Upload a photo of the finished order at least 1 hour before delivery.`
      : `Upload a photo of the finished order at least 30 minutes before pick up.`;

  return {
    orderId: order.id,
    prepDeadlineIso: new Date(prepDeadlineMs).toISOString(),
    scheduledForIso: order.scheduled_for,
    claimMode: order.claim_mode,
    leadMinutes,
    minutesUntilDeadline,
    urgency,
    message: buildPhotoMessage(order.claim_mode, minutesUntilDeadline),
    detail: `${detail} Scheduled ${claimLabel}: ${parseFlowerTimestamp(order.scheduled_for).toLocaleString('en-PH', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })}`,
  };
}

export function listActiveOrderPrepDeadlines(
  orders: FlowerOrder[],
  nowMs: number = Date.now(),
  options: { maxHoursAhead?: number } = {},
): OrderPrepDeadlineInfo[] {
  const maxHoursAhead = options.maxHoursAhead ?? 24;
  const maxMinutesAhead = maxHoursAhead * 60;

  return orders
    .map((order) => getOrderPrepDeadlineInfo(order, nowMs))
    .filter((info): info is OrderPrepDeadlineInfo => {
      if (!info) {
        return false;
      }

      if (info.urgency === 'overdue') {
        return true;
      }

      return info.minutesUntilDeadline <= maxMinutesAhead;
    })
    .sort((left, right) => left.minutesUntilDeadline - right.minutesUntilDeadline);
}

export function isReadyPhotoRequiredForStatusChange(
  order: FlowerOrder,
  nextStatus: FlowerOrderStatus,
  nowMs: number = Date.now(),
): boolean {
  if (order.ready_photo_data_url || !PHOTO_BLOCK_STATUSES.includes(nextStatus)) {
    return false;
  }

  const info = getOrderPrepDeadlineInfo(order, nowMs);
  return Boolean(info && info.minutesUntilDeadline <= 0);
}

export function urgencyPanelClassName(urgency: OrderPrepDeadlineUrgency): string {
  switch (urgency) {
    case 'overdue':
      return 'border-red-400 bg-red-100';
    case 'critical':
      return 'border-red-300 bg-red-50';
    case 'warning':
      return 'border-amber-300 bg-amber-50';
    case 'notice':
      return 'border-brand-muted/50 bg-brand-cream/80';
    default:
      return 'border-brand-muted/40 bg-brand-cream/40';
  }
}

export function urgencyBadgeClassName(urgency: OrderPrepDeadlineUrgency): string {
  switch (urgency) {
    case 'overdue':
      return 'border-red-300 bg-red-200 text-red-950';
    case 'critical':
      return 'border-red-300 bg-red-100 text-red-900';
    case 'warning':
      return 'border-amber-300 bg-amber-100 text-amber-950';
    case 'notice':
      return 'border-brand-muted/40 bg-brand-beige/70 text-brand-brown/85';
    default:
      return 'border-brand-muted/30 bg-white text-brand-brown/70';
  }
}
