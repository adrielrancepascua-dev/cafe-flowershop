import {
  FLOWER_BRANCHES_MOCK,
  FLOWER_INVENTORY_SEED,
  FLOWER_STEMS_MOCK,
} from '../../../modules/flowers/shared/data/flowers.mock';
import type {
  AdjustFlowerInventoryInput,
  FlowerBranchOption,
  FlowerInventoryMovementRow,
  FlowerInventoryStockRow,
  ListFlowerInventoryOptions,
  TransferFlowerInventoryInput,
} from '../../../modules/flowers/shared/types/flower-inventory';
import { listFlowerStemsLocal } from '../products/flowers-products.local';

const INVENTORY_STORAGE_KEY = 'papers_petals_flower_inventory_v2';
const MOVEMENTS_STORAGE_KEY = 'papers_petals_flower_inventory_movements_v2';

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
  return FLOWER_STEMS_MOCK.find((product) => product.id === productId)?.name ?? productId;
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
        product_is_active: product.is_active,
        on_hand: onHand,
        last_updated: null,
      });
    }
  }

  return rows.sort((a, b) => {
    const branchCompare = a.branch_name.localeCompare(b.branch_name);
    if (branchCompare !== 0) {
      return branchCompare;
    }

    return a.product_name.localeCompare(b.product_name);
  });
}

export async function listFlowerInventoryMovementsLocal(
  options: ListFlowerInventoryOptions & { limit?: number } = {},
): Promise<FlowerInventoryMovementRow[]> {
  const limit = options.limit ?? 50;
  const movements = readMovementsFromStorage();

  const filtered = movements.filter((movement) => {
    if (options.branchId && movement.branch_id !== options.branchId) {
      return false;
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
}): Promise<{ previousOnHand: number; newOnHand: number }> {
  const stock = readStockFromStorage();
  const branchStock = stock[input.branchId] ?? {};
  const previousOnHand = branchStock[input.productId] ?? 0;
  const newOnHand = previousOnHand + input.delta;

  if (newOnHand < 0) {
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
}): Promise<void> {
  await applyStockChange({
    branchId: input.branchId,
    productId: input.productId,
    delta: -input.quantity,
    movementType: 'order_deduct',
    note: `Order ${input.orderId} completed`,
  });
}

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

export async function validateFlowerOrderStockLocal(
  branchId: string,
  items: Array<{ product_id: string; item_name: string; quantity: number }>,
  creditByProductId: Record<string, number> = {},
): Promise<void> {
  const stock = readStockFromStorage();
  const branchStock = stock[branchId] ?? {};
  const neededByProduct = new Map<string, { name: string; qty: number }>();

  for (const item of items) {
    const existing = neededByProduct.get(item.product_id);
    if (existing) {
      existing.qty += item.quantity;
      continue;
    }

    neededByProduct.set(item.product_id, {
      name: item.item_name,
      qty: item.quantity,
    });
  }

  for (const [productId, { name, qty }] of neededByProduct) {
    const onHand = branchStock[productId] ?? 0;
    const credit = creditByProductId[productId] ?? 0;
    const available = onHand + credit;

    if (qty > available) {
      throw new Error(
        `Insufficient stock for ${name}. Available: ${available}, requested: ${qty}.`,
      );
    }
  }
}

/** @deprecated use deductFlowerInventoryForOrderLocal */
export async function deductFlowerInventoryLocal(input: {
  branchId: string;
  productId: string;
  quantity: number;
}): Promise<void> {
  await adjustFlowerInventoryLocal({
    branchId: input.branchId,
    productId: input.productId,
    movementType: 'stock_out',
    quantity: input.quantity,
    note: 'Legacy deduction',
  });
}
