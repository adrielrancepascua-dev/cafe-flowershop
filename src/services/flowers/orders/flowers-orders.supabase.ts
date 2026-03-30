import { getSupabaseClient } from '../../../lib/supabase/client';
import type {
  CreateFlowerOrderInput,
  FlowerOrder,
  FlowerOrderItem,
  FlowerOrderStatus,
  ListFlowerOrdersOptions,
} from '../../../modules/flowers/shared/types/flower-order';

type FlowerOrderRow = {
  id: string;
  branch_id: string;
  customer_name: string | null;
  scheduled_for: string | null;
  status: FlowerOrderStatus;
  total_amount: number;
  notes: string;
  created_at: string;
  flower_order_items?: FlowerOrderItemRow[];
};

type FlowerOrderItemRow = {
  id: number;
  product_id: string;
  item_name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
};

type BranchRow = {
  id: string;
  name: string;
};

type InventoryStockRow = {
  product_id: string;
  on_hand: number;
};

type AggregatedOrderItem = {
  product_id: string;
  item_name: string;
  quantity: number;
};

type StockSnapshot = {
  product_id: string;
  item_name: string;
  quantity: number;
  previous_on_hand: number;
  new_on_hand: number;
};

function requireSupabaseClient() {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  return supabase;
}

function mapOrderItemRow(row: FlowerOrderItemRow): FlowerOrderItem {
  return {
    id: Number(row.id),
    product_id: row.product_id,
    item_name: row.item_name,
    quantity: Number(row.quantity),
    unit_price: Number(row.unit_price),
    line_total: Number(row.line_total),
  };
}

function mapOrderRow(row: FlowerOrderRow, branchNameById: Map<string, string>): FlowerOrder {
  return {
    id: row.id,
    branch_id: row.branch_id,
    branch_name: branchNameById.get(row.branch_id) ?? row.branch_id,
    customer_name: row.customer_name,
    scheduled_for: row.scheduled_for,
    status: row.status,
    total_amount: Number(row.total_amount),
    notes: row.notes ?? '',
    created_at: row.created_at,
    items: (row.flower_order_items ?? []).map(mapOrderItemRow),
  };
}

function aggregateOrderItems(input: CreateFlowerOrderInput): AggregatedOrderItem[] {
  const byProductId = new Map<string, AggregatedOrderItem>();

  for (const item of input.items) {
    const existing = byProductId.get(item.product_id);

    if (existing) {
      existing.quantity += item.quantity;
      continue;
    }

    byProductId.set(item.product_id, {
      product_id: item.product_id,
      item_name: item.item_name,
      quantity: item.quantity,
    });
  }

  return [...byProductId.values()];
}

