import { getSupabaseClient } from '../../../lib/supabase/client';
import type {
  CreateFlowerStaffExpenseInput,
  CreateFlowerSupplierCostInput,
  FlowerStaffExpense,
  FlowerSupplierCost,
  UpdateFlowerStaffExpenseInput,
  UpdateFlowerSupplierCostInput,
} from '../../../modules/flowers/shared/types/flower-expense';

type BranchRow = {
  id: string;
  name: string;
};

type ProductRow = {
  id: string;
  name: string;
};

type StaffExpenseDbRow = {
  id: string;
  staff_id: string;
  staff_name: string;
  branch_id: string;
  amount: number;
  description: string;
  expense_date: string;
  created_at: string;
};

type SupplierCostDbRow = {
  id: string;
  branch_id: string;
  product_id: string | null;
  amount: number;
  description: string;
  cost_date: string;
  created_by_id: string;
  created_by_name: string;
  created_at: string;
};

function requireSupabaseClient() {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  return supabase;
}

async function getBranchNameMap(): Promise<Map<string, string>> {
  const supabase = requireSupabaseClient();
  const { data, error } = await supabase.from('flower_branches').select('id, name');

  if (error) {
    throw error;
  }

  const map = new Map<string, string>();
  for (const branch of (data as BranchRow[] | null) ?? []) {
    map.set(branch.id, branch.name);
  }

  return map;
}

async function getProductName(productId: string | null): Promise<string | null> {
  if (!productId) {
    return null;
  }

  const supabase = requireSupabaseClient();
  const { data, error } = await supabase
    .from('flower_products')
    .select('id, name')
    .eq('id', productId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as ProductRow | null)?.name ?? null;
}

function mapStaffExpense(row: StaffExpenseDbRow, branchName: string): FlowerStaffExpense {
  return {
    id: row.id,
    staff_id: row.staff_id,
    staff_name: row.staff_name,
    branch_id: row.branch_id,
    branch_name: branchName,
    amount: Number(row.amount),
    description: row.description,
    expense_date: row.expense_date,
    created_at: row.created_at,
  };
}

function mapSupplierCost(
  row: SupplierCostDbRow,
  branchName: string,
  productName: string | null,
): FlowerSupplierCost {
  return {
    id: row.id,
    branch_id: row.branch_id,
    branch_name: branchName,
    product_id: row.product_id,
    product_name: productName,
    amount: Number(row.amount),
    description: row.description,
    cost_date: row.cost_date,
    created_by_id: row.created_by_id,
    created_by_name: row.created_by_name,
    created_at: row.created_at,
  };
}

