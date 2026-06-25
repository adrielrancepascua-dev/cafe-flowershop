import {
  FLOWER_PRODUCTS_CATALOG_MOCK,
  toFlowerProduct,
} from '../../../modules/flowers/shared/data/flowers.mock';
import type {
  CreateFlowerProductInput,
  FlowerProduct,
  UpdateFlowerProductInput,
} from '../../../modules/flowers/shared/types/flower-product';

const PRODUCTS_STORAGE_KEY = 'stay_awhile_flower_products_v1';

function cloneCatalog() {
  return FLOWER_PRODUCTS_CATALOG_MOCK.map((item) => ({ ...item }));
}

function readCatalogFromStorage() {
  if (typeof window === 'undefined') {
    return cloneCatalog();
  }

  try {
    const raw = window.localStorage.getItem(PRODUCTS_STORAGE_KEY);
    if (!raw) {
      return cloneCatalog();
    }

    const parsed = JSON.parse(raw) as typeof FLOWER_PRODUCTS_CATALOG_MOCK;
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return cloneCatalog();
    }

    return parsed;
  } catch {
    return cloneCatalog();
  }
}

function writeCatalogToStorage(catalog: typeof FLOWER_PRODUCTS_CATALOG_MOCK) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(PRODUCTS_STORAGE_KEY, JSON.stringify(catalog));
}

function getCatalog() {
  const catalog = readCatalogFromStorage();
  writeCatalogToStorage(catalog);
  return catalog;
}

export async function listFlowerProductsLocal(): Promise<FlowerProduct[]> {
  return getCatalog().map(toFlowerProduct);
}

export async function createFlowerProductLocal(input: CreateFlowerProductInput): Promise<FlowerProduct> {
  const catalog = getCatalog();
  const created = {
    id: `fp-${Date.now()}`,
    name: input.name.trim(),
    base_price: input.base_price,
    is_active: input.is_active ?? true,
    created_at: new Date().toISOString(),
    category: 'Custom',
    description: 'Custom flower product.',
    image: 'https://images.unsplash.com/photo-1490750967868-88aa4486c946?auto=format&fit=crop&w=600&q=80',
  };

  catalog.unshift(created);
  writeCatalogToStorage(catalog);

  return toFlowerProduct(created);
}

export async function updateFlowerProductLocal(
  productId: string,
  input: UpdateFlowerProductInput,
): Promise<FlowerProduct> {
  const catalog = getCatalog();
  const target = catalog.find((product) => product.id === productId);

  if (!target) {
    throw new Error('Product not found.');
  }

  target.name = input.name.trim();
  target.base_price = input.base_price;
  writeCatalogToStorage(catalog);

  return toFlowerProduct(target);
}

export async function toggleFlowerProductActiveLocal(
  productId: string,
  isActive: boolean,
): Promise<FlowerProduct> {
  const catalog = getCatalog();
  const target = catalog.find((product) => product.id === productId);

  if (!target) {
    throw new Error('Product not found.');
  }

  target.is_active = isActive;
  writeCatalogToStorage(catalog);

  return toFlowerProduct(target);
}

export async function deleteFlowerProductLocal(productId: string): Promise<void> {
  const catalog = getCatalog();
  const nextCatalog = catalog.filter((product) => product.id !== productId);

  if (nextCatalog.length === catalog.length) {
    throw new Error('Product not found.');
  }

  writeCatalogToStorage(nextCatalog);
}

export async function listFlowerPosCatalogLocal() {
  const catalog = getCatalog();
  return catalog.filter((product) => product.is_active);
}
