import type {
  CreateFlowerStaffExpenseInput,
  CreateFlowerSupplierCostInput,
} from '../../../modules/flowers/shared/types/flower-expense';
import {
  createFlowerStaffExpenseLocal,
  createFlowerSupplierCostLocal,
  listFlowerStaffExpensesLocal,
  listFlowerSupplierCostsLocal,
} from './flowers-expenses.local';

export async function listFlowerStaffExpenses(staffId?: string) {
  return listFlowerStaffExpensesLocal(staffId);
}

export async function createFlowerStaffExpense(input: CreateFlowerStaffExpenseInput) {
  return createFlowerStaffExpenseLocal(input);
}

export async function listFlowerSupplierCosts() {
  return listFlowerSupplierCostsLocal();
}

export async function createFlowerSupplierCost(input: CreateFlowerSupplierCostInput) {
  return createFlowerSupplierCostLocal(input);
}
