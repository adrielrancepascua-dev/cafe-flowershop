import { getSupabaseClient } from '../../../lib/supabase/client';
import { requireSupabaseAuthSession } from '../../../lib/auth/flower-auth.service';
import type {
  FlowerDailySalesSummaryRow,
  FlowerMonthlySalesSummaryRow,
  FlowerReportsData,
  FlowerReportsOptions,
} from '../../../modules/flowers/shared/types/flower-report';
import type { FlowerOrderStatus } from '../../../modules/flowers/shared/types/flower-order';
import {
  getLocalDayBoundsIso,
  scheduledForToDateKey,
  toManilaDateKeyFromDate,
} from '../../../modules/flowers/shared/utils/flower-format';
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

type SupabaseClient = NonNullable<ReturnType<typeof getSupabaseClient>>;

const REPORT_ORDER_SELECT = `
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
`;

/** Statuses that count toward sales totals (matches isFlowerReportSalesIncluded). */
const REPORT_SALES_STATUSES: FlowerOrderStatus[] = ['completed', 'picked_up', 'delivered'];

/** PostgREST default max rows — page explicitly so older months are not truncated. */
const REPORT_ORDERS_PAGE_SIZE = 1000;

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

function maxDateKey(left: string, right: string): string {
  return left >= right ? left : right;
}

/**
 * Load every sales-included order in a Manila pickup window, paging past the
 * silent 1000-row PostgREST cap so monthly totals are not truncated.
 */
async function listSalesOrdersForReportsPaged(
  supabase: SupabaseClient,
  options: {
    branchId?: string;
    scheduledFromIso: string;
    scheduledToIso: string;
  },
): Promise<ReportOrderRow[]> {
  const rows: ReportOrderRow[] = [];
  let offset = 0;

  for (;;) {
    let query = supabase
      .from('flower_orders')
      .select(REPORT_ORDER_SELECT)
      .in('status', REPORT_SALES_STATUSES)
      .gte('scheduled_for', options.scheduledFromIso)
      .lte('scheduled_for', options.scheduledToIso)
      .order('scheduled_for', { ascending: true })
      .order('id', { ascending: true })
      .range(offset, offset + REPORT_ORDERS_PAGE_SIZE - 1);

    if (options.branchId) {
      query = query.eq('branch_id', options.branchId);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    const page = (data as ReportOrderRow[] | null) ?? [];
    rows.push(...page);

    if (page.length < REPORT_ORDERS_PAGE_SIZE) {
      break;
    }

    offset += REPORT_ORDERS_PAGE_SIZE;
  }

  return rows;
}

/** Upcoming pickups for the advance list — not limited to completed sales statuses. */
async function listAdvanceOrdersForReports(
  supabase: SupabaseClient,
  options: {
    branchId?: string;
    advanceLimit: number;
  },
): Promise<ReportOrderRow[]> {
  let query = supabase
    .from('flower_orders')
    .select(REPORT_ORDER_SELECT)
    .gt('scheduled_for', new Date().toISOString())
    .order('scheduled_for', { ascending: true })
    .limit(options.advanceLimit);

  if (options.branchId) {
    query = query.eq('branch_id', options.branchId);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return (data as ReportOrderRow[] | null) ?? [];
}

export async function getFlowerReportsSupabase(options: FlowerReportsOptions = {}): Promise<FlowerReportsData> {
  const supabase = await requireAuthenticatedSupabaseClient();
  const dailyDays = options.dailyDays ?? 14;
  const monthlyMonths = options.monthlyMonths ?? 6;
  const advanceLimit = options.advanceLimit ?? 25;
  const reportDate = options.reportDate ?? formatDateKeyUtc(new Date());

  const dailySummary = buildDailySkeleton(dailyDays);
  const monthlySummary = buildMonthlySkeleton(monthlyMonths);

  const oldestMonth = monthlySummary[0]?.month ?? formatMonthKeyUtc(new Date());
  const startDateKey = `${oldestMonth}-01`;
  const todayManila = toManilaDateKeyFromDate(new Date());
  const endDateKey = maxDateKey(todayManila, reportDate);
  const { startIso: scheduledFromIso } = getLocalDayBoundsIso(startDateKey);
  const { endIso: scheduledToIso } = getLocalDayBoundsIso(endDateKey);

  const [orderRows, advanceOrderRows, branchesResult] = await Promise.all([
    listSalesOrdersForReportsPaged(supabase, {
      branchId: options.branchId,
      scheduledFromIso,
      scheduledToIso,
    }),
    listAdvanceOrdersForReports(supabase, {
      branchId: options.branchId,
      advanceLimit,
    }),
    supabase.from('flower_branches').select('id, name'),
  ]);

  if (branchesResult.error) {
    throw branchesResult.error;
  }

  const branchNameById = new Map<string, string>();
  for (const branch of (branchesResult.data as BranchRow[] | null) ?? []) {
    branchNameById.set(branch.id, branch.name);
  }

  const dailyByDate = new Map(dailySummary.map((row) => [row.date, row]));
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

  const advanceOrders = advanceOrderRows.map((order) => ({
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

  const [staffExpenses, staffExpensesCash, staffExpensesGcash, supplierCosts, products] =
    await Promise.all([
    sumStaffExpensesForPeriodSupabase({
      branchId: options.branchId,
      fromDate: reportDate,
      toDate: reportDate,
    }),
    sumStaffExpensesForPeriodSupabase({
      branchId: options.branchId,
      fromDate: reportDate,
      toDate: reportDate,
      paymentMode: 'cash',
    }),
    sumStaffExpensesForPeriodSupabase({
      branchId: options.branchId,
      fromDate: reportDate,
      toDate: reportDate,
      paymentMode: 'gcash',
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
      staffExpensesCash,
      staffExpensesGcash,
      supplierCosts,
      unitCostByProductId,
    }),
  };
}
