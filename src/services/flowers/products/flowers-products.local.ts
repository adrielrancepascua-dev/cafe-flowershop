import {
  FLOWER_STEMS_MOCK,
} from '../../../modules/flowers/shared/data/flowers.mock';
import type {
  CreateFlowerProductInput,
  FlowerProduct,
  UpdateFlowerProductInput,
} from '../../../modules/flowers/shared/types/flower-product';
import { normalizeFlowerProductColor } from '../../../modules/flowers/shared/utils/flower-product-colors';
import { normalizeFlowerProductKind } from '../../../modules/flowers/shared/utils/flower-product-kind';
import { getFlowerProductType } from '../../../modules/flowers/shared/utils/flower-product-type';

const PRODUCTS_STORAGE_KEY = 'papers_petals_flower_stems_v2';
const PRODUCTS_SEEDED_KEY = 'papers_petals_flower_stems_seeded_v2';
const INVENTORY_STORAGE_KEY = 'papers_petals_flower_inventory_v2';
const MOVEMENTS_STORAGE_KEY = 'papers_petals_flower_inventory_movements_v2';

function readProductsFromStorage(): FlowerProduct[] {
  if (typeof window === 'undefined') {
    return FLOWER_STEMS_MOCK.map((product) => ({ ...product }));
  }

  try {
    const seeded = window.localStorage.getItem(PRODUCTS_SEEDED_KEY);
    const raw = window.localStorage.getItem(PRODUCTS_STORAGE_KEY);

    if (!seeded) {
      const seed = FLOWER_STEMS_MOCK.map((product) => ({ ...product }));
      window.localStorage.setItem(PRODUCTS_STORAGE_KEY, JSON.stringify(seed));
      window.localStorage.setItem(PRODUCTS_SEEDED_KEY, 'true');
      return seed;
    }

    if (!raw) {
      const seed = FLOWER_STEMS_MOCK.map((product) => ({ ...product }));
      writeProductsToStorage(seed);
      return seed;
    }

    const parsed = JSON.parse(raw) as FlowerProduct[];
    if (!Array.isArray(parsed) || parsed.length === 0) {
      const seed = FLOWER_STEMS_MOCK.map((product) => ({ ...product }));
      writeProductsToStorage(seed);
      return seed;
    }

    return parsed.map((product) => {
          const product_kind = normalizeFlowerProductKind(product.product_kind);
          const color = normalizeFlowerProductColor(product.color);
          return {
            ...product,
            product_kind,
            color,
            flower_type:
              product_kind === 'flower'
                ? getFlowerProductType({
                    name: product.name,
                    color,
                    flower_type: product.flower_type,
                  })
                : '',
          };
        });
  } catch {
    return FLOWER_STEMS_MOCK.map((product) => ({ ...product }));
  }
}

export function lookupFlowerProductNameLocal(productId: string): string {
  const product = readProductsFromStorage().find((entry) => entry.id === productId);
  return product?.name ?? productId;
}

function writeProductsToStorage(products: FlowerProduct[]) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(PRODUCTS_STORAGE_KEY, JSON.stringify(products));
}

export async function listFlowerStemsLocal(): Promise<FlowerProduct[]> {
  return readProductsFromStorage().sort((a, b) => a.name.localeCompare(b.name));
}

export async function createFlowerStemLocal(input: CreateFlowerProductInput): Promise<FlowerProduct> {
  const products = readProductsFromStorage();
  const product_kind = normalizeFlowerProductKind(input.product_kind);
  const color = product_kind === 'misc' ? '' : normalizeFlowerProductColor(input.color);
  const flower_type =
    product_kind === 'flower'
      ? (input.flower_type?.trim() || input.name.trim())
      : '';
  const name = product_kind === 'flower' ? flower_type : input.name.trim();
  const created: FlowerProduct = {
    id: `${product_kind === 'misc' ? 'misc' : 'stem'}-${Date.now()}`,
    name,
    flower_type,
    product_kind,
    color,
    unit_cost: input.unit_cost,
    is_active: input.is_active ?? true,
    created_at: new Date().toISOString(),
  };

  writeProductsToStorage([created, ...products]);
  return created;
}

export async function updateFlowerStemLocal(
  productId: string,
  input: UpdateFlowerProductInput,
): Promise<FlowerProduct> {
  const products = readProductsFromStorage();
  const index = products.findIndex((product) => product.id === productId);

  if (index === -1) {
    throw new Error('Product not found.');
  }

  const product_kind = products[index].product_kind;
  const color = normalizeFlowerProductColor(input.color);
  const flower_type =
    product_kind === 'flower'
      ? (input.flower_type?.trim() || input.name.trim())
      : '';
  const name = product_kind === 'flower' ? flower_type : input.name.trim();

  products[index] = {
    ...products[index],
    name,
    flower_type,
    color,
    unit_cost: input.unit_cost,
  };

  writeProductsToStorage(products);
  return products[index];
}

export async function toggleFlowerStemActiveLocal(
  productId: string,
  isActive: boolean,
): Promise<FlowerProduct> {
  const products = readProductsFromStorage();
  const index = products.findIndex((product) => product.id === productId);

  if (index === -1) {
    throw new Error('Product not found.');
  }

  products[index] = { ...products[index], is_active: isActive };
  writeProductsToStorage(products);
  return products[index];
}

export async function deleteFlowerStemLocal(productId: string): Promise<void> {
  const products = readProductsFromStorage();
  writeProductsToStorage(products.filter((product) => product.id !== productId));

  if (typeof window !== 'undefined') {
    try {
      const rawStock = window.localStorage.getItem(INVENTORY_STORAGE_KEY);
      if (rawStock) {
        const stock = JSON.parse(rawStock) as Record<string, Record<string, number>>;
        for (const branchId of Object.keys(stock)) {
          delete stock[branchId][productId];
        }
        window.localStorage.setItem(INVENTORY_STORAGE_KEY, JSON.stringify(stock));
      }

      const rawMovements = window.localStorage.getItem(MOVEMENTS_STORAGE_KEY);
      if (rawMovements) {
        const movements = JSON.parse(rawMovements) as Array<{ product_id?: string }>;
        if (Array.isArray(movements)) {
          window.localStorage.setItem(
            MOVEMENTS_STORAGE_KEY,
            JSON.stringify(movements.filter((movement) => movement.product_id !== productId)),
          );
        }
      }
    } catch {
      // Product removal should still succeed even if inventory cleanup fails locally.
    }
  }
}
