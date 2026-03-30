import type { FlowerOrderStatus } from './flower-order';

export interface FlowerDailySalesSummaryRow {
  date: string;
  order_count: number;
  sales_total: number;
}

export interface FlowerMonthlySalesSummaryRow {
  month: string;
  order_count: number;
  sales_total: number;
}

export interface FlowerAdvanceOrderOverviewRow {
  order_id: string;
  branch_id: string;
  branch_name: string;
  customer_name: string | null;
  scheduled_for: string;
  created_at: string;
  status: FlowerOrderStatus;
  total_amount: number;
  item_count: number;
}

export interface FlowerReportsData {
  daily_summary: FlowerDailySalesSummaryRow[];
  monthly_summary: FlowerMonthlySalesSummaryRow[];
  advance_orders: FlowerAdvanceOrderOverviewRow[];
}

export interface FlowerReportsOptions {
  branchId?: string;
  dailyDays?: number;
  monthlyMonths?: number;
  advanceLimit?: number;
}
