import { useEffect, useMemo, useState } from 'react';
import { Clock3 } from 'lucide-react';
import type { FlowerOrder } from '../../shared/types/flower-order';
import {
  listActiveOrderPrepDeadlines,
  urgencyPanelClassName,
  urgencyBadgeClassName,
} from '../../shared/utils/flower-order-deadlines';

export default function OrderDeadlineAlertsPanel({
  orders,
  onSelectOrder,
}: {
  orders: FlowerOrder[];
  onSelectOrder: (order: FlowerOrder) => void;
}) {
  const [nowMs, setNowMs] = useState(() => Date.now());

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

  return (
    <div
      className={`mt-4 rounded-2xl border px-4 py-3.5 ${urgencyPanelClassName(hasUrgent ? topUrgency : topUrgency)}`}
    >
      <div className="flex items-start gap-3">
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
            hasUrgent ? 'bg-red-200 text-red-800' : 'bg-brand-beige text-brand-brown'
          }`}
        >
          <Clock3 className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-semibold ${hasUrgent ? 'text-red-950' : 'text-brand-dark'}`}>
            {hasUrgent ? 'Submit finished order photos now' : 'Upcoming photo deadlines'}
          </p>
          <p className="mt-0.5 text-xs text-brand-brown/75">
            Pick up: photo due 30 min before scheduled time. Delivery: photo due 1 hr before.
          </p>
          <ul className="mt-3 space-y-2">
            {alerts.slice(0, 6).map((alert) => {
              const order = orders.find((entry) => entry.id === alert.orderId);
              if (!order) {
                return null;
              }

              return (
                <li key={alert.orderId}>
                  <button
                    type="button"
                    onClick={() => onSelectOrder(order)}
                    className="flex w-full items-center justify-between gap-3 rounded-xl border border-brand-muted/30 bg-white px-3 py-2 text-left transition hover:bg-brand-cream/60"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-brand-dark">
                        {order.receiver}
                      </p>
                      <p className="truncate text-xs text-brand-brown/70">
                        {order.branch_name} ·{' '}
                        {order.claim_mode === 'delivery' ? 'Delivery' : 'Pick up'}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold sm:text-xs ${urgencyBadgeClassName(alert.urgency)}`}
                    >
                      {alert.message}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {alerts.length > 6 ? (
            <p className="mt-2 text-xs text-brand-brown/60">
              +{alerts.length - 6} more order{alerts.length - 6 === 1 ? '' : 's'} need photos soon
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
