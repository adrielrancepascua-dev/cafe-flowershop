export type FlowerOrderStatus = 'encoded' | 'fulfilled' | 'cancelled';

export interface FlowerOrderItem {
  id?: number;
  product_id: string;
  item_name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
}

export interface FlowerOrder {
  id: string;
  branch_id: string;
  branch_name: string;
  customer_name: string | null;
  scheduled_for: string | null;
  status: FlowerOrderStatus;
  total_amount: number;
  notes: string;
  created_at: string;
  items: FlowerOrderItem[];
}

export interface CreateFlowerOrderItemInput {
  product_id: string;
  item_name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
}

export interface CreateFlowerOrderInput {
  branch_id: string;
  customer_name?: string;
  scheduled_for?: string | null;
  total_amount: number;
  notes?: string;
  items: CreateFlowerOrderItemInput[];
}

export interface ListFlowerOrdersOptions {
  branchId?: string;
  scheduledOnly?: boolean;
}
