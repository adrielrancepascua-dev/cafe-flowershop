import { useEffect, useState } from 'react';
import { createFlowerStaffExpense, listFlowerStaffExpenses } from '../../../../services/flowers/expenses/flowers-expenses.service';
import { listFlowerBranches } from '../../../../services/flowers/inventory';
import { useFlowerAuth } from '../../../../lib/auth/FlowerAuthContext';
import type { FlowerStaffExpense } from '../../shared/types/flower-expense';
import type { FlowerBranchOption } from '../../shared/types/flower-inventory';
import FlowerPageHeader from '../../shared/components/FlowerPageHeader';
import { PRICE_FORMATTER, toDateKey } from '../../shared/utils/flower-format';

export default function FlowerExpensesPage() {
  const { user, isAdmin } = useFlowerAuth();
  const [expenses, setExpenses] = useState<FlowerStaffExpense[]>([]);
  const [branches, setBranches] = useState<FlowerBranchOption[]>([]);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [branchId, setBranchId] = useState('');
  const [expenseDate, setExpenseDate] = useState(toDateKey(new Date()));
  const [message, setMessage] = useState('');

  async function loadData() {
    const [expenseList, branchList] = await Promise.all([
      listFlowerStaffExpenses(isAdmin ? undefined : user?.id),
      listFlowerBranches(),
    ]);
    setExpenses(expenseList);
    setBranches(branchList);
    if (!branchId && branchList[0]) {
      setBranchId(branchList[0].id);
    }
  }

  useEffect(() => {
    void loadData();
  }, [user, isAdmin]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!user) {
      return;
    }

    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0 || !description.trim() || !branchId) {
      return;
    }

    await createFlowerStaffExpense({
      staff_id: user.id,
      staff_name: user.display_name,
      branch_id: branchId,
      amount: parsedAmount,
      description,
      expense_date: expenseDate,
    });

    setAmount('');
    setDescription('');
    setMessage('Expense saved.');
    await loadData();
  }

  return (
    <div className="animate-fade-in">
      <FlowerPageHeader
        label="Expenses"
        title={isAdmin ? 'All Staff Expenses' : 'My Expenses'}
        description="Staff log expenses here — deducted from net income on the reports page."
      />

      <form onSubmit={handleSubmit} className="mt-5 grid grid-cols-1 gap-3 rounded-2xl border border-brand-muted/40 bg-brand-cream/20 p-4 md:grid-cols-2">
        <input type="date" value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} className="flower-input" required />
        <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className="flower-input" required>
          {branches.map((branch) => (
            <option key={branch.id} value={branch.id}>{branch.name}</option>
          ))}
        </select>
        <input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount" className="flower-input" required />
        <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" className="flower-input" required />
        <button type="submit" className="flower-btn-primary md:col-span-2">Add expense</button>
      </form>

      {message ? <p className="mt-3 text-sm text-emerald-700">{message}</p> : null}

      <div className="mt-5 overflow-x-auto rounded-2xl border border-brand-muted/40">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-brand-beige/40 text-brand-brown">
            <tr>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Staff</th>
              <th className="px-3 py-2">Branch</th>
              <th className="px-3 py-2">Description</th>
              <th className="px-3 py-2">Amount</th>
            </tr>
          </thead>
          <tbody>
            {expenses.map((expense) => (
              <tr key={expense.id} className="border-t border-brand-muted/30">
                <td className="px-3 py-2">{expense.expense_date}</td>
                <td className="px-3 py-2">{expense.staff_name}</td>
                <td className="px-3 py-2">{expense.branch_name}</td>
                <td className="px-3 py-2">{expense.description}</td>
                <td className="px-3 py-2">{PRICE_FORMATTER.format(expense.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
