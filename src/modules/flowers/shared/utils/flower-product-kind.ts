export const FLOWER_PRODUCT_KINDS = ['flower', 'misc'] as const;

export type FlowerProductKind = (typeof FLOWER_PRODUCT_KINDS)[number];

export const FLOWER_PRODUCT_KIND_LABELS: Record<FlowerProductKind, string> = {
  flower: 'Flowers',
  misc: 'Miscellaneous',
};

export function normalizeFlowerProductKind(value: string | null | undefined): FlowerProductKind {
  return value === 'misc' ? 'misc' : 'flower';
}

export function isFlowerCatalogProduct(kind: string | null | undefined): boolean {
  return normalizeFlowerProductKind(kind) === 'flower';
}

export function isMiscCatalogProduct(kind: string | null | undefined): boolean {
  return normalizeFlowerProductKind(kind) === 'misc';
}
