import type { PostgrestError } from '@supabase/supabase-js';
import type { FlowerProduct } from '../../../modules/flowers/shared/types/flower-product';
import {
  deriveFlowerTypeFromProduct,
  normalizeFlowerProductColor,
} from '../../../modules/flowers/shared/utils/flower-product-colors';
import { normalizeFlowerProductKind } from '../../../modules/flowers/shared/utils/flower-product-kind';
import { normalizeFlowerProductType } from '../../../modules/flowers/shared/utils/flower-product-type';
import {
  miscCategoryFromFlowerType,
  miscCategoryLabel,
  type MiscProductCategory,
} from '../../../modules/flowers/shared/utils/flower-misc-category';

export type FlowerProductDbRow = {
  id: string;
  name: string;
  product_kind?: string | null;
  flower_type?: string | null;
  color?: string | null;
  unit_cost: number;
  is_active: boolean;
  created_at: string;
};

export type FlowerProductSummaryDbRow = {
  id: string;
  name: string;
  product_kind?: string | null;
  flower_type?: string | null;
  color?: string | null;
  is_active: boolean;
};

export const FLOWER_PRODUCT_SELECT_WITH_TYPE =
  'id, name, product_kind, flower_type, color, unit_cost, is_active, created_at' as const;

export const FLOWER_PRODUCT_SELECT_WITH_KIND =
  'id, name, product_kind, color, unit_cost, is_active, created_at' as const;

export const FLOWER_PRODUCT_SELECT_WITH_COLOR =
  'id, name, color, unit_cost, is_active, created_at' as const;

export const FLOWER_PRODUCT_SELECT_LEGACY = 'id, name, unit_cost, is_active, created_at' as const;

export const FLOWER_PRODUCT_SUMMARY_WITH_TYPE = 'id, name, product_kind, flower_type, color, is_active' as const;

export const FLOWER_PRODUCT_SUMMARY_WITH_KIND = 'id, name, product_kind, color, is_active' as const;

export const FLOWER_PRODUCT_SUMMARY_WITH_COLOR = 'id, name, color, is_active' as const;

export const FLOWER_PRODUCT_SUMMARY_LEGACY = 'id, name, is_active' as const;

let supportsProductColorColumn: boolean | null = null;
let supportsProductKindColumn: boolean | null = null;
let supportsProductTypeColumn: boolean | null = null;

function isMissingProductColumnError(error: unknown, columnName: string): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const record = error as PostgrestError;
  const message = (record.message ?? '').toLowerCase();
  const details = (record.details ?? '').toLowerCase();
  const hint = (record.hint ?? '').toLowerCase();
  const combined = `${message} ${details} ${hint}`;
  const column = columnName.toLowerCase();

  return (
    record.code === '42703' ||
    record.code === 'PGRST204' ||
    (combined.includes(column) &&
      (combined.includes('does not exist') ||
        combined.includes('could not find') ||
        combined.includes('unknown column')))
  );
}

export function isMissingProductColorColumnError(error: unknown): boolean {
  return isMissingProductColumnError(error, 'color');
}

export function isMissingProductKindColumnError(error: unknown): boolean {
  return isMissingProductColumnError(error, 'product_kind');
}

export function isMissingProductTypeColumnError(error: unknown): boolean {
  return isMissingProductColumnError(error, 'flower_type');
}

export function productColorColumnSupported(): boolean {
  return supportsProductColorColumn !== false;
}

export function productKindColumnSupported(): boolean {
  return supportsProductKindColumn !== false;
}

export function productTypeColumnSupported(): boolean {
  return supportsProductTypeColumn !== false;
}

export function markProductColorColumnMissing(): void {
  supportsProductColorColumn = false;
}

export function markProductColorColumnSupported(): void {
  supportsProductColorColumn = true;
}

export function markProductKindColumnMissing(): void {
  supportsProductKindColumn = false;
}

export function markProductKindColumnSupported(): void {
  supportsProductKindColumn = true;
}

export function markProductTypeColumnMissing(): void {
  supportsProductTypeColumn = false;
}

