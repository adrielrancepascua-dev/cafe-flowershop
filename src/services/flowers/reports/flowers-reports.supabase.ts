import { getSupabaseClient } from '../../../lib/supabase/client';
import type {
  FlowerDailySalesSummaryRow,
  FlowerMonthlySalesSummaryRow,
  FlowerReportsData,
  FlowerReportsOptions,
} from '../../../modules/flowers/shared/types/flower-report';
import type { FlowerOrderStatus } from '../../../modules/flowers/shared/types/flower-order';

type BranchRow = {
  id: string;
  name: string;
};

type ReportOrderRow = {
  id: string;
  branch_id: string;
  customer_name: string | null;
  scheduled_for: string | null;
  status: FlowerOrderStatus;
  total_amount: number;
  created_at: string;
  flower_order_items?: Array<{ id: number }>;
};

function requireSupabaseClient() {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  return supabase;
}

function formatDateKeyUtc(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatMonthKeyUtc(date: Date): string {
  return date.toISOString().slice(0, 7);
}

function isSalesIncluded(status: FlowerOrderStatus): boolean {
  return status !== 'cancelled';
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
  const supabase = requireSupabaseClient();
  const dailyDays = options.dailyDays ?? 14;
  const monthlyMonths = options.monthlyMonths ?? 6;
  const advanceLimit = options.advanceLimit ?? 25;

  let ordersQuery = supabase
    .from('flower_orders')
    .select(
      `
      id,
      branch_id,
      customer_name,
      scheduled_for,
      status,
      total_amount,
      created_at,
      flower_order_items (
        id
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

    const createdAt = new Date(order.created_at);
    const dateKey = formatDateKeyUtc(createdAt);
    const monthKey = formatMonthKeyUtc(createdAt);

    const daily = dailyByDate.get(dateKey);
    if (daily) {
      daily.order_count += 1;
      daily.sales_total += Number(order.total_amount);
    }

    const monthly = monthlyByMonth.get(monthKey);
    if (monthly) {
      monthly.order_count += 1;
      monthly.sales_total += Number(order.total_amount);
    }
  }

  const now = Date.now();
  const advanceOrders = orderRows
    .filter((order) => order.scheduled_for && new Date(order.scheduled_for).getTime() > now)
    .sort((a, b) => new Date(a.scheduled_for as string).getTime() - new Date(b.scheduled_for as string).getTime())
    .slice(0, advanceLimit)
    .map((order) => ({
      order_id: order.id,
      branch_id: order.branch_id,
      branch_name: branchNameById.get(order.branch_id) ?? order.branch_id,
      customer_name: order.customer_name,
      scheduled_for: order.scheduled_for as string,
      created_at: order.created_at,
      status: order.status,
      total_amount: Number(order.total_amount),
      item_count: (order.flower_order_items ?? []).length,
    }));

  return {
    daily_summary: dailySummary,
    monthly_summary: monthlySummary,
    advance_orders: advanceOrders,
  };
}
