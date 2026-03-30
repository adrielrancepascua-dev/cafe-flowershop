export type OrderStatus = 'submitted';

export type OrderSource = 'dashboard_pos';

export interface CafeOrderItem {
  product_id: string;
  name: string;
  category: string;
  unit_price: number;
  quantity: number;
  line_total: number;
}

export interface CafeOrder {
  id: string;
  items: CafeOrderItem[];
  subtotal: number;
  total: number;
  createdAt: string;
  status: OrderStatus;
  source: OrderSource;
}

export interface CreateCafeOrderInput {
  items: CafeOrderItem[];
  subtotal: number;
  total: number;
  source?: OrderSource;
}