export async function listFlowerStaffExpensesSupabase(
  staffId?: string,
): Promise<FlowerStaffExpense[]> {
  const supabase = requireSupabaseClient();
  const branchMap = await getBranchNameMap();

  let query = supabase
    .from('flower_staff_expenses')
    .select('*')
    .order('expense_date', { ascending: false });

  if (staffId) {
    query = query.eq('staff_id', staffId);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return ((data as StaffExpenseDbRow[] | null) ?? []).map((row) =>
    mapStaffExpense(row, branchMap.get(row.branch_id) ?? row.branch_id),
  );
}

export async function createFlowerStaffExpenseSupabase(
  input: CreateFlowerStaffExpenseInput,
): Promise<FlowerStaffExpense> {
  const supabase = requireSupabaseClient();
  const branchMap = await getBranchNameMap();
  const branchName = branchMap.get(input.branch_id);

  if (!branchName) {
    throw new Error('Branch not found.');
  }

  const created: StaffExpenseDbRow = {
    id: `exp-${Date.now()}`,
    staff_id: input.staff_id,
    staff_name: input.staff_name,
    branch_id: input.branch_id,
    amount: input.amount,
    description: input.description.trim(),
    expense_date: input.expense_date,
    created_at: new Date().toISOString(),
  };

  const { error } = await supabase.from('flower_staff_expenses').insert(created);

  if (error) {
    throw error;
  }

  return mapStaffExpense(created, branchName);
}

export async function updateFlowerStaffExpenseSupabase(
  input: UpdateFlowerStaffExpenseInput,
): Promise<FlowerStaffExpense> {
  const supabase = requireSupabaseClient();
  const branchMap = await getBranchNameMap();
  const branchName = branchMap.get(input.branch_id);

  if (!branchName) {
    throw new Error('Branch not found.');
  }

  const { data, error } = await supabase
    .from('flower_staff_expenses')
    .update({
      branch_id: input.branch_id,
      amount: input.amount,
      description: input.description.trim(),
      expense_date: input.expense_date,
    })
    .eq('id', input.id)
    .select('*')
    .single();

  if (error || !data) {
    throw error ?? new Error('Expense not found.');
  }

  return mapStaffExpense(data as StaffExpenseDbRow, branchName);
}

export async function deleteFlowerStaffExpenseSupabase(expenseId: string): Promise<void> {
  const supabase = requireSupabaseClient();
  const { error, count } = await supabase
    .from('flower_staff_expenses')
    .delete({ count: 'exact' })
    .eq('id', expenseId);

  if (error) {
    throw error;
  }

  if (!count) {
    throw new Error('Expense not found.');
  }
}

export async function listFlowerSupplierCostsSupabase(): Promise<FlowerSupplierCost[]> {
  const supabase = requireSupabaseClient();
  const branchMap = await getBranchNameMap();

  const { data, error } = await supabase
    .from('flower_supplier_costs')
    .select('*')
    .order('cost_date', { ascending: false });

  if (error) {
    throw error;
  }

  const rows = (data as SupplierCostDbRow[] | null) ?? [];
  const productIds = [...new Set(rows.map((row) => row.product_id).filter(Boolean))] as string[];
  const productMap = new Map<string, string>();

  if (productIds.length > 0) {
    const { data: productsData, error: productsError } = await supabase
      .from('flower_products')
      .select('id, name')
      .in('id', productIds);

    if (productsError) {
      throw productsError;
    }

    for (const product of (productsData as ProductRow[] | null) ?? []) {
      productMap.set(product.id, product.name);
    }
  }

  return rows.map((row) =>
    mapSupplierCost(
      row,
      branchMap.get(row.branch_id) ?? row.branch_id,
      row.product_id ? productMap.get(row.product_id) ?? null : null,
    ),
  );
}

export async function createFlowerSupplierCostSupabase(
  input: CreateFlowerSupplierCostInput,
): Promise<FlowerSupplierCost> {
  const supabase = requireSupabaseClient();
  const branchMap = await getBranchNameMap();
  const branchName = branchMap.get(input.branch_id);

  if (!branchName) {
    throw new Error('Branch not found.');
  }

  const productName = await getProductName(input.product_id ?? null);
  const created: SupplierCostDbRow = {
    id: `sup-${Date.now()}`,
    branch_id: input.branch_id,
    product_id: input.product_id ?? null,
    amount: input.amount,
    description: input.description.trim(),
    cost_date: input.cost_date,
    created_by_id: input.created_by_id,
    created_by_name: input.created_by_name,
    created_at: new Date().toISOString(),
  };

  const { error } = await supabase.from('flower_supplier_costs').insert(created);

  if (error) {
    throw error;
  }

  return mapSupplierCost(created, branchName, productName);
}

export async function updateFlowerSupplierCostSupabase(
  input: UpdateFlowerSupplierCostInput,
): Promise<FlowerSupplierCost> {
  const supabase = requireSupabaseClient();
  const branchMap = await getBranchNameMap();
  const branchName = branchMap.get(input.branch_id);

  if (!branchName) {
    throw new Error('Branch not found.');
  }

  const productName = await getProductName(input.product_id ?? null);

  const { data, error } = await supabase
    .from('flower_supplier_costs')
    .update({
      branch_id: input.branch_id,
      product_id: input.product_id ?? null,
      amount: input.amount,
      description: input.description.trim(),
      cost_date: input.cost_date,
    })
    .eq('id', input.id)
    .select('*')
    .single();

  if (error || !data) {
    throw error ?? new Error('Supplier cost not found.');
  }

  return mapSupplierCost(data as SupplierCostDbRow, branchName, productName);
}

export async function deleteFlowerSupplierCostSupabase(costId: string): Promise<void> {
  const supabase = requireSupabaseClient();
  const { error, count } = await supabase
    .from('flower_supplier_costs')
    .delete({ count: 'exact' })
    .eq('id', costId);

  if (error) {
    throw error;
  }

  if (!count) {
    throw new Error('Supplier cost not found.');
  }
}

export async function sumStaffExpensesForPeriodSupabase(options: {
  branchId?: string;
  fromDate?: string;
  toDate?: string;
}): Promise<number> {
  const expenses = await listFlowerStaffExpensesSupabase();
  return expenses
    .filter((expense) => {
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

export async function sumSupplierCostsForPeriodSupabase(options: {
  branchId?: string;
  fromDate?: string;
  toDate?: string;
}): Promise<number> {
  const costs = await listFlowerSupplierCostsSupabase();
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
