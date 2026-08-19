import type { FlowerInventoryStockRow } from '../types/flower-inventory';
import { FLOWER_ORDER_TERMINAL_STATUSES, type FlowerOrder } from '../types/flower-order';
import type {
  FlowerDailyInventoryBranchSummary,
  FlowerDailyInventoryCount,
  FlowerDailyInventoryCountLine,
  FlowerDailyInventoryWorksheet,
  FlowerDailyInventoryWorksheetLine,
} from '../types/flower-daily-inventory';
import { scheduledForToDateKey } from './flower-format';
import {
  missingOrderDeductionByProduct,
  type DeductibleInventoryMovement,
} from './flower-inventory-deduct';
import { miscCategoryFromFlowerType } from './flower-misc-category';
import {
  compareFlowerTypeLabels,
  compareInventoryStockRows,
  deriveFlowerTypeFromProduct,
  normalizeFlowerProductColor,
} from './flower-product-colors';
import { normalizeFlowerProductKind } from './flower-product-kind';

export function isDailyInventoryCountableRow(row: {
  product_kind: string;
  product_flower_type?: string | null;
}): boolean {
  if (normalizeFlowerProductKind(row.product_kind) === 'flower') {
    return true;
  }

  return miscCategoryFromFlowerType(row.product_flower_type) === 'gift_items';
}

export function soldPendingDeductionByProductId(
  orders: FlowerOrder[],
  countDate: string,
  branchId: string,
): Map<string, number> {
  const quantities = new Map<string, number>();

  for (const order of orders) {
    if (scheduledForToDateKey(order.scheduled_for) !== countDate) {
      continue;
    }

    if (order.branch_id !== branchId || order.status === 'cancelled' || order.inventory_deducted) {
      continue;
    }

    if (!FLOWER_ORDER_TERMINAL_STATUSES.includes(order.status)) {
      continue;
    }

    for (const item of order.items ?? []) {
      if (!item.product_id) {
        continue;
      }

      quantities.set(item.product_id, (quantities.get(item.product_id) ?? 0) + item.quantity);
    }
  }

  return quantities;
}

/**
 * Expected count must still subtract sold stems when an order was marked deducted
 * but some lines never received an order_deduct (e.g. a same-day stock out matched qty
 * under the old skip logic).
 */
export function effectiveSoldPendingDeductionByProductId(
  orders: FlowerOrder[],
  movements: DeductibleInventoryMovement[],
  countDate: string,
  branchId: string,
): Map<string, number> {
  const quantities = soldPendingDeductionByProductId(orders, countDate, branchId);

  for (const order of orders) {
    if (scheduledForToDateKey(order.scheduled_for) !== countDate) {
      continue;
    }

    if (
      order.branch_id !== branchId ||
      order.status === 'cancelled' ||
      !order.inventory_deducted ||
      !FLOWER_ORDER_TERMINAL_STATUSES.includes(order.status)
    ) {
      continue;
    }

    const missing = missingOrderDeductionByProduct({
      orderId: order.id,
      items: order.items ?? [],
      movements,
    });

    for (const [productId, quantity] of missing) {
      quantities.set(productId, (quantities.get(productId) ?? 0) + quantity);
    }
  }

  return quantities;
}

export function computeExpectedOnHand(systemOnHand: number, soldPendingDeduction: number): number {
  return systemOnHand - soldPendingDeduction;
}

export function computeDailyInventoryVariance(actualCount: number, expectedOnHand: number): number {
  return actualCount - expectedOnHand;
}

export function formatDailyInventoryVariance(variance: number): string {
  if (variance === 0) {
    return 'Match';
  }

  return variance > 0 ? `+${variance}` : String(variance);
}

export function summarizeDailyInventoryVariances(
  lines: Array<{ variance: number }>,
): Pick<
  FlowerDailyInventoryBranchSummary,
  'match_count' | 'short_count' | 'extra_count' | 'short_units' | 'extra_units'
