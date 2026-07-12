import {
  FLOWER_BRANCHES_MOCK,
  FLOWER_INVENTORY_SEED,
} from '../../../modules/flowers/shared/data/flowers.mock';
import type {
  AdjustFlowerInventoryInput,
  CreateFlowerTransferRequestInput,
  FlowerBranchOption,
  FlowerInventoryMovementRow,
  FlowerInventoryStockRow,
  FlowerTransferRequest,
  FlowerTransferRequestItem,
  ListFlowerInventoryMovementsOptions,
  ListFlowerInventoryOptions,
  ListFlowerTransferRequestsOptions,
  ResolveFlowerTransferRequestInput,
  TransferFlowerInventoryInput,
  UpdateFlowerTransferRequestBillingInput,
} from '../../../modules/flowers/shared/types/flower-inventory';
import { stripTransferRequestBilling } from '../../../modules/flowers/shared/utils/flower-transfer-billing';
import { listFlowerStemsLocal, lookupFlowerProductNameLocal } from '../products/flowers-products.local';
import {
  compareInventoryStockRows,
  normalizeFlowerProductColor,
} from '../../../modules/flowers/shared/utils/flower-product-colors';
import { normalizeFlowerProductKind } from '../../../modules/flowers/shared/utils/flower-product-kind';
import { formatInventoryOrderDeductNote, formatInventoryOrderVoidNote } from '../../../modules/flowers/shared/utils/flower-format';

const INVENTORY_STORAGE_KEY = 'papers_petals_flower_inventory_v2';
const MOVEMENTS_STORAGE_KEY = 'papers_petals_flower_inventory_movements_v2';
const TRANSFER_REQUESTS_STORAGE_KEY = 'papers_petals_flower_transfer_requests_v2';

type StockMap = Record<string, Record<string, number>>;

function cloneSeed(): StockMap {
  const seed: StockMap = {};
  for (const [branchId, products] of Object.entries(FLOWER_INVENTORY_SEED)) {
    seed[branchId] = { ...products };
  }
  return seed;
}

function readStockFromStorage(): StockMap {
  if (typeof window === 'undefined') {
    return cloneSeed();
  }

  try {
    const raw = window.localStorage.getItem(INVENTORY_STORAGE_KEY);
    if (!raw) {
      const seed = cloneSeed();
      writeStockToStorage(seed);
      return seed;
    }

    const parsed = JSON.parse(raw) as StockMap;
    if (!parsed || typeof parsed !== 'object') {
      return cloneSeed();
    }

    return parsed;
  } catch {
    return cloneSeed();
  }
}

function writeStockToStorage(stock: StockMap) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(INVENTORY_STORAGE_KEY, JSON.stringify(stock));
}

