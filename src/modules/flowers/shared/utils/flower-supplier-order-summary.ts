import type { FlowerOrder } from '../types/flower-order';
import type { FlowerProduct } from '../types/flower-product';
import type { FlowerProductKind } from './flower-product-kind';
import { normalizeFlowerProductKind } from './flower-product-kind';
import { scheduledForToDateKey, toManilaDateKeyFromDate } from './flower-format';

export interface SupplierRoundSettings {
  flowerRoundStep: number;
  miscRoundStep: number;
}

export interface SupplierSummaryLine {
  key: string;
  productId: string | null;
  itemName: string;
  kind: FlowerProductKind;
  reservedQty: number;
  suggestedOrderQty: number;
}

export interface SupplierBranchSummary {
  branchId: string;
  branchName: string;
  flowers: SupplierSummaryLine[];
  fillers: SupplierSummaryLine[];
}

export type SupplierStampStatus = 'open' | 'partial' | 'done';

export interface SupplierRangeStampState {
  status: SupplierStampStatus;
  rangeKeys: string[];
  stampedKeys: string[];
  unstampedKeys: string[];
}

export interface SupplierOrderSummaryResult {
  branches: SupplierBranchSummary[];
  grandTotalFlowers: SupplierSummaryLine[];
  grandTotalFillers: SupplierSummaryLine[];
  orderCount: number;
  stampedOrderCount: number;
  totalReservedOrderCount: number;
  stamp: SupplierRangeStampState;
  visibleOrders: FlowerOrder[];
  dateFrom: string;
  dateTo: string;
}

const DEFAULT_ROUND_SETTINGS: SupplierRoundSettings = {
  flowerRoundStep: 10,
  miscRoundStep: 1,
};

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function lineKey(productId: string | null | undefined, itemName: string): string {
  if (productId) {
    return `product:${productId}`;
  }

  return `name:${itemName.trim().toLowerCase()}`;
}

function resolveLineKind(
  productId: string,
  productsById: Map<string, FlowerProduct>,
): FlowerProductKind {
  const product = productsById.get(productId);
  return normalizeFlowerProductKind(product?.product_kind);
}

export function roundUpSupplierQuantity(quantity: number, step: number): number {
  if (quantity <= 0) {
    return 0;
  }

  if (!Number.isFinite(step) || step <= 1) {
    return quantity;
  }

  return Math.ceil(quantity / step) * step;
}

function sortSummaryLines(lines: SupplierSummaryLine[]): SupplierSummaryLine[] {
  return [...lines].sort((left, right) => left.itemName.localeCompare(right.itemName));
}

type QtyLineEntry = {
  productId: string | null;
  itemName: string;
  kind: FlowerProductKind;
  qty: number;
};

function addToLineMap(
  map: Map<string, QtyLineEntry>,
  productId: string,
  itemName: string,
  quantity: number,
  productsById: Map<string, FlowerProduct>,
): void {
  const key = lineKey(productId, itemName);
  const kind = resolveLineKind(productId, productsById);
  const existing = map.get(key);

  if (existing) {
    existing.qty += quantity;
    return;
  }

  map.set(key, {
    productId: productId || null,
    itemName: itemName.trim(),
    kind,
    qty: quantity,
  });
}

function mapToSummaryLines(
  allMap: Map<string, QtyLineEntry>,
  roundSettings: SupplierRoundSettings,
  roundQuantities: boolean,
): { flowers: SupplierSummaryLine[]; fillers: SupplierSummaryLine[] } {
  const flowers: SupplierSummaryLine[] = [];
  const fillers: SupplierSummaryLine[] = [];

  for (const [key, entry] of allMap) {
    const step =
      entry.kind === 'misc' ? roundSettings.miscRoundStep : roundSettings.flowerRoundStep;
    const line: SupplierSummaryLine = {
      key,
      productId: entry.productId,
      itemName: entry.itemName,
      kind: entry.kind,
      reservedQty: entry.qty,
      suggestedOrderQty: roundQuantities ? roundUpSupplierQuantity(entry.qty, step) : entry.qty,
    };

    if (entry.kind === 'misc') {
      fillers.push(line);
    } else {
      flowers.push(line);
    }
  }

  return {
    flowers: sortSummaryLines(flowers),
    fillers: sortSummaryLines(fillers),
  };
}

export function listDateKeysInRange(dateFrom: string, dateTo: string): string[] {
  if (!DATE_KEY_PATTERN.test(dateFrom) || !DATE_KEY_PATTERN.test(dateTo) || dateFrom > dateTo) {
    return [];
  }

  const keys: string[] = [];
  let current = dateFrom;
  while (current <= dateTo) {
    keys.push(current);
    const [year, month, day] = current.split('-').map(Number);
    current = new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
  }

  return keys;
}

