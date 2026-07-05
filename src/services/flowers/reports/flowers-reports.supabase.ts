import { getSupabaseClient } from '../../../lib/supabase/client';
import { requireSupabaseAuthSession } from '../../../lib/auth/flower-auth.service';
import type {
  FlowerDailySalesSummaryRow,
  FlowerMonthlySalesSummaryRow,
  FlowerReportsData,
  FlowerReportsOptions,
} from '../../../modules/flowers/shared/types/flower-report';
import type { FlowerOrderStatus } from '../../../modules/flowers/shared/types/flower-order';
import { scheduledForToDateKey } from '../../../modules/flowers/shared/utils/flower-format';
import {
  buildFlowerReportFinancialSummary,
  isFlowerReportSalesIncluded,
} from '../../../modules/flowers/shared/utils/flower-report-financials';
import {
  sumStaffExpensesForPeriodSupabase,
  sumSupplierCostsForPeriodSupabase,
} from '../expenses/flowers-expenses.supabase';
import { listFlowerProductsSupabase } from '../products/flowers-products.supabase';

type BranchRow = {
  id: string;
  name: string;
};

type ReportOrderRow = {
  id: string;
  branch_id: string;
  receiver: string;
  scheduled_for: string;
  status: FlowerOrderStatus;
  total_amount: number;
  downpayment: number;
  balance: number;
  balance_paid: boolean;
  payment_mode: string;
  balance_payment_mode: string;
  created_at: string;
  flower_order_items?: Array<{
    id: number;
    product_id: string;
    item_name: string;
    quantity: number;
  }>;
};

function requireSupabaseClient() {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  return supabase;
}

async function requireAuthenticatedSupabaseClient() {
  await requireSupabaseAuthSession();
  return requireSupabaseClient();
}

function formatDateKeyUtc(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatMonthKeyUtc(date: Date): string {
  return date.toISOString().slice(0, 7);
}

function isSalesIncluded(status: FlowerOrderStatus): boolean {
  return isFlowerReportSalesIncluded(status);
}

function buildDailySkeleton(days: number): FlowerDailySalesSummaryRow[] {
  const rows: FlowerDailySalesSummaryRow[] = [];
  const now = new Date();

  for (let i = days - 1; i >= 0; i -= 1) {
    const cursor = new Date(now);
    cursor.setUTCDate(now.getUTCDate() - i);
    rows.push({
      date: formatDateKeyUtc(cursor),
      order_count: 0,
      sales_total: 0,
    });
  }

  return rows;
}

function buildMonthlySkeleton(months: number): FlowerMonthlySalesSummaryRow[] {
  const rows: FlowerMonthlySalesSummaryRow[] = [];
  const now = new Date();

  for (let i = months - 1; i >= 0; i -= 1) {
    const cursor = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    rows.push({
      month: formatMonthKeyUtc(cursor),
      order_count: 0,
      sales_total: 0,
    });
  }

  return rows;
}

export async function getFlowerReportsSupabase(options: FlowerReportsOptions = {}): Promise<FlowerReportsData> {
  const supabase = await requireAuthenticatedSupabaseClient();
  const dailyDays = options.dailyDays ?? 14;
  const monthlyMonths = options.monthlyMonths ?? 6;
  const advanceLimit = options.advanceLimit ?? 25;
  const reportDate = options.reportDate ?? formatDateKeyUtc(new Date());

  let ordersQuery = supabase
    .from('flower_orders')
    .select(
      `
      id,
      branch_id,
      receiver,
      scheduled_for,
      status,
      total_amount,
      downpayment,
      balance,
      balance_paid,
      payment_mode,
      balance_payment_mode,
      created_at,
      flower_order_items (
        id,
        product_id,
        item_name,
        quantity
      )
    `,
    )
    .order('created_at', { ascending: false });

  if (options.branchId) {
    ordersQuery = ordersQuery.eq('branch_id', options.branchId);
  }

  const [{ data: ordersData, error: ordersError }, { data: branchesData, error: branchesError }] = await Promise.all([
    ordersQuery,
    supabase.from('flower_branches').select('id, name'),
  ]);

  if (ordersError) {
    throw ordersError;
  }

  if (branchesError) {
    throw branchesError;
  }

  const branchNameById = new Map<string, string>();
  for (const branch of (branchesData as BranchRow[] | null) ?? []) {
    branchNameById.set(branch.id, branch.name);
  }

  const orderRows = (ordersData as ReportOrderRow[] | null) ?? [];

  const dailySummary = buildDailySkeleton(dailyDays);
  const dailyByDate = new Map(dailySummary.map((row) => [row.date, row]));

  const monthlySummary = buildMonthlySkeleton(monthlyMonths);
  const monthlyByMonth = new Map(monthlySummary.map((row) => [row.month, row]));

  for (const order of orderRows) {
    if (!isSalesIncluded(order.status)) {
      continue;
    }

    const pickupDate = scheduledForToDateKey(order.scheduled_for);
    const pickupMonth = pickupDate.slice(0, 7);

    const daily = dailyByDate.get(pickupDate);
    if (daily) {
      daily.order_count += 1;
      daily.sales_total += Number(order.total_amount);
    }

    const monthly = monthlyByMonth.get(pickupMonth);
    if (monthly) {
      monthly.order_count += 1;
      monthly.sales_total += Number(order.total_amount);
    }
  }

  const now = Date.now();
  const reportOrders = orderRows.map((order) => ({
    branch_id: order.branch_id,
    branch_name: branchNameById.get(order.branch_id) ?? order.branch_id,
    scheduled_for: order.scheduled_for,
    status: order.status,
    total_amount: Number(order.total_amount),
    downpayment: Number(order.downpayment ?? 0),
    balance: Number(order.balance ?? 0),
    balance_paid: Boolean(order.balance_paid),
    payment_mode: order.payment_mode ?? 'cash',
    balance_payment_mode: order.balance_payment_mode ?? '',
    items: (order.flower_order_items ?? []).map((item) => ({
      product_id: item.product_id,
      item_name: item.item_name,
      quantity: item.quantity,
    })),
  }));

  const advanceOrders = orderRows
    .filter((order) => order.scheduled_for && new Date(order.scheduled_for).getTime() > now)
    .sort((a, b) => new Date(a.scheduled_for).getTime() - new Date(b.scheduled_for).getTime())
    .slice(0, advanceLimit)
    .map((order) => ({
      order_id: order.id,
      branch_id: order.branch_id,
      branch_name: branchNameById.get(order.branch_id) ?? order.branch_id,
      receiver: order.receiver,
      scheduled_for: order.scheduled_for,
      created_at: order.created_at,
      status: order.status,
      total_amount: Number(order.total_amount),
      item_count: (order.flower_order_items ?? []).length,
    }));

  const [staffExpenses, supplierCosts, products] = await Promise.all([
    sumStaffExpensesForPeriodSupabase({
      branchId: options.branchId,
      fromDate: reportDate,
      toDate: reportDate,
    }),
    sumSupplierCostsForPeriodSupabase({
      branchId: options.branchId,
      fromDate: reportDate,
      toDate: reportDate,
    }),
    listFlowerProductsSupabase(),
  ]);

  const unitCostByProductId = new Map(products.map((product) => [product.id, product.unit_cost]));

  return {
    daily_summary: dailySummary,
    monthly_summary: monthlySummary,
    advance_orders: advanceOrders,
    financial: buildFlowerReportFinancialSummary({
      orders: reportOrders,
      reportDate,
      staffExpenses,
      supplierCosts,
      unitCostByProductId,
    }),
  };
}