function readMovementsFromStorage(): FlowerInventoryMovementRow[] {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(MOVEMENTS_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as FlowerInventoryMovementRow[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeMovementsToStorage(movements: FlowerInventoryMovementRow[]) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(MOVEMENTS_STORAGE_KEY, JSON.stringify(movements));
}

function getBranchName(branchId: string): string {
  return FLOWER_BRANCHES_MOCK.find((branch) => branch.id === branchId)?.name ?? branchId;
}

function getProductName(productId: string): string {
  return lookupFlowerProductNameLocal(productId);
}

function appendMovement(
  movement: Omit<FlowerInventoryMovementRow, 'id'>,
): FlowerInventoryMovementRow {
  const movements = readMovementsFromStorage();
  const next: FlowerInventoryMovementRow = {
    ...movement,
    id: movements.length > 0 ? Math.max(...movements.map((row) => row.id)) + 1 : 1,
  };
  writeMovementsToStorage([next, ...movements]);
  return next;
}

export async function listFlowerBranchesLocal(): Promise<FlowerBranchOption[]> {
  return FLOWER_BRANCHES_MOCK.map((branch) => ({ ...branch }));
}

export async function listFlowerInventoryStockLocal(
  options: ListFlowerInventoryOptions = {},
): Promise<FlowerInventoryStockRow[]> {
  const stock = readStockFromStorage();
  const catalog = await listFlowerStemsLocal();
  const rows: FlowerInventoryStockRow[] = [];

  for (const [branchId, products] of Object.entries(stock)) {
    if (options.branchId && options.branchId !== branchId) {
      continue;
    }

    for (const product of catalog) {
      const onHand = products[product.id] ?? 0;
      rows.push({
        branch_id: branchId,
        branch_name: getBranchName(branchId),
        product_id: product.id,
        product_name: product.name,
        product_kind: normalizeFlowerProductKind(product.product_kind),
        product_color: normalizeFlowerProductColor(product.color),
        product_flower_type: product.flower_type,
        product_is_active: product.is_active,
        on_hand: onHand,
        last_updated: null,
      });
    }
  }

  return rows.sort(compareInventoryStockRows);
}

export async function listFlowerInventoryMovementsLocal(
  options: ListFlowerInventoryMovementsOptions = {},
): Promise<FlowerInventoryMovementRow[]> {
  const limit = options.limit ?? 50;
  const movements = readMovementsFromStorage();

  const filtered = movements.filter((movement) => {
    if (options.branchId && movement.branch_id !== options.branchId) {
      return false;
    }

    if (options.fromDate) {
      const fromMs = new Date(`${options.fromDate}T00:00:00`).getTime();
      if (new Date(movement.created_at).getTime() < fromMs) {
        return false;
      }
    }

    if (options.toDate) {
      const toMs = new Date(`${options.toDate}T23:59:59.999`).getTime();
      if (new Date(movement.created_at).getTime() > toMs) {
        return false;
      }
    }

    return true;
  });

  return filtered
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, limit);
}

async function applyStockChange(input: {
  branchId: string;
  productId: string;
  delta: number;
  movementType: FlowerInventoryMovementRow['movement_type'];
  note: string;
  allowNegative?: boolean;
}): Promise<{ previousOnHand: number; newOnHand: number }> {
  const stock = readStockFromStorage();
  const branchStock = stock[input.branchId] ?? {};
  const previousOnHand = branchStock[input.productId] ?? 0;
  const newOnHand = previousOnHand + input.delta;

  if (!input.allowNegative && newOnHand < 0) {
    throw new Error(
      `Insufficient stock for ${getProductName(input.productId)}. Available: ${previousOnHand}.`,
    );
  }

  branchStock[input.productId] = newOnHand;
  stock[input.branchId] = branchStock;
  writeStockToStorage(stock);

  appendMovement({
    branch_id: input.branchId,
    branch_name: getBranchName(input.branchId),
    product_id: input.productId,
    product_name: getProductName(input.productId),
    movement_type: input.movementType,
    quantity: Math.abs(input.delta),
    previous_on_hand: previousOnHand,
    new_on_hand: newOnHand,
    note: input.note,
    created_at: new Date().toISOString(),
  });

  return { previousOnHand, newOnHand };
}

export async function adjustFlowerInventoryLocal(input: AdjustFlowerInventoryInput): Promise<void> {
  const delta = input.movementType === 'stock_in' ? input.quantity : -input.quantity;

  await applyStockChange({
    branchId: input.branchId,
    productId: input.productId,
    delta,
    movementType: input.movementType,
    note: input.note?.trim() ?? '',
  });
}

export async function deductFlowerInventoryForOrderLocal(input: {
  branchId: string;
  productId: string;
  quantity: number;
  orderId: string;
  receiver: string;
  note?: string;
}): Promise<void> {
  await applyStockChange({
    branchId: input.branchId,
    productId: input.productId,
    delta: -input.quantity,
    movementType: 'order_deduct',
    note: input.note ?? formatInventoryOrderDeductNote(input.orderId, input.receiver),
    allowNegative: true,
  });
}

export async function restoreFlowerInventoryForOrderLocal(input: {
  branchId: string;
  productId: string;
  quantity: number;
  orderId: string;
  receiver: string;
  note?: string;
}): Promise<void> {
  await applyStockChange({
    branchId: input.branchId,
    productId: input.productId,
    delta: input.quantity,
    movementType: 'stock_in',
    note: input.note ?? formatInventoryOrderVoidNote(input.orderId, input.receiver),
  });
}

/** Orders may use flowers before stock-in; day-close deduction can drive counts negative. */
export async function validateFlowerOrderStockLocal(
  _branchId: string,
  _items: Array<{ product_id: string; item_name: string; quantity: number }>,
  _creditByProductId: Record<string, number> = {},
): Promise<void> {
  return;
}

/** Inter-branch stock transfer between branches. */
export async function transferFlowerInventoryLocal(
  input: TransferFlowerInventoryInput,
): Promise<void> {
  if (input.fromBranchId === input.toBranchId) {
    throw new Error('Source and destination branches must be different.');
  }

  if (input.items.length === 0) {
    throw new Error('Add at least one product to transfer.');
  }

  const note = input.note?.trim() || `Transfer to ${getBranchName(input.toBranchId)}`;

  for (const item of input.items) {
    if (item.quantity <= 0) {
      continue;
    }

    await applyStockChange({
      branchId: input.fromBranchId,
      productId: item.productId,
      delta: -item.quantity,
      movementType: 'transfer_out',
      note,
      allowNegative: true,
    });

    await applyStockChange({
      branchId: input.toBranchId,
      productId: item.productId,
      delta: item.quantity,
      movementType: 'transfer_in',
      note: `From ${getBranchName(input.fromBranchId)}`,
    });
  }
}

export async function getFlowerStockLevelLocal(branchId: string, productId: string): Promise<number> {
  const stock = readStockFromStorage();
  return stock[branchId]?.[productId] ?? 0;
}

function normalizeTransferRequest(raw: FlowerTransferRequest & {
  product_id?: string;
  product_name?: string;
  product_kind?: string;
  product_color?: string;
  product_flower_type?: string;
  quantity?: number;
}): FlowerTransferRequest {
  const billingDefaults = {
    total_cost: raw.total_cost ?? null,
    cost_paid: raw.cost_paid ?? false,
  };

  if (Array.isArray(raw.items) && raw.items.length > 0) {
    return {
      ...raw,
      ...billingDefaults,
    };
  }

  if (raw.product_id) {
    return {
      ...raw,
      ...billingDefaults,
      items: [
        {
          id: `${raw.id}-item-0`,
          product_id: raw.product_id,
          product_name: raw.product_name ?? raw.product_id,
          product_kind: normalizeFlowerProductKind(raw.product_kind),
          product_color: normalizeFlowerProductColor(raw.product_color ?? ''),
          product_flower_type: raw.product_flower_type ?? '',
          quantity: Number(raw.quantity ?? 0),
        },
      ],
    };
  }

  return { ...raw, ...billingDefaults, items: [] };
}

function readTransferRequestsFromStorage(): FlowerTransferRequest[] {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(TRANSFER_REQUESTS_STORAGE_KEY);
    if (!raw) {
      const legacyRaw = window.localStorage.getItem('papers_petals_flower_transfer_requests_v1');
      if (!legacyRaw) {
        return [];
      }

      const legacyParsed = JSON.parse(legacyRaw) as Array<
        FlowerTransferRequest & {
          product_id?: string;
          product_name?: string;
          product_kind?: string;
          product_color?: string;
          product_flower_type?: string;
          quantity?: number;
        }
      >;
      const normalized = Array.isArray(legacyParsed)
        ? legacyParsed.map((entry) => normalizeTransferRequest(entry))
        : [];
      writeTransferRequestsToStorage(normalized);
      return normalized;
    }

    const parsed = JSON.parse(raw) as Array<
      FlowerTransferRequest & {
        product_id?: string;
        product_name?: string;
        product_kind?: string;
        product_color?: string;
        product_flower_type?: string;
        quantity?: number;
      }
    >;
    return Array.isArray(parsed) ? parsed.map((entry) => normalizeTransferRequest(entry)) : [];
  } catch {
    return [];
  }
}

