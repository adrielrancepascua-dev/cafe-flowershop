import { useEffect, useMemo, useState } from 'react';
import {
  createFlowerStaffExpense,
  deleteFlowerStaffExpense,
  listFlowerStaffExpenses,
  updateFlowerStaffExpense,
} from '../../../../services/flowers/expenses/flowers-expenses.service';
import { listFlowerBranches } from '../../../../services/flowers/inventory';
import { useFlowerAuth } from '../../../../lib/auth/FlowerAuthContext';
import type { FlowerStaffExpense, FlowerExpensePaymentMode } from '../../shared/types/flower-expense';
import {
  FLOWER_EXPENSE_PAYMENT_MODE_LABELS,
} from '../../shared/types/flower-expense';
import type { FlowerBranchOption } from '../../shared/types/flower-inventory';
import FlowerPageHeader from '../../shared/components/FlowerPageHeader';
import FlowerMobileCardList from '../../shared/components/FlowerMobileCardList';
import FlowerPrintControls from '../../shared/components/FlowerPrintControls';
import {
  FlowerThermalExpensesDocument,
  type FlowerThermalExpenseSection,
} from '../../shared/components/FlowerThermalPrint';
import { PRICE_FORMATTER, toDateKey } from '../../shared/utils/flower-format';

type ExpenseDraft = {
  expense_date: string;
  branch_id: string;
  amount: string;
  description: string;
  payment_mode: FlowerExpensePaymentMode;
};

function emptyDraft(branchId: string): ExpenseDraft {
  return {
    expense_date: toDateKey(new Date()),
    branch_id: branchId,
    amount: '',
    description: '',
    payment_mode: 'cash',
  };
}

