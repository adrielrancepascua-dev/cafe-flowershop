import { useEffect, useState } from 'react';
import { Printer } from 'lucide-react';
import { getFlowerPrintableInventoryMovementsReport } from '../../../../services/flowers/inventory/flowers-inventory-print.service';
import type { FlowerPrintableInventoryMovementsReport } from '../../shared/types/flower-inventory';
import type { FlowerSalesReportPeriod } from '../../shared/types/flower-report';
import { INVENTORY_MOVEMENT_TYPE_LABELS, toDateKey } from '../../shared/utils/flower-format';

type FlowerPrintableInventoryMovementsPanelProps = {
  branchId?: string;
  branchLabel: string;
  disabled?: boolean;
  expanded: boolean;
};

const PERIOD_OPTIONS: Array<{ value: FlowerSalesReportPeriod; label: string }> = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
];

function formatGeneratedAt(iso: string): string {
  return new Date(iso).toLocaleString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatMovementTimestamp(iso: string): string {
  return new Date(iso).toLocaleString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function handlePrintMovements() {
  document.body.setAttribute('data-flower-print', 'inventory-movements');
  window.print();
  document.body.removeAttribute('data-flower-print');
}

export default function FlowerPrintableInventoryMovementsPanel({
  branchId,
  branchLabel,
  disabled = false,
  expanded,
}: FlowerPrintableInventoryMovementsPanelProps) {
  const [anchorDate, setAnchorDate] = useState(() => toDateKey(new Date()));
  const [period, setPeriod] = useState<FlowerSalesReportPeriod>('day');
  const [report, setReport] = useState<FlowerPrintableInventoryMovementsReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (disabled || !expanded) {
      setReport(null);
      return;
    }

    setLoading(true);
    setErrorMessage('');

    void getFlowerPrintableInventoryMovementsReport({
      anchorDate,
      period,
      branchId,
      branchLabel,
    })
      .then(setReport)
      .catch((error) => {
        setReport(null);
        setErrorMessage(error instanceof Error ? error.message : 'Failed to load movement report.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [anchorDate, branchId, branchLabel, disabled, expanded, period]);

  if (!expanded) {
    return null;
  }

  return (
    <>
      <section className="mt-4 print:hidden">
        <div className="rounded-2xl border border-brand-muted/40 bg-brand-cream/20 p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-brand-dark">Movement report</h3>
              <p className="mt-1 text-sm text-brand-brown/70">
                All stock movements for {branchLabel}. Choose day, week, or month.
              </p>
            </div>
            <button
              type="button"
              onClick={handlePrintMovements}
              disabled={disabled || loading || !report}
              className="flower-btn-primary inline-flex gap-2"
            >
              <Printer className="h-4 w-4" />
              Print movements
            </button>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={anchorDate}
              onChange={(event) => setAnchorDate(event.target.value)}
              className="flower-input max-w-[180px]"
            />
            <div className="inline-flex rounded-xl border border-brand-muted/50 bg-white p-1">
              {PERIOD_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setPeriod(option.value)}
                  className={`flower-pill ${period === option.value ? 'flower-pill-active' : 'flower-pill-inactive'}`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {errorMessage ? (
            <p className="mt-3 text-sm text-red-700">{errorMessage}</p>
          ) : loading ? (
            <p className="mt-3 text-sm text-brand-brown/60">Loading movements...</p>
          ) : report ? (
            <p className="mt-3 text-sm text-brand-brown/70">
              {report.movements.length} movement{report.movements.length === 1 ? '' : 's'} in this period.
            </p>
          ) : null}
        </div>
      </section>

      {report ? <FlowerPrintableInventoryMovementsDocument report={report} /> : null}
    </>
  );
}

export function FlowerPrintableInventoryMovementsDocument({
  report,
}: {
  report: FlowerPrintableInventoryMovementsReport;
}) {
  return (
    <article
      id="flower-printable-inventory-movements"
      className="flower-printable-inventory-report mt-4 max-w-full overflow-hidden rounded-2xl border border-brand-muted/40 bg-white p-4 sm:p-6 print:mt-0 print:overflow-visible print:rounded-none print:border-0 print:p-0 print:shadow-none"
    >
      <header className="border-b border-brand-muted/40 pb-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-accent">
          Papers &amp; Petals
        </p>
        <h2 className="mt-1 font-serif text-xl font-semibold text-brand-dark sm:text-2xl">
          Inventory Movements
        </h2>
        <p className="mt-2 text-sm text-brand-brown">{report.period_label}</p>
        <p className="mt-1 text-sm text-brand-brown/80">{report.branch_label}</p>
        <p className="mt-1 break-words text-xs text-brand-brown/60">
          Period: {report.from_date} to {report.to_date} · {report.movements.length} records · Generated{' '}
          {formatGeneratedAt(report.generated_at)}
        </p>
      </header>

      {report.movements.length === 0 ? (
        <p className="mt-6 text-sm text-brand-brown/70">No movements recorded for this period.</p>
      ) : (
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm print:min-w-0">
            <thead>
              <tr className="border-b border-brand-muted/50 text-left text-xs uppercase tracking-wide text-brand-brown/70">
                <th className="py-2 pr-3">Date</th>
                <th className="py-2 pr-3">Branch</th>
                <th className="py-2 pr-3">Flower</th>
                <th className="py-2 pr-3">Type</th>
                <th className="py-2 pr-3 text-right">Qty</th>
                <th className="py-2 pr-3 text-right">Before</th>
                <th className="py-2 pr-3 text-right">After</th>
                <th className="py-2">Note</th>
              </tr>
            </thead>
            <tbody>
              {report.movements.map((movement) => (
                <tr key={movement.id} className="border-b border-brand-muted/20">
                  <td className="py-2 pr-3 whitespace-nowrap">{formatMovementTimestamp(movement.created_at)}</td>
                  <td className="py-2 pr-3">{movement.branch_name}</td>
                  <td className="py-2 pr-3">{movement.product_name}</td>
                  <td className="py-2 pr-3">
                    {INVENTORY_MOVEMENT_TYPE_LABELS[movement.movement_type] ?? movement.movement_type}
                  </td>
                  <td className="py-2 pr-3 text-right">{movement.quantity}</td>
                  <td className="py-2 pr-3 text-right">{movement.previous_on_hand}</td>
                  <td className="py-2 pr-3 text-right">{movement.new_on_hand}</td>
                  <td className="py-2 max-w-[12rem] break-words">{movement.note || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </article>
  );
}