export function markProductTypeColumnSupported(): void {
  supportsProductTypeColumn = true;
}

export function mapFlowerProductRow(row: FlowerProductDbRow): FlowerProduct {
  const product_kind = normalizeFlowerProductKind(row.product_kind);
  const color = normalizeFlowerProductColor(row.color);
  const flower_type =
    product_kind === 'flower'
      ? row.flower_type?.trim() || deriveFlowerTypeFromProduct(row.name, color)
      : row.flower_type?.trim() || miscCategoryLabel('wrappers');

  return {
    id: row.id,
    name: row.name,
    flower_type,
    product_kind,
    color,
    unit_cost: Number(row.unit_cost ?? 0),
    is_active: Boolean(row.is_active),
    created_at: row.created_at,
  };
}

export function mapFlowerProductSummaryRow(row: FlowerProductSummaryDbRow): FlowerProductSummaryDbRow {
  const product_kind = normalizeFlowerProductKind(row.product_kind);
  const color = normalizeFlowerProductColor(row.color);
  const flower_type =
    product_kind === 'flower'
      ? row.flower_type?.trim() || deriveFlowerTypeFromProduct(row.name, color)
      : row.flower_type?.trim() || miscCategoryLabel('wrappers');

  return {
    id: row.id,
    name: row.name,
    product_kind,
    flower_type,
    color,
    is_active: Boolean(row.is_active),
  };
}

function resolveProductSelectColumns(includeUnitCost: boolean): string {
  if (supportsProductTypeColumn !== false) {
    return includeUnitCost ? FLOWER_PRODUCT_SELECT_WITH_TYPE : FLOWER_PRODUCT_SUMMARY_WITH_TYPE;
  }

  if (supportsProductKindColumn !== false) {
    return includeUnitCost ? FLOWER_PRODUCT_SELECT_WITH_KIND : FLOWER_PRODUCT_SUMMARY_WITH_KIND;
  }

  if (supportsProductColorColumn !== false) {
    return includeUnitCost ? FLOWER_PRODUCT_SELECT_WITH_COLOR : FLOWER_PRODUCT_SUMMARY_WITH_COLOR;
  }

  return includeUnitCost ? FLOWER_PRODUCT_SELECT_LEGACY : FLOWER_PRODUCT_SUMMARY_LEGACY;
}

async function runProductQueryWithFallback<T>(
  includeUnitCost: boolean,
  runQuery: (columns: string) => Promise<{ data: T[] | null; error: PostgrestError | null }>,
): Promise<T[]> {
  if (
    supportsProductTypeColumn === false &&
    supportsProductKindColumn === false &&
    supportsProductColorColumn === false
  ) {
    const legacy = await runQuery(resolveProductSelectColumns(includeUnitCost));
    if (legacy.error) {
      throw legacy.error;
    }

    return legacy.data ?? [];
  }

  if (supportsProductTypeColumn !== false) {
    const withType = await runQuery(
      includeUnitCost ? FLOWER_PRODUCT_SELECT_WITH_TYPE : FLOWER_PRODUCT_SUMMARY_WITH_TYPE,
    );
    if (!withType.error) {
      markProductTypeColumnSupported();
      markProductKindColumnSupported();
      markProductColorColumnSupported();
      return withType.data ?? [];
    }

    if (!isMissingProductTypeColumnError(withType.error)) {
      throw withType.error;
    }

    markProductTypeColumnMissing();
  }

  if (supportsProductKindColumn !== false) {
    const withKind = await runQuery(
      includeUnitCost ? FLOWER_PRODUCT_SELECT_WITH_KIND : FLOWER_PRODUCT_SUMMARY_WITH_KIND,
    );
    if (!withKind.error) {
      markProductKindColumnSupported();
      markProductColorColumnSupported();
      return withKind.data ?? [];
    }

    if (!isMissingProductKindColumnError(withKind.error)) {
      throw withKind.error;
    }

    markProductKindColumnMissing();
  }

  if (supportsProductColorColumn !== false) {
    const withColor = await runQuery(
      includeUnitCost ? FLOWER_PRODUCT_SELECT_WITH_COLOR : FLOWER_PRODUCT_SUMMARY_WITH_COLOR,
    );
    if (!withColor.error) {
      markProductColorColumnSupported();
      return withColor.data ?? [];
    }

    if (!isMissingProductColorColumnError(withColor.error)) {
      throw withColor.error;
    }

    markProductColorColumnMissing();
  }

  const legacy = await runQuery(resolveProductSelectColumns(includeUnitCost));
  if (legacy.error) {
    throw legacy.error;
  }

  return legacy.data ?? [];
}

