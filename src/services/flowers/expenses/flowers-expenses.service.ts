import type {
  CreateFlowerStaffExpenseInput,
  CreateFlowerSupplierCostInput,
  UpdateFlowerStaffExpenseInput,
  UpdateFlowerSupplierCostInput,
} from '../../../modules/flowers/shared/types/flower-expense';
import { getFlowerStorageMode, shouldUseFlowerSupabase } from '../storage-mode';
import {
  createFlowerStaffExpenseLocal,
  createFlowerSupplierCostLocal,
  deleteFlowerStaffExpenseLocal,
  deleteFlowerSupplierCostLocal,
  listFlowerStaffExpensesLocal,
  listFlowerSupplierCostsLocal,
  sumStaffExpensesForPeriodLocal,
  sumSupplierCostsForPeriodLocal,
  updateFlowerStaffExpenseLocal,
  updateFlowerSupplierCostLocal,
} from './flowers-expenses.local';

async function withSupabaseExpenses<T>(
  operation: () => Promise<T>,
  fallback: () => Promise<T>,
): Promise<T> {
  const mode = getFlowerStorageMode();

  if (shouldUseFlowerSupabase(mode)) {
    try {
      return await operation();
    } catch (error) {
      if (mode === 'supabase') {
        throw error;
      }
      console.warn('Falling back to local flower expenses.', error);
    }
  }

  return fallback();
}

export async function listFlowerStaffExpenses(staffId?: string) {
  return withSupabaseExpenses(
    async () => {
      const { listFlowerStaffExpensesSupabase } = await import('./flowers-expenses.supabase');
      return listFlowerStaffExpensesSupabase(staffId);
    },
    () => listFlowerStaffExpensesLocal(staffId),
  );
}

export async function createFlowerStaffExpense(input: CreateFlowerStaffExpenseInput) {
  return withSupabaseExpenses(
    async () => {
      const { createFlowerStaffExpenseSupabase } = await import('./flowers-expenses.supabase');
      return createFlowerStaffExpenseSupabase(input);
    },
    () => createFlowerStaffExpenseLocal(input),
  );
}

export async function updateFlowerStaffExpense(input: UpdateFlowerStaffExpenseInput) {
  return withSupabaseExpenses(
    async () => {
      const { updateFlowerStaffExpenseSupabase } = await import('./flowers-expenses.supabase');
      return updateFlowerStaffExpenseSupabase(input);
    },
    () => updateFlowerStaffExpenseLocal(input),
  );
}

export async function deleteFlowerStaffExpense(expenseId: string) {
  return withSupabaseExpenses(
    async () => {
      const { deleteFlowerStaffExpenseSupabase } = await import('./flowers-expenses.supabase');
      return deleteFlowerStaffExpenseSupabase(expenseId);
    },
    () => deleteFlowerStaffExpenseLocal(expenseId),
  );
}

export async function listFlowerSupplierCosts() {
  return withSupabaseExpenses(
    async () => {
      const { listFlowerSupplierCostsSupabase } = await import('./flowers-expenses.supabase');
      return listFlowerSupplierCostsSupabase();
    },
    () => listFlowerSupplierCostsLocal(),
  );
}

export async function createFlowerSupplierCost(input: CreateFlowerSupplierCostInput) {
  return withSupabaseExpenses(
    async () => {
      const { createFlowerSupplierCostSupabase } = await import('./flowers-expenses.supabase');
      return createFlowerSupplierCostSupabase(input);
    },
    () => createFlowerSupplierCostLocal(input),
  );
}

export async function updateFlowerSupplierCost(input: UpdateFlowerSupplierCostInput) {
  return withSupabaseExpenses(
    async () => {
      const { updateFlowerSupplierCostSupabase } = await import('./flowers-expenses.supabase');
      return updateFlowerSupplierCostSupabase(input);
    },
    () => updateFlowerSupplierCostLocal(input),
  );
}

export async function deleteFlowerSupplierCost(costId: string) {
  return withSupabaseExpenses(
    async () => {
      const { deleteFlowerSupplierCostSupabase } = await import('./flowers-expenses.supabase');
      return deleteFlowerSupplierCostSupabase(costId);
    },
    () => deleteFlowerSupplierCostLocal(costId),
  );
}

export async function sumStaffExpensesForPeriod(options: {
  branchId?: string;
  fromDate?: string;
  toDate?: string;
}) {
  return withSupabaseExpenses(
    async () => {
      const { sumStaffExpensesForPeriodSupabase } = await import('./flowers-expenses.supabase');
      return sumStaffExpensesForPeriodSupabase(options);
    },
    () => sumStaffExpensesForPeriodLocal(options),
  );
}

export async function sumSupplierCostsForPeriod(options: {
  branchId?: string;
  fromDate?: string;
  toDate?: string;
}) {
  return withSupabaseExpenses(
    async () => {
      const { sumSupplierCostsForPeriodSupabase } = await import('./flowers-expenses.supabase');
      return sumSupplierCostsForPeriodSupabase(options);
    },
    () => sumSupplierCostsForPeriodLocal(options),
  );
}
