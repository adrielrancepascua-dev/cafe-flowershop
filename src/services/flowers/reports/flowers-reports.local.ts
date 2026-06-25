import type {
  FlowerReportsData,
  FlowerReportsOptions,
} from '../../../modules/flowers/shared/types/flower-report';
import type { FlowerOrderStatus } from '../../../modules/flowers/shared/types/flower-order';
import { listFlowerOrdersLocal } from '../orders/flowers-orders.local';

function formatDateKeyUtc(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatMonthKeyUtc(date: Date): string {
  return date.toISOString().slice(0, 7);
}

function isSalesIncluded(status: FlowerOrderStatus): boolean {
  return status !== 'cancelled';
}

function buildDailySkeleton(days: number) {
  const rows = [];
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

function buildMonthlySkeleton(months: number) {
  const rows = [];
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

export async function getFlowerReportsLocal(
  options: FlowerReportsOptions = {},
): Promise<FlowerReportsData> {
  const dailyDays = options.dailyDays ?? 14;
  const monthlyMonths = options.monthlyMonths ?? 6;
  const advanceLimit = options.advanceLimit ?? 25;

  const orders = await listFlowerOrdersLocal({
    branchId: options.branchId,
  });

  const dailyByKey = new Map(
    buildDailySkeleton(dailyDays).map((row) => [row.date, { ...row }]),
  );
  const monthlyByKey = new Map(
    buildMonthlySkeleton(monthlyMonths).map((row) => [row.month, { ...row }]),
  );

  const now = Date.now();
  const advanceOrders = [];

  for (const order of orders) {
    if (!isSalesIncluded(order.status)) {
      continue;
    }

    const createdDate = formatDateKeyUtc(new Date(order.created_at));
    const dailyRow = dailyByKey.get(createdDate);
    if (dailyRow) {
      dailyRow.order_count += 1;
      dailyRow.sales_total += order.total_amount;
    }

    const createdMonth = formatMonthKeyUtc(new Date(order.created_at));
    const monthlyRow = monthlyByKey.get(createdMonth);
    if (monthlyRow) {
      monthlyRow.order_count += 1;
      monthlyRow.sales_total += order.total_amount;
    }

    if (
      order.scheduled_for &&
      new Date(order.scheduled_for).getTime() > now &&
      advanceOrders.length < advanceLimit
    ) {
      advanceOrders.push({
        order_id: order.id,
        branch_id: order.branch_id,
        branch_name: order.branch_name,
        customer_name: order.customer_name,
        scheduled_for: order.scheduled_for,
        created_at: order.created_at,
        status: order.status,
        total_amount: order.total_amount,
        item_count: order.items.length,
      });
    }
  }

  return {
    daily_summary: [...dailyByKey.values()],
    monthly_summary: [...monthlyByKey.values()],
    advance_orders: advanceOrders.sort(
      (a, b) => new Date(a.scheduled_for).getTime() - new Date(b.scheduled_for).getTime(),
    ),
  };
}
