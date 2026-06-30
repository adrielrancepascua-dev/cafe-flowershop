import { getSupabaseClient } from '../../../lib/supabase/client';
import { ensureSupabaseSession } from '../../../lib/auth/flower-auth.service';
import { FLOWER_BRANCHES_MOCK } from '../../../modules/flowers/shared/data/flowers.mock';
import type {
  AdjustFlowerInventoryInput,
  FlowerBranchOption,
  FlowerInventoryMovementRow,
  FlowerInventoryStockRow,
  ListFlowerInventoryOptions,
  TransferFlowerInventoryInput,
} from '../../../modules/flowers/shared/types/flower-inventory';

type BranchRow = {
  id: string;
  name: string;
  is_active: boolean;
};

type ProductRow = {
  id: string;
  name: string;
  is_active: boolean;
};

type InventoryStockDbRow = {
  branch_id: string;
  product_id: string;
  on_hand: number;
  updated_at: string;
};

type InventoryMovementDbRow = {
  id: number;
  branch_id: string;
  product_id: string;
  movement_type: string;
  quantity: number;
  previous_on_hand: number;
  new_on_hand: number;
  note: string;
  created_at: string;
};

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

function toDisplayMovementType(value: string): FlowerInventoryMovementRow['movement_type'] {
  if (value === 'stock_in' || value === 'in' || value === 'transfer_in') {
    return value === 'transfer_in' ? 'transfer_in' : 'stock_in';
  }

  if (value === 'order_deduct') {
    return 'order_deduct';
  }

  if (value === 'transfer_out') {
    return 'transfer_out';
  }

  return 'stock_out';
}

function toMovementType(value: 'stock_in' | 'stock_out'): 'in' | 'out' {
  return value === 'stock_in' ? 'in' : 'out';
}

async function listBranchesInternal(options: ListFlowerInventoryOptions = {}): Promise<BranchRow[]> {
  const supabase = await requireAuthenticatedSupabaseClient();

  let query = supabase
    .from('flower_branches')
    .select('id, name, is_active')
    .order('name', { ascending: true });

  if (options.branchId) {
    query = query.eq('id', options.branchId);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return (data as BranchRow[] | null) ?? [];
}

async function listProductsInternal(): Promise<ProductRow[]> {
  const supabase = await requireAuthenticatedSupabaseClient();

  const { data, error } = await supabase
    .from('flower_products')
    .select('id, name, is_active')
    .order('name', { ascending: true });

  if (error) {
    throw error;
  }

  return (data as ProductRow[] | null) ?? [];
}

export async function listFlowerBranchesSupabase(): Promise<FlowerBranchOption[]> {
  const rows = await listBranchesInternal();

  if (rows.length > 0) {
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      is_active: Boolean(row.is_active),
    }));
  }

  return FLOWER_BRANCHES_MOCK.map((branch) => ({
    id: branch.id,
    name: branch.name,
    is_active: branch.is_active,
  }));
}

export async function listFlowerInventoryStockSupabase(
  options: ListFlowerInventoryOptions = {},
): Promise<FlowerInventoryStockRow[]> {
  const supabase = await requireAuthenticatedSupabaseClient();

  const [branches, products] = await Promise.all([
    listBranchesInternal(options),
    listProductsInternal(),
  ]);

  if (branches.length === 0 || products.length === 0) {
    return [];
  }

  let stockQuery = supabase
    .from('flower_inventory_stock')
    .select('branch_id, product_id, on_hand, updated_at');

  if (options.branchId) {
    stockQuery = stockQuery.eq('branch_id', options.branchId);
  }

  const { data: stockRowsData, error: stockError } = await stockQuery;

  if (stockError) {
    throw stockError;
  }

  const stockRows = (stockRowsData as InventoryStockDbRow[] | null) ?? [];
  const stockMap = new Map<string, InventoryStockDbRow>();

  for (const row of stockRows) {
    stockMap.set(`${row.branch_id}:${row.product_id}`, row);
  }

  const rows: FlowerInventoryStockRow[] = [];

  for (const branch of branches) {
    for (const product of products) {
      const stock = stockMap.get(`${branch.id}:${product.id}`);

      rows.push({
        branch_id: branch.id,
        branch_name: branch.name,
        product_id: product.id,
        product_name: product.name,
        product_is_active: Boolean(product.is_active),
        on_hand: Number(stock?.on_hand ?? 0),
        last_updated: stock?.updated_at ?? null,
      });
    }
  }

  rows.sort((a, b) => {
    if (a.branch_name !== b.branch_name) {
      return a.branch_name.localeCompare(b.branch_name);
    }

    return a.product_name.localeCompare(b.product_name);
  });

  return rows;
}

