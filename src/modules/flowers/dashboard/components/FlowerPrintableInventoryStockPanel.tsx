import { useEffect, useState } from 'react';
import { Printer } from 'lucide-react';
import { getFlowerPrintableInventoryStockReport } from '../../../../services/flowers/inventory/flowers-inventory-print.service';
import type { FlowerPrintableInventoryStockReport } from '../../shared/types/flower-inventory';

type FlowerInventoryStockPrintProps = {
  branchId: string;
  branchLabel: string;
  disabled?: boolean;
  controlsOnly?: boolean;
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
  window.print();
}

export default function FlowerInventoryStockPrint({
  branchId,
  branchLabel,
  disabled = false,
  controlsOnly = false,
}: FlowerInventoryStockPrintProps) {
  const [report, setReport] = useState<FlowerPrintableInventoryStockReport | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (disabled) {
      setReport(null);
      return;
    }

    setLoading(true);

    void getFlowerPrintableInventoryStockReport({
      branchId,
      layout: 'by_branch',
      branchLabel,
    })
      .then(setReport)
      .catch(() => {
        setReport(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [branchId, branchLabel, disabled]);

  return (
    <>
      {!controlsOnly ? (
        <div className="mt-4 flex flex-wrap items-center justify-end gap-2 print:hidden">
          <button
            type="button"
            onClick={handlePrintStock}
            disabled={disabled || loading || !report}
            className="flower-btn-secondary inline-flex gap-2 text-sm"
          >
            <Printer className="h-4 w-4" />
            Print stock
          </button>
        </div>
      ) : null}

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
      className="flower-printable-inventory-report hidden max-w-full overflow-hidden rounded-2xl border border-brand-muted/40 bg-white p-4 sm:p-6 print:block print:mt-0 print:overflow-visible print:rounded-none print:border-0 print:p-0 print:shadow-none"
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
                  <td className="py-2.5 pr-3">Total</td>
                  <td className="py-2.5 text-right">{section.total_units}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      ))}
    </article>
  );
}
