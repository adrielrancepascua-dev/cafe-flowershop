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

const PRODUCTS_STORAGE_KEY = 'papers_petals_flower_stems_v2';
const PRODUCTS_SEEDED_KEY = 'papers_petals_flower_stems_seeded_v2';

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
      return [];
    }

    const parsed = JSON.parse(raw) as FlowerProduct[];
    return Array.isArray(parsed)
      ? parsed.map((product) => ({
          ...product,
          product_kind: normalizeFlowerProductKind(product.product_kind),
          color: normalizeFlowerProductColor(product.color),
        }))
      : [];
  } catch {
    return FLOWER_STEMS_MOCK.map((product) => ({ ...product }));
  }
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
  const created: FlowerProduct = {
    id: `${product_kind === 'misc' ? 'misc' : 'stem'}-${Date.now()}`,
    name: input.name.trim(),
    product_kind,
    color: product_kind === 'misc' ? '' : normalizeFlowerProductColor(input.color),
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

  products[index] = {
    ...products[index],
    name: input.name.trim(),
    color: normalizeFlowerProductColor(input.color),
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
}

/** @deprecated use listFlowerStemsLocal */
export async function listFlowerPosCatalogLocal() {
  const stems = await listFlowerStemsLocal();
  return stems.map((stem) => ({
    ...stem,
    base_price: stem.unit_cost,
    category: 'Stems',
    description: '',
    image: '',
  }));
}
