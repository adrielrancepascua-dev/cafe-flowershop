import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Clock3 } from 'lucide-react';
import type { FlowerOrder } from '../../shared/types/flower-order';
import { formatPickupDateTimeLocal } from '../../shared/utils/flower-format';
import {
  listActiveOrderPrepDeadlines,
  urgencyPanelClassName,
  urgencyBadgeClassName,
  type OrderPrepDeadlineInfo,
} from '../../shared/utils/flower-order-deadlines';

function buildCollapsedSummary(alerts: OrderPrepDeadlineInfo[]): string {
  if (alerts.length === 0) {
    return '';
  }

  const nearest = alerts[0];
  if (alerts.length === 1) {
    return nearest.message;
  }

  const moreCount = alerts.length - 1;
  return `${nearest.message} · ${moreCount} more order${moreCount === 1 ? '' : 's'}`;
}

export default function OrderDeadlineAlertsPanel({
  orders,
  onSelectOrder,
}: {
  orders: FlowerOrder[];
  onSelectOrder: (order: FlowerOrder) => void;
}) {
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNowMs(Date.now());
    }, 60_000);

    return () => window.clearInterval(intervalId);
  }, []);

  const alerts = useMemo(
    () => listActiveOrderPrepDeadlines(orders, nowMs),
    [orders, nowMs],
  );

  const topUrgency = alerts[0]?.urgency ?? 'none';
  const hasUrgent = alerts.some(
    (alert) => alert.urgency === 'critical' || alert.urgency === 'overdue',
  );

  if (alerts.length === 0) {
    return null;
  }

  const collapsedSummary = buildCollapsedSummary(alerts);

  return (
    <div
      className={`mt-4 rounded-2xl border px-4 py-3.5 ${urgencyPanelClassName(hasUrgent ? topUrgency : topUrgency)}`}
    >
      <button
        type="button"
        onClick={() => setExpanded((current) => !current)}
        className="flex w-full items-start gap-3 text-left"
        aria-expanded={expanded}
      >
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
            hasUrgent ? 'bg-red-200 text-red-800' : 'bg-brand-beige text-brand-brown'
          }`}
        >
          <Clock3 className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className={`text-sm font-semibold ${hasUrgent ? 'text-red-950' : 'text-brand-dark'}`}>
              {hasUrgent ? 'Submit finished order photos now' : 'Upcoming photo deadlines'}
            </p>
            <span className="mt-0.5 shrink-0 text-brand-brown/60" aria-hidden="true">
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </span>
          </div>
          {!expanded ? (
            <>
              <p
                className={`mt-1 text-sm font-medium ${hasUrgent ? 'text-red-900' : 'text-brand-brown'}`}
              >
                {collapsedSummary}
              </p>
              <p className="mt-1 text-xs text-brand-brown/70">
                {alerts.length} order{alerts.length === 1 ? '' : 's'} need finished photos · Tap to
                view all
              </p>
            </>
          ) : (
            <p className="mt-0.5 text-xs text-brand-brown/75">
              Pick up: photo due 30 min before scheduled time. Delivery: photo due 1 hr before.
            </p>
          )}
        </div>
      </button>

      {expanded ? (
        <ul className="mt-3 space-y-2 border-t border-brand-muted/25 pt-3">
          {alerts.map((alert) => {
            const order = orders.find((entry) => entry.id === alert.orderId);
            if (!order) {
              return null;
            }

            return (
              <li key={alert.orderId}>
                <button
                  type="button"
                  onClick={() => onSelectOrder(order)}
                  className="flex w-full flex-col items-stretch gap-2 rounded-xl border border-brand-muted/30 bg-white px-3 py-2.5 text-left transition hover:bg-brand-cream/60 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold leading-snug text-brand-dark break-words">
                      {order.receiver}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-brand-brown/75">
                      {formatPickupDateTimeLocal(order.scheduled_for)}
                    </p>
                    <p className="mt-0.5 text-xs text-brand-brown/65">
                      {order.branch_name} ·{' '}
                      {order.claim_mode === 'delivery' ? 'Delivery' : 'Pick up'}
                    </p>
                  </div>
                  <span
                    className={`w-fit max-w-full rounded-full border px-2.5 py-1 text-[11px] font-semibold leading-tight sm:shrink-0 sm:text-xs ${urgencyBadgeClassName(alert.urgency)}`}
                  >
                    {alert.message}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
