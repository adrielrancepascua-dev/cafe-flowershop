import type { FlowerInventoryStockRow } from '../types/flower-inventory';

export const FLOWER_PRODUCT_COLOR_UNCategorized = 'Uncategorized';

/** Common stem colors — pick one per product or add a custom color. */
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

export function isPresetFlowerProductColor(value: string): boolean {
  return (FLOWER_PRODUCT_COLOR_OPTIONS as readonly string[]).includes(value);
}

export function buildFlowerProductColorOptions(existingColors: string[] = []): string[] {
  const merged = new Set<string>([...FLOWER_PRODUCT_COLOR_OPTIONS]);

  for (const color of existingColors) {
    const normalized = normalizeFlowerProductColor(color);
    if (normalized !== FLOWER_PRODUCT_COLOR_UNCategorized) {
      merged.add(normalized);
    }
  }

  const preset = FLOWER_PRODUCT_COLOR_OPTIONS.filter((color) => merged.has(color));
  const custom = [...merged]
    .filter((color) => !isPresetFlowerProductColor(color))
    .sort((left, right) => left.localeCompare(right));

  return [...preset, ...custom];
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

export function deriveFlowerTypeFromProduct(name: string, color: string): string {
  const trimmedName = name.trim();
  const normalizedColor = normalizeFlowerProductColor(color);

  if (normalizedColor !== FLOWER_PRODUCT_COLOR_UNCategorized) {
    const colorPrefix = `${normalizedColor} `;
    if (trimmedName.toLowerCase().startsWith(colorPrefix.toLowerCase())) {
      const withoutColor = trimmedName.slice(colorPrefix.length).trim();
      if (withoutColor) {
        return withoutColor;
      }
    }
  }

  return trimmedName;
}

export function compareFlowerTypeLabels(left: string, right: string): number {
  return left.localeCompare(right);
}

export function compareInventoryStockRows(left: FlowerInventoryStockRow, right: FlowerInventoryStockRow): number {
  const typeCompare = compareFlowerTypeLabels(
    deriveFlowerTypeFromProduct(left.product_name, left.product_color),
    deriveFlowerTypeFromProduct(right.product_name, right.product_color),
  );

  if (typeCompare !== 0) {
    return typeCompare;
  }

  const colorCompare = compareFlowerProductColorLabels(
    normalizeFlowerProductColor(left.product_color),
    normalizeFlowerProductColor(right.product_color),
  );

  if (colorCompare !== 0) {
    return colorCompare;
  }

  return left.product_name.localeCompare(right.product_name);
}

export function compareFlowerProducts(
  left: { name: string; color: string },
  right: { name: string; color: string },
): number {
  return compareInventoryStockRows(
    {
      product_id: left.name,
      product_name: left.name,
      product_color: left.color,
      branch_id: '',
      branch_name: '',
      on_hand: 0,
      last_updated: null,
      product_is_active: true,
    },
    {
      product_id: right.name,
      product_name: right.name,
      product_color: right.color,
      branch_id: '',
      branch_name: '',
      on_hand: 0,
      last_updated: null,
      product_is_active: true,
    },
  );
}

export function groupInventoryStockByFlowerType(rows: FlowerInventoryStockRow[]): Array<{
  flowerType: string;
  rows: FlowerInventoryStockRow[];
}> {
  const buckets = new Map<string, FlowerInventoryStockRow[]>();

  for (const row of rows) {
    const flowerType = deriveFlowerTypeFromProduct(row.product_name, row.product_color);
    const bucket = buckets.get(flowerType) ?? [];
    bucket.push(row);
    buckets.set(flowerType, bucket);
  }

  return [...buckets.entries()]
    .sort(([left], [right]) => compareFlowerTypeLabels(left, right))
    .map(([flowerType, typeRows]) => ({
      flowerType,
      rows: [...typeRows].sort(compareInventoryStockRows),
    }));
}

/** @deprecated Use groupInventoryStockByFlowerType */
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
      rows: [...colorRows].sort(compareInventoryStockRows),
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
