import type { FlowerClaimMode } from '../types/flower-order';
import type { FlowerProduct } from '../types/flower-product';

export function buildFlowerProductIdSet(products: FlowerProduct[]): Set<string> {
  return new Set(
    products.filter((product) => product.product_kind === 'flower').map((product) => product.id),
  );
}

export function orderHasFlowerLineItems(
  items: Array<{ product_id: string }>,
  flowerProductIds: ReadonlySet<string>,
): boolean {
  return items.some((item) => flowerProductIds.has(item.product_id));
}

export function orderIsMiscOnly(
  items: Array<{ product_id: string }>,
  flowerProductIds: ReadonlySet<string>,
): boolean {
  return items.length > 0 && !orderHasFlowerLineItems(items, flowerProductIds);
}

/** Misc-only orders follow walk-in finished-photo rules (optional, never blocks status). */
export function orderSkipsReadyPhotoRequirement(
  items: Array<{ product_id: string }>,
  claimMode: FlowerClaimMode,
  flowerProductIds?: ReadonlySet<string>,
): boolean {
  if (claimMode === 'walk_in') {
    return true;
  }

  if (!flowerProductIds || flowerProductIds.size === 0) {
    return false;
  }

  return orderIsMiscOnly(items, flowerProductIds);
}
