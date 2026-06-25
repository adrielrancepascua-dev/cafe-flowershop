import { useEffect, useMemo, useState } from 'react';
import { listFlowerBranches } from '../../../../services/flowers/inventory';
import { getFlowerReports } from '../../../../services/flowers/reports';
import type { FlowerBranchOption } from '../../shared/types/flower-inventory';
import type { FlowerReportsData } from '../../shared/types/flower-report';

import DemoModeBanner from '../../shared/components/DemoModeBanner';
import FlowerPageHeader from '../../shared/components/FlowerPageHeader';

const PRICE_FORMATTER = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function emptyReportsData(): FlowerReportsData {
  return {
    daily_summary: [],
    monthly_summary: [],
    advance_orders: [],
  };
}

export default function FlowerReportsPage() {
  const [branches, setBranches] = useState<FlowerBranchOption[]>([]);
  const [branchFilter, setBranchFilter] = useState('all');
  const [reportsData, setReportsData] = useState<FlowerReportsData>(emptyReportsData());
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    void loadBranches();
  }, []);

  useEffect(() => {
    void loadReports();
  }, [branchFilter]);

  async function loadBranches() {
    try {
      const data = await listFlowerBranches();
      setBranches(data);
    } catch {
      // Non-blocking; reports can still load.
    }
  }

  async function loadReports() {
    try {
      setLoading(true);
      const data = await getFlowerReports({
        branchId: branchFilter === 'all' ? undefined : branchFilter,
        dailyDays: 14,
        monthlyMonths: 6,
        advanceLimit: 25,
      });

      setReportsData(data);
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to load flower reports.');
    } finally {
      setLoading(false);
    }
  }

  const dailySalesTotal = useMemo(
    () => reportsData.daily_summary.reduce((sum, row) => sum + row.sales_total, 0),
    [reportsData.daily_summary],
  );

  const monthlySalesTotal = useMemo(
    () => reportsData.monthly_summary.reduce((sum, row) => sum + row.sales_total, 0),
    [reportsData.monthly_summary],
  );

  return (
    <div className="animate-fade-in">
      <DemoModeBanner />

      <FlowerPageHeader
        label="Reports"
        title="Sales & Advance Orders"
        description="Daily and monthly sales summaries plus upcoming scheduled orders."
      />

      <div className="mt-6 rounded-2xl border border-brand-muted/40 bg-white p-4 sm:p-5">
        <label className="block max-w-sm text-sm font-medium text-brand-brown">
          Branch Filter
          <select
            value={branchFilter}
            onChange={(event) => setBranchFilter(event.target.value)}
            className="flower-input mt-1.5"
          >
            <option value="all">All Branches</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
        <div className="flower-card p-4 sm:p-5">
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-brand-accent">14-Day Sales</p>
          <p className="mt-2 font-serif text-2xl font-semibold text-brand-dark">{PRICE_FORMATTER.format(dailySalesTotal)}</p>
        </div>
        <div className="flower-card p-4 sm:p-5">
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-brand-accent">6-Month Sales</p>
          <p className="mt-2 font-serif text-2xl font-semibold text-brand-dark">{PRICE_FORMATTER.format(monthlySalesTotal)}</p>
        </div>
        <div className="flower-card p-4 sm:p-5">
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-brand-accent">Advance Orders</p>
          <p className="mt-2 font-serif text-2xl font-semibold text-brand-dark">{reportsData.advance_orders.length}</p>
        </div>
      </div>

      {errorMessage ? (
        <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{errorMessage}</p>
      ) : null}

      <div className="mt-8 overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3">
          <h3 className="text-sm font-semibold text-slate-900">Daily Sales Summary (Last 14 Days)</h3>
        </div>
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3 font-semibold">Date (UTC)</th>
              <th className="px-4 py-3 font-semibold">Order Count</th>
              <th className="px-4 py-3 font-semibold">Sales Total</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="px-4 py-4 text-slate-500" colSpan={3}>Loading daily summary...</td>
              </tr>
            ) : reportsData.daily_summary.length === 0 ? (
              <tr>
                <td className="px-4 py-4 text-slate-500" colSpan={3}>No daily summary data.</td>
              </tr>
            ) : (
              reportsData.daily_summary.map((row) => (
                <tr key={row.date} className="border-t border-slate-200">
                  <td className="px-4 py-3 text-slate-700">{row.date}</td>
                  <td className="px-4 py-3 text-slate-700">{row.order_count}</td>
                  <td className="px-4 py-3 font-semibold text-slate-900">{PRICE_FORMATTER.format(row.sales_total)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-8 overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3">
          <h3 className="text-sm font-semibold text-slate-900">Monthly Sales Summary (Last 6 Months)</h3>
        </div>
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3 font-semibold">Month (UTC)</th>
              <th className="px-4 py-3 font-semibold">Order Count</th>
              <th className="px-4 py-3 font-semibold">Sales Total</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="px-4 py-4 text-slate-500" colSpan={3}>Loading monthly summary...</td>
              </tr>
            ) : reportsData.monthly_summary.length === 0 ? (
              <tr>
                <td className="px-4 py-4 text-slate-500" colSpan={3}>No monthly summary data.</td>
              </tr>
            ) : (
              reportsData.monthly_summary.map((row) => (
                <tr key={row.month} className="border-t border-slate-200">
                  <td className="px-4 py-3 text-slate-700">{row.month}</td>
                  <td className="px-4 py-3 text-slate-700">{row.order_count}</td>
                  <td className="px-4 py-3 font-semibold text-slate-900">{PRICE_FORMATTER.format(row.sales_total)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-8 overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3">
          <h3 className="text-sm font-semibold text-slate-900">Advance Orders Overview (Upcoming)</h3>
        </div>
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3 font-semibold">Scheduled</th>
              <th className="px-4 py-3 font-semibold">Branch</th>
              <th className="px-4 py-3 font-semibold">Customer</th>
              <th className="px-4 py-3 font-semibold">Items</th>
              <th className="px-4 py-3 font-semibold">Total</th>
              <th className="px-4 py-3 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="px-4 py-4 text-slate-500" colSpan={6}>Loading advance orders...</td>
              </tr>
            ) : reportsData.advance_orders.length === 0 ? (
              <tr>
                <td className="px-4 py-4 text-slate-500" colSpan={6}>No upcoming advance orders.</td>
              </tr>
            ) : (
              reportsData.advance_orders.map((row) => (
                <tr key={row.order_id} className="border-t border-slate-200">
                  <td className="px-4 py-3 text-slate-700">
                    {new Date(row.scheduled_for).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{row.branch_name}</td>
                  <td className="px-4 py-3 text-slate-700">{row.customer_name || 'N/A'}</td>
                  <td className="px-4 py-3 text-slate-700">{row.item_count}</td>
                  <td className="px-4 py-3 font-semibold text-slate-900">{PRICE_FORMATTER.format(row.total_amount)}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700">
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
