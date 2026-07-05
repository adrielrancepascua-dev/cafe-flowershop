import type { FlowerOrderStatus } from './flower-order';
import type { FlowerPaymentMode } from '../utils/flower-payment';

export interface FlowerSalesByPaymentRow {
  payment_mode: FlowerPaymentMode;
  label: string;
  amount: number;
}

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
  receiver: string;
  scheduled_for: string;
  created_at: string;
  status: FlowerOrderStatus;
  total_amount: number;
  item_count: number;
}

export interface FlowerFinancialSummary {
  total_sales: number;
  staff_expenses: number;
  staff_expenses_cash: number;
  staff_expenses_gcash: number;
  /** Cash sales minus cash-only staff expenses for the report date. */
  cash_on_hand: number;
  supplier_costs: number;
  cogs: number;
  net_sales: number;
  sales_by_payment: FlowerSalesByPaymentRow[];
  /** Legacy owner profit using logged supplier costs. */
  net_income: number;
}

export interface FlowerReportsData {
  daily_summary: FlowerDailySalesSummaryRow[];
  monthly_summary: FlowerMonthlySalesSummaryRow[];
  advance_orders: FlowerAdvanceOrderOverviewRow[];
  financial: FlowerFinancialSummary;
}

export interface FlowerReportsOptions {
  branchId?: string;
  dailyDays?: number;
  monthlyMonths?: number;
  advanceLimit?: number;
  reportDate?: string;
  /** When staff, supplier costs and net income are omitted. */
  audience?: 'admin' | 'staff';
}

export interface FlowerDayCloseStatus {
  date: string;
  total_orders: number;
  open_orders: number;
  is_closed: boolean;
}

export type FlowerSalesReportPeriod = 'day' | 'week' | 'month';

export interface FlowerPrintableSalesOrderLine {
  order_id: string;
  pickup_date: string;
  receiver: string;
  branch_name: string;
  status: FlowerOrderStatus;
  total_amount: number;
}

export interface FlowerPrintableSalesBranchRow {
  branch_id: string;
  branch_name: string;
  order_count: number;
  sales_total: number;
  staff_expenses: number;
  supplier_costs: number;
  net_income: number;
  orders: FlowerPrintableSalesOrderLine[];
}

export interface FlowerPrintableSalesTotals {
  order_count: number;
  sales_total: number;
  staff_expenses: number;
  supplier_costs: number;
  net_income: number;
}

export interface FlowerPrintableSalesReport {
  period: FlowerSalesReportPeriod;
  period_label: string;
  from_date: string;
  to_date: string;
  generated_at: string;
  branches: FlowerPrintableSalesBranchRow[];
  totals: FlowerPrintableSalesTotals;
}
