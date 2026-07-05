export type FlowerExpensePaymentMode = 'cash' | 'gcash';

export const FLOWER_EXPENSE_PAYMENT_MODE_LABELS: Record<FlowerExpensePaymentMode, string> = {
  cash: 'Cash',
  gcash: 'GCash',
};

export function normalizeFlowerExpensePaymentMode(
  value: string | null | undefined,
): FlowerExpensePaymentMode {
  return value === 'gcash' ? 'gcash' : 'cash';
}

export interface FlowerStaffExpense {
  id: string;
  staff_id: string;
  staff_name: string;
  branch_id: string;
  branch_name: string;
  amount: number;
  description: string;
  expense_date: string;
  payment_mode: FlowerExpensePaymentMode;
  created_at: string;
}

export interface CreateFlowerStaffExpenseInput {
  staff_id: string;
  staff_name: string;
  branch_id: string;
  amount: number;
  description: string;
  expense_date: string;
  payment_mode: FlowerExpensePaymentMode;
}

export interface UpdateFlowerStaffExpenseInput {
  id: string;
  branch_id: string;
  amount: number;
  description: string;
  expense_date: string;
  payment_mode: FlowerExpensePaymentMode;
}

export interface FlowerSupplierCost {
  id: string;
  branch_id: string;
  branch_name: string;
  product_id: string | null;
  product_name: string | null;
  amount: number;
  description: string;
  cost_date: string;
  created_by_id: string;
  created_by_name: string;
  created_at: string;
}

export interface CreateFlowerSupplierCostInput {
  branch_id: string;
  product_id?: string | null;
  amount: number;
  description: string;
  cost_date: string;
  created_by_id: string;
  created_by_name: string;
}

export interface UpdateFlowerSupplierCostInput {
  id: string;
  branch_id: string;
  product_id?: string | null;
  amount: number;
  description: string;
  cost_date: string;
}
