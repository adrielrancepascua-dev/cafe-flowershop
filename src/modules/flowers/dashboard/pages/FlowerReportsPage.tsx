import { useEffect, useState } from 'react';
import { listFlowerBranches } from '../../../../services/flowers/inventory';
import { getFlowerDayCloseStatus } from '../../../../services/flowers/orders';
import { canStaffAccessReports, getFlowerReports } from '../../../../services/flowers/reports';
import {
  createFlowerSupplierCost,
  deleteFlowerSupplierCost,
  listFlowerSupplierCosts,
  updateFlowerSupplierCost,
} from '../../../../services/flowers/expenses/flowers-expenses.service';
import { useFlowerAuth } from '../../../../lib/auth/FlowerAuthContext';
import type { FlowerReportsData } from '../../shared/types/flower-report';
import type { FlowerBranchOption } from '../../shared/types/flower-inventory';
import type { FlowerSupplierCost } from '../../shared/types/flower-expense';
import FlowerPageHeader from '../../shared/components/FlowerPageHeader';
import FlowerMobileCardList from '../../shared/components/FlowerMobileCardList';
import FlowerPrintableSalesReportPanel from '../components/FlowerPrintableSalesReportPanel';
import { PRICE_FORMATTER, toDateKey } from '../../shared/utils/flower-format';

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
      staff_expenses_cash: 0,
      staff_expenses_gcash: 0,
      cash_on_hand: 0,
      supplier_costs: 0,
      cogs: 0,
      net_sales: 0,
      sales_by_payment: [],
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
  const [supplierCosts, setSupplierCosts] = useState<FlowerSupplierCost[]>([]);
  const [editingSupplierCostId, setEditingSupplierCostId] = useState<string | null>(null);
  const [supplierEditDraft, setSupplierEditDraft] = useState<{
    cost_date: string;
    branch_id: string;
    amount: string;
    description: string;
  } | null>(null);
  const [supplierMessage, setSupplierMessage] = useState('');
  const [supplierErrorMessage, setSupplierErrorMessage] = useState('');

  const staffReportDate = toDateKey(new Date());
  const effectiveReportDate = isAdmin ? reportDate : staffReportDate;
  const staffBranchId = !isAdmin ? user?.branch_id ?? null : null;
  const staffBranchName = !isAdmin ? user?.branch_name ?? null : null;
  const effectiveBranchFilter = isAdmin
    ? branchFilter === 'all'
      ? undefined
      : branchFilter
    : staffBranchId ?? undefined;

  async function loadSupplierCosts() {
    if (!isAdmin) {
      return;
    }

    setSupplierCosts(await listFlowerSupplierCosts());
  }

  async function loadReports() {
    if (!user) {
      return;
    }

    setLoading(true);
    setBlockedMessage('');

    try {
      if (!isAdmin) {
        if (!staffBranchId) {
          setBlockedMessage('Reports unlock after you finish first-time setup and choose your branch.');
          setReportsData(emptyReports());
          return;
        }

        const allowed = await canStaffAccessReports(effectiveReportDate, staffBranchId);
        if (!allowed) {
          const closeStatus = await getFlowerDayCloseStatus(effectiveReportDate, staffBranchId);
          const branchLabel = staffBranchName ? `${staffBranchName} branch` : 'your branch';
          setBlockedMessage(
            closeStatus.total_orders === 0
              ? `Reports unlock after today (${formatReportDateLabel(effectiveReportDate)}) once ${branchLabel} has scheduled orders and all are marked picked up or delivered.`
              : `Reports locked — ${closeStatus.open_orders} open order(s) left for ${branchLabel} today. Mark all as picked up or delivered first.`,
          );
          setReportsData(emptyReports());
          return;
        }
      }

      const data = await getFlowerReports({
        branchId: effectiveBranchFilter,
        reportDate: effectiveReportDate,
        dailyDays: isAdmin ? undefined : 1,
        monthlyMonths: isAdmin ? undefined : 0,
        advanceLimit: isAdmin ? undefined : 0,
        audience: isAdmin ? 'admin' : 'staff',
      });
      setReportsData(data);
      await loadSupplierCosts();
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
  }, [branchFilter, effectiveReportDate, user, isAdmin, staffBranchId]);

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
    setSupplierMessage('Supplier cost added.');
    setSupplierErrorMessage('');
    await loadReports();
  }

  function startEditingSupplierCost(cost: FlowerSupplierCost) {
    setEditingSupplierCostId(cost.id);
    setSupplierEditDraft({
      cost_date: cost.cost_date,
      branch_id: cost.branch_id,
      amount: String(cost.amount),
      description: cost.description,
    });
    setSupplierMessage('');
    setSupplierErrorMessage('');
  }

  function cancelEditingSupplierCost() {
    setEditingSupplierCostId(null);
    setSupplierEditDraft(null);
  }

  async function handleSaveSupplierCost(costId: string) {
    if (!supplierEditDraft) {
      return;
    }

    const amount = Number(supplierEditDraft.amount);
    if (!Number.isFinite(amount) || amount <= 0 || !supplierEditDraft.description.trim() || !supplierEditDraft.branch_id) {
      setSupplierErrorMessage('Enter a valid amount, description, and branch.');
      return;
    }

    try {
      await updateFlowerSupplierCost({
        id: costId,
        branch_id: supplierEditDraft.branch_id,
        amount,
        description: supplierEditDraft.description,
        cost_date: supplierEditDraft.cost_date,
      });
      cancelEditingSupplierCost();
      setSupplierMessage('Supplier cost updated.');
      setSupplierErrorMessage('');
      await loadReports();
    } catch (error) {
      setSupplierErrorMessage(error instanceof Error ? error.message : 'Failed to update supplier cost.');
    }
  }

  async function handleDeleteSupplierCost(costId: string) {
    if (!window.confirm('Delete this supplier cost entry?')) {
      return;
    }

    try {
      await deleteFlowerSupplierCost(costId);
      if (editingSupplierCostId === costId) {
        cancelEditingSupplierCost();
      }
      setSupplierMessage('Supplier cost deleted.');
      setSupplierErrorMessage('');
      await loadReports();
    } catch (error) {
      setSupplierErrorMessage(error instanceof Error ? error.message : 'Failed to delete supplier cost.');
    }
  }

  return (
    <div className="animate-fade-in min-w-0 max-w-full overflow-x-hidden">
      <div className="print:hidden">
      <FlowerPageHeader
        label="Sales & Finance"
        title="Reports"
        description={
          isAdmin
            ? 'Net income = total sales − staff expenses − supplier costs. Pick any date to review history.'
            : staffBranchName
              ? `Today's ${staffBranchName} sales and logged expenses. Supplier costs and net income are owner-only.`
              : `Today's sales and logged expenses for your branch. Supplier costs and net income are owner-only.`
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
          <div className="flex flex-wrap items-center gap-2">
            <p className="rounded-xl border border-brand-muted/40 bg-brand-cream/30 px-3 py-2 text-sm font-medium text-brand-dark">
              {formatReportDateLabel(staffReportDate)}
            </p>
            {staffBranchName ? (
              <p className="rounded-xl border border-brand-brown/20 bg-brand-beige/50 px-3 py-2 text-sm font-semibold text-brand-dark">
                {staffBranchName} branch
              </p>
            ) : null}
          </div>
        )}
        {isAdmin ? (
          <select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)} className="flower-input max-w-[180px]">
            <option value="all">All branches</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>{branch.name}</option>
            ))}
          </select>
        ) : null}
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
          <div className={`mt-5 grid grid-cols-2 gap-3 ${isAdmin ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}>
            <MetricCard label="Total sales" value={PRICE_FORMATTER.format(reportsData.financial.total_sales)} />
            <MetricCard label="Expenses" value={PRICE_FORMATTER.format(reportsData.financial.staff_expenses)} />
            {isAdmin ? (
              <MetricCard label="COGS" value={PRICE_FORMATTER.format(reportsData.financial.cogs)} />
            ) : null}
            <MetricCard
              label="Net sales"
              value={PRICE_FORMATTER.format(reportsData.financial.net_sales)}
              accent
            />
          </div>

          {reportsData.financial.sales_by_payment.length > 0 ? (
            <div className="mt-5 rounded-2xl border border-brand-muted/40 bg-white p-4">
              <h3 className="text-sm font-semibold text-brand-dark">Sales by payment</h3>
              <p className="mt-1 text-xs text-brand-brown/60">
                Breakdown of completed sales for {formatReportDateLabel(effectiveReportDate)}.
              </p>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {reportsData.financial.sales_by_payment.map((row) => (
                  <div
                    key={row.payment_mode}
                    className="rounded-xl border border-brand-muted/30 bg-brand-cream/20 px-3 py-2"
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-brand-brown/60 sm:text-xs">
                      {row.label}
                    </p>
                    <p className="mt-1 font-serif text-base font-semibold text-brand-dark sm:text-lg">
                      {PRICE_FORMATTER.format(row.amount)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="mt-5 rounded-2xl border border-emerald-200/70 bg-emerald-50/40 p-4">
            <h3 className="text-sm font-semibold text-brand-dark">Expected cash on hand</h3>
            <p className="mt-1 text-xs text-brand-brown/60">
              Cash sales minus cash-only expenses. GCash expenses are tracked separately and do not
              reduce this amount.
            </p>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-brand-muted/30 bg-white/80 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-brand-brown/60 sm:text-xs">
                  Cash expenses
                </p>
                <p className="mt-1 font-serif text-base font-semibold text-brand-dark sm:text-lg">
                  {PRICE_FORMATTER.format(reportsData.financial.staff_expenses_cash)}
                </p>
              </div>
              <div className="rounded-xl border border-brand-muted/30 bg-white/80 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-brand-brown/60 sm:text-xs">
                  GCash expenses
                </p>
                <p className="mt-1 font-serif text-base font-semibold text-brand-dark sm:text-lg">
                  {PRICE_FORMATTER.format(reportsData.financial.staff_expenses_gcash)}
                </p>
              </div>
              <div className="rounded-xl border border-emerald-300/60 bg-white px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-800/70 sm:text-xs">
                  Cash on hand
                </p>
                <p className="mt-1 font-serif text-base font-semibold text-emerald-900 sm:text-lg">
                  {PRICE_FORMATTER.format(reportsData.financial.cash_on_hand)}
                </p>
              </div>
            </div>
          </div>

          {isAdmin ? (
            <div className="mt-6 rounded-2xl border border-brand-muted/40 bg-brand-cream/20 p-4">
              <form onSubmit={handleSupplierCost}>
                <h3 className="text-sm font-semibold text-brand-dark">Log supplier cost (admin)</h3>
                <p className="mt-1 text-xs text-brand-brown/60">
                  Edit or delete incorrect supplier entries below.
                </p>
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

              {supplierMessage ? <p className="mt-3 text-sm text-emerald-700">{supplierMessage}</p> : null}
              {supplierErrorMessage ? <p className="mt-3 text-sm text-red-700">{supplierErrorMessage}</p> : null}

              <div className="mt-4 md:hidden">
                <FlowerMobileCardList
                  items={supplierCosts}
                  emptyMessage="No supplier costs logged yet."
                  getKey={(cost) => cost.id}
                  renderCard={(cost) =>
                    editingSupplierCostId === cost.id && supplierEditDraft ? (
                      <div className="space-y-3">
                        <input
                          type="date"
                          value={supplierEditDraft.cost_date}
                          onChange={(e) =>
                            setSupplierEditDraft((current) =>
                              current ? { ...current, cost_date: e.target.value } : current,
                            )
                          }
                          className="flower-input w-full"
                        />
                        <select
                          value={supplierEditDraft.branch_id}
                          onChange={(e) =>
                            setSupplierEditDraft((current) =>
                              current ? { ...current, branch_id: e.target.value } : current,
                            )
                          }
                          className="flower-input w-full"
                        >
                          {branches.map((branch) => (
                            <option key={branch.id} value={branch.id}>{branch.name}</option>
                          ))}
                        </select>
                        <input
                          type="text"
                          value={supplierEditDraft.description}
                          onChange={(e) =>
                            setSupplierEditDraft((current) =>
                              current ? { ...current, description: e.target.value } : current,
                            )
                          }
                          className="flower-input w-full"
                        />
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={supplierEditDraft.amount}
                          onChange={(e) =>
                            setSupplierEditDraft((current) =>
                              current ? { ...current, amount: e.target.value } : current,
                            )
                          }
                          className="flower-input w-full"
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => void handleSaveSupplierCost(cost.id)}
                            className="flower-btn-primary flex-1 text-sm"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={cancelEditingSupplierCost}
                            className="flower-btn-secondary flex-1 text-sm"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold text-brand-dark">{cost.description}</p>
                            <p className="mt-1 text-xs text-brand-brown/60">{cost.cost_date}</p>
                          </div>
                          <p className="shrink-0 font-semibold text-brand-dark">
                            {PRICE_FORMATTER.format(cost.amount)}
                          </p>
                        </div>
                        <p className="text-sm text-brand-brown/75">
                          {cost.branch_name} · {cost.created_by_name}
                        </p>
                        <div className="flex gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => startEditingSupplierCost(cost)}
                            className="flower-btn-secondary flex-1 px-3 py-1.5 text-xs"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDeleteSupplierCost(cost.id)}
                            className="flex-1 rounded-xl border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    )
                  }
                />
              </div>

              <div className="mt-4 hidden overflow-x-auto rounded-xl border border-brand-muted/40 bg-white md:block">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-brand-beige/40 text-brand-brown">
                    <tr>
                      <th className="px-3 py-2">Date</th>
                      <th className="px-3 py-2">Branch</th>
                      <th className="px-3 py-2">Description</th>
                      <th className="px-3 py-2">Amount</th>
                      <th className="px-3 py-2">Logged by</th>
                      <th className="px-3 py-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {supplierCosts.map((cost) =>
                      editingSupplierCostId === cost.id && supplierEditDraft ? (
                        <tr key={cost.id} className="border-t border-brand-muted/30 bg-brand-cream/30">
                          <td className="px-3 py-2">
                            <input
                              type="date"
                              value={supplierEditDraft.cost_date}
                              onChange={(e) =>
                                setSupplierEditDraft((current) =>
                                  current ? { ...current, cost_date: e.target.value } : current,
                                )
                              }
                              className="flower-input min-w-[140px]"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <select
                              value={supplierEditDraft.branch_id}
                              onChange={(e) =>
                                setSupplierEditDraft((current) =>
                                  current ? { ...current, branch_id: e.target.value } : current,
                                )
                              }
                              className="flower-input min-w-[120px]"
                            >
                              {branches.map((branch) => (
                                <option key={branch.id} value={branch.id}>{branch.name}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="text"
                              value={supplierEditDraft.description}
                              onChange={(e) =>
                                setSupplierEditDraft((current) =>
                                  current ? { ...current, description: e.target.value } : current,
                                )
                              }
                              className="flower-input min-w-[160px]"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={supplierEditDraft.amount}
                              onChange={(e) =>
                                setSupplierEditDraft((current) =>
                                  current ? { ...current, amount: e.target.value } : current,
                                )
                              }
                              className="flower-input min-w-[100px]"
                            />
                          </td>
                          <td className="px-3 py-2">{cost.created_by_name}</td>
                          <td className="px-3 py-2">
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => void handleSaveSupplierCost(cost.id)}
                                className="flower-btn-primary px-3 py-1.5 text-xs"
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={cancelEditingSupplierCost}
                                className="flower-btn-secondary px-3 py-1.5 text-xs"
                              >
                                Cancel
                              </button>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        <tr key={cost.id} className="border-t border-brand-muted/30">
                          <td className="px-3 py-2">{cost.cost_date}</td>
                          <td className="px-3 py-2">{cost.branch_name}</td>
                          <td className="px-3 py-2">{cost.description}</td>
                          <td className="px-3 py-2">{PRICE_FORMATTER.format(cost.amount)}</td>
                          <td className="px-3 py-2">{cost.created_by_name}</td>
                          <td className="px-3 py-2">
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => startEditingSupplierCost(cost)}
                                className="flower-btn-secondary px-3 py-1.5 text-xs"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleDeleteSupplierCost(cost.id)}
                                className="rounded-xl border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {isAdmin ? (
            <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
              <section className="rounded-2xl border border-brand-muted/40 p-4">
                <h3 className="text-sm font-semibold text-brand-dark">Daily summary</h3>
                <ul className="mt-2 space-y-1 text-sm">
                  {reportsData.daily_summary.map((row) => (
                    <li key={row.date} className="flex flex-col gap-0.5 border-b border-brand-muted/20 py-2 last:border-0 sm:flex-row sm:items-center sm:justify-between">
                      <span className="font-medium text-brand-dark">{row.date}</span>
                      <span className="text-brand-brown/80">
                        {row.order_count} orders · {PRICE_FORMATTER.format(row.sales_total)}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
              <section className="rounded-2xl border border-brand-muted/40 p-4">
                <h3 className="text-sm font-semibold text-brand-dark">Monthly summary</h3>
                <ul className="mt-2 space-y-1 text-sm">
                  {reportsData.monthly_summary.map((row) => (
                    <li key={row.month} className="flex flex-col gap-0.5 border-b border-brand-muted/20 py-2 last:border-0 sm:flex-row sm:items-center sm:justify-between">
                      <span className="font-medium text-brand-dark">{row.month}</span>
                      <span className="text-brand-brown/80">
                        {row.order_count} orders · {PRICE_FORMATTER.format(row.sales_total)}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          ) : null}
        </>
      ) : null}
      </div>

      {!loading && !blockedMessage ? (
        <FlowerPrintableSalesReportPanel
          anchorDate={effectiveReportDate}
          isAdmin={isAdmin}
          branchId={effectiveBranchFilter}
          disabled={isAdmin && branchFilter === 'all'}
          disabledMessage={
            isAdmin && branchFilter === 'all'
              ? 'Select a branch above to print its sales report.'
              : undefined
          }
        />
      ) : null}
    </div>
  );
}

function MetricCard({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`min-w-0 rounded-2xl border p-3 sm:p-4 ${accent ? 'border-brand-brown bg-brand-brown text-white' : 'border-brand-muted/40 bg-white'}`}>
      <p className={`text-[10px] font-semibold uppercase tracking-wide sm:text-xs ${accent ? 'text-white/80' : 'text-brand-brown/60'}`}>{label}</p>
      <p className="mt-2 break-words font-serif text-base font-semibold leading-tight sm:text-xl">{value}</p>
    </div>
  );
}
