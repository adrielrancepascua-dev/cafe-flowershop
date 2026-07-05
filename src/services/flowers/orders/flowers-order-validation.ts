import type { FlowerProduct } from '../../../modules/flowers/shared/types/flower-product';
import {
  assertOrderInspoPhotoProvided,
  buildFlowerProductIdSet,
} from '../../../modules/flowers/shared/utils/flower-order-items';

export function validateOrderInspoPhotoWithProducts(
  items: Array<{ product_id: string }>,
  photoInspoDataUrl: string,
  products: FlowerProduct[],
): void {
  assertOrderInspoPhotoProvided(items, photoInspoDataUrl, buildFlowerProductIdSet(products));
}

export function validateOrderInspoPhotoForProductRows(
  items: Array<{ product_id: string }>,
  photoInspoDataUrl: string,
  productRows: Array<{ id: string; product_kind: string }>,
): void {
  const flowerProductIds = new Set(
    productRows.filter((row) => row.product_kind === 'flower').map((row) => row.id),
  );

  assertOrderInspoPhotoProvided(items, photoInspoDataUrl, flowerProductIds);
}
