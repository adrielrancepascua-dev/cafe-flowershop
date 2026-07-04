export type FlowerInventoryAdjustmentType = 'stock_in' | 'stock_out';

export type FlowerInventoryMovementType =
  | FlowerInventoryAdjustmentType
  | 'transfer_in'
  | 'transfer_out'
  | 'order_deduct';

export interface FlowerBranchOption {
  id: string;
  name: string;
  is_active: boolean;
}

export interface FlowerInventoryStockRow {
  branch_id: string;
  branch_name: string;
  product_id: string;
  product_name: string;
  product_kind: string;
  product_color: string;
  product_flower_type: string;
  product_is_active: boolean;
  on_hand: number;
  last_updated: string | null;
}

export interface FlowerInventoryMovementRow {
  id: number;
  branch_id: string;
  branch_name: string;
  product_id: string;
  product_name: string;
  movement_type: FlowerInventoryMovementType;
  quantity: number;
  previous_on_hand: number;
  new_on_hand: number;
  note: string;
  created_at: string;
}

export interface ListFlowerInventoryOptions {
  branchId?: string;
}

export interface ListFlowerInventoryMovementsOptions extends ListFlowerInventoryOptions {
  limit?: number;
  fromDate?: string;
  toDate?: string;
}

export type FlowerInventoryStockPrintLayout = 'combined' | 'by_branch';

export interface FlowerPrintableInventoryStockSection {
  branch_id: string;
  branch_name: string;
  total_units: number;
  rows: Array<{
    product_name: string;
    on_hand: number;
  }>;
}

export interface FlowerPrintableInventoryStockReport {
  generated_at: string;
  layout: FlowerInventoryStockPrintLayout;
  branch_label: string;
  sections: FlowerPrintableInventoryStockSection[];
  total_units: number;
}

export interface AdjustFlowerInventoryInput {
  branchId: string;
  productId: string;
  movementType: FlowerInventoryAdjustmentType;
  quantity: number;
  note?: string;
}

export interface TransferFlowerInventoryInput {
  fromBranchId: string;
  toBranchId: string;
  items: { productId: string; quantity: number }[];
  note?: string;
}

export type FlowerTransferRequestStatus = 'pending' | 'confirmed' | 'rejected' | 'cancelled';

export interface FlowerTransferRequest {
  id: string;
  from_branch_id: string;
  from_branch_name: string;
  to_branch_id: string;
  to_branch_name: string;
  product_id: string;
  product_name: string;
  product_kind: string;
  product_color: string;
  product_flower_type: string;
  quantity: number;
  status: FlowerTransferRequestStatus;
  note: string;
  requested_by_id: string;
  requested_by_name: string;
  resolved_by_id: string | null;
  resolved_by_name: string | null;
  resolved_at: string | null;
  created_at: string;
}

export interface CreateFlowerTransferRequestInput {
  fromBranchId: string;
  toBranchId: string;
  productId: string;
  quantity: number;
  note?: string;
  requestedById: string;
  requestedByName: string;
}

export interface ResolveFlowerTransferRequestInput {
  requestId: string;
  resolvedById: string;
  resolvedByName: string;
}

export interface ListFlowerTransferRequestsOptions {
  /** Only include requests where this branch is the sender or receiver. */
  branchId?: string;
  status?: FlowerTransferRequestStatus;
  limit?: number;
}
