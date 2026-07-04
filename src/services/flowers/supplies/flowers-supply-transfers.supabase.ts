import { getSupabaseClient } from '../../../lib/supabase/client';
import { ensureSupabaseSession } from '../../../lib/auth/flower-auth.service';
import type {
  CreateFlowerSupplyTransferInput,
  FlowerSupplyTransfer,
  FlowerSupplyTransferLine,
  ListFlowerSupplyTransfersOptions,
} from '../../../modules/flowers/shared/types/flower-supply-transfer';
import {
  buildSupplyTransferLine,
  computeFlowerLiability,
  computeSupplyTransferTotalLiability,
  validateCreateSupplyTransferInput,
} from '../../../modules/flowers/shared/utils/flower-supply-transfer';
import { transferFlowerInventorySupabase } from '../inventory/flowers-inventory.supabase';

type BranchRow = {
  id: string;
  name: string;
};

type TransferRow = {
  id: string;
  transfer_type: 'new_arrival' | 'old_stock';
  arrived_at_branch_id: string | null;
  supplier: string;
  amount_paid_supplies: number;
  amount_paid_transpo: number;
  original_arrival_date: string | null;
  from_branch_id: string;
  to_branch_id: string;
  prepared_by: string;
  received_by: string;
  flower_liability: number;
  total_liability: number;
  created_by_id: string;
  created_by_name: string;
  created_at: string;
};

