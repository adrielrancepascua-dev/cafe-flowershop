import type { CafeOrder, CafeOrderItem, CreateCafeOrderInput } from '../../modules/shared/types/order';
import { getSupabaseClient } from '../../lib/supabase/client';
import { buildOrderId } from './order-id';
const ORDER_DEBUG_ENABLED = import.meta.env.VITE_DEBUG_ORDERS === 'true';

function logDebug(message: string, meta?: unknown) {
  if (!ORDER_DEBUG_ENABLED) {
    return;
  }

  if (meta !== undefined) {
    console.log('[OrdersDebug][orders.supabase]', message, meta);
    return;
  }

  console.log('[OrdersDebug][orders.supabase]', message);
}

type OrderRow = {
  id: string;
  created_at: string;
  status: CafeOrder['status'];
  source: CafeOrder['source'];
  subtotal: number;
  total: number;
  order_items?: OrderItemRow[];
};

type OrderItemRow = {
  product_id: string;
  name: string;
  category: string;
  unit_price: number;
  quantity: number;
  line_total: number;
};

function rowToCafeOrder(row: OrderRow): CafeOrder {
  return {
    id: row.id,
    createdAt: row.created_at,
    status: row.status,
    source: row.source,
    subtotal: Number(row.subtotal),
    total: Number(row.total),
    items: (row.order_items ?? []).map((item) => ({
      product_id: item.product_id,
      name: item.name,
      category: item.category,
      unit_price: Number(item.unit_price),
      quantity: Number(item.quantity),
      line_total: Number(item.line_total),
    })),
  };
}

function requireSupabaseClient() {
  logDebug('Requesting Supabase client from adapter');
  const supabase = getSupabaseClient();
  if (!supabase) {
    logDebug('Supabase client unavailable in adapter');
    throw new Error('Supabase is not configured.');
  }
  logDebug('Supabase client available in adapter');
  return supabase;
}

export async function listOrdersSupabase(): Promise<CafeOrder[]> {
  logDebug('listOrdersSupabase reached');
  const supabase = requireSupabaseClient();

  const { data, error } = await supabase
    .from('orders')
    .select(
      `
      id,
      created_at,
      status,
      source,
      subtotal,
      total,
      order_items (
        product_id,
        name,
        category,
        unit_price,
        quantity,
        line_total
      )
    `,
    )
    .order('created_at', { ascending: false });

  if (error) {
    logDebug('listOrdersSupabase query failed', { reason: error.message });
    throw error;
  }

  const mapped = (data as OrderRow[] | null)?.map(rowToCafeOrder) ?? [];
  logDebug('listOrdersSupabase query succeeded', { count: mapped.length });
  return mapped;
}

export async function createOrderSupabase(input: CreateCafeOrderInput): Promise<CafeOrder> {
  logDebug('createOrderSupabase reached', {
    itemCount: input.items.length,
    subtotal: input.subtotal,
    total: input.total,
  });
  const supabase = requireSupabaseClient();

  const orderId = buildOrderId();
  const createdAt = new Date().toISOString();
  const source = input.source ?? 'dashboard_pos';
  const status: CafeOrder['status'] = 'submitted';

  const orderInsert = {
    id: orderId,
    created_at: createdAt,
    status,
    source,
    subtotal: input.subtotal,
    total: input.total,
  };

  const { error: orderError } = await supabase.from('orders').insert(orderInsert);

  if (orderError) {
    logDebug('Order header insert failed', { reason: orderError.message });
    throw orderError;
  }

  logDebug('Order header inserted', { orderId });

  const itemRows = input.items.map((item) => ({
    order_id: orderId,
    product_id: item.product_id,
    name: item.name,
    category: item.category,
    unit_price: item.unit_price,
    quantity: item.quantity,
    line_total: item.line_total,
  }));

  const { error: itemsError } = await supabase.from('order_items').insert(itemRows);

  if (itemsError) {
    logDebug('Order items insert failed', { reason: itemsError.message, orderId });
    // Best-effort rollback to avoid orphaned order when item insert fails.
    await supabase.from('orders').delete().eq('id', orderId);
    logDebug('Order header rollback attempted after item insert failure', { orderId });
    throw itemsError;
  }

  logDebug('Order items inserted', { orderId, itemCount: itemRows.length });

  const createdItems: CafeOrderItem[] = input.items.map((item) => ({
    product_id: item.product_id,
    name: item.name,
    category: item.category,
    unit_price: item.unit_price,
    quantity: item.quantity,
    line_total: item.line_total,
  }));

  return {
    id: orderId,
    items: createdItems,
    subtotal: input.subtotal,
    total: input.total,
    createdAt,
    status,
    source,
  };
}
