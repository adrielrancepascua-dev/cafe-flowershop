export type FlowerSupplyTransferType = 'new_arrival' | 'old_stock';

export interface FlowerSupplyTransferLine {
  id: string;
  product_id: string;
  product_name: string;
  product_color: string;
  quantity: number;
  unit_cost: number;
  line_liability: number;
}

export interface FlowerSupplyTransfer {
  id: string;
  transfer_type: FlowerSupplyTransferType;
  arrived_at_branch_id: string | null;
  arrived_at_branch_name: string | null;
  supplier: string;
  amount_paid_supplies: number;
  amount_paid_transpo: number;
  original_arrival_date: string | null;
  from_branch_id: string;
  from_branch_name: string;
  to_branch_id: string;
  to_branch_name: string;
  prepared_by: string;
  received_by: string;
  flower_liability: number;
  total_liability: number;
  items: FlowerSupplyTransferLine[];
  created_by_id: string;
  created_by_name: string;
  created_at: string;
}

export interface FlowerSupplyTransferLineInput {
  productId: string;
  quantity: number;
}

export interface CreateFlowerSupplyTransferInput {
  transfer_type: FlowerSupplyTransferType;
  arrived_at_branch_id?: string | null;
  supplier?: string;
  amount_paid_supplies?: number;
  amount_paid_transpo?: number;
  original_arrival_date?: string | null;
  from_branch_id: string;
  to_branch_id: string;
  prepared_by: string;
  received_by: string;
  items: FlowerSupplyTransferLineInput[];
  created_by_id: string;
  created_by_name: string;
}

export interface ListFlowerSupplyTransfersOptions {
  transferType?: FlowerSupplyTransferType;
  limit?: number;
}
