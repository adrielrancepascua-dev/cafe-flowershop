import type { FlowerOrder } from '../types/flower-order';
import type { FlowerProduct } from '../types/flower-product';
import type { FlowerProductKind } from './flower-product-kind';
import { normalizeFlowerProductKind } from './flower-product-kind';
import {
  formatOrderInputTimestamp,
  parseFlowerTimestamp,
  scheduledForToDateKey,
  toManilaDateKeyFromDate,
} from './flower-format';

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
  newQty: number;
  suggestedOrderQty: number;
}

export interface SupplierBranchSummary {
  branchId: string;
  branchName: string;
  flowers: SupplierSummaryLine[];
  fillers: SupplierSummaryLine[];
}

export interface SupplierOrderSummaryResult {
  branches: SupplierBranchSummary[];
  grandTotalFlowers: SupplierSummaryLine[];
  grandTotalFillers: SupplierSummaryLine[];
  orderCount: number;
  newOrderCount: number;
  createdAfterIso: string | null;
  newOrders: FlowerOrder[];
  dateFrom: string;
  dateTo: string;
}

const DEFAULT_ROUND_SETTINGS: SupplierRoundSettings = {
  flowerRoundStep: 10,
  miscRoundStep: 1,
};

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
  newQtyByKey: Map<string, number>,
  roundSettings: SupplierRoundSettings,
  roundQuantities: boolean,
  suggestNew: boolean,
): { flowers: SupplierSummaryLine[]; fillers: SupplierSummaryLine[] } {
  const flowers: SupplierSummaryLine[] = [];
  const fillers: SupplierSummaryLine[] = [];

  for (const [key, entry] of allMap) {
    const newQty = newQtyByKey.get(key) ?? 0;
    const step =
      entry.kind === 'misc' ? roundSettings.miscRoundStep : roundSettings.flowerRoundStep;
    const sourceQty = suggestNew ? newQty : entry.qty;
    const line: SupplierSummaryLine = {
      key,
      productId: entry.productId,
      itemName: entry.itemName,
      kind: entry.kind,
      reservedQty: entry.qty,
      newQty,
      suggestedOrderQty: roundQuantities ? roundUpSupplierQuantity(sourceQty, step) : sourceQty,
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

export function isOrderCreatedAfterCutoff(
  createdAtIso: string,
  createdAfterIso: string,
): boolean {
  const createdMs = parseFlowerTimestamp(createdAtIso).getTime();
  const cutoffMs = parseFlowerTimestamp(createdAfterIso).getTime();
  if (Number.isNaN(createdMs) || Number.isNaN(cutoffMs)) {
    return false;
  }

  return createdMs > cutoffMs;
}

export function filterOrdersForSupplierSummary(
  orders: FlowerOrder[],
  options: {
    dateFrom: string;
    dateTo: string;
    createdAfterIso?: string | null;
  },
): { reservedOrders: FlowerOrder[]; includedOrders: FlowerOrder[] } {
  const reservedOrders = orders.filter((order) => {
    if (order.status === 'cancelled') {
      return false;
    }

    const pickupKey = scheduledForToDateKey(order.scheduled_for);
    return pickupKey >= options.dateFrom && pickupKey <= options.dateTo;
  });

  const cutoff = options.createdAfterIso?.trim() || '';
  const includedOrders = cutoff
    ? reservedOrders.filter((order) => isOrderCreatedAfterCutoff(order.created_at, cutoff))
    : reservedOrders;

  return {
    reservedOrders,
    includedOrders: [...includedOrders].sort((left, right) =>
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
    createdAfterIso?: string | null;
  },
): SupplierOrderSummaryResult {
  const roundSettings = options.roundSettings ?? DEFAULT_ROUND_SETTINGS;
  const productsById = new Map(products.map((product) => [product.id, product]));
  const createdAfterIso = options.createdAfterIso?.trim() || null;
  const { reservedOrders, includedOrders: newOrders } = filterOrdersForSupplierSummary(orders, {
    dateFrom: options.dateFrom,
    dateTo: options.dateTo,
    createdAfterIso,
  });
  const suggestNew = Boolean(createdAfterIso);
  const allMap = collectLineMap(reservedOrders, productsById);
  const newQtyByKey = new Map<string, number>();
  for (const [key, entry] of collectLineMap(createdAfterIso ? newOrders : [], productsById)) {
    newQtyByKey.set(key, entry.qty);
  }

  const branchMaps = new Map<
    string,
    {
      branchName: string;
      lines: Map<string, QtyLineEntry>;
    }
  >();

  for (const order of reservedOrders) {
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
      const split = mapToSummaryLines(entry.lines, newQtyByKey, roundSettings, false, false);
      return {
        branchId,
        branchName: entry.branchName,
        flowers: split.flowers,
        fillers: split.fillers,
      };
    })
    .sort((left, right) => left.branchName.localeCompare(right.branchName));

  const grandSplit = mapToSummaryLines(allMap, newQtyByKey, roundSettings, true, suggestNew);

  return {
    branches,
    grandTotalFlowers: grandSplit.flowers,
    grandTotalFillers: grandSplit.fillers,
    orderCount: reservedOrders.length,
    newOrderCount: createdAfterIso ? newOrders.length : 0,
    createdAfterIso,
    newOrders: createdAfterIso ? newOrders : [],
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

function formatSupplierSummaryDateLabel(dateKey: string): string {
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
    `${summary.orderCount} reserved order${summary.orderCount === 1 ? '' : 's'}`,
  ];

  if (summary.createdAfterIso) {
    lines.push(
      `New = inputted after ${formatOrderInputTimestamp(summary.createdAfterIso)}`,
      `${summary.newOrderCount} new order${summary.newOrderCount === 1 ? '' : 's'} to add`,
    );
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

  lines.push(summary.createdAfterIso ? 'TO ORDER (new additions)' : 'TO ORDER');
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

const LAST_LOOK_STORAGE_KEY = 'pp_supplier_last_look_iso';

export function readSupplierLastLookIso(): string {
  if (typeof window === 'undefined') {
    return '';
  }

  try {
    return window.localStorage.getItem(LAST_LOOK_STORAGE_KEY)?.trim() ?? '';
  } catch {
    return '';
  }
}

export function writeSupplierLastLookIso(iso: string | null): void {
  if (typeof window === 'undefined') {
    return;
  }

  const trimmed = iso?.trim() ?? '';
  if (!trimmed) {
    window.localStorage.removeItem(LAST_LOOK_STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(LAST_LOOK_STORAGE_KEY, trimmed);
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