export async function listFlowerInventoryMovementsSupabase(
  options: ListFlowerInventoryOptions & { limit?: number } = {},
): Promise<FlowerInventoryMovementRow[]> {
  const supabase = await requireAuthenticatedSupabaseClient();
  const limit = options.limit ?? 40;

  let query = supabase
    .from('flower_inventory_movements')
    .select('id, branch_id, product_id, movement_type, quantity, previous_on_hand, new_on_hand, note, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (options.branchId) {
    query = query.eq('branch_id', options.branchId);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  const movementRows = (data as InventoryMovementDbRow[] | null) ?? [];

  if (movementRows.length === 0) {
    return [];
  }

  const branchIds = [...new Set(movementRows.map((row) => row.branch_id))];
  const productIds = [...new Set(movementRows.map((row) => row.product_id))];

  const [{ data: branchesData, error: branchesError }, { data: productsData, error: productsError }] = await Promise.all([
    supabase.from('flower_branches').select('id, name, is_active').in('id', branchIds),
    supabase.from('flower_products').select('id, name, is_active').in('id', productIds),
  ]);

  if (branchesError) {
    throw branchesError;
  }

  if (productsError) {
    throw productsError;
  }

  const branchMap = new Map<string, string>();
  for (const branch of (branchesData as BranchRow[] | null) ?? []) {
    branchMap.set(branch.id, branch.name);
  }

  const productMap = new Map<string, string>();
  for (const product of (productsData as ProductRow[] | null) ?? []) {
    productMap.set(product.id, product.name);
  }

  return movementRows.map((row) => ({
    id: Number(row.id),
    branch_id: row.branch_id,
    branch_name: branchMap.get(row.branch_id) ?? row.branch_id,
    product_id: row.product_id,
    product_name: productMap.get(row.product_id) ?? row.product_id,
    movement_type: toDisplayMovementType(row.movement_type),
    quantity: Number(row.quantity),
    previous_on_hand: Number(row.previous_on_hand),
    new_on_hand: Number(row.new_on_hand),
    note: row.note ?? '',
    created_at: row.created_at,
  }));
}

export async function adjustFlowerInventorySupabase(input: AdjustFlowerInventoryInput): Promise<void> {
  const supabase = await requireAuthenticatedSupabaseClient();
  const quantity = Number(input.quantity);

  if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isInteger(quantity)) {
    throw new Error('Quantity must be a whole number greater than 0.');
  }

  const { data: existingStock, error: existingStockError } = await supabase
    .from('flower_inventory_stock')
    .select('branch_id, product_id, on_hand')
    .eq('branch_id', input.branchId)
    .eq('product_id', input.productId)
    .maybeSingle();

  if (existingStockError) {
    throw existingStockError;
  }

  const previousOnHand = Number(existingStock?.on_hand ?? 0);
  const nextOnHand =
    input.movementType === 'stock_in'
      ? previousOnHand + quantity
      : previousOnHand - quantity;

  if (nextOnHand < 0) {
    throw new Error('Insufficient stock. Stock out would result in negative balance.');
  }

  const nowIso = new Date().toISOString();

  const { error: upsertError } = await supabase
    .from('flower_inventory_stock')
    .upsert(
      {
        branch_id: input.branchId,
        product_id: input.productId,
        on_hand: nextOnHand,
        updated_at: nowIso,
      },
      { onConflict: 'branch_id,product_id' },
    );

  if (upsertError) {
    throw upsertError;
  }

  const { error: movementError } = await supabase
    .from('flower_inventory_movements')
    .insert({
      branch_id: input.branchId,
      product_id: input.productId,
      movement_type: toMovementType(input.movementType),
      quantity,
      previous_on_hand: previousOnHand,
      new_on_hand: nextOnHand,
      note: input.note?.trim() ?? '',
      created_at: nowIso,
    });

  if (!movementError) {
    return;
  }

  await supabase
    .from('flower_inventory_stock')
    .upsert(
      {
        branch_id: input.branchId,
        product_id: input.productId,
        on_hand: previousOnHand,
        updated_at: nowIso,
      },
      { onConflict: 'branch_id,product_id' },
    );

  throw new Error(`Inventory movement logging failed: ${movementError.message}`);
}

