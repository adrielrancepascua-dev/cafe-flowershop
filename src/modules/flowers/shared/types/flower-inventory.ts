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
