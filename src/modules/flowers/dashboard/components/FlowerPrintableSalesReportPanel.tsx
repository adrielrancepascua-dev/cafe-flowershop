import { useEffect, useState } from 'react';
import FlowerPrintControls from '../../shared/components/FlowerPrintControls';
import { getFlowerPrintableSalesReport } from '../../../../services/flowers/reports';
import type {
  FlowerPrintableSalesReport,
  FlowerSalesReportPeriod,
} from '../../shared/types/flower-report';
import { FlowerThermalSalesReportDocument } from '../../shared/components/FlowerThermalPrint';

type FlowerPrintableSalesReportPanelProps = {
  anchorDate: string;
  isAdmin: boolean;
  branchId?: string;
  disabled?: boolean;
};

const PERIOD_OPTIONS: Array<{ value: FlowerSalesReportPeriod; label: string }> = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
];

export default function FlowerPrintableSalesReportPanel({
  anchorDate,
  isAdmin,
  branchId,
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
      branchId,
      audience: isAdmin ? 'admin' : 'staff',
    })
      .then(setReport)
      .catch((error) => {
        setReport(null);
        setErrorMessage(error instanceof Error ? error.message : 'Failed to load printable report.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [anchorDate, branchId, disabled, effectivePeriod]);

  return (
    <>
      <section className="mt-6 print:hidden">
        <div className="rounded-2xl border border-brand-muted/40 bg-brand-cream/20 p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-brand-dark">Printable sales report</h3>
              <p className="mt-1 text-sm text-brand-brown/70">
                Coupon layout for orders, inventory, expenses, and reports. Choose day, week, or month
                {isAdmin ? '' : ' (today only)'} — tap <span className="font-medium">Size</span> to match your
                label paper.
              </p>
            </div>
            <FlowerPrintControls
              disabled={disabled || loading || !report}
              label="Print report"
            />
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

      {report ? (
        <FlowerThermalSalesReportDocument report={report} showProfitDetails={isAdmin} />
      ) : null}
    </>
  );
}
