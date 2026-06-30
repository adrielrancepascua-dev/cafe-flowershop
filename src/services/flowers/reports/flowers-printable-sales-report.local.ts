import type {
  FlowerPrintableSalesBranchRow,
  FlowerPrintableSalesReport,
  FlowerSalesReportPeriod,
} from '../../../modules/flowers/shared/types/flower-report';
import {
  getSalesReportPeriodRange,
  isPickupDateInRange,
} from '../../../modules/flowers/shared/utils/flower-report-period';
import { scheduledForToDateKey } from '../../../modules/flowers/shared/utils/flower-format';
import { listFlowerBranches } from '../inventory/flowers-inventory.service';
import { listFlowerOrders } from '../orders/flowers-orders.service';
import {
  sumStaffExpensesForPeriod,
  sumSupplierCostsForPeriod,
} from '../expenses/flowers-expenses.service';

function isSalesIncluded(status: string): boolean {
  return status === 'completed' || status === 'picked_up' || status === 'delivered';
}

export async function getFlowerPrintableSalesReportLocal(options: {
  anchorDate: string;
  period: FlowerSalesReportPeriod;
  branchId?: string;
}): Promise<FlowerPrintableSalesReport> {
  const { fromDate, toDate, periodLabel } = getSalesReportPeriodRange(
    options.anchorDate,
    options.period,
  );

  const [orders, branches] = await Promise.all([
    listFlowerOrders(),
    listFlowerBranches(),
  ]);

  const scopedBranches = options.branchId
    ? branches.filter((branch) => branch.id === options.branchId)
    : branches;

  const branchRows: FlowerPrintableSalesBranchRow[] = await Promise.all(
    scopedBranches.map(async (branch) => {
      const branchOrders = orders
        .filter((order) => {
          if (order.branch_id !== branch.id || !isSalesIncluded(order.status)) {
            return false;
          }

          const pickupDate = scheduledForToDateKey(order.scheduled_for);
          return isPickupDateInRange(pickupDate, fromDate, toDate);
        })
        .sort(
          (left, right) =>
            left.scheduled_for.localeCompare(right.scheduled_for) ||
            left.receiver.localeCompare(right.receiver),
        );

      const salesTotal = branchOrders.reduce((sum, order) => sum + order.total_amount, 0);
      const staffExpenses = await sumStaffExpensesForPeriod({
        branchId: branch.id,
        fromDate,
        toDate,
      });
      const supplierCosts = await sumSupplierCostsForPeriod({
        branchId: branch.id,
        fromDate,
        toDate,
      });

      return {
        branch_id: branch.id,
        branch_name: branch.name,
        order_count: branchOrders.length,
        sales_total: salesTotal,
        staff_expenses: staffExpenses,
        supplier_costs: supplierCosts,
        net_income: salesTotal - staffExpenses - supplierCosts,
        orders: branchOrders.map((order) => ({
          order_id: order.id,
          pickup_date: scheduledForToDateKey(order.scheduled_for),
          receiver: order.receiver,
          branch_name: order.branch_name,
          status: order.status,
          total_amount: order.total_amount,
        })),
      };
    }),
  );

  const totals = branchRows.reduce(
    (accumulator, row) => ({
      order_count: accumulator.order_count + row.order_count,
      sales_total: accumulator.sales_total + row.sales_total,
      staff_expenses: accumulator.staff_expenses + row.staff_expenses,
      supplier_costs: accumulator.supplier_costs + row.supplier_costs,
      net_income: accumulator.net_income + row.net_income,
    }),
    {
      order_count: 0,
      sales_total: 0,
      staff_expenses: 0,
      supplier_costs: 0,
      net_income: 0,
    },
  );

  return {
    period: options.period,
    period_label: periodLabel,
    from_date: fromDate,
    to_date: toDate,
    generated_at: new Date().toISOString(),
    branches: branchRows,
    totals,
  };
}