async function applyFlowerStockChangeSupabase(input: {
  branchId: string;
  productId: string;
  delta: number;
  movementType: string;
  note: string;
}): Promise<void> {
  const supabase = await requireAuthenticatedSupabaseClient();
  const quantity = Math.abs(input.delta);

  if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isInteger(quantity)) {
    throw new Error('Quantity must be a whole number greater than 0.');
  }

  const { data: existingStock, error: existingStockError } = await supabase
    .from('flower_inventory_stock')
    .select('branch_id, product_id, on_hand')
    .eq('branch_id', input.branchId)
    .eq('product_id', input.productId)
    .maybeSingle();

  if (existingStockError) {
    throw existingStockError;
  }

  const previousOnHand = Number(existingStock?.on_hand ?? 0);
  const nextOnHand = previousOnHand + input.delta;

  if (nextOnHand < 0) {
    throw new Error('Insufficient stock. Stock out would result in negative balance.');
  }

  const nowIso = new Date().toISOString();

  const { error: upsertError } = await supabase
    .from('flower_inventory_stock')
    .upsert(
      {
        branch_id: input.branchId,
        product_id: input.productId,
        on_hand: nextOnHand,
        updated_at: nowIso,
      },
      { onConflict: 'branch_id,product_id' },
    );

  if (upsertError) {
    throw upsertError;
  }

  const { error: movementError } = await supabase.from('flower_inventory_movements').insert({
    branch_id: input.branchId,
    product_id: input.productId,
    movement_type: input.movementType,
    quantity,
    previous_on_hand: previousOnHand,
    new_on_hand: nextOnHand,
    note: input.note.trim(),
    created_at: nowIso,
  });

  if (!movementError) {
    return;
  }

  await supabase
    .from('flower_inventory_stock')
    .upsert(
      {
        branch_id: input.branchId,
        product_id: input.productId,
        on_hand: previousOnHand,
        updated_at: nowIso,
      },
      { onConflict: 'branch_id,product_id' },
    );

  throw new Error(`Inventory movement logging failed: ${movementError.message}`);
}

export async function deductFlowerInventoryForOrderSupabase(input: {
  branchId: string;
  productId: string;
  quantity: number;
  orderId: string;
}): Promise<void> {
  await applyFlowerStockChangeSupabase({
    branchId: input.branchId,
    productId: input.productId,
    delta: -input.quantity,
    movementType: 'order_deduct',
    note: `Order ${input.orderId} day-close deduct`,
  });
}

export async function validateFlowerOrderStockSupabase(
  branchId: string,
  items: Array<{ product_id: string; item_name: string; quantity: number }>,
  creditByProductId: Record<string, number> = {},
): Promise<void> {
  const supabase = await requireAuthenticatedSupabaseClient();
  const productIds = [...new Set(items.map((item) => item.product_id))];

  if (productIds.length === 0) {
    return;
  }

  const { data, error } = await supabase
    .from('flower_inventory_stock')
    .select('product_id, on_hand')
    .eq('branch_id', branchId)
    .in('product_id', productIds);

  if (error) {
    throw error;
  }

  const stockByProduct = new Map<string, number>();
  for (const row of (data as Array<{ product_id: string; on_hand: number }> | null) ?? []) {
    stockByProduct.set(row.product_id, Number(row.on_hand));
  }

  const neededByProduct = new Map<string, { name: string; qty: number }>();

  for (const item of items) {
    const existing = neededByProduct.get(item.product_id);
    if (existing) {
      existing.qty += item.quantity;
      continue;
    }

    neededByProduct.set(item.product_id, {
      name: item.item_name,
      qty: item.quantity,
    });
  }

  for (const [productId, { name, qty }] of neededByProduct) {
    const onHand = stockByProduct.get(productId) ?? 0;
    const credit = creditByProductId[productId] ?? 0;
    const available = onHand + credit;

    if (qty > available) {
      throw new Error(
        `Insufficient stock for ${name}. Available: ${available}, requested: ${qty}.`,
      );
    }
  }
}

export async function transferFlowerInventorySupabase(
  input: TransferFlowerInventoryInput,
): Promise<void> {
  if (input.fromBranchId === input.toBranchId) {
    throw new Error('Source and destination branches must be different.');
  }

  if (input.items.length === 0) {
    throw new Error('Add at least one product to transfer.');
  }

  const branches = await listFlowerBranchesSupabase();
  const fromBranch = branches.find((branch) => branch.id === input.fromBranchId);
  const toBranch = branches.find((branch) => branch.id === input.toBranchId);
  const note = input.note?.trim() || `Transfer to ${toBranch?.name ?? input.toBranchId}`;

  for (const item of input.items) {
    if (item.quantity <= 0) {
      continue;
    }

    await applyFlowerStockChangeSupabase({
      branchId: input.fromBranchId,
      productId: item.productId,
      delta: -item.quantity,
      movementType: 'transfer_out',
      note,
    });

    await applyFlowerStockChangeSupabase({
      branchId: input.toBranchId,
      productId: item.productId,
      delta: item.quantity,
      movementType: 'transfer_in',
      note: `From ${fromBranch?.name ?? input.fromBranchId}`,
    });
  }
}
