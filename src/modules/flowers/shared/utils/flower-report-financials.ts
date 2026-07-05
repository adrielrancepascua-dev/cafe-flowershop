import type { FlowerOrderItem, FlowerOrderStatus } from '../types/flower-order';
import type { FlowerFinancialSummary, FlowerSalesByPaymentRow } from '../types/flower-report';
import { scheduledForToDateKey } from './flower-format';
import {
  FLOWER_PAYMENT_MODE_LABELS,
  formatFlowerPaymentModeLabel,
  normalizeFlowerPaymentMode,
  type FlowerPaymentMode,
} from './flower-payment';

export type FlowerReportOrderSnapshot = {
  branch_id: string;
  branch_name?: string;
  scheduled_for: string;
  status: FlowerOrderStatus;
  total_amount: number;
  downpayment: number;
  balance: number;
  balance_paid: boolean;
  payment_mode: string;
  balance_payment_mode: string;
  items: FlowerOrderItem[];
};

const PAYMENT_BREAKDOWN_ORDER: FlowerPaymentMode[] = [
  'cash',
  'gcash',
  'metrobank',
  'bpi',
  'eastwest',
  'bank',
];

export function isFlowerReportSalesIncluded(status: FlowerOrderStatus | string): boolean {
  return status === 'completed' || status === 'picked_up' || status === 'delivered';
}

function addPaymentAmount(
  totals: Map<FlowerPaymentMode, number>,
  mode: string | null | undefined,
  amount: number,
  branchId: string,
  branchName?: string,
): void {
  if (amount <= 0) {
    return;
  }

  const normalized = normalizeFlowerPaymentMode(mode, branchId, branchName);
  totals.set(normalized, (totals.get(normalized) ?? 0) + amount);
}

export function allocateOrderSalesByPayment(order: FlowerReportOrderSnapshot): Map<FlowerPaymentMode, number> {
  const totals = new Map<FlowerPaymentMode, number>();
  const downpayment = Number(order.downpayment) || 0;
  const balance = Number(order.balance) || 0;
  const total = Number(order.total_amount) || 0;

  if (balance > 0 && order.balance_paid && order.balance_payment_mode) {
    const downpaymentAmount = downpayment > 0 ? downpayment : Math.max(0, total - balance);
    addPaymentAmount(totals, order.payment_mode, downpaymentAmount, order.branch_id, order.branch_name);
    addPaymentAmount(totals, order.balance_payment_mode, balance, order.branch_id, order.branch_name);
    return totals;
  }

  if (downpayment > 0 && balance > 0 && !order.balance_paid) {
    addPaymentAmount(totals, order.payment_mode, downpayment, order.branch_id, order.branch_name);
    return totals;
  }

  addPaymentAmount(totals, order.payment_mode, total, order.branch_id, order.branch_name);
  return totals;
}

export function calculateCogsForOrders(
  orders: FlowerReportOrderSnapshot[],
  reportDate: string,
  unitCostByProductId: Map<string, number>,
): number {
  let cogs = 0;

  for (const order of orders) {
    if (!isFlowerReportSalesIncluded(order.status)) {
      continue;
    }

    if (scheduledForToDateKey(order.scheduled_for) !== reportDate) {
      continue;
    }

    for (const item of order.items) {
      const unitCost = unitCostByProductId.get(item.product_id) ?? 0;
      cogs += unitCost * item.quantity;
    }
  }

  return cogs;
}

export function sumSalesByPaymentForReportDate(
  orders: FlowerReportOrderSnapshot[],
  reportDate: string,
): FlowerSalesByPaymentRow[] {
  const totals = new Map<FlowerPaymentMode, number>();

  for (const order of orders) {
    if (!isFlowerReportSalesIncluded(order.status)) {
      continue;
    }

    if (scheduledForToDateKey(order.scheduled_for) !== reportDate) {
      continue;
    }

    for (const [mode, amount] of allocateOrderSalesByPayment(order)) {
      totals.set(mode, (totals.get(mode) ?? 0) + amount);
    }
  }

  const rows: FlowerSalesByPaymentRow[] = [];

  for (const mode of PAYMENT_BREAKDOWN_ORDER) {
    const amount = totals.get(mode) ?? 0;
    if (amount > 0) {
      rows.push({
        payment_mode: mode,
        label: FLOWER_PAYMENT_MODE_LABELS[mode],
        amount,
      });
    }
    totals.delete(mode);
  }

  for (const [mode, amount] of [...totals.entries()].sort((left, right) =>
    formatFlowerPaymentModeLabel(left[0]).localeCompare(formatFlowerPaymentModeLabel(right[0])),
  )) {
    if (amount > 0) {
      rows.push({
        payment_mode: mode,
        label: formatFlowerPaymentModeLabel(mode),
        amount,
      });
    }
  }

  return rows;
}

export function buildFlowerReportFinancialSummary(input: {
  orders: FlowerReportOrderSnapshot[];
  reportDate: string;
  staffExpenses: number;
  staffExpensesCash: number;
  staffExpensesGcash: number;
  supplierCosts: number;
  unitCostByProductId: Map<string, number>;
}): FlowerFinancialSummary {
  const {
    orders,
    reportDate,
    staffExpenses,
    staffExpensesCash,
    staffExpensesGcash,
    supplierCosts,
    unitCostByProductId,
  } = input;

  let totalSales = 0;

  for (const order of orders) {
    if (!isFlowerReportSalesIncluded(order.status)) {
      continue;
    }

    if (scheduledForToDateKey(order.scheduled_for) === reportDate) {
      totalSales += Number(order.total_amount) || 0;
    }
  }

  const cogs = calculateCogsForOrders(orders, reportDate, unitCostByProductId);
  const salesByPayment = sumSalesByPaymentForReportDate(orders, reportDate);
  const cashSales = salesByPayment.find((row) => row.payment_mode === 'cash')?.amount ?? 0;
  const netSales = totalSales - staffExpenses - cogs;

  return {
    total_sales: totalSales,
    staff_expenses: staffExpenses,
    staff_expenses_cash: staffExpensesCash,
    staff_expenses_gcash: staffExpensesGcash,
    cash_on_hand: cashSales - staffExpensesCash,
    supplier_costs: supplierCosts,
    cogs,
    net_sales: netSales,
    sales_by_payment: salesByPayment,
    net_income: totalSales - staffExpenses - supplierCosts,
  };
}

export function buildStaffFlowerReportFinancialSummary(
  financial: FlowerFinancialSummary,
): FlowerFinancialSummary {
  return {
    ...financial,
    cogs: 0,
    net_sales: financial.total_sales - financial.staff_expenses,
    supplier_costs: 0,
    net_income: 0,
  };
}
