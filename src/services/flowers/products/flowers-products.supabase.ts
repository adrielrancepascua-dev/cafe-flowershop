import { getSupabaseClient } from '../../../lib/supabase/client';
import { ensureSupabaseSession } from '../../../lib/auth/flower-auth.service';
import type {
  CreateFlowerProductInput,
  FlowerProduct,
  UpdateFlowerProductInput,
} from '../../../modules/flowers/shared/types/flower-product';
import {
  buildFlowerProductUpdatePayload,
  buildFlowerProductWritePayload,
  FLOWER_PRODUCT_SELECT_LEGACY,
  FLOWER_PRODUCT_SELECT_WITH_COLOR,
  FLOWER_PRODUCT_SELECT_WITH_TYPE,
  isMissingProductColorColumnError,
  isMissingProductTypeColumnError,
  mapFlowerProductRow,
  markProductColorColumnMissing,
  markProductColorColumnSupported,
  markProductTypeColumnMissing,
  productColorColumnSupported,
  productTypeColumnSupported,
  queryFlowerProductsWithColorFallback,
  type FlowerProductDbRow,
} from './flowers-products-supabase.shared';

function requireSupabaseClient() {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  return supabase;
}

async function requireAuthenticatedSupabaseClient() {
  await ensureSupabaseSession();
  return requireSupabaseClient();
}

async function selectSingleProductRow(
  productId: string,
  preferredColumns: string,
): Promise<FlowerProductDbRow> {
  const supabase = await requireAuthenticatedSupabaseClient();

  const attempt = async (columns: string) =>
    supabase.from('flower_products').select(columns).eq('id', productId).single();

  if (productColorColumnSupported()) {
    const withColor = await attempt(preferredColumns);
    if (!withColor.error && withColor.data) {
      markProductColorColumnSupported();
      return withColor.data as unknown as FlowerProductDbRow;
    }

    if (withColor.error && !isMissingProductColorColumnError(withColor.error)) {
      throw withColor.error;
    }

    markProductColorColumnMissing();
  }

  const legacy = await attempt(FLOWER_PRODUCT_SELECT_LEGACY);
  if (legacy.error || !legacy.data) {
    throw legacy.error ?? new Error('Product not found.');
  }

  return legacy.data as unknown as FlowerProductDbRow;
}

export async function listFlowerProductsSupabase(): Promise<FlowerProduct[]> {
  const supabase = await requireAuthenticatedSupabaseClient();

  const rows = await queryFlowerProductsWithColorFallback(async (columns) => {
    const result = await supabase.from('flower_products').select(columns).order('created_at', { ascending: false });
    return { data: result.data as FlowerProductDbRow[] | null, error: result.error };
  });

  return rows.map(mapFlowerProductRow);
}

export async function createFlowerProductSupabase(input: CreateFlowerProductInput): Promise<FlowerProduct> {
  const supabase = await requireAuthenticatedSupabaseClient();
  const productId = `product-${Date.now()}`;

  const preferredSelect = productTypeColumnSupported()
    ? FLOWER_PRODUCT_SELECT_WITH_TYPE
    : FLOWER_PRODUCT_SELECT_WITH_COLOR;

  const insertProduct = async () =>
    supabase
      .from('flower_products')
      .insert(buildFlowerProductWritePayload(input, productId))
      .select(preferredSelect)
      .single();

  let result = await insertProduct();

  if (result.error && isMissingProductTypeColumnError(result.error)) {
    markProductTypeColumnMissing();
    result = await supabase
      .from('flower_products')
      .insert(buildFlowerProductWritePayload(input, productId))
      .select(FLOWER_PRODUCT_SELECT_WITH_COLOR)
      .single();
  }

  if (result.error && isMissingProductColorColumnError(result.error)) {
    markProductColorColumnMissing();
    result = await supabase
      .from('flower_products')
      .insert(buildFlowerProductWritePayload(input, productId))
      .select(FLOWER_PRODUCT_SELECT_LEGACY)
      .single();
  } else if (!result.error) {
    markProductColorColumnSupported();
  }

  if (result.error || !result.data) {
    throw result.error ?? new Error('Failed to create product.');
  }

  return mapFlowerProductRow(result.data as unknown as FlowerProductDbRow);
}

export async function updateFlowerProductSupabase(
  productId: string,
  input: UpdateFlowerProductInput,
): Promise<FlowerProduct> {
  const supabase = await requireAuthenticatedSupabaseClient();

  const preferredSelect = productTypeColumnSupported()
    ? FLOWER_PRODUCT_SELECT_WITH_TYPE
    : FLOWER_PRODUCT_SELECT_WITH_COLOR;

  const updateProduct = async () =>
    supabase
      .from('flower_products')
      .update(buildFlowerProductUpdatePayload(input))
      .eq('id', productId)
      .select(preferredSelect)
      .single();

  let result = await updateProduct();

  if (result.error && isMissingProductTypeColumnError(result.error)) {
    markProductTypeColumnMissing();
    result = await supabase
      .from('flower_products')
      .update(buildFlowerProductUpdatePayload(input))
      .eq('id', productId)
      .select(FLOWER_PRODUCT_SELECT_WITH_COLOR)
      .single();
  }

  if (result.error && isMissingProductColorColumnError(result.error)) {
    markProductColorColumnMissing();
    result = await supabase
      .from('flower_products')
      .update(buildFlowerProductUpdatePayload(input))
      .eq('id', productId)
      .select(FLOWER_PRODUCT_SELECT_LEGACY)
      .single();
  } else if (!result.error) {
    markProductColorColumnSupported();
  }

  if (result.error || !result.data) {
    throw result.error ?? new Error('Failed to update product.');
  }

  return mapFlowerProductRow(result.data as unknown as FlowerProductDbRow);
}

export async function toggleFlowerProductActiveSupabase(
  productId: string,
  isActive: boolean,
): Promise<FlowerProduct> {
  const supabase = await requireAuthenticatedSupabaseClient();

  const { error } = await supabase
    .from('flower_products')
    .update({ is_active: isActive })
    .eq('id', productId);

  if (error) {
    throw error;
  }

  return mapFlowerProductRow(await selectSingleProductRow(productId, FLOWER_PRODUCT_SELECT_WITH_TYPE));
}

export async function deleteFlowerProductSupabase(productId: string): Promise<void> {
  const supabase = await requireAuthenticatedSupabaseClient();

  const { error } = await supabase.from('flower_products').delete().eq('id', productId);

  if (error) {
    if ('code' in error && error.code === '23503') {
      throw new Error(
        'Cannot delete this product because it is linked to inventory or order history. Archive it instead.',
      );
    }

    throw error;
  }
}

export { productColorColumnSupported } from './flowers-products-supabase.shared';
