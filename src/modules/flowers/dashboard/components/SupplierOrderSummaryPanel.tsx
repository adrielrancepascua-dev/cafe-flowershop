import { useEffect, useMemo, useState } from 'react';
import { ClipboardCopy, ChevronDown, RotateCcw } from 'lucide-react';
import { listFlowerOrders } from '../../../../services/flowers/orders';
import type { FlowerOrder } from '../../shared/types/flower-order';
import type { FlowerProduct } from '../../shared/types/flower-product';
import {
  formatOrderInputTimestamp,
  formatPickupDateTimeLocal,
  summarizeFlowerLines,
} from '../../shared/utils/flower-format';
import {
  buildSupplierOrderClipboardText,
  buildSupplierOrderSummary,
  defaultSupplierDateRange,
  formatSupplierSummaryDateLabel,
  formatSupplierSummaryDateRange,
  readSupplierRoundSettings,
  readSupplierStampedDates,
  stampSupplierDateRange,
  SUPPLIER_ROUND_STEP_OPTIONS,
  unstampSupplierDateRange,
  writeSupplierRoundSettings,
  writeSupplierStampedDates,
  type SupplierSummaryLine,
} from '../../shared/utils/flower-supplier-order-summary';

function SummaryLineList({
  lines,
  emptyLabel,
}: {
  lines: SupplierSummaryLine[];
  emptyLabel: string;
}) {
  if (lines.length === 0) {
    return <p className="text-sm text-brand-brown/55">{emptyLabel}</p>;
  }

  return (
    <ul className="space-y-1.5">
      {lines.map((line) => (
        <li key={line.key} className="text-sm text-brand-dark">
          <span className="font-semibold tabular-nums">{line.reservedQty}</span>
          <span className="text-brand-brown/75"> · {line.itemName}</span>
        </li>
      ))}
    </ul>
  );
}

function EditableOrderLine({
  line,
  orderQty,
  onChange,
  onReset,
}: {
  line: SupplierSummaryLine;
  orderQty: number;
  onChange: (value: number) => void;
  onReset: () => void;
}) {
  const isOverridden = orderQty !== line.suggestedOrderQty;
  const unitLabel = line.kind === 'misc' ? '' : 'stems';

  return (
    <li className="flex flex-wrap items-center gap-2 rounded-xl border border-brand-muted/35 bg-white px-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-brand-dark">{line.itemName}</p>
        <p className="text-xs text-brand-brown/60">
          Reserved {line.reservedQty}
          {line.kind === 'flower' ? ' stems' : ''}
          {' · '}
          Suggested {line.suggestedOrderQty}
          {line.kind === 'flower' ? ' stems' : ''}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {unitLabel ? (
          <span className="text-xs font-medium text-brand-brown/60">{unitLabel}</span>
        ) : null}
        <input
          type="number"
          min={0}
          step={1}
          value={orderQty}
          onChange={(event) => {
            const next = Number(event.target.value);
            if (Number.isFinite(next) && next >= 0) {
              onChange(Math.round(next));
            }
          }}
          className="flower-input w-20 text-center text-sm tabular-nums"
          aria-label={`Order quantity for ${line.itemName}`}
        />
        {isOverridden ? (
          <button
            type="button"
            onClick={onReset}
            className="rounded-lg border border-brand-muted/50 px-2 py-1 text-xs font-semibold text-brand-brown hover:bg-brand-beige/50"
            title="Reset to suggested quantity"
          >
            Reset
          </button>
        ) : null}
      </div>
    </li>
  );
}

function formatStampedDaysLabel(keys: string[]): string {
  if (keys.length === 0) {
    return '';
  }

  if (keys.length === 1) {
    return formatSupplierSummaryDateLabel(keys[0]);
  }

  return `${formatSupplierSummaryDateLabel(keys[0])} – ${formatSupplierSummaryDateLabel(keys[keys.length - 1])}`;
}