export async function queryFlowerProductsWithColorFallback<T extends FlowerProductDbRow>(
  runQuery: (columns: string) => Promise<{ data: T[] | null; error: PostgrestError | null }>,
): Promise<T[]> {
  return runProductQueryWithFallback(true, runQuery);
}

export async function queryFlowerProductSummariesWithColorFallback(
  runQuery: (
    columns: string,
  ) => Promise<{ data: FlowerProductSummaryDbRow[] | null; error: PostgrestError | null }>,
): Promise<FlowerProductSummaryDbRow[]> {
  const rows = await runProductQueryWithFallback(false, runQuery);
  return rows.map((row) => mapFlowerProductSummaryRow(row as FlowerProductSummaryDbRow));
}

export function buildFlowerProductWritePayload(
  input: {
    name: string;
    flower_type?: string;
    product_kind?: string;
    misc_category?: MiscProductCategory;
    color: string;
    unit_cost: number;
    is_active?: boolean;
  },
  includeId?: string,
): Record<string, unknown> {
  const productKind = normalizeFlowerProductKind(input.product_kind);
  const normalizedColor = normalizeFlowerProductColor(input.color);
  const payload: Record<string, unknown> = {
    name: input.name.trim(),
    unit_cost: input.unit_cost,
    is_active: input.is_active ?? true,
  };

  if (includeId) {
    payload.id = includeId;
  }

  if (productKindColumnSupported()) {
    payload.product_kind = productKind;
  }

  if (productColorColumnSupported()) {
    payload.color = normalizedColor;
  }

  if (productTypeColumnSupported()) {
    if (productKind === 'flower') {
      payload.flower_type = normalizeFlowerProductType(
        input.name,
        normalizedColor,
        input.flower_type,
      );
    } else {
      payload.flower_type = miscCategoryLabel(
        input.misc_category ?? miscCategoryFromFlowerType(input.flower_type),
      );
    }
  }

  return payload;
}

export function buildFlowerProductUpdatePayload(input: {
  name: string;
  product_kind?: string;
  flower_type?: string;
  misc_category?: MiscProductCategory;
  color: string;
  unit_cost: number;
}): Record<string, unknown> {
  const productKind = normalizeFlowerProductKind(input.product_kind);
  const normalizedColor = normalizeFlowerProductColor(input.color);
  const payload: Record<string, unknown> = {
    name: input.name.trim(),
    unit_cost: input.unit_cost,
  };

  if (productColorColumnSupported()) {
    payload.color = normalizedColor;
  }

  if (productTypeColumnSupported()) {
    if (productKind === 'misc') {
      if (input.misc_category) {
        payload.flower_type = miscCategoryLabel(input.misc_category);
      }
    } else {
      payload.flower_type = normalizeFlowerProductType(
        input.name,
        normalizedColor,
        input.flower_type,
      );
    }
  }

  return payload;
}

export async function selectFlowerProductColumns(
  columns: string,
  runSelect: (selectedColumns: string) => Promise<{ data: unknown; error: PostgrestError | null }>,
): Promise<{ data: unknown; error: PostgrestError | null; usedColorColumn: boolean }> {
  const includeUnitCost = columns.includes('unit_cost');
  const selectedColumns = resolveProductSelectColumns(includeUnitCost);
  const result = await runSelect(selectedColumns);

  return {
    ...result,
    usedColorColumn: selectedColumns.includes('color'),
  };
}