function ExpensePaymentModeField({
  value,
  onChange,
  className = '',
}: {
  value: FlowerExpensePaymentMode;
  onChange: (value: FlowerExpensePaymentMode) => void;
  className?: string;
}) {
  return (
    <fieldset className={className}>
      <legend className="mb-1.5 text-sm font-medium text-brand-brown">Paid via</legend>
      <div className="inline-flex rounded-xl border border-brand-muted/50 bg-white p-1">
        {(['cash', 'gcash'] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => onChange(mode)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              value === mode ? 'bg-brand-dark text-white' : 'text-brand-brown/70 hover:bg-brand-beige/40'
            }`}
          >
            {FLOWER_EXPENSE_PAYMENT_MODE_LABELS[mode]}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export default function FlowerExpensesPage() {
  const { user, isAdmin } = useFlowerAuth();
  const [expenses, setExpenses] = useState<FlowerStaffExpense[]>([]);
  const [branches, setBranches] = useState<FlowerBranchOption[]>([]);
  const [branchFilter, setBranchFilter] = useState('all');
  const [staffViewDate, setStaffViewDate] = useState(() => toDateKey(new Date()));
  const [draft, setDraft] = useState<ExpenseDraft>(emptyDraft(''));
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<ExpenseDraft | null>(null);
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const staffBranchId = !isAdmin ? user?.branch_id ?? null : null;
  const staffBranchName = !isAdmin ? user?.branch_name ?? null : null;

  const visibleExpenses = useMemo(() => {
    let rows = expenses;

    if (!isAdmin) {
      rows = rows.filter((expense) => expense.expense_date === staffViewDate);
    } else if (branchFilter !== 'all') {
      rows = rows.filter((expense) => expense.branch_id === branchFilter);
    }

    return rows;
  }, [expenses, branchFilter, isAdmin, staffViewDate]);

  const staffDayTotal = useMemo(
    () => visibleExpenses.reduce((sum, expense) => sum + expense.amount, 0),
    [visibleExpenses],
  );

  const printableExpenseSections = useMemo((): FlowerThermalExpenseSection[] => {
    if (visibleExpenses.length === 0) {
      return [];
    }

    if (isAdmin && branchFilter === 'all') {
      const byBranch = new Map<string, FlowerThermalExpenseSection>();

      for (const expense of visibleExpenses) {
        const existing = byBranch.get(expense.branch_id);
        if (existing) {
          existing.expenses.push(expense);
          continue;
        }

        byBranch.set(expense.branch_id, {
          branch_id: expense.branch_id,
          branch_name: expense.branch_name,
          expenses: [expense],
        });
      }

      return [...byBranch.values()].sort((left, right) =>
        left.branch_name.localeCompare(right.branch_name),
      );
    }

    const branchId = isAdmin ? branchFilter : staffBranchId;
    const branchName = isAdmin
      ? branches.find((branch) => branch.id === branchFilter)?.name ?? 'Branch'
      : staffBranchName ?? 'Branch';

    if (!branchId) {
      return [];
    }

    return [
      {
        branch_id: branchId,
        branch_name: branchName,
        expenses: visibleExpenses,
      },
    ];
  }, [visibleExpenses, isAdmin, branchFilter, branches, staffBranchId, staffBranchName]);

  const canPrintExpenses = printableExpenseSections.some((section) => section.expenses.length > 0);
  const [expensesPrintTimestamp, setExpensesPrintTimestamp] = useState('');

  function preparePrintExpenses() {
    setExpensesPrintTimestamp(
      new Date().toLocaleString('en-PH', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }),
    );
  }

  async function loadData() {
    const [expenseList, branchList] = await Promise.all([
      listFlowerStaffExpenses(isAdmin ? undefined : user?.id),
      listFlowerBranches(),
    ]);
    setExpenses(expenseList);
    setBranches(branchList);

    if (!isAdmin && staffBranchId) {
      setDraft((current) => ({
        ...emptyDraft(staffBranchId),
        expense_date: staffViewDate || current.expense_date || toDateKey(new Date()),
      }));
    } else if (!draft.branch_id && branchList[0]) {
      setDraft(emptyDraft(branchList[0].id));
    }
  }

  useEffect(() => {
    void loadData();
  }, [user, isAdmin]);

  useEffect(() => {
    if (isAdmin || !staffBranchId) {
      return;
    }

    setDraft((current) => ({
      ...current,
      branch_id: staffBranchId,
      expense_date: staffViewDate,
    }));
  }, [isAdmin, staffBranchId, staffViewDate]);

  function parseAmount(value: string): number | null {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return null;
    }
    return parsed;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!user) {
      return;
    }

    const parsedAmount = parseAmount(draft.amount);
    const branchId = isAdmin ? draft.branch_id : staffBranchId;
    if (!parsedAmount || !draft.description.trim() || !branchId) {
      setErrorMessage(
        isAdmin
          ? 'Enter a valid amount, description, and branch.'
          : 'Enter a valid amount and description. Finish first-time setup if your branch is missing.',
      );
      return;
    }

    try {
      await createFlowerStaffExpense({
        staff_id: user.id,
        staff_name: user.display_name,
        branch_id: branchId,
        amount: parsedAmount,
        description: draft.description,
        expense_date: isAdmin ? draft.expense_date : staffViewDate,
        payment_mode: draft.payment_mode,
      });

      setDraft((current) => ({
        ...emptyDraft(isAdmin ? current.branch_id : staffBranchId ?? current.branch_id),
        expense_date: isAdmin ? current.expense_date : staffViewDate,
      }));
      setMessage('Expense saved.');
      setErrorMessage('');
      await loadData();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to save expense.');
    }
  }

  function startEditing(expense: FlowerStaffExpense) {
    setEditingExpenseId(expense.id);
    setEditDraft({
      expense_date: expense.expense_date,
      branch_id: expense.branch_id,
      amount: String(expense.amount),
      description: expense.description,
      payment_mode: expense.payment_mode,
    });
    setMessage('');
    setErrorMessage('');
  }

  function cancelEditing() {
    setEditingExpenseId(null);
    setEditDraft(null);
  }

  async function handleSaveEdit(expenseId: string) {
    if (!editDraft) {
      return;
    }

    const parsedAmount = parseAmount(editDraft.amount);
    if (!parsedAmount || !editDraft.description.trim() || !editDraft.branch_id) {
      setErrorMessage('Enter a valid amount, description, and branch.');
      return;
    }

    try {
      await updateFlowerStaffExpense({
        id: expenseId,
        branch_id: editDraft.branch_id,
        amount: parsedAmount,
        description: editDraft.description,
        expense_date: editDraft.expense_date,
        payment_mode: editDraft.payment_mode,
      });
      cancelEditing();
      setMessage('Expense updated.');
      setErrorMessage('');
      await loadData();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to update expense.');
    }
  }

  async function handleDelete(expenseId: string) {
    if (!window.confirm('Delete this expense entry?')) {
      return;
    }

    try {
      await deleteFlowerStaffExpense(expenseId);
      if (editingExpenseId === expenseId) {
        cancelEditing();
      }
      setMessage('Expense deleted.');
      setErrorMessage('');
      await loadData();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to delete expense.');
    }
  }

  return (
    <div className="animate-fade-in">
      <div className="print:hidden">
      <FlowerPageHeader
        label="Expenses"
        title={isAdmin ? 'All Staff Expenses' : 'My Expenses'}
        description={
          isAdmin
            ? 'Staff log expenses here. Admins can edit or remove incorrect entries.'
            : 'Daily view only — pick a date, log expenses for that day, and print/send just that day\'s list.'
        }
      />

      {isAdmin ? (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <select
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
            className="flower-input max-w-[200px]"
          >
            <option value="all">All branches</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
          {branchFilter !== 'all' ? (
            <p className="text-sm text-brand-brown/70">
              Showing {visibleExpenses.length} expense{visibleExpenses.length === 1 ? '' : 's'}
            </p>
          ) : null}
          {canPrintExpenses ? (
            <FlowerPrintControls
              onPrint={preparePrintExpenses}
              label={branchFilter === 'all' ? 'Print all branches' : 'Print expenses'}
              showSizeHint={false}
            />
          ) : null}
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {staffBranchName ? (
            <p className="inline-flex rounded-xl border border-brand-brown/20 bg-brand-beige/50 px-3 py-2 text-sm font-semibold text-brand-dark">
              {staffBranchName} branch
            </p>
          ) : null}
          <label className="inline-flex items-center gap-2 text-sm font-medium text-brand-brown">
            Day
            <input
              type="date"
              value={staffViewDate}
              onChange={(e) => setStaffViewDate(e.target.value)}
              className="flower-input max-w-[170px]"
            />
          </label>
          <p className="text-sm text-brand-brown/70">
            {visibleExpenses.length} expense{visibleExpenses.length === 1 ? '' : 's'} ·{' '}
            {PRICE_FORMATTER.format(staffDayTotal)}
          </p>
          {canPrintExpenses ? (
            <FlowerPrintControls
              onPrint={preparePrintExpenses}
              label="Print this day"
              showSizeHint={false}
            />
          ) : null}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-5 grid grid-cols-1 gap-3 rounded-2xl border border-brand-muted/40 bg-brand-cream/20 p-4 md:grid-cols-2">
        {isAdmin ? (
          <input
            type="date"
            value={draft.expense_date}
            onChange={(e) => setDraft((current) => ({ ...current, expense_date: e.target.value }))}
            className="flower-input"
            required
          />
        ) : (
          <div
            className="flower-input flex items-center bg-brand-cream/40 text-brand-dark"
            aria-readonly="true"
          >
            {staffViewDate}
          </div>
        )}
        {isAdmin ? (
          <select
            value={draft.branch_id}
            onChange={(e) => setDraft((current) => ({ ...current, branch_id: e.target.value }))}
            className="flower-input"
            required
          >
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
        ) : (
          <div
            className="flower-input flex items-center bg-brand-cream/40 text-brand-dark"
            aria-readonly="true"
          >
            {staffBranchName ?? 'Branch not set'}
          </div>
        )}
        <input
          type="number"
          min="0"
          step="0.01"
          value={draft.amount}
          onChange={(e) => setDraft((current) => ({ ...current, amount: e.target.value }))}
          placeholder="Amount"
          className="flower-input"
          required
        />
        <input
          type="text"
          value={draft.description}
          onChange={(e) => setDraft((current) => ({ ...current, description: e.target.value }))}
          placeholder="Description"
          className="flower-input"
          required
        />
        <ExpensePaymentModeField
          value={draft.payment_mode}
          onChange={(payment_mode) => setDraft((current) => ({ ...current, payment_mode }))}
        />
        <button type="submit" className="flower-btn-primary md:col-span-2">Add expense</button>
      </form>

      {message ? <p className="mt-3 text-sm text-emerald-700">{message}</p> : null}
      {errorMessage ? <p className="mt-3 text-sm text-red-700">{errorMessage}</p> : null}

      <div className="mt-5 md:hidden">
        <FlowerMobileCardList
          items={visibleExpenses}
          emptyMessage={
            !isAdmin
              ? 'No expenses for this day yet.'
              : branchFilter !== 'all'
                ? 'No expenses for this branch.'
                : 'No expenses logged yet.'
          }
          getKey={(expense) => expense.id}
          renderCard={(expense) =>
            isAdmin && editingExpenseId === expense.id && editDraft ? (
              <div className="space-y-3">
                <input
                  type="date"
                  value={editDraft.expense_date}
                  onChange={(e) =>
                    setEditDraft((current) =>
                      current ? { ...current, expense_date: e.target.value } : current,
                    )
                  }
                  className="flower-input w-full"
                />
                <select
                  value={editDraft.branch_id}
                  onChange={(e) =>
                    setEditDraft((current) =>
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
                  value={editDraft.description}
                  onChange={(e) =>
                    setEditDraft((current) =>
                      current ? { ...current, description: e.target.value } : current,
                    )
                  }
                  className="flower-input w-full"
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={editDraft.amount}
                  onChange={(e) =>
                    setEditDraft((current) =>
                      current ? { ...current, amount: e.target.value } : current,
                    )
                  }
                  className="flower-input w-full"
                />
                <ExpensePaymentModeField
                  value={editDraft.payment_mode}
                  onChange={(payment_mode) =>
                    setEditDraft((current) => (current ? { ...current, payment_mode } : current))
                  }
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void handleSaveEdit(expense.id)}
                    className="flower-btn-primary flex-1 text-sm"
                  >
                    Save
                  </button>
                  <button type="button" onClick={cancelEditing} className="flower-btn-secondary flex-1 text-sm">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-brand-dark">{expense.description}</p>
                    <p className="mt-1 text-xs text-brand-brown/60">{expense.expense_date}</p>
                  </div>
                  <p className="shrink-0 font-semibold text-brand-dark">
                    {PRICE_FORMATTER.format(expense.amount)}
                  </p>
                </div>
                <p className="text-sm text-brand-brown/75">
                  {expense.staff_name} · {expense.branch_name} ·{' '}
                  {FLOWER_EXPENSE_PAYMENT_MODE_LABELS[expense.payment_mode]}
                </p>
                {isAdmin ? (
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => startEditing(expense)}
                      className="flower-btn-secondary flex-1 px-3 py-1.5 text-xs"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete(expense.id)}
                      className="flex-1 rounded-xl border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700"
                    >
                      Delete
                    </button>
                  </div>
                ) : null}
              </div>
            )
          }
        />
      </div>

      <div className="mt-5 hidden overflow-x-auto rounded-2xl border border-brand-muted/40 md:block">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-brand-beige/40 text-brand-brown">
            <tr>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Staff</th>
              <th className="px-3 py-2">Branch</th>
              <th className="px-3 py-2">Description</th>
              <th className="px-3 py-2">Paid via</th>
              <th className="px-3 py-2">Amount</th>
              {isAdmin ? <th className="px-3 py-2">Actions</th> : null}
            </tr>
          </thead>
          <tbody>
            {visibleExpenses.length === 0 ? (
              <tr>
                <td
                  colSpan={isAdmin ? 7 : 6}
                  className="border-t border-brand-muted/30 px-3 py-6 text-center text-brand-brown/60"
                >
                  {branchFilter !== 'all'
                    ? 'No expenses for this branch.'
                    : !isAdmin
                      ? 'No expenses for this day yet.'
                      : 'No expenses logged yet.'}
                </td>
              </tr>
            ) : null}
            {visibleExpenses.map((expense) =>
              isAdmin && editingExpenseId === expense.id && editDraft ? (
                <tr key={expense.id} className="border-t border-brand-muted/30 bg-brand-cream/30">
                  <td className="px-3 py-2">
                    <input
                      type="date"
                      value={editDraft.expense_date}
                      onChange={(e) =>
                        setEditDraft((current) =>
                          current ? { ...current, expense_date: e.target.value } : current,
                        )
                      }
                      className="flower-input min-w-[140px]"
                    />
                  </td>
                  <td className="px-3 py-2">{expense.staff_name}</td>
                  <td className="px-3 py-2">
                    <select
                      value={editDraft.branch_id}
                      onChange={(e) =>
                        setEditDraft((current) =>
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
                      value={editDraft.description}
                      onChange={(e) =>
                        setEditDraft((current) =>
                          current ? { ...current, description: e.target.value } : current,
                        )
                      }
                      className="flower-input min-w-[160px]"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <ExpensePaymentModeField
                      value={editDraft.payment_mode}
                      onChange={(payment_mode) =>
                        setEditDraft((current) => (current ? { ...current, payment_mode } : current))
                      }
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={editDraft.amount}
                      onChange={(e) =>
                        setEditDraft((current) =>
                          current ? { ...current, amount: e.target.value } : current,
                        )
                      }
                      className="flower-input min-w-[100px]"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void handleSaveEdit(expense.id)}
                        className="flower-btn-primary px-3 py-1.5 text-xs"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={cancelEditing}
                        className="flower-btn-secondary px-3 py-1.5 text-xs"
                      >
                        Cancel
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr key={expense.id} className="border-t border-brand-muted/30">
                  <td className="px-3 py-2">{expense.expense_date}</td>
                  <td className="px-3 py-2">{expense.staff_name}</td>
                  <td className="px-3 py-2">{expense.branch_name}</td>
                  <td className="px-3 py-2">{expense.description}</td>
                  <td className="px-3 py-2">
                    {FLOWER_EXPENSE_PAYMENT_MODE_LABELS[expense.payment_mode]}
                  </td>
                  <td className="px-3 py-2">{PRICE_FORMATTER.format(expense.amount)}</td>
                  {isAdmin ? (
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => startEditing(expense)}
                          className="flower-btn-secondary px-3 py-1.5 text-xs"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDelete(expense.id)}
                          className="rounded-xl border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  ) : null}
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>
      </div>

      {canPrintExpenses ? (
        <FlowerThermalExpensesDocument
          sections={printableExpenseSections}
          generatedAt={expensesPrintTimestamp}
        />
      ) : null}
    </div>
  );
}
