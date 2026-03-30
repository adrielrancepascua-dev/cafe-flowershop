import { CAFE_PRODUCTS_MOCK } from '../../modules/shared/data/products.mock';
import type { CafeProduct } from '../../modules/shared/types/product';
import type { ListProductsOptions } from './products.types';

const PRODUCTS_STORAGE_KEY = 'stay_awhile_cafe_products_v1';

function cloneProducts(products: CafeProduct[]): CafeProduct[] {
  return products.map((product) => ({ ...product }));
}

function readProductsFromStorage(): CafeProduct[] {
  if (typeof window === 'undefined') {
    return cloneProducts(CAFE_PRODUCTS_MOCK);
  }

  try {
    const raw = window.localStorage.getItem(PRODUCTS_STORAGE_KEY);
    if (!raw) {
      return cloneProducts(CAFE_PRODUCTS_MOCK);
    }

    const parsed = JSON.parse(raw) as CafeProduct[];
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return cloneProducts(CAFE_PRODUCTS_MOCK);
    }

    return parsed;
  } catch {
    return cloneProducts(CAFE_PRODUCTS_MOCK);
  }
}

function writeProductsToStorage(products: CafeProduct[]) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(PRODUCTS_STORAGE_KEY, JSON.stringify(products));
}

function getLocalProducts(): CafeProduct[] {
  const stored = readProductsFromStorage();
  writeProductsToStorage(stored);
  return stored;
}

export async function listProductsLocal(options: ListProductsOptions = {}): Promise<CafeProduct[]> {
  const { includeInactive = false } = options;
  const products = getLocalProducts();

  const filtered = includeInactive ? products : products.filter((product) => product.is_active);
  return cloneProducts(filtered);
}

export async function updateProductPriceLocal(productId: string, nextPrice: number): Promise<CafeProduct> {
  const products = getLocalProducts();
  const target = products.find((product) => product.id === productId);

  if (!target) {
    throw new Error('Product not found.');
  }

  target.price = nextPrice;
  writeProductsToStorage(products);

  return { ...target };
}

export async function updateProductActiveLocal(productId: string, isActive: boolean): Promise<CafeProduct> {
  const products = getLocalProducts();
  const target = products.find((product) => product.id === productId);

  if (!target) {
    throw new Error('Product not found.');
  }

  target.is_active = isActive;
  writeProductsToStorage(products);

  return { ...target };
}
