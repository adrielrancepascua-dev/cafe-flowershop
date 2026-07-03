export const MISC_PRODUCT_CATEGORIES = ['wrappers', 'gift_items'] as const;

export type MiscProductCategory = (typeof MISC_PRODUCT_CATEGORIES)[number];

export const MISC_PRODUCT_CATEGORY_LABELS: Record<MiscProductCategory, string> = {
  wrappers: 'Wrappers',
  gift_items: 'Gift items',
};

export function miscCategoryLabel(category: MiscProductCategory): string {
  return MISC_PRODUCT_CATEGORY_LABELS[category];
}

export function normalizeMiscCategory(value: string | null | undefined): MiscProductCategory {
  const normalized = value?.trim().toLowerCase() ?? '';

  if (
    normalized === 'gift items' ||
    normalized === 'gift_items' ||
    normalized === 'gift item' ||
    normalized === 'gifts'
  ) {
    return 'gift_items';
  }

  return 'wrappers';
}

export function miscCategoryFromFlowerType(flowerType: string | null | undefined): MiscProductCategory {
  return normalizeMiscCategory(flowerType);
}
