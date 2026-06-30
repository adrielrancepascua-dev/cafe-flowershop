import type { FlowerOrder } from '../../shared/types/flower-order';
import {
  getOrderPrepDeadlineInfo,
  urgencyBadgeClassName,
} from '../../shared/utils/flower-order-deadlines';

export default function OrderDeadlineBadge({
  order,
  nowMs,
  compact = false,
}: {
  order: FlowerOrder;
  nowMs?: number;
  compact?: boolean;
}) {
  const info = getOrderPrepDeadlineInfo(order, nowMs);

  if (!info || info.urgency === 'none') {
    return null;
  }

  return (
    <span
      className={`inline-flex max-w-full items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold leading-tight sm:text-xs ${urgencyBadgeClassName(info.urgency)} ${compact ? 'truncate' : ''}`}
      title={info.detail}
    >
      {info.message}
    </span>
  );
}
