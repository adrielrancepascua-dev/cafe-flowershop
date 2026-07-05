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

export function orderRequiresInspoPhoto(
  items: Array<{ product_id: string }>,
  flowerProductIds: ReadonlySet<string>,
): boolean {
  if (items.length === 0) {
    return false;
  }

  return !orderIsMiscOnly(items, flowerProductIds);
}

export function assertOrderInspoPhotoProvided(
  items: Array<{ product_id: string }>,
  photoInspoDataUrl: string | null | undefined,
  flowerProductIds: ReadonlySet<string>,
): void {
  if (!orderRequiresInspoPhoto(items, flowerProductIds)) {
    return;
  }

  if (!String(photoInspoDataUrl ?? '').trim()) {
    throw new Error('Photo of order / inspo is required for flower orders.');
  }
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
