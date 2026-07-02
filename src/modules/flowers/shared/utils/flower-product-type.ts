import type { FlowerProduct } from '../types/flower-product';
import {
  compareFlowerProducts,
  compareFlowerTypeLabels,
  deriveFlowerTypeFromProduct,
} from './flower-product-colors';

export function getFlowerProductType(
  product: Pick<FlowerProduct, 'name' | 'color' | 'flower_type'>,
): string {
  const explicitType = product.flower_type?.trim();
  if (explicitType) {
    return explicitType;
  }

  return deriveFlowerTypeFromProduct(product.name, product.color);
}

export function normalizeFlowerProductType(
  name: string,
  _color: string,
  flowerType?: string | null,
): string {
  const explicitType = flowerType?.trim();
  if (explicitType) {
    return explicitType;
  }

  return name.trim();
}

export type FlowerProductTypeGroup = {
  flowerType: string;
  variants: FlowerProduct[];
  isCategory: boolean;
};

export function groupFlowerProductsByType(products: FlowerProduct[]): FlowerProductTypeGroup[] {
  const buckets = new Map<string, FlowerProduct[]>();

  for (const product of products) {
    if (product.product_kind !== 'flower') {
      continue;
    }

    const flowerType = getFlowerProductType(product);
    const bucket = buckets.get(flowerType) ?? [];
    bucket.push(product);
    buckets.set(flowerType, bucket);
  }

  return [...buckets.entries()]
    .sort(([left], [right]) => compareFlowerTypeLabels(left, right))
    .map(([flowerType, variants]) => ({
      flowerType,
      variants: [...variants].sort(compareFlowerProducts),
      isCategory: variants.length > 1,
    }));
}

export function summarizeVariantQuantities(
  variants: FlowerProduct[],
  quantities: Record<string, string>,
): { types: number; units: number } {
  let types = 0;
  let units = 0;

  for (const variant of variants) {
    const quantity = Number(quantities[variant.id]) || 0;
    if (quantity > 0) {
      types += 1;
      units += quantity;
    }
  }

  return { types, units };
}