> {
  let matchCount = 0;
  let shortCount = 0;
  let extraCount = 0;
  let shortUnits = 0;
  let extraUnits = 0;

  for (const line of lines) {
    if (line.variance === 0) {
      matchCount += 1;
      continue;
    }

    if (line.variance < 0) {
      shortCount += 1;
      shortUnits += -line.variance;
      continue;
    }

    extraCount += 1;
    extraUnits += line.variance;
  }

  return {
    match_count: matchCount,
    short_count: shortCount,
    extra_count: extraCount,
    short_units: shortUnits,
    extra_units: extraUnits,
  };
}

function shouldIncludeWorksheetRow(
  row: FlowerInventoryStockRow,
  soldPending: Map<string, number>,
): boolean {
  if (!isDailyInventoryCountableRow(row)) {
    return false;
  }

  if (row.product_is_active) {
    return true;
  }

  return row.on_hand !== 0 || (soldPending.get(row.product_id) ?? 0) > 0;
}

function worksheetLineFromStockRow(
  row: FlowerInventoryStockRow,
  soldPending: Map<string, number>,
): FlowerDailyInventoryWorksheetLine {
  const soldPendingDeduction = soldPending.get(row.product_id) ?? 0;
  const expectedOnHand = computeExpectedOnHand(row.on_hand, soldPendingDeduction);

  return {
    product_id: row.product_id,
    product_name: row.product_name,
    product_kind: normalizeFlowerProductKind(row.product_kind),
    product_color: normalizeFlowerProductColor(row.product_color),
    product_flower_type: row.product_flower_type,
    system_on_hand: row.on_hand,
    sold_pending_deduction: soldPendingDeduction,
    expected_on_hand: expectedOnHand,
    actual_count: null,
    variance: null,
  };
}

function worksheetLineFromSubmitted(
  line: FlowerDailyInventoryCountLine,
): FlowerDailyInventoryWorksheetLine {
  return {
    product_id: line.product_id,
    product_name: line.product_name,
    product_kind: line.product_kind,
    product_color: line.product_color,
    product_flower_type: line.product_flower_type,
    system_on_hand: line.system_on_hand,
    sold_pending_deduction: line.sold_pending_deduction,
    expected_on_hand: line.expected_on_hand,
    actual_count: line.actual_count,
    variance: line.variance,
  };
}

export function parseDailyInventoryCountInput(value: string | number | null | undefined): number {
  if (typeof value === 'number') {
    if (!Number.isInteger(value) || value < 0) {
      throw new Error('Count must be a whole number of 0 or more.');
    }

    return value;
  }

  const trimmed = String(value ?? '').trim();
  if (trimmed === '') {
    return 0;
  }

  const parsed = Number(trimmed);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error('Count must be a whole number of 0 or more.');
  }

  return parsed;
}

export function matchesDailyInventorySearch(
  line: FlowerDailyInventoryWorksheetLine,
  query: string,
): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return true;
  }

  return [line.product_name, line.product_color, line.product_flower_type]
    .join(' ')
    .toLowerCase()
    .includes(needle);
}