export async function listFlowerOrdersSupabase(
  options: ListFlowerOrdersOptions = {},
): Promise<FlowerOrder[]> {
  const supabase = requireSupabaseClient();

  let query = supabase
    .from('flower_orders')
    .select(
      `
      id,
      branch_id,
      customer_name,
      scheduled_for,
      status,
      total_amount,
      notes,
      created_at,
      flower_order_items (
        id,
        product_id,
        item_name,
        quantity,
        unit_price,
        line_total
      )
    `,
    )
    .order('created_at', { ascending: false });

  if (options.branchId) {
    query = query.eq('branch_id', options.branchId);
  }

  if (options.scheduledOnly) {
    query = query.not('scheduled_for', 'is', null);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  const orderRows = (data as FlowerOrderRow[] | null) ?? [];

  if (orderRows.length === 0) {
    return [];
  }

  const branchIds = [...new Set(orderRows.map((row) => row.branch_id))];
  const { data: branchData, error: branchError } = await supabase
    .from('flower_branches')
    .select('id, name')
    .in('id', branchIds);

  if (branchError) {
    throw branchError;
  }

  const branchNameById = new Map<string, string>();
  for (const branch of (branchData as BranchRow[] | null) ?? []) {
    branchNameById.set(branch.id, branch.name);
  }

  return orderRows.map((row) => mapOrderRow(row, branchNameById));
}

export async function createFlowerOrderSupabase(input: CreateFlowerOrderInput): Promise<FlowerOrder> {
  const supabase = requireSupabaseClient();
  const nowIso = new Date().toISOString();

  const aggregatedItems = aggregateOrderItems(input);
  const productIds = aggregatedItems.map((item) => item.product_id);

  const { data: stockData, error: stockError } = await supabase
    .from('flower_inventory_stock')
    .select('product_id, on_hand')
    .eq('branch_id', input.branch_id)
    .in('product_id', productIds);

  if (stockError) {
    throw stockError;
  }

  const stockByProductId = new Map<string, number>();
  for (const row of (stockData as InventoryStockRow[] | null) ?? []) {
    stockByProductId.set(row.product_id, Number(row.on_hand));
  }

  const snapshots: StockSnapshot[] = aggregatedItems.map((item) => {
    const previousOnHand = stockByProductId.get(item.product_id) ?? 0;
    const newOnHand = previousOnHand - item.quantity;

    return {
      product_id: item.product_id,
      item_name: item.item_name,
      quantity: item.quantity,
      previous_on_hand: previousOnHand,
      new_on_hand: newOnHand,
    };
  });

  const insufficient = snapshots.find((snapshot) => snapshot.new_on_hand < 0);
  if (insufficient) {
    throw new Error(
      `Insufficient stock for ${insufficient.item_name}. Available: ${insufficient.previous_on_hand}, required: ${insufficient.quantity}.`,
    );
  }

  const { data: orderRow, error: orderError } = await supabase
    .from('flower_orders')
    .insert({
      branch_id: input.branch_id,
      customer_name: input.customer_name?.trim() || null,
      scheduled_for: input.scheduled_for ?? null,
      status: 'encoded',
      total_amount: input.total_amount,
      notes: input.notes?.trim() ?? '',
    })
    .select('id, branch_id, customer_name, scheduled_for, status, total_amount, notes, created_at')
    .single();

  if (orderError) {
    throw orderError;
  }

  const createdOrder = orderRow as FlowerOrderRow;

  const itemRows = input.items.map((item) => ({
    order_id: createdOrder.id,
    product_id: item.product_id,
    item_name: item.item_name,
    quantity: item.quantity,
    unit_price: item.unit_price,
    line_total: item.line_total,
  }));

  const { data: insertedItems, error: itemsError } = await supabase
    .from('flower_order_items')
    .insert(itemRows)
    .select('id, product_id, item_name, quantity, unit_price, line_total');

  if (itemsError) {
    await supabase.from('flower_orders').delete().eq('id', createdOrder.id);
    throw itemsError;
  }

  try {
    for (const snapshot of snapshots) {
      const { error: updateError } = await supabase
        .from('flower_inventory_stock')
        .upsert(
          {
            branch_id: input.branch_id,
            product_id: snapshot.product_id,
            on_hand: snapshot.new_on_hand,
            updated_at: nowIso,
          },
          { onConflict: 'branch_id,product_id' },
        );

      if (updateError) {
        throw updateError;
      }
    }

    const movementRows = snapshots.map((snapshot) => ({
      branch_id: input.branch_id,
      product_id: snapshot.product_id,
      movement_type: 'out',
      quantity: snapshot.quantity,
      previous_on_hand: snapshot.previous_on_hand,
      new_on_hand: snapshot.new_on_hand,
      note: `Order ${createdOrder.id} encoded deduction`,
      created_at: nowIso,
    }));

    const { error: movementError } = await supabase
      .from('flower_inventory_movements')
      .insert(movementRows);

    if (movementError) {
      throw movementError;
    }
  } catch (deductionError) {
    for (const snapshot of snapshots) {
      await supabase
        .from('flower_inventory_stock')
        .upsert(
          {
            branch_id: input.branch_id,
            product_id: snapshot.product_id,
            on_hand: snapshot.previous_on_hand,
            updated_at: nowIso,
          },
          { onConflict: 'branch_id,product_id' },
        );
    }

    await supabase.from('flower_orders').delete().eq('id', createdOrder.id);

    if (deductionError instanceof Error) {
      throw new Error(`Order save failed during inventory deduction: ${deductionError.message}`);
    }

    throw new Error('Order save failed during inventory deduction.');
  }

  const { data: branchRow, error: branchError } = await supabase
    .from('flower_branches')
    .select('id, name')
    .eq('id', createdOrder.branch_id)
    .single();

  if (branchError) {
    throw branchError;
  }

  const branchNameById = new Map<string, string>([[branchRow.id, branchRow.name]]);

  return {
    ...mapOrderRow(
      {
        ...createdOrder,
        flower_order_items: (insertedItems as FlowerOrderItemRow[] | null) ?? [],
      },
      branchNameById,
    ),
  };
}
