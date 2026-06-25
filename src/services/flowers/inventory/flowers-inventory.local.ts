import {
  FLOWER_BRANCHES_MOCK,
  FLOWER_INVENTORY_SEED,
  FLOWER_PRODUCTS_CATALOG_MOCK,
} from '../../../modules/flowers/shared/data/flowers.mock';
import type {
  AdjustFlowerInventoryInput,
  FlowerBranchOption,
  FlowerInventoryMovementRow,
  FlowerInventoryStockRow,
  ListFlowerInventoryOptions,
} from '../../../modules/flowers/shared/types/flower-inventory';
import { listFlowerPosCatalogLocal } from '../products/flowers-products.local';

const INVENTORY_STORAGE_KEY = 'stay_awhile_flower_inventory_v1';
const MOVEMENTS_STORAGE_KEY = 'stay_awhile_flower_inventory_movements_v1';

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
  return (
    FLOWER_PRODUCTS_CATALOG_MOCK.find((product) => product.id === productId)?.name ?? productId
  );
}

export async function listFlowerBranchesLocal(): Promise<FlowerBranchOption[]> {
  return FLOWER_BRANCHES_MOCK.map((branch) => ({ ...branch }));
}

export async function listFlowerInventoryStockLocal(
  options: ListFlowerInventoryOptions = {},
): Promise<FlowerInventoryStockRow[]> {
  const stock = readStockFromStorage();
  const catalog = await listFlowerPosCatalogLocal();
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

export async function adjustFlowerInventoryLocal(input: AdjustFlowerInventoryInput): Promise<void> {
  const stock = readStockFromStorage();
  const branchStock = stock[input.branchId] ?? {};
  const previousOnHand = branchStock[input.productId] ?? 0;
  const delta = input.movementType === 'stock_in' ? input.quantity : -input.quantity;
  const newOnHand = previousOnHand + delta;

  if (newOnHand < 0) {
    throw new Error('Insufficient stock. Stock out would result in negative balance.');
  }

  branchStock[input.productId] = newOnHand;
  stock[input.branchId] = branchStock;
  writeStockToStorage(stock);

  const movements = readMovementsFromStorage();
  const nextMovement: FlowerInventoryMovementRow = {
    id: movements.length + 1,
    branch_id: input.branchId,
    branch_name: getBranchName(input.branchId),
    product_id: input.productId,
    product_name: getProductName(input.productId),
    movement_type: input.movementType,
    quantity: input.quantity,
    previous_on_hand: previousOnHand,
    new_on_hand: newOnHand,
    note: input.note?.trim() ?? '',
    created_at: new Date().toISOString(),
  };

  writeMovementsToStorage([nextMovement, ...movements]);
}

export async function deductFlowerInventoryLocal(input: {
  branchId: string;
  productId: string;
  quantity: number;
}): Promise<void> {
  const stock = readStockFromStorage();
  const branchStock = stock[input.branchId] ?? {};
  const previousOnHand = branchStock[input.productId] ?? 0;

  if (previousOnHand < input.quantity) {
    const productName = getProductName(input.productId);
    throw new Error(
      `Insufficient stock for ${productName}. Available: ${previousOnHand}, required: ${input.quantity}.`,
    );
  }

  await adjustFlowerInventoryLocal({
    branchId: input.branchId,
    productId: input.productId,
    movementType: 'stock_out',
    quantity: input.quantity,
    note: 'POS order deduction',
  });
}