export function getSupplierRangeStampState(
  stampedDates: readonly string[],
  dateFrom: string,
  dateTo: string,
): SupplierRangeStampState {
  const stampedSet = new Set(stampedDates.filter((key) => DATE_KEY_PATTERN.test(key)));
  const rangeKeys = listDateKeysInRange(dateFrom, dateTo);
  const stampedKeys = rangeKeys.filter((key) => stampedSet.has(key));
  const unstampedKeys = rangeKeys.filter((key) => !stampedSet.has(key));

  let status: SupplierStampStatus = 'open';
  if (rangeKeys.length > 0 && unstampedKeys.length === 0) {
    status = 'done';
  } else if (stampedKeys.length > 0) {
    status = 'partial';
  }

  return { status, rangeKeys, stampedKeys, unstampedKeys };
}

export function stampSupplierDateRange(
  stampedDates: readonly string[],
  dateFrom: string,
  dateTo: string,
): string[] {
  return [...new Set([...stampedDates, ...listDateKeysInRange(dateFrom, dateTo)])].sort();
}

export function unstampSupplierDateRange(
  stampedDates: readonly string[],
  dateFrom: string,
  dateTo: string,
): string[] {
  const remove = new Set(listDateKeysInRange(dateFrom, dateTo));
  return stampedDates.filter((key) => !remove.has(key));
}

export function filterOrdersForSupplierSummary(
  orders: FlowerOrder[],
  options: {
    dateFrom: string;
    dateTo: string;
    stampedDates?: readonly string[];
  },
): { reservedOrders: FlowerOrder[]; visibleOrders: FlowerOrder[] } {
  const reservedOrders = orders.filter((order) => {
    if (order.status === 'cancelled') {
      return false;
    }

    const pickupKey = scheduledForToDateKey(order.scheduled_for);
    return pickupKey >= options.dateFrom && pickupKey <= options.dateTo;
  });

  const stampedSet = new Set(options.stampedDates ?? []);
  const visibleOrders = reservedOrders.filter((order) => {
    const pickupKey = scheduledForToDateKey(order.scheduled_for);
    return !stampedSet.has(pickupKey);
  });

  return {
    reservedOrders,
    visibleOrders: [...visibleOrders].sort((left, right) =>
      right.created_at.localeCompare(left.created_at),
    ),
  };
}

function collectLineMap(
  orders: FlowerOrder[],
  productsById: Map<string, FlowerProduct>,
): Map<string, QtyLineEntry> {
  const map = new Map<string, QtyLineEntry>();
  for (const order of orders) {
    for (const item of order.items) {
      addToLineMap(map, item.product_id, item.item_name, item.quantity, productsById);
    }
  }
  return map;
}

export function buildSupplierOrderSummary(
  orders: FlowerOrder[],
  products: FlowerProduct[],
  options: {
    dateFrom: string;
    dateTo: string;
    roundSettings?: SupplierRoundSettings;
    stampedDates?: readonly string[];
  },
): SupplierOrderSummaryResult {
  const roundSettings = options.roundSettings ?? DEFAULT_ROUND_SETTINGS;
  const productsById = new Map(products.map((product) => [product.id, product]));
  const stampedDates = options.stampedDates ?? [];
  const stamp = getSupplierRangeStampState(stampedDates, options.dateFrom, options.dateTo);
  const { reservedOrders, visibleOrders } = filterOrdersForSupplierSummary(orders, {
    dateFrom: options.dateFrom,
    dateTo: options.dateTo,
    stampedDates,
  });

  const branchMaps = new Map<
    string,
    {
      branchName: string;
      lines: Map<string, QtyLineEntry>;
    }
  >();

  for (const order of visibleOrders) {
    let branchEntry = branchMaps.get(order.branch_id);
    if (!branchEntry) {
      branchEntry = {
        branchName: order.branch_name,
        lines: new Map(),
      };
      branchMaps.set(order.branch_id, branchEntry);
    }

    for (const item of order.items) {
      addToLineMap(branchEntry.lines, item.product_id, item.item_name, item.quantity, productsById);
    }
  }

  const branches: SupplierBranchSummary[] = [...branchMaps.entries()]
    .map(([branchId, entry]) => {
      const split = mapToSummaryLines(entry.lines, roundSettings, false);
      return {
        branchId,
        branchName: entry.branchName,
        flowers: split.flowers,
        fillers: split.fillers,
      };
    })
    .sort((left, right) => left.branchName.localeCompare(right.branchName));

  const grandSplit = mapToSummaryLines(collectLineMap(visibleOrders, productsById), roundSettings, true);

  return {
    branches,
    grandTotalFlowers: grandSplit.flowers,
    grandTotalFillers: grandSplit.fillers,
    orderCount: visibleOrders.length,
    stampedOrderCount: reservedOrders.length - visibleOrders.length,
    totalReservedOrderCount: reservedOrders.length,
    stamp,
    visibleOrders,
    dateFrom: options.dateFrom,
    dateTo: options.dateTo,
  };
}

export function formatSupplierSummaryDateRange(dateFrom: string, dateTo: string): string {
  if (dateFrom === dateTo) {
    return formatSupplierSummaryDateLabel(dateFrom);
  }

  return `${formatSupplierSummaryDateLabel(dateFrom)} – ${formatSupplierSummaryDateLabel(dateTo)}`;
}

