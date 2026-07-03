import { useEffect, useMemo, useState } from 'react';
import type { FlowerOrder } from '../types/flower-order';
import { formatPickupDateTimeLocal } from '../utils/flower-format';
import FlowerPrintControls from './FlowerPrintControls';

export function formatFlowerOrderPrintLabel(order: FlowerOrder): string {
  return `${order.receiver} — ${formatPickupDateTimeLocal(order.scheduled_for)}`;
}

type FlowerOrderPrintControlsProps = {
  orders: FlowerOrder[];
  onPrint: (orderId: string) => void | Promise<void>;
  disabled?: boolean;
  label?: string;
  className?: string;
  showSizeHint?: boolean;
  compact?: boolean;
};

export default function FlowerOrderPrintControls({
  orders,
  onPrint,
  disabled = false,
  label = 'Print order',
  className = '',
  showSizeHint = true,
  compact = false,
}: FlowerOrderPrintControlsProps) {
  const [selectedOrderId, setSelectedOrderId] = useState('');

  const sortedOrders = useMemo(
    () =>
      [...orders].sort(
        (left, right) =>
          new Date(left.scheduled_for).getTime() - new Date(right.scheduled_for).getTime(),
      ),
    [orders],
  );

  useEffect(() => {
    setSelectedOrderId((current) =>
      sortedOrders.some((order) => order.id === current) ? current : sortedOrders[0]?.id ?? '',
    );
  }, [sortedOrders]);

  if (sortedOrders.length === 0) {
    return null;
  }

  return (
    <div className={className}>
      <div className={`flex flex-wrap gap-2 ${compact ? 'items-center' : 'items-end'}`}>
        <label className={`min-w-0 ${compact ? 'flex-1' : 'w-full sm:min-w-[14rem] sm:flex-1'}`}>
          {!compact ? (
            <span className="mb-1 block text-xs font-medium text-brand-brown/70">Order to print</span>
          ) : null}
          <select
            value={selectedOrderId}
            onChange={(event) => setSelectedOrderId(event.target.value)}
            className="flower-input w-full"
            aria-label="Order to print"
          >
            {sortedOrders.map((order) => (
              <option key={order.id} value={order.id}>
                {formatFlowerOrderPrintLabel(order)}
              </option>
            ))}
          </select>
        </label>
        <FlowerPrintControls
          onPrint={() => void onPrint(selectedOrderId)}
          disabled={disabled || !selectedOrderId}
          label={label}
          showSizeHint={showSizeHint}
          className="shrink-0"
        />
      </div>
    </div>
  );
}
