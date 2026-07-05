import type { FlowerClaimMode } from '../../../modules/flowers/shared/types/flower-order';
import type { FlowerProduct } from '../../../modules/flowers/shared/types/flower-product';
import {
  assertOrderInspoPhotoProvided,
  buildFlowerProductIdSet,
} from '../../../modules/flowers/shared/utils/flower-order-items';

export function validateOrderInspoPhotoWithProducts(
  items: Array<{ product_id: string }>,
  photoInspoDataUrl: string,
  products: FlowerProduct[],
  claimMode?: FlowerClaimMode,
): void {
  assertOrderInspoPhotoProvided(
    items,
    photoInspoDataUrl,
    buildFlowerProductIdSet(products),
    claimMode,
  );
}

export function validateOrderInspoPhotoForProductRows(
  items: Array<{ product_id: string }>,
  photoInspoDataUrl: string,
  productRows: Array<{ id: string; product_kind: string }>,
  claimMode?: FlowerClaimMode,
): void {
  const flowerProductIds = new Set(
    productRows.filter((row) => row.product_kind === 'flower').map((row) => row.id),
  );

  assertOrderInspoPhotoProvided(items, photoInspoDataUrl, flowerProductIds, claimMode);
}
