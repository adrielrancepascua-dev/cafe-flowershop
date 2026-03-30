import { getSupabaseClient } from '../../lib/supabase/client';
import type {
  AdjustInventoryInput,
  InventoryLogRecord,
  InventoryStockRecord,
} from '../../modules/shared/types/inventory';

type ProductRow = {
  id: string;
  name: string;
  is_active: boolean;
};

type InventoryStockRow = {
  product_id: string;
  current_stock: number;
  updated_at: string;
};

type InventoryLogRow = {
  id: number;
  product_id: string;
  adjustment_type: 'stock_in' | 'stock_out';
  quantity: number;
  previous_stock: number;
  new_stock: number;
  note: string;
  source: 'dashboard_inventory';
  created_at: string;
};

function requireSupabaseClient() {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  return supabase;
}

function toInventoryLogRecord(row: InventoryLogRow): InventoryLogRecord {
  return {
    id: Number(row.id),
    productId: row.product_id,
    adjustmentType: row.adjustment_type,
    quantity: Number(row.quantity),
    previousStock: Number(row.previous_stock),
    newStock: Number(row.new_stock),
    note: row.note ?? '',
    source: row.source,
    createdAt: row.created_at,
  };
}

export async function listInventoryStockSupabase(): Promise<InventoryStockRecord[]> {
  const supabase = requireSupabaseClient();

  const { data: products, error: productsError } = await supabase
    .from('products')
    .select('id, name, is_active')
    .order('name', { ascending: true });

  if (productsError) {
    throw productsError;
  }

  const { data: stockRows, error: stockError } = await supabase
    .from('inventory_stock')
    .select('product_id, current_stock, updated_at');

  if (stockError) {
    throw stockError;
  }

  const stockByProductId = new Map<string, InventoryStockRow>();
  for (const row of (stockRows as InventoryStockRow[] | null) ?? []) {
    stockByProductId.set(row.product_id, row);
  }

  return ((products as ProductRow[] | null) ?? []).map((product) => {
    const stock = stockByProductId.get(product.id);

    return {
      productId: product.id,
      productName: product.name,
      currentStock: stock ? Number(stock.current_stock) : 0,
      lastUpdated: stock?.updated_at ?? null,
      isActiveProduct: Boolean(product.is_active),
    };
  });
}

export async function listInventoryLogSupabase(limit = 50): Promise<InventoryLogRecord[]> {
  const supabase = requireSupabaseClient();

  const { data, error } = await supabase
    .from('inventory_log')
    .select('id, product_id, adjustment_type, quantity, previous_stock, new_stock, note, source, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return ((data as InventoryLogRow[] | null) ?? []).map(toInventoryLogRecord);
}

export async function adjustInventorySupabase(input: AdjustInventoryInput): Promise<void> {
  const supabase = requireSupabaseClient();
  const quantity = Number(input.quantity);

  if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isInteger(quantity)) {
    throw new Error('Quantity must be a whole number greater than 0.');
  }

  const { data: currentStockRow, error: currentStockError } = await supabase
    .from('inventory_stock')
    .select('product_id, current_stock')
    .eq('product_id', input.productId)
    .maybeSingle();

  if (currentStockError) {
    throw currentStockError;
  }

  const previousStock = Number(currentStockRow?.current_stock ?? 0);
  const nextStock =
    input.adjustmentType === 'stock_in'
      ? previousStock + quantity
      : previousStock - quantity;

  if (nextStock < 0) {
    throw new Error('Insufficient stock. Deduction would result in negative inventory.');
  }

  const nowIso = new Date().toISOString();

  const { error: upsertError } = await supabase
    .from('inventory_stock')
    .upsert(
      {
        product_id: input.productId,
        current_stock: nextStock,
        updated_at: nowIso,
      },
      { onConflict: 'product_id' },
    );

  if (upsertError) {
    throw upsertError;
  }

  const { error: logError } = await supabase
    .from('inventory_log')
    .insert({
      product_id: input.productId,
      adjustment_type: input.adjustmentType,
      quantity,
      previous_stock: previousStock,
      new_stock: nextStock,
      note: input.note?.trim() ?? '',
      source: 'dashboard_inventory',
      created_at: nowIso,
    });

  if (!logError) {
    return;
  }

  await supabase
    .from('inventory_stock')
    .upsert(
      {
        product_id: input.productId,
        current_stock: previousStock,
        updated_at: nowIso,
      },
      { onConflict: 'product_id' },
    );

  throw new Error(`Inventory log write failed: ${logError.message}`);
}
