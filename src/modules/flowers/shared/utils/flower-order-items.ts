import type { FlowerClaimMode, FlowerOrderStatus } from '../types/flower-order';
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
  claimMode?: FlowerClaimMode,
): boolean {
  if (claimMode === 'walk_in') {
    return false;
  }

  if (items.length === 0) {
    return false;
  }

  return !orderIsMiscOnly(items, flowerProductIds);
}

export function assertOrderInspoPhotoProvided(
  items: Array<{ product_id: string }>,
  photoInspoDataUrl: string | null | undefined,
  flowerProductIds: ReadonlySet<string>,
  claimMode?: FlowerClaimMode,
): void {
  if (!orderRequiresInspoPhoto(items, flowerProductIds, claimMode)) {
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

function hasFinishedPhoto(readyPhotoDataUrl: string | null | undefined): boolean {
  return Boolean(String(readyPhotoDataUrl ?? '').trim());
}

/**
 * Walk-in flower orders can be completed during the day without a photo.
 * Reports still wait on that photo. Misc-only walk-ins stay optional.
 */
export function walkInOrderBlocksReportsWithoutPhoto(
  order: {
    claim_mode: FlowerClaimMode;
    status: FlowerOrderStatus;
    ready_photo_data_url: string;
    items: Array<{ product_id: string }>;
  },
  flowerProductIds: ReadonlySet<string>,
): boolean {
  if (order.claim_mode !== 'walk_in' || order.status === 'cancelled') {
    return false;
  }

  if (hasFinishedPhoto(order.ready_photo_data_url)) {
    return false;
  }

  if (flowerProductIds.size === 0) {
    return order.items.length > 0;
  }

  return !orderIsMiscOnly(order.items, flowerProductIds);
}
