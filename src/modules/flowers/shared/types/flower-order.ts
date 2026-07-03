export type FlowerOrderStatus =
  | 'not_started'
  | 'ready'
  | 'picked_up'
  | 'delivered'
  | 'completed'
  | 'cancelled';

export type FlowerClaimMode = 'pickup' | 'delivery' | 'walk_in';

export const FLOWER_CLAIM_MODE_LABELS: Record<FlowerClaimMode, string> = {
  pickup: 'Pick up',
  delivery: 'Delivery',
  walk_in: 'Walk in',
};

export function formatFlowerClaimModeLabel(claimMode: FlowerClaimMode): string {
  return FLOWER_CLAIM_MODE_LABELS[claimMode];
}

export function formatScheduledForFieldLabel(claimMode: FlowerClaimMode): string {
  switch (claimMode) {
    case 'delivery':
      return 'Date & time of delivery';
    case 'walk_in':
      return 'Date & time of walk in';
    default:
      return 'Date & time of pick up';
  }
}

import type { FlowerPaymentMode } from '../utils/flower-payment';

export type { FlowerPaymentMode };

export const FLOWER_ORDER_TERMINAL_STATUSES: FlowerOrderStatus[] = [
  'picked_up',
  'delivered',
  'completed',
];

/** Left-to-right status picker order in the orders UI (claim-mode aware). */
export function getFlowerOrderStatusSequenceForClaimMode(
  claimMode: FlowerClaimMode,
): FlowerOrderStatus[] {
  if (claimMode === 'walk_in') {
    return ['not_started', 'ready', 'completed', 'cancelled'];
  }

  const terminalStatus: FlowerOrderStatus =
    claimMode === 'delivery' ? 'delivered' : 'picked_up';

  return ['not_started', 'ready', terminalStatus, 'cancelled'];
}

export const FLOWER_ORDER_COMPLETE_STATUSES: FlowerOrderStatus[] = [
  'picked_up',
  'delivered',
  'completed',
];

export function normalizeOrderStatusForPicker(
  status: FlowerOrderStatus,
  claimMode: FlowerClaimMode,
): FlowerOrderStatus {
  if (status === 'completed') {
    if (claimMode === 'delivery') {
      return 'delivered';
    }

    if (claimMode === 'walk_in') {
      return 'completed';
    }

    return 'picked_up';
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
  payment_mode: FlowerPaymentMode;
  payment_reference: string;
  total_amount: number;
  balance: number;
  balance_paid: boolean;
  balance_payment_mode: FlowerPaymentMode | '';
  balance_payment_reference: string;
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
  payment_mode: FlowerPaymentMode;
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
