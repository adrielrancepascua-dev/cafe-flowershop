import type {
  FlowerInventoryStockPrintLayout,
  FlowerInventoryStockRow,
  FlowerPrintableInventoryMovementsReport,
  FlowerPrintableInventoryStockReport,
  FlowerPrintableInventoryStockSection,
} from '../../../modules/flowers/shared/types/flower-inventory';
import type { FlowerSalesReportPeriod } from '../../../modules/flowers/shared/types/flower-report';
import { getSalesReportPeriodRange } from '../../../modules/flowers/shared/utils/flower-report-period';
import { listFlowerInventoryMovements, listFlowerInventoryStock } from './flowers-inventory.service';

function buildStockSection(
  branchId: string,
  branchName: string,
  rows: FlowerInventoryStockRow[],
): FlowerPrintableInventoryStockSection {
  const productRows = rows
    .filter((row) => row.branch_id === branchId)
    .sort((left, right) => left.product_name.localeCompare(right.product_name))
    .map((row) => ({
      product_name: row.product_name,
      on_hand: row.on_hand,
    }));

  return {
    branch_id: branchId,
    branch_name: branchName,
    total_units: productRows.reduce((sum, row) => sum + row.on_hand, 0),
    rows: productRows,
  };
}

function aggregateCombinedSection(rows: FlowerInventoryStockRow[]): FlowerPrintableInventoryStockSection {
  const totals = new Map<string, number>();

  for (const row of rows) {
    totals.set(row.product_name, (totals.get(row.product_name) ?? 0) + row.on_hand);
  }

  const productRows = [...totals.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([product_name, on_hand]) => ({ product_name, on_hand }));

  return {
    branch_id: 'all',
    branch_name: 'All branches (combined)',
    total_units: productRows.reduce((sum, row) => sum + row.on_hand, 0),
    rows: productRows,
  };
}

export async function getFlowerPrintableInventoryStockReport(options: {
  branchId?: string;
  layout: FlowerInventoryStockPrintLayout;
  branchLabel?: string;
}): Promise<FlowerPrintableInventoryStockReport> {
  const stockRows = await listFlowerInventoryStock({
    branchId: options.branchId,
  });

  if (options.branchId) {
    const branchName = stockRows[0]?.branch_name ?? options.branchLabel ?? 'Branch';
    const section = buildStockSection(options.branchId, branchName, stockRows);

    return {
      generated_at: new Date().toISOString(),
      layout: 'by_branch',
      branch_label: branchName,
      sections: [section],
      total_units: section.total_units,
    };
  }

  if (options.layout === 'combined') {
    const section = aggregateCombinedSection(stockRows);

    return {
      generated_at: new Date().toISOString(),
      layout: 'combined',
      branch_label: 'All branches (combined totals)',
      sections: [section],
      total_units: section.total_units,
    };
  }

  const branchOrder = [...new Map(stockRows.map((row) => [row.branch_id, row.branch_name])).entries()];
  const sections = branchOrder.map(([branchId, branchName]) =>
    buildStockSection(branchId, branchName, stockRows),
  );

  return {
    generated_at: new Date().toISOString(),
    layout: 'by_branch',
    branch_label: 'All branches (by branch)',
    sections,
    total_units: sections.reduce((sum, section) => sum + section.total_units, 0),
  };
}

export async function getFlowerPrintableInventoryMovementsReport(options: {
  anchorDate: string;
  period: FlowerSalesReportPeriod;
  branchId?: string;
  branchLabel: string;
}): Promise<FlowerPrintableInventoryMovementsReport> {
  const { fromDate, toDate, periodLabel } = getSalesReportPeriodRange(options.anchorDate, options.period);

  const movements = await listFlowerInventoryMovements({
    branchId: options.branchId,
    fromDate,
    toDate,
    limit: 2000,
  });

  return {
    generated_at: new Date().toISOString(),
    period_label: periodLabel,
    from_date: fromDate,
    to_date: toDate,
    branch_label: options.branchLabel,
    movements,
  };
}