export default function SupplierOrderSummaryPanel({
  products,
}: {
  products: FlowerProduct[];
}) {
  const initialRange = defaultSupplierDateRange();
  const [dateFrom, setDateFrom] = useState(initialRange.from);
  const [dateTo, setDateTo] = useState(initialRange.to);
  const [roundSettings, setRoundSettings] = useState(readSupplierRoundSettings);
  const [orders, setOrders] = useState<FlowerOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [copyMessage, setCopyMessage] = useState('');
  const [orderOverrides, setOrderOverrides] = useState<Record<string, number>>({});
  const [stampedDates, setStampedDates] = useState(() => readSupplierStampedDates());

  useEffect(() => {
    let cancelled = false;

    async function loadOrders() {
      if (!dateFrom || !dateTo || dateFrom > dateTo) {
        setLoadError('Choose a valid date range.');
        setOrders([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      setLoadError('');

      try {
        const orderList = await listFlowerOrders({
          scheduledFrom: dateFrom,
          scheduledTo: dateTo,
        });
        if (!cancelled) {
          setOrders(orderList);
        }
      } catch (error) {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : 'Failed to load orders.');
          setOrders([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadOrders();

    return () => {
      cancelled = true;
    };
  }, [dateFrom, dateTo]);

  useEffect(() => {
    writeSupplierRoundSettings(roundSettings);
  }, [roundSettings]);

  useEffect(() => {
    setOrderOverrides({});
  }, [dateFrom, dateTo, roundSettings.flowerRoundStep, roundSettings.miscRoundStep, stampedDates]);

  const summary = useMemo(
    () =>
      buildSupplierOrderSummary(orders, products, {
        dateFrom,
        dateTo,
        roundSettings,
        stampedDates,
      }),
    [orders, products, dateFrom, dateTo, roundSettings, stampedDates],
  );

  const orderQuantities = useMemo(() => {
    const map = new Map<string, number>();
    for (const line of [...summary.grandTotalFlowers, ...summary.grandTotalFillers]) {
      map.set(line.key, orderOverrides[line.key] ?? line.suggestedOrderQty);
    }
    return map;
  }, [summary, orderOverrides]);

  async function handleCopy() {
    const text = buildSupplierOrderClipboardText({ summary, orderQuantities });
    try {
      await navigator.clipboard.writeText(text);
      setCopyMessage('Copied to clipboard.');
      window.setTimeout(() => setCopyMessage(''), 2500);
    } catch {
      setCopyMessage('Could not copy — check browser permissions.');
    }
  }

  function resetAllOverrides() {
    setOrderOverrides({});
  }

  function stampCurrentRange() {
    if (summary.stamp.status === 'done') {
      return;
    }

    const next = stampSupplierDateRange(stampedDates, dateFrom, dateTo);
    writeSupplierStampedDates(next);
    setStampedDates(next);
  }

  function redoCurrentRange() {
    const next = unstampSupplierDateRange(stampedDates, dateFrom, dateTo);
    writeSupplierStampedDates(next);
    setStampedDates(next);
  }

  const grandTotalLines = [...summary.grandTotalFlowers, ...summary.grandTotalFillers];
  const stampStatus = summary.stamp.status;
  const hasResults = summary.orderCount > 0;

  return (
    <div className="mt-5 space-y-5">
      <div className="rounded-2xl border border-brand-muted/40 bg-white p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-brand-dark">Supplier order summary</h2>
            <p className="mt-1 text-sm text-brand-brown/70">
              Pick the pickup dates, copy, then tap{' '}
              <span className="font-semibold">Already ordered these</span> to stamp that range{' '}
              <span className="font-semibold">DONE</span>. Those days stay void even if you open a
              wider range. <span className="font-semibold">Redo</span> unstamps only the dates you
              are looking at.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-brand-brown/60">
                From
              </span>
              <input
                type="date"
                value={dateFrom}
                onChange={(event) => setDateFrom(event.target.value)}
                className="flower-input"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-brand-brown/60">
                To
              </span>
              <input
                type="date"
                value={dateTo}
                onChange={(event) => setDateTo(event.target.value)}
                className="flower-input"
              />
            </label>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-3 border-t border-brand-muted/30 pt-4">
          <label className="text-sm">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-brand-brown/60">
              Flower round-up
            </span>
            <select
              value={roundSettings.flowerRoundStep}
              onChange={(event) =>
                setRoundSettings((current) => ({
                  ...current,
                  flowerRoundStep: Number(event.target.value),
                }))
              }
              className="flower-input min-w-[120px]"
            >
              {SUPPLIER_ROUND_STEP_OPTIONS.map((step) => (
                <option key={step} value={step}>
                  {step === 1 ? 'Exact qty' : `Nearest ${step} stems`}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-brand-brown/60">
              Filler / misc round-up
            </span>
            <select
              value={roundSettings.miscRoundStep}
              onChange={(event) =>
                setRoundSettings((current) => ({
                  ...current,
                  miscRoundStep: Number(event.target.value),
                }))
              }
              className="flower-input min-w-[120px]"
            >
              {SUPPLIER_ROUND_STEP_OPTIONS.map((step) => (
                <option key={`misc-${step}`} value={step}>
                  {step === 1 ? 'Exact qty' : `Nearest ${step}`}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => void handleCopy()} className="flower-btn-primary">
            <ClipboardCopy className="mr-1.5 inline h-4 w-4" />
            Copy for supplier
          </button>
          {stampStatus === 'done' ? (
            <span className="inline-flex min-h-[44px] items-center rounded-xl border border-brand-muted bg-brand-beige/50 px-4 text-sm font-semibold uppercase tracking-[0.16em] text-brand-brown">
              Done
            </span>
          ) : (
            <button type="button" onClick={stampCurrentRange} className="flower-btn-secondary">
              Already ordered these
            </button>
          )}
          {stampStatus !== 'open' ? (
            <button type="button" onClick={redoCurrentRange} className="flower-btn-secondary">
              Redo
            </button>
          ) : null}
          <button
            type="button"
            onClick={resetAllOverrides}
            className="flower-btn-secondary inline-flex items-center gap-1.5"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset edits
          </button>
          {copyMessage ? <span className="text-sm text-emerald-700">{copyMessage}</span> : null}
          {loading ? <span className="text-sm text-brand-brown/55">Loading orders…</span> : null}
        </div>

        {loadError ? <p className="mt-3 text-sm text-red-700">{loadError}</p> : null}

        {!loading && !loadError ? (
          <p className="mt-3 text-sm text-brand-brown/70">
            {formatSupplierSummaryDateRange(dateFrom, dateTo)}
            {stampStatus === 'done'
              ? ' · DONE — this pickup range is already stamped'
              : stampStatus === 'partial'
                ? ` · ${formatStampedDaysLabel(summary.stamp.stampedKeys)} already DONE · showing ${
                    summary.orderCount
                  } remaining order${summary.orderCount === 1 ? '' : 's'}`
                : ` · ${summary.orderCount} reserved order${summary.orderCount === 1 ? '' : 's'} · all branches`}
          </p>
        ) : null}
      </div>

      {!loading && stampStatus !== 'done' && summary.visibleOrders.length > 0 ? (
        <details className="group rounded-2xl border border-brand-muted/40 bg-white p-4 sm:p-5">
          <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-brand-dark">
                  {stampStatus === 'partial' ? 'Still to order' : 'Orders in this range'}
                  <span className="ml-2 text-sm font-normal text-brand-brown/60">
                    {summary.visibleOrders.length}
                  </span>
                </h3>
                <p className="mt-0.5 text-sm text-brand-brown/70">
                  Tap to check which customer orders are in this copy. Collapsed so it stays short.
                </p>
              </div>
              <ChevronDown className="mt-1 h-4 w-4 shrink-0 text-brand-brown/55 transition group-open:rotate-180" />
            </div>
          </summary>
          <ul className="mt-3 divide-y divide-brand-muted/30">
            {summary.visibleOrders.map((order) => (
              <li key={order.id} className="py-2.5 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-semibold text-brand-dark">{order.receiver}</p>
                  <p className="text-xs text-brand-brown/65">
                    Input {formatOrderInputTimestamp(order.created_at)}
                    {order.created_by_name ? ` · ${order.created_by_name}` : ''}
                  </p>
                </div>
                <p className="mt-0.5 text-xs text-brand-brown/65">
                  {order.branch_name} · pickup {formatPickupDateTimeLocal(order.scheduled_for)}
                </p>
                <p className="mt-1 truncate text-sm text-brand-dark" title={summarizeFlowerLines(order.items)}>
                  {summarizeFlowerLines(order.items, 3)}
                </p>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {!loading && !hasResults && !loadError ? (
        <div className="rounded-2xl border border-dashed border-brand-muted/50 bg-brand-beige/20 px-4 py-10 text-center">
          {stampStatus === 'done' ? (
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-brown">Done</p>
              <p className="mt-2 text-sm text-brand-brown/70">
                {formatSupplierSummaryDateRange(dateFrom, dateTo)} is already stamped. Redo to
                unstamp these dates.
              </p>
            </div>
          ) : (
            <p className="text-sm text-brand-brown/70">
              No reserved orders in this date range. Try widening the dates or check that orders are
              not cancelled.
            </p>
          )}
        </div>
      ) : null}

      {hasResults ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {summary.branches.map((branch) => (
            <section
              key={branch.branchId}
              className="rounded-2xl border border-brand-muted/40 bg-white p-4 sm:p-5"
            >
              <h3 className="text-base font-semibold text-brand-dark">{branch.branchName}</h3>
              <p className="mt-0.5 text-xs text-brand-brown/60">
                {stampStatus === 'partial' ? 'Unstamped days only' : 'Exact reserved totals'}
              </p>

              {branch.flowers.length > 0 ? (
                <div className="mt-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-brand-brown/55">
                    Flowers
                  </p>
                  <SummaryLineList lines={branch.flowers} emptyLabel="No flowers." />
                </div>
              ) : null}

              {branch.fillers.length > 0 ? (
                <div className="mt-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-brand-brown/55">
                    Fillers & misc
                  </p>
                  <SummaryLineList lines={branch.fillers} emptyLabel="No fillers." />
                </div>
              ) : null}

              {branch.flowers.length === 0 && branch.fillers.length === 0 ? (
                <p className="mt-3 text-sm text-brand-brown/55">No line items for this branch.</p>
              ) : null}
            </section>
          ))}
        </div>
      ) : null}

      {hasResults ? (
        <section className="rounded-2xl border border-brand-muted/50 bg-brand-beige/25 p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-brand-dark">To order (all branches)</h3>
              <p className="mt-0.5 text-sm text-brand-brown/65">
                {stampStatus === 'partial'
                  ? 'Only unstamped pickup days — flowers, fillers, and misc.'
                  : 'Rounded totals — edit any quantity before copying to your supplier.'}
              </p>
            </div>
          </div>

          {grandTotalLines.length === 0 ? (
            <p className="mt-4 text-sm text-brand-brown/55">No items to order.</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {grandTotalLines.map((line) => (
                <EditableOrderLine
                  key={line.key}
                  line={line}
                  orderQty={orderQuantities.get(line.key) ?? line.suggestedOrderQty}
                  onChange={(value) =>
                    setOrderOverrides((current) => ({
                      ...current,
                      [line.key]: value,
                    }))
                  }
                  onReset={() =>
                    setOrderOverrides((current) => {
                      const next = { ...current };
                      delete next[line.key];
                      return next;
                    })
                  }
                />
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  );
}
