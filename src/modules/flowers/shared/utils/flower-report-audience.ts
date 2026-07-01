import type {
  FlowerPrintableSalesReport,
  FlowerReportsData,
} from '../types/flower-report';

/** Staff reports hide supplier costs and net income (owner-only profit). */
export function sanitizeFlowerReportsForStaff(data: FlowerReportsData): FlowerReportsData {
  return {
    ...data,
    financial: {
      total_sales: data.financial.total_sales,
      staff_expenses: data.financial.staff_expenses,
      supplier_costs: 0,
      net_income: 0,
    },
  };
}

export function sanitizeFlowerPrintableSalesReportForStaff(
  report: FlowerPrintableSalesReport,
): FlowerPrintableSalesReport {
  return {
    ...report,
    branches: report.branches.map((branch) => ({
      ...branch,
      supplier_costs: 0,
      net_income: 0,
    })),
    totals: {
      ...report.totals,
      supplier_costs: 0,
      net_income: 0,
    },
  };
}
