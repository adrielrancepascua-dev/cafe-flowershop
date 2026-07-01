import type { PostgrestError } from '@supabase/supabase-js';
import type { FlowerProduct } from '../../../modules/flowers/shared/types/flower-product';
import { normalizeFlowerProductColor } from '../../../modules/flowers/shared/utils/flower-product-colors';

export type FlowerProductDbRow = {
  id: string;
  name: string;
  color?: string | null;
  unit_cost: number;
  is_active: boolean;
  created_at: string;
};

export type FlowerProductSummaryDbRow = {
  id: string;
  name: string;
  color?: string | null;
  is_active: boolean;
};

export const FLOWER_PRODUCT_SELECT_WITH_COLOR =
  'id, name, color, unit_cost, is_active, created_at' as const;

export const FLOWER_PRODUCT_SELECT_LEGACY = 'id, name, unit_cost, is_active, created_at' as const;

export const FLOWER_PRODUCT_SUMMARY_WITH_COLOR = 'id, name, color, is_active' as const;

export const FLOWER_PRODUCT_SUMMARY_LEGACY = 'id, name, is_active' as const;

let supportsProductColorColumn: boolean | null = null;

export function isMissingProductColorColumnError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const record = error as PostgrestError;
  const message = (record.message ?? '').toLowerCase();
  const details = (record.details ?? '').toLowerCase();
  const hint = (record.hint ?? '').toLowerCase();
  const combined = `${message} ${details} ${hint}`;

  return (
    record.code === '42703' ||
    record.code === 'PGRST204' ||
    (combined.includes('color') &&
      (combined.includes('does not exist') ||
        combined.includes('could not find') ||
        combined.includes('unknown column')))
  );
}

export function productColorColumnSupported(): boolean {
  return supportsProductColorColumn !== false;
}

export function markProductColorColumnMissing(): void {
  supportsProductColorColumn = false;
}

export function markProductColorColumnSupported(): void {
  supportsProductColorColumn = true;
}

export function mapFlowerProductRow(row: FlowerProductDbRow): FlowerProduct {
  return {
    id: row.id,
    name: row.name,
    color: normalizeFlowerProductColor(row.color),
    unit_cost: Number(row.unit_cost ?? 0),
    is_active: Boolean(row.is_active),
    created_at: row.created_at,
  };
}

export function mapFlowerProductSummaryRow(row: FlowerProductSummaryDbRow): FlowerProductSummaryDbRow {
  return {
    id: row.id,
    name: row.name,
    color: normalizeFlowerProductColor(row.color),
    is_active: Boolean(row.is_active),
  };
}

export async function queryFlowerProductsWithColorFallback<T extends FlowerProductDbRow>(
  runQuery: (columns: string) => Promise<{ data: T[] | null; error: PostgrestError | null }>,
): Promise<T[]> {
  if (supportsProductColorColumn === false) {
    const legacy = await runQuery(FLOWER_PRODUCT_SELECT_LEGACY);
    if (legacy.error) {
      throw legacy.error;
    }

    return legacy.data ?? [];
  }

  const withColor = await runQuery(FLOWER_PRODUCT_SELECT_WITH_COLOR);
  if (!withColor.error) {
    markProductColorColumnSupported();
    return withColor.data ?? [];
  }

  if (!isMissingProductColorColumnError(withColor.error)) {
    throw withColor.error;
  }

  markProductColorColumnMissing();
  const legacy = await runQuery(FLOWER_PRODUCT_SELECT_LEGACY);
  if (legacy.error) {
    throw legacy.error;
  }

  return legacy.data ?? [];
}

export async function queryFlowerProductSummariesWithColorFallback(
  runQuery: (
    columns: string,
  ) => Promise<{ data: FlowerProductSummaryDbRow[] | null; error: PostgrestError | null }>,
): Promise<FlowerProductSummaryDbRow[]> {
  if (supportsProductColorColumn === false) {
    const legacy = await runQuery(FLOWER_PRODUCT_SUMMARY_LEGACY);
    if (legacy.error) {
      throw legacy.error;
    }

    return (legacy.data ?? []).map(mapFlowerProductSummaryRow);
  }

  const withColor = await runQuery(FLOWER_PRODUCT_SUMMARY_WITH_COLOR);
  if (!withColor.error) {
    markProductColorColumnSupported();
    return (withColor.data ?? []).map(mapFlowerProductSummaryRow);
  }

  if (!isMissingProductColorColumnError(withColor.error)) {
    throw withColor.error;
  }

  markProductColorColumnMissing();
  const legacy = await runQuery(FLOWER_PRODUCT_SUMMARY_LEGACY);
  if (legacy.error) {
    throw legacy.error;
  }

  return (legacy.data ?? []).map(mapFlowerProductSummaryRow);
}

export function buildFlowerProductWritePayload(
  input: { name: string; color: string; unit_cost: number; is_active?: boolean },
  includeId?: string,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    name: input.name.trim(),
    unit_cost: input.unit_cost,
    is_active: input.is_active ?? true,
  };

  if (includeId) {
    payload.id = includeId;
  }

  if (productColorColumnSupported()) {
    payload.color = normalizeFlowerProductColor(input.color);
  }

  return payload;
}

export function buildFlowerProductUpdatePayload(input: {
  name: string;
  color: string;
  unit_cost: number;
}): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    name: input.name.trim(),
    unit_cost: input.unit_cost,
  };

  if (productColorColumnSupported()) {
    payload.color = normalizeFlowerProductColor(input.color);
  }

  return payload;
}

export async function selectFlowerProductColumns(
  columns: string,
  runSelect: (selectedColumns: string) => Promise<{ data: unknown; error: PostgrestError | null }>,
): Promise<{ data: unknown; error: PostgrestError | null; usedColorColumn: boolean }> {
  if (supportsProductColorColumn === false) {
    const legacyColumns = columns.includes('unit_cost')
      ? FLOWER_PRODUCT_SELECT_LEGACY
      : FLOWER_PRODUCT_SUMMARY_LEGACY;
    const legacy = await runSelect(legacyColumns);
    return { ...legacy, usedColorColumn: false };
  }

  const withColor = await runSelect(columns);
  if (!withColor.error) {
    markProductColorColumnSupported();
    return { ...withColor, usedColorColumn: true };
  }

  if (!isMissingProductColorColumnError(withColor.error)) {
    return { ...withColor, usedColorColumn: true };
  }

  markProductColorColumnMissing();
  const legacyColumns = columns.includes('unit_cost')
    ? FLOWER_PRODUCT_SELECT_LEGACY
    : FLOWER_PRODUCT_SUMMARY_LEGACY;
  const legacy = await runSelect(legacyColumns);
  return { ...legacy, usedColorColumn: false };
}