type TransferItemRow = {
  id: number;
  transfer_id: string;
  product_id: string;
  product_name: string;
  product_color: string;
  quantity: number;
  unit_cost: number;
  line_liability: number;
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

async function getBranchNameMap(): Promise<Map<string, string>> {
  const supabase = await requireAuthenticatedSupabaseClient();
  const { data, error } = await supabase.from('flower_branches').select('id, name');

  if (error) {
    throw error;
  }

  const map = new Map<string, string>();
  for (const branch of (data as BranchRow[] | null) ?? []) {
    map.set(branch.id, branch.name);
  }

  return map;
}

function mapTransfer(
  row: TransferRow,
  items: FlowerSupplyTransferLine[],
  branchNames: Map<string, string>,
): FlowerSupplyTransfer {
  const arrivedAtBranchId = row.arrived_at_branch_id;

  return {
    id: row.id,
    transfer_type: row.transfer_type,
    arrived_at_branch_id: arrivedAtBranchId,
    arrived_at_branch_name: arrivedAtBranchId ? branchNames.get(arrivedAtBranchId) ?? arrivedAtBranchId : null,
    supplier: row.supplier,
    amount_paid_supplies: Number(row.amount_paid_supplies),
    amount_paid_transpo: Number(row.amount_paid_transpo),
    original_arrival_date: row.original_arrival_date,
    from_branch_id: row.from_branch_id,
    from_branch_name: branchNames.get(row.from_branch_id) ?? row.from_branch_id,
    to_branch_id: row.to_branch_id,
    to_branch_name: branchNames.get(row.to_branch_id) ?? row.to_branch_id,
    prepared_by: row.prepared_by,
    received_by: row.received_by,
    flower_liability: Number(row.flower_liability),
    total_liability: Number(row.total_liability),
    items,
    created_by_id: row.created_by_id,
    created_by_name: row.created_by_name,
    created_at: row.created_at,
  };
}

function mapItemRow(row: TransferItemRow): FlowerSupplyTransferLine {
  return {
    id: String(row.id),
    product_id: row.product_id,
    product_name: row.product_name,
    product_color: row.product_color,
    quantity: row.quantity,
    unit_cost: Number(row.unit_cost),
    line_liability: Number(row.line_liability),
  };
}

export async function listFlowerSupplyTransfersSupabase(
  options: ListFlowerSupplyTransfersOptions = {},
): Promise<FlowerSupplyTransfer[]> {
  const supabase = await requireAuthenticatedSupabaseClient();
  const limit = options.limit ?? 100;

  let query = supabase
    .from('flower_supply_transfers')
    .select(
      `
      id,
      transfer_type,
      arrived_at_branch_id,
      supplier,
      amount_paid_supplies,
      amount_paid_transpo,
      original_arrival_date,
      from_branch_id,
      to_branch_id,
      prepared_by,
      received_by,
      flower_liability,
      total_liability,
      created_by_id,
      created_by_name,
      created_at,
      flower_supply_transfer_items (
        id,
        transfer_id,
        product_id,
        product_name,
        product_color,
        quantity,
        unit_cost,
        line_liability
      )
    `,
    )
    .order('created_at', { ascending: false })
    .limit(limit);

  if (options.transferType) {
    query = query.eq('transfer_type', options.transferType);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  const branchNames = await getBranchNameMap();
  const rows = (data ?? []) as Array<
    TransferRow & { flower_supply_transfer_items?: TransferItemRow[] }
  >;

  return rows.map((row) =>
    mapTransfer(
      row,
      (row.flower_supply_transfer_items ?? []).map(mapItemRow),
      branchNames,
    ),
  );
}

export async function getFlowerSupplyTransferSupabase(
  transferId: string,
): Promise<FlowerSupplyTransfer | null> {
  const supabase = await requireAuthenticatedSupabaseClient();
  const { data, error } = await supabase
    .from('flower_supply_transfers')
    .select(
      `
      id,
      transfer_type,
      arrived_at_branch_id,
      supplier,
      amount_paid_supplies,
      amount_paid_transpo,
      original_arrival_date,
      from_branch_id,
      to_branch_id,
      prepared_by,
      received_by,
      flower_liability,
      total_liability,
      created_by_id,
      created_by_name,
      created_at,
      flower_supply_transfer_items (
        id,
        transfer_id,
        product_id,
        product_name,
        product_color,
        quantity,
        unit_cost,
        line_liability
      )
    `,
    )
    .eq('id', transferId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  const branchNames = await getBranchNameMap();
  const row = data as TransferRow & { flower_supply_transfer_items?: TransferItemRow[] };

  return mapTransfer(row, (row.flower_supply_transfer_items ?? []).map(mapItemRow), branchNames);
}

export async function createFlowerSupplyTransferSupabase(
  input: CreateFlowerSupplyTransferInput,
): Promise<FlowerSupplyTransfer> {
  const validationError = validateCreateSupplyTransferInput(input);
  if (validationError) {
    throw new Error(validationError);
  }

  const supabase = await requireAuthenticatedSupabaseClient();
  const { data: productRows, error: productError } = await supabase
    .from('flower_products')
    .select('id, name, color, unit_cost, product_kind, is_active');

  if (productError) {
    throw productError;
  }

  const productById = new Map(
    ((productRows ?? []) as Array<{
      id: string;
      name: string;
      color: string;
      unit_cost: number;
      product_kind: string;
      is_active: boolean;
    }>).map((product) => [product.id, product]),
  );

  const validItems = input.items.filter((item) => item.productId && item.quantity > 0);
  const lines = validItems.map((item, index) => {
    const product = productById.get(item.productId);
    if (!product) {
      throw new Error(`Unknown product: ${item.productId}`);
    }

    return buildSupplyTransferLine(
      item,
      {
        id: product.id,
        name: product.name,
        color: product.color,
        unit_cost: Number(product.unit_cost),
        flower_type: '',
        product_kind: 'flower',
        is_active: product.is_active,
        created_at: '',
      },
      `line-${index + 1}`,
    );
  });

  const flowerLiability = computeFlowerLiability(lines);
  const totalLiability = computeSupplyTransferTotalLiability({
    transfer_type: input.transfer_type,
    flower_liability: flowerLiability,
    amount_paid_supplies: input.amount_paid_supplies,
    amount_paid_transpo: input.amount_paid_transpo,
  });

  const transferId = crypto.randomUUID();
  const voucherLabel = input.transfer_type === 'new_arrival' ? 'New arrivals' : 'Old stock';

  await transferFlowerInventorySupabase({
    fromBranchId: input.from_branch_id,
    toBranchId: input.to_branch_id,
    items: lines.map((line) => ({
      productId: line.product_id,
      quantity: line.quantity,
    })),
    note: `Supplies ${voucherLabel} voucher ${transferId}`,
  });

  const { error: insertError } = await supabase.from('flower_supply_transfers').insert({
    id: transferId,
    transfer_type: input.transfer_type,
    arrived_at_branch_id: input.arrived_at_branch_id ?? null,
    supplier: input.supplier?.trim() ?? '',
    amount_paid_supplies: Number(input.amount_paid_supplies) || 0,
    amount_paid_transpo: Number(input.amount_paid_transpo) || 0,
    original_arrival_date: input.original_arrival_date ?? null,
    from_branch_id: input.from_branch_id,
    to_branch_id: input.to_branch_id,
    prepared_by: input.prepared_by.trim(),
    received_by: input.received_by.trim(),
    flower_liability: flowerLiability,
    total_liability: totalLiability,
    created_by_id: input.created_by_id,
    created_by_name: input.created_by_name,
  });

  if (insertError) {
    throw insertError;
  }

  const { error: itemsError } = await supabase.from('flower_supply_transfer_items').insert(
    lines.map((line) => ({
      transfer_id: transferId,
      product_id: line.product_id,
      product_name: line.product_name,
      product_color: line.product_color,
      quantity: line.quantity,
      unit_cost: line.unit_cost,
      line_liability: line.line_liability,
    })),
  );

  if (itemsError) {
    throw itemsError;
  }

  const created = await getFlowerSupplyTransferSupabase(transferId);
  if (!created) {
    throw new Error('Failed to load saved supply transfer.');
  }

  return created;
}
