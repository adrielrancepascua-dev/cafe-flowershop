import type { FlowerInventoryStockRow } from '../types/flower-inventory';

export const FLOWER_PRODUCT_COLOR_UNCategorized = 'Uncategorized';

/** Common stem colors — admins pick one per product; inventory groups by this. */
export const FLOWER_PRODUCT_COLOR_OPTIONS = [
  'Red',
  'Pink',
  'White',
  'Yellow',
  'Orange',
  'Peach',
  'Lavender',
  'Purple',
  'Blue',
  'Green',
  'Cream',
  'Brown',
  'Mixed',
  'Other',
] as const;

export type FlowerProductColorOption = (typeof FLOWER_PRODUCT_COLOR_OPTIONS)[number];

const COLOR_SORT_ORDER = [...FLOWER_PRODUCT_COLOR_OPTIONS, FLOWER_PRODUCT_COLOR_UNCategorized];

export function normalizeFlowerProductColor(value: string | null | undefined): string {
  const trimmed = (value ?? '').trim();
  return trimmed || FLOWER_PRODUCT_COLOR_UNCategorized;
}

export function compareFlowerProductColorLabels(left: string, right: string): number {
  const leftIndex = COLOR_SORT_ORDER.indexOf(left as FlowerProductColorOption);
  const rightIndex = COLOR_SORT_ORDER.indexOf(right as FlowerProductColorOption);
  const safeLeft = leftIndex === -1 ? COLOR_SORT_ORDER.length : leftIndex;
  const safeRight = rightIndex === -1 ? COLOR_SORT_ORDER.length : rightIndex;

  if (safeLeft !== safeRight) {
    return safeLeft - safeRight;
  }

  return left.localeCompare(right);
}

export function groupInventoryStockByColor(rows: FlowerInventoryStockRow[]): Array<{
  color: string;
  rows: FlowerInventoryStockRow[];
}> {
  const buckets = new Map<string, FlowerInventoryStockRow[]>();

  for (const row of rows) {
    const color = normalizeFlowerProductColor(row.product_color);
    const bucket = buckets.get(color) ?? [];
    bucket.push(row);
    buckets.set(color, bucket);
  }

  return [...buckets.entries()]
    .sort(([left], [right]) => compareFlowerProductColorLabels(left, right))
    .map(([color, colorRows]) => ({
      color,
      rows: [...colorRows].sort((left, right) => left.product_name.localeCompare(right.product_name)),
    }));
}

export function flowerProductColorSwatchClass(color: string): string {
  switch (normalizeFlowerProductColor(color)) {
    case 'Red':
      return 'bg-red-500';
    case 'Pink':
      return 'bg-pink-400';
    case 'White':
      return 'bg-white border border-brand-muted/60';
    case 'Yellow':
      return 'bg-yellow-400';
    case 'Orange':
      return 'bg-orange-400';
    case 'Peach':
      return 'bg-orange-200';
    case 'Lavender':
      return 'bg-violet-300';
    case 'Purple':
      return 'bg-purple-500';
    case 'Blue':
      return 'bg-blue-500';
    case 'Green':
      return 'bg-emerald-500';
    case 'Cream':
      return 'bg-amber-100 border border-brand-muted/50';
    case 'Brown':
      return 'bg-amber-800';
    case 'Mixed':
      return 'bg-gradient-to-br from-pink-400 via-yellow-300 to-purple-400';
    default:
      return 'bg-brand-muted/50';
  }
}
