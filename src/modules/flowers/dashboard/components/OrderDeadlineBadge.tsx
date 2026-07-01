import type { FlowerOrder } from '../../shared/types/flower-order';
import {
  formatRemainingTimeLabel,
  getOrderPrepDeadlineInfo,
  urgencyBadgeClassName,
} from '../../shared/utils/flower-order-deadlines';

export default function OrderDeadlineBadge({
  order,
  nowMs,
  compact = false,
  variant = 'inline',
}: {
  order: FlowerOrder;
  nowMs?: number;
  compact?: boolean;
  variant?: 'inline' | 'table';
}) {
  const info = getOrderPrepDeadlineInfo(order, nowMs);

  if (!info || info.urgency === 'none') {
    return null;
  }

  if (variant === 'table') {
    const timeLabel = formatRemainingTimeLabel(info.minutesUntilDeadline);
    const timeStatus = info.minutesUntilDeadline < 0 ? 'overdue' : 'remaining';

    return (
      <span
        className={`inline-flex min-w-[6.75rem] flex-col gap-0.5 rounded-lg border px-2 py-1.5 text-left text-[10px] font-semibold leading-tight sm:min-w-[7.25rem] sm:text-[11px] ${urgencyBadgeClassName(info.urgency)}`}
        title={info.detail}
      >
        <span>Submit photo</span>
        <span className="font-medium opacity-90">
          {timeLabel} {timeStatus}
        </span>
      </span>
    );
  }

  return (
    <span
      className={`inline-flex max-w-full items-center rounded-lg border px-2 py-0.5 text-[10px] font-semibold leading-snug sm:text-xs ${urgencyBadgeClassName(info.urgency)} ${compact ? 'truncate' : ''}`}
      title={info.detail}
    >
      {info.message}
    </span>
  );
}
