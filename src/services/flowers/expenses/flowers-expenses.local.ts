import type {
  CreateFlowerStaffExpenseInput,
  CreateFlowerSupplierCostInput,
  FlowerExpensePaymentMode,
  FlowerStaffExpense,
  FlowerSupplierCost,
  UpdateFlowerStaffExpenseInput,
  UpdateFlowerSupplierCostInput,
} from '../../../modules/flowers/shared/types/flower-expense';
import { normalizeFlowerExpensePaymentMode } from '../../../modules/flowers/shared/types/flower-expense';
import { FLOWER_BRANCHES_MOCK } from '../../../modules/flowers/shared/data/flowers.mock';
import { lookupFlowerProductNameLocal } from '../products/flowers-products.local';

const EXPENSES_STORAGE_KEY = 'papers_petals_staff_expenses_v1';
const SUPPLIER_COSTS_STORAGE_KEY = 'papers_petals_supplier_costs_v1';

function readExpenses(): FlowerStaffExpense[] {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(EXPENSES_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as FlowerStaffExpense[];
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.map((expense) => ({
      ...expense,
      payment_mode: normalizeFlowerExpensePaymentMode(expense.payment_mode),
    }));
  } catch {
    return [];
  }
}

function writeExpenses(expenses: FlowerStaffExpense[]) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(EXPENSES_STORAGE_KEY, JSON.stringify(expenses));
}

function readSupplierCosts(): FlowerSupplierCost[] {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(SUPPLIER_COSTS_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as FlowerSupplierCost[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeSupplierCosts(costs: FlowerSupplierCost[]) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(SUPPLIER_COSTS_STORAGE_KEY, JSON.stringify(costs));
}

function getBranchName(branchId: string): string {
  return FLOWER_BRANCHES_MOCK.find((branch) => branch.id === branchId)?.name ?? branchId;
}

export async function listFlowerStaffExpensesLocal(staffId?: string): Promise<FlowerStaffExpense[]> {
  const expenses = readExpenses();
  const filtered = staffId ? expenses.filter((expense) => expense.staff_id === staffId) : expenses;
  return filtered.sort(
    (a, b) => new Date(b.expense_date).getTime() - new Date(a.expense_date).getTime(),
  );
}

export async function createFlowerStaffExpenseLocal(
  input: CreateFlowerStaffExpenseInput,
): Promise<FlowerStaffExpense> {
  const expenses = readExpenses();
  const created: FlowerStaffExpense = {
    id: `exp-${Date.now()}`,
    staff_id: input.staff_id,
    staff_name: input.staff_name,
    branch_id: input.branch_id,
    branch_name: getBranchName(input.branch_id),
    amount: input.amount,
    description: input.description.trim(),
    expense_date: input.expense_date,
    payment_mode: normalizeFlowerExpensePaymentMode(input.payment_mode),
    created_at: new Date().toISOString(),
  };

  writeExpenses([created, ...expenses]);
  return created;
}

export async function updateFlowerStaffExpenseLocal(
  input: UpdateFlowerStaffExpenseInput,
): Promise<FlowerStaffExpense> {
  const expenses = readExpenses();
  const index = expenses.findIndex((expense) => expense.id === input.id);

  if (index === -1) {
    throw new Error('Expense not found.');
  }

  const updated: FlowerStaffExpense = {
    ...expenses[index],
    branch_id: input.branch_id,
    branch_name: getBranchName(input.branch_id),
    amount: input.amount,
    description: input.description.trim(),
    expense_date: input.expense_date,
    payment_mode: normalizeFlowerExpensePaymentMode(input.payment_mode),
  };

  expenses[index] = updated;
  writeExpenses(expenses);
  return updated;
}

export async function deleteFlowerStaffExpenseLocal(expenseId: string): Promise<void> {
  const expenses = readExpenses();
  const nextExpenses = expenses.filter((expense) => expense.id !== expenseId);

  if (nextExpenses.length === expenses.length) {
    throw new Error('Expense not found.');
  }

  writeExpenses(nextExpenses);
}

export async function listFlowerSupplierCostsLocal(): Promise<FlowerSupplierCost[]> {
  return readSupplierCosts().sort(
    (a, b) => new Date(b.cost_date).getTime() - new Date(a.cost_date).getTime(),
  );
}

export async function createFlowerSupplierCostLocal(
  input: CreateFlowerSupplierCostInput,
): Promise<FlowerSupplierCost> {
  const costs = readSupplierCosts();
  const product = input.product_id
    ? { name: lookupFlowerProductNameLocal(input.product_id) }
    : null;

  const created: FlowerSupplierCost = {
    id: `sup-${Date.now()}`,
    branch_id: input.branch_id,
    branch_name: getBranchName(input.branch_id),
    product_id: input.product_id ?? null,
    product_name: product?.name ?? null,
    amount: input.amount,
    description: input.description.trim(),
    cost_date: input.cost_date,
    created_by_id: input.created_by_id,
    created_by_name: input.created_by_name,
    created_at: new Date().toISOString(),
  };

  writeSupplierCosts([created, ...costs]);
  return created;
}

export async function updateFlowerSupplierCostLocal(
  input: UpdateFlowerSupplierCostInput,
): Promise<FlowerSupplierCost> {
  const costs = readSupplierCosts();
  const index = costs.findIndex((cost) => cost.id === input.id);

  if (index === -1) {
    throw new Error('Supplier cost not found.');
  }

  const product = input.product_id
    ? { name: lookupFlowerProductNameLocal(input.product_id) }
    : null;

  const updated: FlowerSupplierCost = {
    ...costs[index],
    branch_id: input.branch_id,
    branch_name: getBranchName(input.branch_id),
    product_id: input.product_id ?? null,
    product_name: product?.name ?? null,
    amount: input.amount,
    description: input.description.trim(),
    cost_date: input.cost_date,
  };

  costs[index] = updated;
  writeSupplierCosts(costs);
  return updated;
}

export async function deleteFlowerSupplierCostLocal(costId: string): Promise<void> {
  const costs = readSupplierCosts();
  const nextCosts = costs.filter((cost) => cost.id !== costId);

  if (nextCosts.length === costs.length) {
    throw new Error('Supplier cost not found.');
  }

  writeSupplierCosts(nextCosts);
}

export async function sumStaffExpensesForPeriodLocal(options: {
  branchId?: string;
  fromDate?: string;
  toDate?: string;
  paymentMode?: FlowerExpensePaymentMode;
}): Promise<number> {
  const expenses = await listFlowerStaffExpensesLocal();
  return expenses
    .filter((expense) => {
      if (options.paymentMode && expense.payment_mode !== options.paymentMode) {
        return false;
      }

      if (options.branchId && expense.branch_id !== options.branchId) {
        return false;
      }

      if (options.fromDate && expense.expense_date < options.fromDate) {
        return false;
      }

      if (options.toDate && expense.expense_date > options.toDate) {
        return false;
      }

      return true;
    })
    .reduce((sum, expense) => sum + expense.amount, 0);
}

export async function sumSupplierCostsForPeriodLocal(options: {
  branchId?: string;
  fromDate?: string;
  toDate?: string;
}): Promise<number> {
  const costs = await listFlowerSupplierCostsLocal();
  return costs
    .filter((cost) => {
      if (options.branchId && cost.branch_id !== options.branchId) {
        return false;
      }

      if (options.fromDate && cost.cost_date < options.fromDate) {
        return false;
      }

      if (options.toDate && cost.cost_date > options.toDate) {
        return false;
      }

      return true;
    })
    .reduce((sum, cost) => sum + cost.amount, 0);
}
