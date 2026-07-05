import { getSupabaseClient } from '../../../lib/supabase/client';
import { requireSupabaseAuthSession } from '../../../lib/auth/flower-auth.service';
import { extractSupabaseErrorMessage, toServiceError } from '../../../lib/supabase/errors';
import { FLOWER_BRANCHES_MOCK } from '../../../modules/flowers/shared/data/flowers.mock';
import type {
  AdjustFlowerInventoryInput,
  CreateFlowerTransferRequestInput,
  FlowerBranchOption,
  FlowerInventoryMovementRow,
  FlowerInventoryStockRow,
  FlowerTransferRequest,
  FlowerTransferRequestStatus,
  ListFlowerInventoryMovementsOptions,
  ListFlowerInventoryOptions,
  ListFlowerTransferRequestsOptions,
  ResolveFlowerTransferRequestInput,
  TransferFlowerInventoryInput,
  UpdateFlowerTransferRequestBillingInput,
} from '../../../modules/flowers/shared/types/flower-inventory';
import { getLocalDayBoundsIso, formatInventoryOrderDeductNote } from '../../../modules/flowers/shared/utils/flower-format';
import {
  compareInventoryStockRows,
  normalizeFlowerProductColor,
} from '../../../modules/flowers/shared/utils/flower-product-colors';
import { normalizeFlowerProductKind } from '../../../modules/flowers/shared/utils/flower-product-kind';
import {
  queryFlowerProductSummariesWithColorFallback,
  type FlowerProductSummaryDbRow,
} from '../products/flowers-products-supabase.shared';

type BranchRow = {
  id: string;
  name: string;
  is_active: boolean;
};

type ProductRow = {
  id: string;
  name: string;
  product_kind: string;
  flower_type: string;
  color: string;
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
  await requireSupabaseAuthSession();
  return requireSupabaseClient();
}

function assertPositiveInteger(quantity: number): void {
  if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isInteger(quantity)) {
    throw new Error('Quantity must be a whole number greater than 0.');
  }
}

// Cached per session: once we learn the atomic RPC is missing we stop probing
// for it and use the JS fallback for the rest of the session.
let atomicStockRpcAvailable: boolean | undefined;

function isMissingFunctionError(error: { code?: string; message?: string } | null): boolean {
  if (!error) {
    return false;
  }

  const code = error.code ?? '';
  const message = error.message ?? '';
  return (
    code === 'PGRST202' ||
    /could not find the function|schema cache|does not exist/i.test(message)
  );
}

/**
 * Attempts the atomic DB-side stock adjustment. Returns true when the RPC
 * handled the change, false when the RPC is not deployed yet (so the caller
 * should run the legacy read-modify-write path). Real errors are rethrown.
 */
async function runAtomicStockChange(
  supabase: ReturnType<typeof requireSupabaseClient>,
  params: {
    branchId: string;
    productId: string;
    delta: number;
    movementType: string;
    note: string;
    allowNegative: boolean;
  },
): Promise<boolean> {
  if (atomicStockRpcAvailable === false) {
    return false;
  }

  const { error } = await supabase.rpc('adjust_flower_stock', {
    p_branch_id: params.branchId,
    p_product_id: params.productId,
    p_delta: params.delta,
    p_movement_type: params.movementType,
    p_note: params.note,
    p_allow_negative: params.allowNegative,
  });

  if (!error) {
    atomicStockRpcAvailable = true;
    return true;
  }

  if (isMissingFunctionError(error)) {
    atomicStockRpcAvailable = false;
    return false;
  }

  if (/insufficient stock/i.test(error.message ?? '')) {
    throw new Error('Insufficient stock. Stock out would result in negative balance.');
  }

  if (/unauthorized inventory update/i.test(error.message ?? '')) {
    throw new Error('Your session has expired. Please sign in again.');
  }

  throw toServiceError(error, 'Stock update failed.');
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

  const rows = await queryFlowerProductSummariesWithColorFallback(async (columns) => {
    const result = await supabase.from('flower_products').select(columns).order('name', { ascending: true });
    return { data: result.data as FlowerProductSummaryDbRow[] | null, error: result.error };
  });

  return rows as ProductRow[];
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
        product_kind: normalizeFlowerProductKind(product.product_kind),
        product_color: normalizeFlowerProductColor(product.color),
        product_flower_type: product.flower_type ?? '',
        product_is_active: Boolean(product.is_active),
        on_hand: Number(stock?.on_hand ?? 0),
        last_updated: stock?.updated_at ?? null,
      });
    }
  }

  rows.sort(compareInventoryStockRows);

  return rows;
}