export function formatSupplierSummaryDateLabel(dateKey: string): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));
  return date.toLocaleDateString('en-PH', {
    timeZone: 'Asia/Manila',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatBranchLine(line: SupplierSummaryLine): string {
  return `${line.reservedQty} ${line.itemName.toLowerCase()}`;
}

function formatOrderLine(line: SupplierSummaryLine, orderQty: number): string {
  if (line.kind === 'misc') {
    return `${orderQty} ${line.itemName.toLowerCase()}`;
  }

  return `${orderQty} stems ${line.itemName.toLowerCase()}`;
}

export function buildSupplierOrderClipboardText(input: {
  summary: SupplierOrderSummaryResult;
  orderQuantities: Map<string, number>;
}): string {
  const { summary, orderQuantities } = input;
  const lines: string[] = [
    'PAPERS & PETALS — SUPPLIER ORDER',
    formatSupplierSummaryDateRange(summary.dateFrom, summary.dateTo),
  ];

  if (summary.stamp.status === 'done') {
    lines.push('DONE — this pickup range is already stamped');
  } else if (summary.stamp.status === 'partial') {
    lines.push(
      `${summary.orderCount} order${summary.orderCount === 1 ? '' : 's'} still to order`,
      `${summary.stamp.stampedKeys.length} pickup day${
        summary.stamp.stampedKeys.length === 1 ? '' : 's'
      } already DONE and not included`,
    );
  } else {
    lines.push(`${summary.orderCount} reserved order${summary.orderCount === 1 ? '' : 's'}`);
  }

  lines.push('');

  for (const branch of summary.branches) {
    lines.push(branch.branchName.toUpperCase());
    for (const line of branch.flowers) {
      lines.push(`• ${formatBranchLine(line)}`);
    }
    for (const line of branch.fillers) {
      lines.push(`• ${formatBranchLine(line)}`);
    }
    if (branch.flowers.length === 0 && branch.fillers.length === 0) {
      lines.push('• (none)');
    }
    lines.push('');
  }

  lines.push(summary.stamp.status === 'done' ? 'TO ORDER (already done)' : 'TO ORDER');
  const allGrandLines = [...summary.grandTotalFlowers, ...summary.grandTotalFillers];
  let wroteOrderLine = false;
  for (const line of allGrandLines) {
    const orderQty = orderQuantities.get(line.key) ?? line.suggestedOrderQty;
    if (orderQty <= 0) {
      continue;
    }
    lines.push(`• ${formatOrderLine(line, orderQty)}`);
    wroteOrderLine = true;
  }
  if (!wroteOrderLine) {
    lines.push('• (none)');
  }

  return lines.join('\n');
}

export const SUPPLIER_ROUND_STEP_OPTIONS = [1, 5, 10, 20] as const;

export function readSupplierRoundSettings(): SupplierRoundSettings {
  if (typeof window === 'undefined') {
    return { ...DEFAULT_ROUND_SETTINGS };
  }

  try {
    const raw = window.localStorage.getItem('pp_supplier_round_settings');
    if (!raw) {
      return { ...DEFAULT_ROUND_SETTINGS };
    }

    const parsed = JSON.parse(raw) as Partial<SupplierRoundSettings>;
    return {
      flowerRoundStep: Number(parsed.flowerRoundStep) || DEFAULT_ROUND_SETTINGS.flowerRoundStep,
      miscRoundStep: Number(parsed.miscRoundStep) || DEFAULT_ROUND_SETTINGS.miscRoundStep,
    };
  } catch {
    return { ...DEFAULT_ROUND_SETTINGS };
  }
}

export function writeSupplierRoundSettings(settings: SupplierRoundSettings): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem('pp_supplier_round_settings', JSON.stringify(settings));
}

const STAMPED_DATES_STORAGE_KEY = 'pp_supplier_stamped_dates';
const LEGACY_LAST_LOOK_STORAGE_KEY = 'pp_supplier_last_look_iso';

export function readSupplierStampedDates(): string[] {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    window.localStorage.removeItem(LEGACY_LAST_LOOK_STORAGE_KEY);
    const raw = window.localStorage.getItem(STAMPED_DATES_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((value): value is string => typeof value === 'string' && DATE_KEY_PATTERN.test(value));
  } catch {
    return [];
  }
}

export function writeSupplierStampedDates(dates: readonly string[]): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(
    STAMPED_DATES_STORAGE_KEY,
    JSON.stringify([...new Set(dates.filter((key) => DATE_KEY_PATTERN.test(key)))].sort()),
  );
}

export function defaultSupplierDateRange(): { from: string; to: string } {
  const start = new Date();
  const end = new Date();
  end.setDate(end.getDate() + 3);

  return {
    from: toManilaDateKeyFromDate(start),
    to: toManilaDateKeyFromDate(end),
  };
}