function writeTransferRequestsToStorage(requests: FlowerTransferRequest[]) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(TRANSFER_REQUESTS_STORAGE_KEY, JSON.stringify(requests));
}

async function getProductDetailsLocal(productId: string): Promise<{
  name: string;
  kind: string;
  color: string;
  flowerType: string;
}> {
  const catalog = await listFlowerStemsLocal();
  const product = catalog.find((entry) => entry.id === productId);

  return {
    name: product?.name ?? getProductName(productId),
    kind: normalizeFlowerProductKind(product?.product_kind),
    color: normalizeFlowerProductColor(product?.color ?? ''),
    flowerType: product?.flower_type ?? '',
  };
}

async function buildTransferRequestItems(
  items: CreateFlowerTransferRequestInput['items'],
): Promise<FlowerTransferRequestItem[]> {
  const built: FlowerTransferRequestItem[] = [];

  for (const item of items) {
    const details = await getProductDetailsLocal(item.productId);
    built.push({
      id: `item-${item.productId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      product_id: item.productId,
      product_name: details.name,
      product_kind: details.kind,
      product_color: details.color,
      product_flower_type: details.flowerType,
      quantity: item.quantity,
    });
  }

  return built;
}

/** Staff/admin file a transfer request. Stock leaves the source branch immediately (in transit). */
export async function createFlowerTransferRequestLocal(
  input: CreateFlowerTransferRequestInput,
): Promise<FlowerTransferRequest> {
  if (input.fromBranchId === input.toBranchId) {
    throw new Error('Source and destination branches must be different.');
  }

  if (input.items.length === 0) {
    throw new Error('Add at least one product to transfer.');
  }

  const mergedItems = new Map<string, number>();
  for (const item of input.items) {
    const quantity = Number(item.quantity);
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new Error('Each quantity must be a whole number greater than 0.');
    }

    mergedItems.set(item.productId, (mergedItems.get(item.productId) ?? 0) + quantity);
  }

  const normalizedItems = [...mergedItems.entries()].map(([productId, quantity]) => ({
    productId,
    quantity,
  }));

  const toBranchName = getBranchName(input.toBranchId);
  const fromBranchName = getBranchName(input.fromBranchId);

  for (const item of normalizedItems) {
    await applyStockChange({
      branchId: input.fromBranchId,
      productId: item.productId,
      delta: -item.quantity,
      movementType: 'transfer_out',
      note: `Transfer request to ${toBranchName}`,
      allowNegative: true,
    });
  }

  const request: FlowerTransferRequest = {
    id: `transfer-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    from_branch_id: input.fromBranchId,
    from_branch_name: fromBranchName,
    to_branch_id: input.toBranchId,
    to_branch_name: toBranchName,
    items: await buildTransferRequestItems(normalizedItems),
    status: 'pending',
    note: input.note?.trim() ?? '',
    requested_by_id: input.requestedById,
    requested_by_name: input.requestedByName,
    resolved_by_id: null,
    resolved_by_name: null,
    resolved_at: null,
    created_at: new Date().toISOString(),
    total_cost: null,
    cost_paid: false,
  };

  writeTransferRequestsToStorage([request, ...readTransferRequestsFromStorage()]);
  return request;
}

export async function listFlowerTransferRequestsLocal(
  options: ListFlowerTransferRequestsOptions = {},
): Promise<FlowerTransferRequest[]> {
  const requests = readTransferRequestsFromStorage();

  const filtered = requests.filter((request) => {
    if (
      options.branchId &&
      request.from_branch_id !== options.branchId &&
      request.to_branch_id !== options.branchId
    ) {
      return false;
    }

    if (options.status && request.status !== options.status) {
      return false;
    }

    return true;
  });

  const sorted = filtered.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  const limited = typeof options.limit === 'number' ? sorted.slice(0, options.limit) : sorted;

  if (options.includeBilling) {
    return limited;
  }

  return limited.map(stripTransferRequestBilling);
}

function findPendingRequest(requestId: string): {
  requests: FlowerTransferRequest[];
  index: number;
  request: FlowerTransferRequest;
} {
  const requests = readTransferRequestsFromStorage();
  const index = requests.findIndex((entry) => entry.id === requestId);

  if (index === -1) {
    throw new Error('Transfer request not found.');
  }

  const request = requests[index];
  if (request.status !== 'pending') {
    throw new Error('This transfer request has already been resolved.');
  }

  return { requests, index, request };
}

/** Receiving branch confirms delivery — stock is added to their inventory. */
export async function confirmFlowerTransferRequestLocal(
  input: ResolveFlowerTransferRequestInput,
): Promise<FlowerTransferRequest> {
  const { requests, index, request } = findPendingRequest(input.requestId);

  for (const item of request.items) {
    await applyStockChange({
      branchId: request.to_branch_id,
      productId: item.product_id,
      delta: item.quantity,
      movementType: 'transfer_in',
      note: `Transfer received from ${request.from_branch_name}`,
    });
  }

  const resolved: FlowerTransferRequest = {
    ...request,
    status: 'confirmed',
    resolved_by_id: input.resolvedById,
    resolved_by_name: input.resolvedByName,
    resolved_at: new Date().toISOString(),
  };

  requests[index] = resolved;
  writeTransferRequestsToStorage(requests);
  return resolved;
}

async function returnTransferRequestStock(request: FlowerTransferRequest, reason: string) {
  for (const item of request.items) {
    await applyStockChange({
      branchId: request.from_branch_id,
      productId: item.product_id,
      delta: item.quantity,
      movementType: 'transfer_in',
      note: reason,
      allowNegative: true,
    });
  }
}

/** Receiving branch rejects the request — stock is returned to the source branch. */
export async function rejectFlowerTransferRequestLocal(
  input: ResolveFlowerTransferRequestInput,
): Promise<FlowerTransferRequest> {
  const { requests, index, request } = findPendingRequest(input.requestId);

  await returnTransferRequestStock(request, `Transfer request rejected by ${request.to_branch_name}`);

  const resolved: FlowerTransferRequest = {
    ...request,
    status: 'rejected',
    resolved_by_id: input.resolvedById,
    resolved_by_name: input.resolvedByName,
    resolved_at: new Date().toISOString(),
  };

  requests[index] = resolved;
  writeTransferRequestsToStorage(requests);
  return resolved;
}

/** Sending branch cancels its own pending request — stock is returned to the source branch. */
export async function cancelFlowerTransferRequestLocal(
  input: ResolveFlowerTransferRequestInput,
): Promise<FlowerTransferRequest> {
  const { requests, index, request } = findPendingRequest(input.requestId);

  await returnTransferRequestStock(request, `Transfer request cancelled by ${request.from_branch_name}`);

  const resolved: FlowerTransferRequest = {
    ...request,
    status: 'cancelled',
    resolved_by_id: input.resolvedById,
    resolved_by_name: input.resolvedByName,
    resolved_at: new Date().toISOString(),
  };

  requests[index] = resolved;
  writeTransferRequestsToStorage(requests);
  return resolved;
}

export async function updateFlowerTransferRequestBillingLocal(
  input: UpdateFlowerTransferRequestBillingInput,
): Promise<FlowerTransferRequest> {
  const requests = readTransferRequestsFromStorage();
  const index = requests.findIndex((request) => request.id === input.requestId);

  if (index === -1) {
    throw new Error('Transfer request not found.');
  }

  const totalCost =
    input.total_cost === null || input.total_cost === undefined
      ? null
      : Number(input.total_cost);

  if (totalCost !== null && (!Number.isFinite(totalCost) || totalCost < 0)) {
    throw new Error('Total cost must be zero or greater.');
  }

  const updated: FlowerTransferRequest = {
    ...requests[index],
    total_cost: totalCost,
    cost_paid: Boolean(input.cost_paid),
  };

  requests[index] = updated;
  writeTransferRequestsToStorage(requests);
  return updated;
}