export function buildDailyInventoryWorksheet(input: {
  branchId: string;
  branchName: string;
  countDate: string;
  stockRows: FlowerInventoryStockRow[];
  orders: FlowerOrder[];
  movements?: DeductibleInventoryMovement[];
  submitted: FlowerDailyInventoryCount | null;
}): FlowerDailyInventoryWorksheet {
  const soldPending = input.movements
    ? effectiveSoldPendingDeductionByProductId(
        input.orders,
        input.movements,
        input.countDate,
        input.branchId,
      )
    : soldPendingDeductionByProductId(input.orders, input.countDate, input.branchId);
  const liveLines = input.stockRows
    .filter((row) => row.branch_id === input.branchId && shouldIncludeWorksheetRow(row, soldPending))
    .sort(compareInventoryStockRows)
    .map((row) => worksheetLineFromStockRow(row, soldPending));

  if (!input.submitted) {
    return {
      branch_id: input.branchId,
      branch_name: input.branchName,
      count_date: input.countDate,
      submitted: null,
      lines: liveLines,
    };
  }

  const submittedByProductId = new Map(input.submitted.lines.map((line) => [line.product_id, line]));
  const liveProductIds = new Set(liveLines.map((line) => line.product_id));
  const lines = liveLines.map((line) => {
    const submittedLine = submittedByProductId.get(line.product_id);
    if (!submittedLine) {
      return line;
    }

    return {
      ...line,
      actual_count: submittedLine.actual_count,
      variance: computeDailyInventoryVariance(submittedLine.actual_count, line.expected_on_hand),
    };
  });

  for (const submittedLine of input.submitted.lines) {
    if (!liveProductIds.has(submittedLine.product_id)) {
      lines.push(worksheetLineFromSubmitted(submittedLine));
    }
  }

  lines.sort((left, right) =>
    compareInventoryStockRows(
      {
        branch_id: input.branchId,
        branch_name: input.branchName,
        product_id: left.product_id,
        product_name: left.product_name,
        product_kind: left.product_kind,
        product_color: left.product_color,
        product_flower_type: left.product_flower_type,
        product_is_active: true,
        on_hand: left.expected_on_hand,
        last_updated: null,
      },
      {
        branch_id: input.branchId,
        branch_name: input.branchName,
        product_id: right.product_id,
        product_name: right.product_name,
        product_kind: right.product_kind,
        product_color: right.product_color,
        product_flower_type: right.product_flower_type,
        product_is_active: true,
        on_hand: right.expected_on_hand,
        last_updated: null,
      },
    ),
  );

  return {
    branch_id: input.branchId,
    branch_name: input.branchName,
    count_date: input.countDate,
    submitted: input.submitted,
    lines,
  };
}

export function groupDailyInventoryWorksheetLines(lines: FlowerDailyInventoryWorksheetLine[]): Array<{
  key: string;
  title: string;
  lines: FlowerDailyInventoryWorksheetLine[];
}> {
  const flowerGroups = new Map<string, FlowerDailyInventoryWorksheetLine[]>();
  const giftItems: FlowerDailyInventoryWorksheetLine[] = [];

  for (const line of lines) {
    if (normalizeFlowerProductKind(line.product_kind) === 'misc') {
      giftItems.push(line);
      continue;
    }

    const flowerType = line.product_flower_type.trim() || deriveFlowerTypeFromProduct(line.product_name, line.product_color);
    const group = flowerGroups.get(flowerType) ?? [];
    group.push(line);
    flowerGroups.set(flowerType, group);
  }

  const grouped = [...flowerGroups.entries()]
    .sort(([left], [right]) => compareFlowerTypeLabels(left, right))
    .map(([title, groupLines]) => ({
      key: `flower:${title}`,
      title,
      lines: groupLines,
    }));

  if (giftItems.length > 0) {
    grouped.push({
      key: 'gift_items',
      title: 'Gift items',
      lines: giftItems,
    });
  }

  return grouped;
}

export function buildDailyInventoryBranchSummary(input: {
  branchId: string;
  branchName: string;
  countDate: string;
  submitted: FlowerDailyInventoryCount | null;
}): FlowerDailyInventoryBranchSummary {
  if (!input.submitted) {
    return {
      branch_id: input.branchId,
      branch_name: input.branchName,
      count_date: input.countDate,
      submitted: false,
      submitted_at: null,
      submitted_by_name: null,
      match_count: 0,
      short_count: 0,
      extra_count: 0,
      short_units: 0,
      extra_units: 0,
    };
  }

  return {
    branch_id: input.branchId,
    branch_name: input.branchName,
    count_date: input.countDate,
    submitted: true,
    submitted_at: input.submitted.submitted_at,
    submitted_by_name: input.submitted.submitted_by_name,
    ...summarizeDailyInventoryVariances(input.submitted.lines),
  };
}
