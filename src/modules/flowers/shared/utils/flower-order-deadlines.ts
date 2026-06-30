import type { FlowerClaimMode, FlowerOrder } from '../types/flower-order';

const PICKUP_PREP_LEAD_MS = 30 * 60 * 1000;
const DELIVERY_PREP_LEAD_MS = 60 * 60 * 1000;

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

function getPrepLeadMs(claimMode: FlowerClaimMode): number {
  return claimMode === 'delivery' ? DELIVERY_PREP_LEAD_MS : PICKUP_PREP_LEAD_MS;
}

function getPrepLeadMinutes(claimMode: FlowerClaimMode): number {
  return claimMode === 'delivery' ? 60 : 30;
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

function resolveUrgency(minutesUntilDeadline: number): OrderPrepDeadlineUrgency {
  if (minutesUntilDeadline < 0) {
    return 'overdue';
  }

  if (minutesUntilDeadline <= 30) {
    return 'critical';
  }

  if (minutesUntilDeadline <= 120) {
    return 'warning';
  }

  if (minutesUntilDeadline <= 480) {
    return 'notice';
  }

  return 'none';
}

export function getOrderPrepDeadlineInfo(
  order: Pick<FlowerOrder, 'id' | 'status' | 'scheduled_for' | 'claim_mode'>,
  nowMs: number = Date.now(),
): OrderPrepDeadlineInfo | null {
  if (order.status !== 'not_started') {
    return null;
  }

  const scheduledMs = new Date(order.scheduled_for).getTime();
  if (Number.isNaN(scheduledMs)) {
    return null;
  }

  const leadMs = getPrepLeadMs(order.claim_mode);
  const leadMinutes = getPrepLeadMinutes(order.claim_mode);
  const prepDeadlineMs = scheduledMs - leadMs;
  const minutesUntilDeadline = (prepDeadlineMs - nowMs) / 60_000;
  const urgency = resolveUrgency(minutesUntilDeadline);

  const claimLabel = order.claim_mode === 'delivery' ? 'delivery' : 'pick up';
  const detail =
    order.claim_mode === 'delivery'
      ? 'Finish and photo-ready 1 hour before delivery.'
      : 'Finish and photo-ready 30 minutes before pick up.';

  let message: string;
  if (minutesUntilDeadline < 0) {
    message = `Prep overdue by ${formatMinutesRemaining(minutesUntilDeadline)}`;
  } else if (minutesUntilDeadline <= 30) {
    message = `Prep due in ${formatMinutesRemaining(minutesUntilDeadline)} — start now`;
  } else {
    message = `Prep due in ${formatMinutesRemaining(minutesUntilDeadline)}`;
  }

  return {
    orderId: order.id,
    prepDeadlineIso: new Date(prepDeadlineMs).toISOString(),
    scheduledForIso: order.scheduled_for,
    claimMode: order.claim_mode,
    leadMinutes,
    minutesUntilDeadline,
    urgency,
    message,
    detail: `${detail} (${claimLabel} at ${new Date(scheduledMs).toLocaleString('en-PH', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })})`,
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

export function urgencyPanelClassName(urgency: OrderPrepDeadlineUrgency): string {
  switch (urgency) {
    case 'overdue':
      return 'border-red-300/80 bg-gradient-to-r from-red-50 to-rose-50/80';
    case 'critical':
      return 'border-red-200/70 bg-gradient-to-r from-red-50/90 to-orange-50/70 animate-pulse';
    case 'warning':
      return 'border-amber-200/80 bg-gradient-to-r from-amber-50 to-orange-50/60';
    case 'notice':
      return 'border-brand-muted/50 bg-gradient-to-r from-brand-cream/80 to-brand-beige/40';
    default:
      return 'border-brand-muted/40 bg-brand-cream/30';
  }
}

export function urgencyBadgeClassName(urgency: OrderPrepDeadlineUrgency): string {
  switch (urgency) {
    case 'overdue':
      return 'border-red-200 bg-red-100 text-red-900';
    case 'critical':
      return 'border-red-200 bg-red-50 text-red-800 animate-pulse';
    case 'warning':
      return 'border-amber-200 bg-amber-50 text-amber-950';
    case 'notice':
      return 'border-brand-muted/40 bg-brand-beige/60 text-brand-brown/80';
    default:
      return 'border-brand-muted/30 bg-white text-brand-brown/70';
  }
}
