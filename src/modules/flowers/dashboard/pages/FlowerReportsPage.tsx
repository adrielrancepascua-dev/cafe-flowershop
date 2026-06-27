import { useEffect, useState } from 'react';
import { listFlowerBranches } from '../../../../services/flowers/inventory';
import { getFlowerDayCloseStatus } from '../../../../services/flowers/orders';
import { canStaffAccessReports, getFlowerReports } from '../../../../services/flowers/reports';
import { createFlowerSupplierCost } from '../../../../services/flowers/expenses/flowers-expenses.service';
import { useFlowerAuth } from '../../../../lib/auth/FlowerAuthContext';
import type { FlowerReportsData } from '../../shared/types/flower-report';
import type { FlowerBranchOption } from '../../shared/types/flower-inventory';
import FlowerPageHeader from '../../shared/components/FlowerPageHeader';
import { PRICE_FORMATTER, toDateKey } from '../../shared/utils/flower-format';
import { RequireFlowerAdmin } from '../components/RequireFlowerAuth';

function formatReportDateLabel(dateKey: string): string {
  return new Date(`${dateKey}T12:00:00`).toLocaleDateString('en-PH', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function emptyReports(): FlowerReportsData {
  return {
    daily_summary: [],
    monthly_summary: [],
    advance_orders: [],
    financial: {
      total_sales: 0,
      staff_expenses: 0,
      supplier_costs: 0,
      net_income: 0,
    },
  };
}

export default function FlowerReportsPage() {
  const { user, isAdmin } = useFlowerAuth();
  const [reportsData, setReportsData] = useState<FlowerReportsData>(emptyReports());
  const [branches, setBranches] = useState<FlowerBranchOption[]>([]);
  const [branchFilter, setBranchFilter] = useState('all');
  const [reportDate, setReportDate] = useState(toDateKey(new Date()));
  const [loading, setLoading] = useState(true);
  const [blockedMessage, setBlockedMessage] = useState('');
  const [supplierAmount, setSupplierAmount] = useState('');
  const [supplierDescription, setSupplierDescription] = useState('');
  const [supplierBranchId, setSupplierBranchId] = useState('');

  const staffReportDate = toDateKey(new Date());
  const effectiveReportDate = isAdmin ? reportDate : staffReportDate;

  async function loadReports() {
    if (!user) {
      return;
    }

    setLoading(true);
    setBlockedMessage('');

    try {
      if (!isAdmin) {
        const allowed = await canStaffAccessReports(effectiveReportDate);
        if (!allowed) {
          const closeStatus = await getFlowerDayCloseStatus(effectiveReportDate);
          setBlockedMessage(
            closeStatus.total_orders === 0
              ? `Reports unlock after today (${formatReportDateLabel(effectiveReportDate)}) once orders are scheduled and all are marked picked up, delivered, or completed.`
              : `Reports locked — ${closeStatus.open_orders} order(s) still open for today. Mark all as picked up/delivered/completed first.`,
          );
          setReportsData(emptyReports());
          return;
        }
      }

      const data = await getFlowerReports({
        branchId: branchFilter === 'all' ? undefined : branchFilter,
        reportDate: effectiveReportDate,
        dailyDays: isAdmin ? undefined : 1,
        monthlyMonths: isAdmin ? undefined : 0,
        advanceLimit: isAdmin ? undefined : 0,
      });
      setReportsData(data);
    } catch (error) {
      setBlockedMessage(error instanceof Error ? error.message : 'Failed to load reports.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void listFlowerBranches().then((items) => {
      setBranches(items);
      if (items[0]) {
        setSupplierBranchId(items[0].id);
      }
    });
  }, []);

  useEffect(() => {
    void loadReports();
  }, [branchFilter, effectiveReportDate, user, isAdmin]);

  async function handleSupplierCost(event: React.FormEvent) {
    event.preventDefault();
    if (!user) {
      return;
    }

    const amount = Number(supplierAmount);
    if (!Number.isFinite(amount) || amount <= 0 || !supplierDescription.trim() || !supplierBranchId) {
      return;
    }

    await createFlowerSupplierCost({
      branch_id: supplierBranchId,
      amount,
      description: supplierDescription,
      cost_date: effectiveReportDate,
      created_by_id: user.id,
      created_by_name: user.display_name,
    });

    setSupplierAmount('');
    setSupplierDescription('');
    await loadReports();
  }

  return (
    <div className="animate-fade-in">
      <FlowerPageHeader
        label="Sales & Finance"
        title="Reports"
        description={
          isAdmin
            ? 'Net income = total sales − staff expenses − supplier costs. Pick any date to review history.'
            : `Today's totals only. Unlocks after all orders for ${formatReportDateLabel(staffReportDate)} are closed.`
        }
      />

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {isAdmin ? (
          <input
            type="date"
            value={reportDate}
            onChange={(e) => setReportDate(e.target.value)}
            className="flower-input max-w-[180px]"
          />
        ) : (
          <p className="rounded-xl border border-brand-muted/40 bg-brand-cream/30 px-3 py-2 text-sm font-medium text-brand-dark">
            {formatReportDateLabel(staffReportDate)}
          </p>
        )}
        <select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)} className="flower-input max-w-[180px]">
          <option value="all">All branches</option>
          {branches.map((branch) => (
            <option key={branch.id} value={branch.id}>{branch.name}</option>
          ))}
        </select>
      </div>

      {blockedMessage ? (
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {blockedMessage}
        </p>
      ) : null}

      {loading ? (
        <p className="mt-6 text-sm text-brand-brown/60">Loading reports...</p>
      ) : !blockedMessage ? (
        <>
          <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MetricCard label="Total sales" value={PRICE_FORMATTER.format(reportsData.financial.total_sales)} />
            <MetricCard label="Staff expenses" value={PRICE_FORMATTER.format(reportsData.financial.staff_expenses)} />
            <MetricCard label="Supplier costs" value={PRICE_FORMATTER.format(reportsData.financial.supplier_costs)} />
            <MetricCard label="Net income" value={PRICE_FORMATTER.format(reportsData.financial.net_income)} accent />
          </div>

          <RequireFlowerAdmin>
            <form onSubmit={handleSupplierCost} className="mt-6 rounded-2xl border border-brand-muted/40 bg-brand-cream/20 p-4">
              <h3 className="text-sm font-semibold text-brand-dark">Log supplier cost (admin)</h3>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-4">
                <select value={supplierBranchId} onChange={(e) => setSupplierBranchId(e.target.value)} className="flower-input" required>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>{branch.name}</option>
                  ))}
                </select>
                <input type="number" min="0" step="0.01" value={supplierAmount} onChange={(e) => setSupplierAmount(e.target.value)} placeholder="Amount" className="flower-input" required />
                <input type="text" value={supplierDescription} onChange={(e) => setSupplierDescription(e.target.value)} placeholder="Description" className="flower-input" required />
                <button type="submit" className="flower-btn-primary">Add supplier cost</button>
              </div>
            </form>
          </RequireFlowerAdmin>

          {isAdmin ? (
            <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
              <section className="rounded-2xl border border-brand-muted/40 p-4">
                <h3 className="text-sm font-semibold text-brand-dark">Daily summary</h3>
                <ul className="mt-2 space-y-1 text-sm">
                  {reportsData.daily_summary.map((row) => (
                    <li key={row.date} className="flex justify-between">
                      <span>{row.date}</span>
                      <span>{row.order_count} orders · {PRICE_FORMATTER.format(row.sales_total)}</span>
                    </li>
                  ))}
                </ul>
              </section>
              <section className="rounded-2xl border border-brand-muted/40 p-4">
                <h3 className="text-sm font-semibold text-brand-dark">Monthly summary</h3>
                <ul className="mt-2 space-y-1 text-sm">
                  {reportsData.monthly_summary.map((row) => (
                    <li key={row.month} className="flex justify-between">
                      <span>{row.month}</span>
                      <span>{row.order_count} orders · {PRICE_FORMATTER.format(row.sales_total)}</span>
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function MetricCard({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 ${accent ? 'border-brand-brown bg-brand-brown text-white' : 'border-brand-muted/40 bg-white'}`}>
      <p className={`text-xs font-semibold uppercase tracking-wide ${accent ? 'text-white/80' : 'text-brand-brown/60'}`}>{label}</p>
      <p className="mt-2 font-serif text-xl font-semibold">{value}</p>
    </div>
  );
}
