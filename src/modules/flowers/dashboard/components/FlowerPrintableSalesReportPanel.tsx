import { useEffect, useState } from 'react';
import { Printer } from 'lucide-react';
import { getFlowerPrintableSalesReport } from '../../../../services/flowers/reports';
import type {
  FlowerPrintableSalesReport,
  FlowerSalesReportPeriod,
} from '../../shared/types/flower-report';
import { ORDER_STATUS_LABELS, PRICE_FORMATTER } from '../../shared/utils/flower-format';

type FlowerPrintableSalesReportPanelProps = {
  anchorDate: string;
  isAdmin: boolean;
  disabled?: boolean;
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

export default function FlowerPrintableSalesReportPanel({
  anchorDate,
  isAdmin,
  disabled = false,
}: FlowerPrintableSalesReportPanelProps) {
  const [period, setPeriod] = useState<FlowerSalesReportPeriod>('day');
  const [report, setReport] = useState<FlowerPrintableSalesReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const effectivePeriod = isAdmin ? period : 'day';

  useEffect(() => {
    if (disabled) {
      setReport(null);
      return;
    }

    setLoading(true);
    setErrorMessage('');

    void getFlowerPrintableSalesReport({
      anchorDate,
      period: effectivePeriod,
    })
      .then(setReport)
      .catch((error) => {
        setReport(null);
        setErrorMessage(error instanceof Error ? error.message : 'Failed to load printable report.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [anchorDate, disabled, effectivePeriod]);

  function handlePrint() {
    window.print();
  }

  return (
    <>
      <section className="mt-6 print:hidden">
        <div className="rounded-2xl border border-brand-muted/40 bg-brand-cream/20 p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-brand-dark">Printable sales report</h3>
              <p className="mt-1 text-sm text-brand-brown/70">
                Branch breakdown with order details. Choose day, week, or month{isAdmin ? '' : ' (today only)'}.
              </p>
            </div>
            <button
              type="button"
              onClick={handlePrint}
              disabled={disabled || loading || !report}
              className="flower-btn-primary inline-flex gap-2"
            >
              <Printer className="h-4 w-4" />
              Print report
            </button>
          </div>

          {isAdmin ? (
            <div className="mt-4 inline-flex rounded-xl border border-brand-muted/50 bg-white p-1">
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
          ) : null}

          {errorMessage ? (
            <p className="mt-3 text-sm text-red-700">{errorMessage}</p>
          ) : loading ? (
            <p className="mt-3 text-sm text-brand-brown/60">Preparing report...</p>
          ) : null}
        </div>
      </section>

      {report ? <FlowerPrintableSalesReportDocument report={report} /> : null}
    </>
  );
}

export function FlowerPrintableSalesReportDocument({
  report,
}: {
  report: FlowerPrintableSalesReport;
}) {
  return (
    <article
      id="flower-printable-sales-report"
      className="flower-printable-sales-report mt-4 rounded-2xl border border-brand-muted/40 bg-white p-5 sm:p-6 print:mt-0 print:rounded-none print:border-0 print:p-0 print:shadow-none"
    >
      <header className="border-b border-brand-muted/40 pb-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-accent">
          Papers &amp; Petals
        </p>
        <h2 className="mt-1 font-serif text-2xl font-semibold text-brand-dark">Sales Report</h2>
        <p className="mt-2 text-sm text-brand-brown">{report.period_label}</p>
        <p className="text-xs text-brand-brown/60">
          Period: {report.from_date} to {report.to_date} · Generated {formatGeneratedAt(report.generated_at)}
        </p>
      </header>

      <table className="mt-5 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-brand-muted/50 text-left text-xs uppercase tracking-wide text-brand-brown/70">
            <th className="py-2 pr-3">Branch</th>
            <th className="py-2 pr-3 text-right">Orders</th>
            <th className="py-2 pr-3 text-right">Sales</th>
            <th className="py-2 pr-3 text-right">Staff exp.</th>
            <th className="py-2 pr-3 text-right">Supplier</th>
            <th className="py-2 text-right">Net income</th>
          </tr>
        </thead>
        <tbody>
          {report.branches.map((branch) => (
            <tr key={branch.branch_id} className="border-b border-brand-muted/30">
              <td className="py-2.5 pr-3 font-medium text-brand-dark">{branch.branch_name}</td>
              <td className="py-2.5 pr-3 text-right">{branch.order_count}</td>
              <td className="py-2.5 pr-3 text-right">{PRICE_FORMATTER.format(branch.sales_total)}</td>
              <td className="py-2.5 pr-3 text-right">{PRICE_FORMATTER.format(branch.staff_expenses)}</td>
              <td className="py-2.5 pr-3 text-right">{PRICE_FORMATTER.format(branch.supplier_costs)}</td>
              <td className="py-2.5 text-right font-semibold">{PRICE_FORMATTER.format(branch.net_income)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-brand-brown/30 font-semibold text-brand-dark">
            <td className="py-3 pr-3">All branches</td>
            <td className="py-3 pr-3 text-right">{report.totals.order_count}</td>
            <td className="py-3 pr-3 text-right">{PRICE_FORMATTER.format(report.totals.sales_total)}</td>
            <td className="py-3 pr-3 text-right">{PRICE_FORMATTER.format(report.totals.staff_expenses)}</td>
            <td className="py-3 pr-3 text-right">{PRICE_FORMATTER.format(report.totals.supplier_costs)}</td>
            <td className="py-3 text-right">{PRICE_FORMATTER.format(report.totals.net_income)}</td>
          </tr>
        </tfoot>
      </table>

      {report.branches.map((branch) =>
        branch.orders.length > 0 ? (
          <section key={`${branch.branch_id}-orders`} className="mt-6 break-inside-avoid">
            <h3 className="font-serif text-lg font-semibold text-brand-dark">{branch.branch_name}</h3>
            <table className="mt-2 w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-brand-muted/50 text-left text-xs uppercase tracking-wide text-brand-brown/70">
                  <th className="py-2 pr-3">Pickup</th>
                  <th className="py-2 pr-3">Receiver</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {branch.orders.map((order) => (
                  <tr key={order.order_id} className="border-b border-brand-muted/20">
                    <td className="py-2 pr-3">{order.pickup_date}</td>
                    <td className="py-2 pr-3">{order.receiver}</td>
                    <td className="py-2 pr-3">{ORDER_STATUS_LABELS[order.status] ?? order.status}</td>
                    <td className="py-2 text-right">{PRICE_FORMATTER.format(order.total_amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : null,
      )}
    </article>
  );
}
