import { useEffect, useState } from 'react';
import { Printer } from 'lucide-react';
import { getFlowerPrintableInventoryStockReport } from '../../../../services/flowers/inventory/flowers-inventory-print.service';
import type {
  FlowerInventoryStockPrintLayout,
  FlowerPrintableInventoryStockReport,
} from '../../shared/types/flower-inventory';

type FlowerPrintableInventoryStockPanelProps = {
  branchId?: string;
  branchLabel: string;
  disabled?: boolean;
};

function formatGeneratedAt(iso: string): string {
  return new Date(iso).toLocaleString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function handlePrintStock() {
  document.body.setAttribute('data-flower-print', 'inventory-stock');
  window.print();
  document.body.removeAttribute('data-flower-print');
}

export default function FlowerPrintableInventoryStockPanel({
  branchId,
  branchLabel,
  disabled = false,
}: FlowerPrintableInventoryStockPanelProps) {
  const isAllBranches = !branchId;
  const [layout, setLayout] = useState<FlowerInventoryStockPrintLayout>(
    isAllBranches ? 'by_branch' : 'by_branch',
  );
  const [report, setReport] = useState<FlowerPrintableInventoryStockReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (disabled) {
      setReport(null);
      return;
    }

    setLoading(true);
    setErrorMessage('');

    void getFlowerPrintableInventoryStockReport({
      branchId,
      layout: isAllBranches ? layout : 'by_branch',
      branchLabel,
    })
      .then(setReport)
      .catch((error) => {
        setReport(null);
        setErrorMessage(error instanceof Error ? error.message : 'Failed to load stock report.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [branchId, branchLabel, disabled, isAllBranches, layout]);

  return (
    <>
      <section className="mt-6 print:hidden">
        <div className="rounded-2xl border border-brand-muted/40 bg-brand-cream/20 p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-brand-dark">Printable stock report</h3>
              <p className="mt-1 text-sm text-brand-brown/70">
                {isAllBranches
                  ? 'Print combined totals or a separate section for each branch.'
                  : `Print on-hand stock for ${branchLabel}.`}
              </p>
            </div>
            <button
              type="button"
              onClick={handlePrintStock}
              disabled={disabled || loading || !report}
              className="flower-btn-primary inline-flex gap-2"
            >
              <Printer className="h-4 w-4" />
              Print stock
            </button>
          </div>

          {isAllBranches ? (
            <div className="mt-4 inline-flex rounded-xl border border-brand-muted/50 bg-white p-1">
              <button
                type="button"
                onClick={() => setLayout('by_branch')}
                className={`flower-pill ${layout === 'by_branch' ? 'flower-pill-active' : 'flower-pill-inactive'}`}
              >
                Each branch
              </button>
              <button
                type="button"
                onClick={() => setLayout('combined')}
                className={`flower-pill ${layout === 'combined' ? 'flower-pill-active' : 'flower-pill-inactive'}`}
              >
                Combined totals
              </button>
            </div>
          ) : null}

          {errorMessage ? (
            <p className="mt-3 text-sm text-red-700">{errorMessage}</p>
          ) : loading ? (
            <p className="mt-3 text-sm text-brand-brown/60">Preparing stock report...</p>
          ) : null}
        </div>
      </section>

      {report ? <FlowerPrintableInventoryStockDocument report={report} /> : null}
    </>
  );
}

export function FlowerPrintableInventoryStockDocument({
  report,
}: {
  report: FlowerPrintableInventoryStockReport;
}) {
  return (
    <article
      id="flower-printable-inventory-stock"
      className="flower-printable-inventory-report mt-4 max-w-full overflow-hidden rounded-2xl border border-brand-muted/40 bg-white p-4 sm:p-6 print:mt-0 print:overflow-visible print:rounded-none print:border-0 print:p-0 print:shadow-none"
    >
      <header className="border-b border-brand-muted/40 pb-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-accent">
          Papers &amp; Petals
        </p>
        <h2 className="mt-1 font-serif text-xl font-semibold text-brand-dark sm:text-2xl">Inventory Stock</h2>
        <p className="mt-2 text-sm text-brand-brown">{report.branch_label}</p>
        <p className="mt-1 break-words text-xs text-brand-brown/60">
          {report.total_units} units on hand · Generated {formatGeneratedAt(report.generated_at)}
        </p>
      </header>

      {report.sections.map((section) => (
        <section key={section.branch_id} className="mt-6 break-inside-avoid">
          {report.sections.length > 1 || report.layout === 'by_branch' ? (
            <h3 className="font-serif text-lg font-semibold text-brand-dark">
              {section.branch_name}
              <span className="ml-2 text-sm font-normal text-brand-brown/70">
                ({section.total_units} units)
              </span>
            </h3>
          ) : null}

          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[320px] border-collapse text-sm print:min-w-0">
              <thead>
                <tr className="border-b border-brand-muted/50 text-left text-xs uppercase tracking-wide text-brand-brown/70">
                  <th className="py-2 pr-3">Flower</th>
                  <th className="py-2 text-right">On hand</th>
                </tr>
              </thead>
              <tbody>
                {section.rows.map((row) => (
                  <tr key={`${section.branch_id}-${row.product_name}`} className="border-b border-brand-muted/20">
                    <td className="py-2 pr-3">{row.product_name}</td>
                    <td className="py-2 text-right font-medium">{row.on_hand}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-brand-brown/30 font-semibold text-brand-dark">
                  <td className="py-2.5 pr-3">Section total</td>
                  <td className="py-2.5 text-right">{section.total_units}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      ))}

      {report.sections.length > 1 ? (
        <p className="mt-6 border-t border-brand-muted/40 pt-4 text-sm font-semibold text-brand-dark">
          Grand total: {report.total_units} units
        </p>
      ) : null}
    </article>
  );
}