export async function listFlowerInventoryMovementsSupabase(
  options: ListFlowerInventoryMovementsOptions = {},
): Promise<FlowerInventoryMovementRow[]> {
  const supabase = await requireAuthenticatedSupabaseClient();
  const hasDateRange = Boolean(options.fromDate || options.toDate);
  const limit = options.limit ?? (hasDateRange ? 2000 : 40);

  let query = supabase
    .from('flower_inventory_movements')
    .select('id, branch_id, product_id, movement_type, quantity, previous_on_hand, new_on_hand, note, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (options.branchId) {
    query = query.eq('branch_id', options.branchId);
  }

  if (options.fromDate) {
    const { startIso } = getLocalDayBoundsIso(options.fromDate);
    query = query.gte('created_at', startIso);
  }

  if (options.toDate) {
    const { endIso } = getLocalDayBoundsIso(options.toDate);
    query = query.lte('created_at', endIso);
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

  const [branchesResult, productsData] = await Promise.all([
    supabase.from('flower_branches').select('id, name, is_active').in('id', branchIds),
    queryFlowerProductSummariesWithColorFallback(async (columns) => {
      const result = await supabase.from('flower_products').select(columns).in('id', productIds);
      return { data: result.data as FlowerProductSummaryDbRow[] | null, error: result.error };
    }),
  ]);

  const { data: branchesData, error: branchesError } = branchesResult;

  if (branchesError) {
    throw branchesError;
  }

  const branchMap = new Map<string, string>();
  for (const branch of (branchesData as BranchRow[] | null) ?? []) {
    branchMap.set(branch.id, branch.name);
  }

  const productMap = new Map<string, string>();
  for (const product of productsData) {
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
  const quantity = Number(input.quantity);
  assertPositiveInteger(quantity);

  const supabase = await requireAuthenticatedSupabaseClient();
  const delta = input.movementType === 'stock_in' ? quantity : -quantity;
  const movementType = toMovementType(input.movementType);
  const note = input.note?.trim() ?? '';

  if (
    await runAtomicStockChange(supabase, {
      branchId: input.branchId,
      productId: input.productId,
      delta,
      movementType,
      note,
      allowNegative: false,
    })
  ) {
    return;
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
  allowNegative?: boolean;
}): Promise<void> {
  const quantity = Math.abs(input.delta);
  assertPositiveInteger(quantity);

  const supabase = await requireAuthenticatedSupabaseClient();
  const note = input.note.trim();

  if (
    await runAtomicStockChange(supabase, {
      branchId: input.branchId,
      productId: input.productId,
      delta: input.delta,
      movementType: input.movementType,
      note,
      allowNegative: Boolean(input.allowNegative),
    })
  ) {
    return;
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

  if (!input.allowNegative && nextOnHand < 0) {
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
  receiver: string;
}): Promise<void> {
  await applyFlowerStockChangeSupabase({
    branchId: input.branchId,
    productId: input.productId,
    delta: -input.quantity,
    movementType: 'order_deduct',
    note: formatInventoryOrderDeductNote(input.orderId, input.receiver),
    allowNegative: true,
  });
}

/** Orders may use flowers before stock-in; day-close deduction can drive counts negative. */
export async function validateFlowerOrderStockSupabase(
  _branchId: string,
  _items: Array<{ product_id: string; item_name: string; quantity: number }>,
  _creditByProductId: Record<string, number> = {},
): Promise<void> {
  return;
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
      allowNegative: true,
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

type TransferRequestDbRow = {
  id: string;
  from_branch_id: string;
  to_branch_id: string;
  status: FlowerTransferRequestStatus;
  note: string;
  requested_by_id: string;
  requested_by_name: string;
  resolved_by_id: string | null;
  resolved_by_name: string | null;
  resolved_at: string | null;
  created_at: string;
  total_cost?: number | null;
  cost_paid?: boolean | null;
};

type TransferRequestItemDbRow = {
  id: number;
  transfer_id: string;
  product_id: string;
  quantity: number;
};

const TRANSFER_REQUEST_BASE_COLUMNS =
  'id, from_branch_id, to_branch_id, status, note, requested_by_id, requested_by_name, resolved_by_id, resolved_by_name, resolved_at, created_at';

const TRANSFER_REQUEST_BILLING_COLUMNS = ', total_cost, cost_paid';

function transferRequestSelectColumns(includeBilling: boolean): string {
  return includeBilling
    ? `${TRANSFER_REQUEST_BASE_COLUMNS}${TRANSFER_REQUEST_BILLING_COLUMNS}`
    : TRANSFER_REQUEST_BASE_COLUMNS;
}

function mapTransferBillingFields(row: TransferRequestDbRow): {
  total_cost: number | null;
  cost_paid: boolean;
} {
  return {
    total_cost: row.total_cost === null || row.total_cost === undefined ? null : Number(row.total_cost),
    cost_paid: Boolean(row.cost_paid),
  };
}

const TRANSFER_REQUEST_ITEM_COLUMNS = 'id, transfer_id, product_id, quantity';

function asTransferRequestDbRow(data: unknown): TransferRequestDbRow {
  return data as TransferRequestDbRow;
}

function asTransferRequestDbRows(data: unknown): TransferRequestDbRow[] {
  return (data as TransferRequestDbRow[] | null) ?? [];
}

async function listTransferRequestItems(
  supabase: ReturnType<typeof requireSupabaseClient>,
  transferIds: string[],
): Promise<TransferRequestItemDbRow[]> {
  if (transferIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from('flower_inventory_transfer_items')
    .select(TRANSFER_REQUEST_ITEM_COLUMNS)
    .in('transfer_id', transferIds);

  if (error) {
    throw error;
  }

  return (data as TransferRequestItemDbRow[] | null) ?? [];
}

async function mapTransferRequestRows(
  supabase: ReturnType<typeof requireSupabaseClient>,
  rows: TransferRequestDbRow[],
  includeBilling: boolean,
): Promise<FlowerTransferRequest[]> {
  if (rows.length === 0) {
    return [];
  }

  const branchIds = [
    ...new Set(rows.flatMap((row) => [row.from_branch_id, row.to_branch_id])),
  ];
  const transferIds = rows.map((row) => row.id);
  const itemRows = await listTransferRequestItems(supabase, transferIds);
  const productIds = [...new Set(itemRows.map((row) => row.product_id))];

  const [branchesResult, productsData] = await Promise.all([
    supabase.from('flower_branches').select('id, name, is_active').in('id', branchIds),
    productIds.length > 0
      ? queryFlowerProductSummariesWithColorFallback(async (columns) => {
          const result = await supabase.from('flower_products').select(columns).in('id', productIds);
          return { data: result.data as FlowerProductSummaryDbRow[] | null, error: result.error };
        })
      : Promise.resolve([] as FlowerProductSummaryDbRow[]),
  ]);

  if (branchesResult.error) {
    throw branchesResult.error;
  }

  const branchMap = new Map<string, string>();
  for (const branch of (branchesResult.data as BranchRow[] | null) ?? []) {
    branchMap.set(branch.id, branch.name);
  }

  const productMap = new Map<string, ProductRow>();
  for (const product of productsData as ProductRow[]) {
    productMap.set(product.id, product);
  }

  const itemsByTransfer = new Map<string, TransferRequestItemDbRow[]>();
  for (const item of itemRows) {
    const existing = itemsByTransfer.get(item.transfer_id) ?? [];
    existing.push(item);
    itemsByTransfer.set(item.transfer_id, existing);
  }

  return rows.map((row) => {
    const lineItems = itemsByTransfer.get(row.id) ?? [];

    return {
      id: row.id,
      from_branch_id: row.from_branch_id,
      from_branch_name: branchMap.get(row.from_branch_id) ?? row.from_branch_id,
      to_branch_id: row.to_branch_id,
      to_branch_name: branchMap.get(row.to_branch_id) ?? row.to_branch_id,
      items: lineItems.map((item) => {
        const product = productMap.get(item.product_id);

        return {
          id: String(item.id),
          product_id: item.product_id,
          product_name: product?.name ?? item.product_id,
          product_kind: normalizeFlowerProductKind(product?.product_kind),
          product_color: normalizeFlowerProductColor(product?.color ?? ''),
          product_flower_type: product?.flower_type ?? '',
          quantity: Number(item.quantity),
        };
      }),
      status: row.status,
      note: row.note ?? '',
      requested_by_id: row.requested_by_id,
      requested_by_name: row.requested_by_name,
      resolved_by_id: row.resolved_by_id,
      resolved_by_name: row.resolved_by_name,
      resolved_at: row.resolved_at,
      created_at: row.created_at,
      ...(includeBilling
        ? mapTransferBillingFields(row)
        : { total_cost: null, cost_paid: false }),
    };
  });
}

function isLegacyTransferSchemaError(error: unknown): boolean {
  const message = extractSupabaseErrorMessage(error, '');
  return /flower_inventory_transfers.*product_id|column "product_id".*flower_inventory_transfers/i.test(
    message,
  );
}

function mergeTransferItems(items: CreateFlowerTransferRequestInput['items']) {
  const merged = new Map<string, number>();

  for (const item of items) {
    const quantity = Number(item.quantity);
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new Error('Each quantity must be a whole number greater than 0.');
    }

    merged.set(item.productId, (merged.get(item.productId) ?? 0) + quantity);
  }

  return [...merged.entries()].map(([productId, quantity]) => ({ productId, quantity }));
}

export async function createFlowerTransferRequestSupabase(
  input: CreateFlowerTransferRequestInput,
): Promise<FlowerTransferRequest> {
  if (input.fromBranchId === input.toBranchId) {
    throw new Error('Source and destination branches must be different.');
  }

  if (input.items.length === 0) {
    throw new Error('Add at least one product to transfer.');
  }

  const normalizedItems = mergeTransferItems(input.items);
  const supabase = await requireAuthenticatedSupabaseClient();
  const branches = await listFlowerBranchesSupabase();
  const toBranchName = branches.find((branch) => branch.id === input.toBranchId)?.name ?? input.toBranchId;

  for (const item of normalizedItems) {
    await applyFlowerStockChangeSupabase({
      branchId: input.fromBranchId,
      productId: item.productId,
      delta: -item.quantity,
      movementType: 'transfer_out',
      note: `Transfer request to ${toBranchName}`,
      allowNegative: true,
    });
  }

  const { data, error } = await supabase
    .from('flower_inventory_transfers')
    .insert({
      from_branch_id: input.fromBranchId,
      to_branch_id: input.toBranchId,
      status: 'pending',
      note: input.note?.trim() ?? '',
      requested_by_id: input.requestedById,
      requested_by_name: input.requestedByName,
    })
    .select(transferRequestSelectColumns(false))
    .single();

  if (error || !data) {
    for (const item of normalizedItems) {
      await applyFlowerStockChangeSupabase({
        branchId: input.fromBranchId,
        productId: item.productId,
        delta: item.quantity,
        movementType: 'transfer_in',
        note: 'Transfer request failed — reverted',
        allowNegative: true,
      });
    }
    if (error && isLegacyTransferSchemaError(error)) {
      throw new Error(
        'Supabase still uses the old single-product transfer table. Run supabase/add_inventory_transfer_items.sql in the SQL editor, then try again.',
      );
    }
    throw toServiceError(error, 'Failed to create transfer request.');
  }

  const transferId = asTransferRequestDbRow(data).id;
  const { error: itemsError } = await supabase.from('flower_inventory_transfer_items').insert(
    normalizedItems.map((item) => ({
      transfer_id: transferId,
      product_id: item.productId,
      quantity: item.quantity,
    })),
  );

  if (itemsError) {
    await supabase.from('flower_inventory_transfers').delete().eq('id', transferId);
    for (const item of normalizedItems) {
      await applyFlowerStockChangeSupabase({
        branchId: input.fromBranchId,
        productId: item.productId,
        delta: item.quantity,
        movementType: 'transfer_in',
        note: 'Transfer request failed — reverted',
        allowNegative: true,
      });
    }
    throw toServiceError(itemsError, 'Failed to save transfer line items.');
  }

  const [mapped] = await mapTransferRequestRows(supabase, [asTransferRequestDbRow(data)], false);
  return mapped;
}

export async function listFlowerTransferRequestsSupabase(
  options: ListFlowerTransferRequestsOptions = {},
): Promise<FlowerTransferRequest[]> {
  const supabase = await requireAuthenticatedSupabaseClient();
  const includeBilling = Boolean(options.includeBilling);

  let query = supabase
    .from('flower_inventory_transfers')
    .select(transferRequestSelectColumns(includeBilling))
    .order('created_at', { ascending: false })
    .limit(options.limit ?? 100);

  if (options.status) {
    query = query.eq('status', options.status);
  }

  if (options.branchId) {
    query = query.or(`from_branch_id.eq.${options.branchId},to_branch_id.eq.${options.branchId}`);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return mapTransferRequestRows(supabase, asTransferRequestDbRows(data), includeBilling);
}

async function loadPendingTransferRequest(
  supabase: ReturnType<typeof requireSupabaseClient>,
  requestId: string,
): Promise<FlowerTransferRequest> {
  const { data, error } = await supabase
    .from('flower_inventory_transfers')
    .select(transferRequestSelectColumns(false))
    .eq('id', requestId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error('Transfer request not found.');
  }

  const [mapped] = await mapTransferRequestRows(supabase, [asTransferRequestDbRow(data)], false);
  if (mapped.status !== 'pending') {
    throw new Error('This transfer request has already been resolved.');
  }

  if (mapped.items.length === 0) {
    throw new Error('Transfer request has no line items.');
  }

  return mapped;
}

async function resolveTransferRequest(
  input: ResolveFlowerTransferRequestInput,
  status: Exclude<FlowerTransferRequestStatus, 'pending'>,
): Promise<FlowerTransferRequest> {
  const supabase = await requireAuthenticatedSupabaseClient();
  const request = await loadPendingTransferRequest(supabase, input.requestId);

  if (status === 'confirmed') {
    for (const item of request.items) {
      await applyFlowerStockChangeSupabase({
        branchId: request.to_branch_id,
        productId: item.product_id,
        delta: item.quantity,
        movementType: 'transfer_in',
        note: `Transfer received from ${request.from_branch_name}`,
      });
    }
  } else {
    const reason =
      status === 'rejected'
        ? `Transfer request rejected by ${request.to_branch_name}`
        : `Transfer request cancelled by ${request.from_branch_name}`;

    for (const item of request.items) {
      await applyFlowerStockChangeSupabase({
        branchId: request.from_branch_id,
        productId: item.product_id,
        delta: item.quantity,
        movementType: 'transfer_in',
        note: reason,
        allowNegative: true,
      });
    }
  }

  const { data, error } = await supabase
    .from('flower_inventory_transfers')
    .update({
      status,
      resolved_by_id: input.resolvedById,
      resolved_by_name: input.resolvedByName,
      resolved_at: new Date().toISOString(),
    })
    .eq('id', input.requestId)
    .eq('status', 'pending')
    .select(transferRequestSelectColumns(false))
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error('This transfer request has already been resolved.');
  }

  const [mapped] = await mapTransferRequestRows(supabase, [asTransferRequestDbRow(data)], false);
  return mapped;
}

export async function updateFlowerTransferRequestBillingSupabase(
  input: UpdateFlowerTransferRequestBillingInput,
): Promise<FlowerTransferRequest> {
  const supabase = await requireAuthenticatedSupabaseClient();
  const totalCost =
    input.total_cost === null || input.total_cost === undefined
      ? null
      : Number(input.total_cost);

  if (totalCost !== null && (!Number.isFinite(totalCost) || totalCost < 0)) {
    throw new Error('Total cost must be zero or greater.');
  }

  const { error } = await supabase.rpc('update_flower_transfer_billing', {
    p_transfer_id: input.requestId,
    p_total_cost: totalCost,
    p_cost_paid: Boolean(input.cost_paid),
  });

  if (error) {
    if (/only admins can update transfer billing/i.test(error.message ?? '')) {
      throw new Error('Only admins can update transfer billing.');
    }

    if (isMissingFunctionError(error)) {
      throw new Error(
        'Transfer billing is not available yet. Run supabase/add_flower_transfer_billing.sql in Supabase.',
      );
    }

    throw toServiceError(error, 'Failed to update transfer billing.');
  }

  const { data, error: loadError } = await supabase
    .from('flower_inventory_transfers')
    .select(transferRequestSelectColumns(true))
    .eq('id', input.requestId)
    .maybeSingle();

  if (loadError) {
    throw loadError;
  }

  if (!data) {
    throw new Error('Transfer request not found.');
  }

  const [mapped] = await mapTransferRequestRows(supabase, [asTransferRequestDbRow(data)], true);
  return mapped;
}

export async function confirmFlowerTransferRequestSupabase(
  input: ResolveFlowerTransferRequestInput,
): Promise<FlowerTransferRequest> {
  return resolveTransferRequest(input, 'confirmed');
}

export async function rejectFlowerTransferRequestSupabase(
  input: ResolveFlowerTransferRequestInput,
): Promise<FlowerTransferRequest> {
  return resolveTransferRequest(input, 'rejected');
}

export async function cancelFlowerTransferRequestSupabase(
  input: ResolveFlowerTransferRequestInput,
): Promise<FlowerTransferRequest> {
  return resolveTransferRequest(input, 'cancelled');
}
