import type {
  CreateFlowerStaffExpenseInput,
  CreateFlowerSupplierCostInput,
  UpdateFlowerStaffExpenseInput,
  UpdateFlowerSupplierCostInput,
} from '../../../modules/flowers/shared/types/flower-expense';
import {
  createFlowerStaffExpenseLocal,
  createFlowerSupplierCostLocal,
  deleteFlowerStaffExpenseLocal,
  deleteFlowerSupplierCostLocal,
  listFlowerStaffExpensesLocal,
  listFlowerSupplierCostsLocal,
  updateFlowerStaffExpenseLocal,
  updateFlowerSupplierCostLocal,
} from './flowers-expenses.local';

export async function listFlowerStaffExpenses(staffId?: string) {
  return listFlowerStaffExpensesLocal(staffId);
}

export async function createFlowerStaffExpense(input: CreateFlowerStaffExpenseInput) {
  return createFlowerStaffExpenseLocal(input);
}

export async function updateFlowerStaffExpense(input: UpdateFlowerStaffExpenseInput) {
  return updateFlowerStaffExpenseLocal(input);
}

export async function deleteFlowerStaffExpense(expenseId: string) {
  return deleteFlowerStaffExpenseLocal(expenseId);
}

export async function listFlowerSupplierCosts() {
  return listFlowerSupplierCostsLocal();
}

export async function createFlowerSupplierCost(input: CreateFlowerSupplierCostInput) {
  return createFlowerSupplierCostLocal(input);
}

export async function updateFlowerSupplierCost(input: UpdateFlowerSupplierCostInput) {
  return updateFlowerSupplierCostLocal(input);
}

export async function deleteFlowerSupplierCost(costId: string) {
  return deleteFlowerSupplierCostLocal(costId);
}
