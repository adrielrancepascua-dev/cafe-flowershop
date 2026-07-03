import type {
  FlowerPrintableSalesReport,
  FlowerReportsData,
} from '../types/flower-report';
import { buildStaffFlowerReportFinancialSummary } from './flower-report-financials';

/** Staff reports hide COGS, supplier costs, and legacy net income. */
export function sanitizeFlowerReportsForStaff(data: FlowerReportsData): FlowerReportsData {
  return {
    ...data,
    financial: buildStaffFlowerReportFinancialSummary(data.financial),
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
