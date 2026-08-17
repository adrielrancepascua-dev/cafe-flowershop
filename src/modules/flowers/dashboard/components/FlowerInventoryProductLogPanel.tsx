import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { listFlowerInventoryMovements } from '../../../../services/flowers/inventory';
import { extractSupabaseErrorMessage } from '../../../../lib/supabase/errors';
import type { FlowerInventoryMovementRow, FlowerInventoryStockRow } from '../../shared/types/flower-inventory';
import {
  formatInventoryMovementActor,
  formatInventoryMovementTimestamp,
  INVENTORY_MOVEMENT_TYPE_BADGES,
  INVENTORY_MOVEMENT_TYPE_LABELS,
  parseInventoryMovementOrderId,
  resolveInventoryMovementReceiver,
  toManilaDateKeyFromDate,
} from '../../shared/utils/flower-format';
import {
  flowerProductColorSwatchClass,
  normalizeFlowerProductColor,
} from '../../shared/utils/flower-product-colors';
import { normalizeFlowerProductKind } from '../../shared/utils/flower-product-kind';

function shiftManilaDateKey(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return shifted.toISOString().slice(0, 10);
}

function formatLogDateLabel(dateKey: string): string {
  return new Date(`${dateKey}T12:00:00`).toLocaleDateString('en-PH', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function isOutbound(type: FlowerInventoryMovementRow['movement_type']): boolean {
  return type === 'stock_out' || type === 'transfer_out' || type === 'order_deduct';
}

export default function FlowerInventoryProductLogPanel({
  row,
  branchId,
  showBranch,
  onClose,
}: {
  row: FlowerInventoryStockRow;
  branchId?: string;
  showBranch: boolean;
  onClose: () => void;
}) {
  const [dateKey, setDateKey] = useState(() => toManilaDateKeyFromDate());
  const [movements, setMovements] = useState<FlowerInventoryMovementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const color = normalizeFlowerProductColor(row.product_color);
  const isFlower = normalizeFlowerProductKind(row.product_kind) === 'flower';

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setErrorMessage('');
      try {
        const rows = await listFlowerInventoryMovements({
          branchId,
          productId: row.product_id,
          fromDate: dateKey,
          toDate: dateKey,
          limit: 500,
        });
        if (!cancelled) {
          setMovements(rows);
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(extractSupabaseErrorMessage(error, 'Failed to load this color’s log.'));
          setMovements([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [branchId, dateKey, row.product_id]);

  const totals = useMemo(() => {
    let stockIn = 0;
    let stockOut = 0;
    let orderDeduct = 0;
    let transfers = 0;

    for (const movement of movements) {
      if (movement.movement_type === 'stock_in') {
        stockIn += movement.quantity;
      } else if (movement.movement_type === 'stock_out') {
        stockOut += movement.quantity;
      } else if (movement.movement_type === 'order_deduct') {
        orderDeduct += movement.quantity;
      } else if (movement.movement_type === 'transfer_in' || movement.movement_type === 'transfer_out') {
        transfers += movement.quantity;
      }
    }

    return { stockIn, stockOut, orderDeduct, transfers };
  }, [movements]);

  const title = isFlower ? `${row.product_flower_type || row.product_name} · ${color}` : row.product_name;

  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-brand-dark/40 p-0 sm:items-center sm:p-4">
      <button type="button" aria-label="Close inventory log" className="absolute inset-0" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="inventory-color-log-title"
        className="relative flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-white shadow-xl sm:max-h-[85vh] sm:rounded-3xl"
      >
        <div className="border-b border-brand-muted/30 px-4 py-4 sm:px-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-brown/60">
                Inventory log
              </p>
              <h2
                id="inventory-color-log-title"
                className="mt-1 flex min-w-0 items-center gap-2 font-serif text-lg font-semibold text-brand-dark"
              >
                {isFlower ? (
                  <span
                    className={`h-3.5 w-3.5 shrink-0 rounded-full ${flowerProductColorSwatchClass(color)}`}
                    aria-hidden
                  />
                ) : null}
                <span className="truncate">{title}</span>
              </h2>
              <p className="mt-1 text-xs text-brand-brown/65">
                {showBranch ? 'All branches · ' : `${row.branch_name} · `}
                tap another color anytime. Names show on new stock in/out after the log update.
              </p>
            </div>
            <button
              type="button"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-brand-muted/40 text-brand-brown hover:bg-brand-beige/50"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              aria-label="Previous day"
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-brand-muted/50 text-brand-brown hover:bg-brand-beige/50"
              onClick={() => setDateKey((current) => shiftManilaDateKey(current, -1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <label className="min-w-0 flex-1 text-xs font-medium text-brand-brown">
              <span className="sr-only">Log date</span>
              <input
                type="date"
                value={dateKey}
                onChange={(event) => setDateKey(event.target.value)}
                className="flower-input w-full"
              />
            </label>
            <button
              type="button"
              aria-label="Next day"
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-brand-muted/50 text-brand-brown hover:bg-brand-beige/50"
              onClick={() => setDateKey((current) => shiftManilaDateKey(current, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-2 text-center text-xs font-medium text-brand-brown/70">{formatLogDateLabel(dateKey)}</p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2">
              <p className="font-semibold text-emerald-800">Stock in</p>
              <p className="mt-0.5 text-lg font-bold text-emerald-900">+{totals.stockIn}</p>
            </div>
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2">
              <p className="font-semibold text-red-700">Stock out</p>
              <p className="mt-0.5 text-lg font-bold text-red-800">−{totals.stockOut}</p>
            </div>
            <div className="rounded-xl border border-brand-muted/50 bg-brand-beige/40 px-3 py-2">
              <p className="font-semibold text-brand-brown">Order deduct</p>
              <p className="mt-0.5 text-lg font-bold text-brand-dark">−{totals.orderDeduct}</p>
            </div>
            <div className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2">
              <p className="font-semibold text-sky-800">Transfers</p>
              <p className="mt-0.5 text-lg font-bold text-sky-900">{totals.transfers}</p>
            </div>
          </div>

          {errorMessage ? (
            <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {errorMessage}
            </p>
          ) : null}

          {loading ? (
            <p className="mt-4 text-center text-sm text-brand-brown/60">Loading this day’s log…</p>
          ) : movements.length === 0 ? (
            <p className="mt-4 rounded-xl border border-dashed border-brand-muted/40 px-3 py-8 text-center text-sm text-brand-brown/60">
              No stock movement for this color on {formatLogDateLabel(dateKey)}.
            </p>
          ) : (
            <ul className="mt-4 space-y-2">
              {movements.map((movement) => {
                const typeLabel =
                  INVENTORY_MOVEMENT_TYPE_LABELS[movement.movement_type] ?? movement.movement_type;
                const typeBadgeClass =
                  INVENTORY_MOVEMENT_TYPE_BADGES[movement.movement_type] ??
                  'border-brand-muted/40 bg-white text-brand-brown';
                const orderId = parseInventoryMovementOrderId(movement.note);
                const receiver = resolveInventoryMovementReceiver(movement.note);
                const actor = formatInventoryMovementActor(movement);

                return (
                  <li
                    key={movement.id}
                    className="rounded-xl border border-brand-muted/35 bg-brand-cream/20 px-3 py-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-brand-dark">{actor}</p>
                        {showBranch ? (
                          <p className="mt-0.5 text-xs text-brand-brown/65">{movement.branch_name}</p>
                        ) : null}
                      </div>
                      <span
                        className={`inline-flex shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${typeBadgeClass}`}
                      >
                        {typeLabel}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                      <span className="rounded-lg border border-brand-muted/40 bg-white px-2.5 py-1 text-sm font-bold text-brand-dark">
                        {isOutbound(movement.movement_type) ? '−' : '+'}
                        {movement.quantity}
                      </span>
                      <span className="text-xs text-brand-brown/70">
                        {movement.previous_on_hand} → {movement.new_on_hand} on hand
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-brand-brown/65">
                      <span>{formatInventoryMovementTimestamp(movement.created_at)}</span>
                      {orderId ? (
                        <>
                          <span aria-hidden>·</span>
                          <span>Order {orderId}</span>
                        </>
                      ) : null}
                      {receiver ? (
                        <>
                          <span aria-hidden>·</span>
                          <span>For {receiver}</span>
                        </>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
