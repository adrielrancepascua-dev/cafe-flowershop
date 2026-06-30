export type FlowerOrderStatus =
  | 'not_started'
  | 'ready'
  | 'picked_up'
  | 'delivered'
  | 'completed'
  | 'cancelled';

export type FlowerClaimMode = 'pickup' | 'delivery';

export const FLOWER_ORDER_TERMINAL_STATUSES: FlowerOrderStatus[] = [
  'picked_up',
  'delivered',
  'completed',
];

/** Left-to-right status picker order in the orders UI. */
export const FLOWER_ORDER_STATUS_SEQUENCE: FlowerOrderStatus[] = [
  'not_started',
  'ready',
  'picked_up',
  'delivered',
  'cancelled',
];

export const FLOWER_ORDER_COMPLETE_STATUSES: FlowerOrderStatus[] = ['picked_up', 'delivered'];

export function normalizeOrderStatusForPicker(
  status: FlowerOrderStatus,
  claimMode: FlowerClaimMode,
): FlowerOrderStatus {
  if (status === 'completed') {
    return claimMode === 'delivery' ? 'delivered' : 'picked_up';
  }

  return status;
}

export interface FlowerOrderItem {
  id?: number;
  product_id: string;
  item_name: string;
  quantity: number;
}

export interface FlowerOrder {
  id: string;
  branch_id: string;
  branch_name: string;
  receiver: string;
  customer_social: string;
  scheduled_for: string;
  status: FlowerOrderStatus;
  claim_mode: FlowerClaimMode;
  wrapper_color: string;
  greeting_card: string;
  special_instructions: string;
  downpayment: number;
  payment_reference: string;
  total_amount: number;
  balance: number;
  notes: string;
  photo_inspo_data_url: string;
  proof_dp_data_url: string;
  order_form_ss_data_url: string;
  ready_photo_data_url: string;
  created_at: string;
  created_by_id: string;
  created_by_name: string;
  inventory_deducted: boolean;
  items: FlowerOrderItem[];
}

export interface CreateFlowerOrderItemInput {
  product_id: string;
  item_name: string;
  quantity: number;
}

export interface CreateFlowerOrderInput {
  branch_id: string;
  receiver: string;
  customer_social: string;
  scheduled_for: string;
  claim_mode: FlowerClaimMode;
  wrapper_color: string;
  greeting_card: string;
  special_instructions: string;
  downpayment: number;
  payment_reference: string;
  total_amount: number;
  notes: string;
  photo_inspo_data_url: string;
  proof_dp_data_url: string;
  order_form_ss_data_url: string;
  ready_photo_data_url: string;
  created_by_id: string;
  created_by_name: string;
  items: CreateFlowerOrderItemInput[];
}

export interface UpdateFlowerOrderInput extends CreateFlowerOrderInput {
  id: string;
}

export interface ListFlowerOrdersOptions {
  branchId?: string;
  scheduledFrom?: string;
  scheduledTo?: string;
}
