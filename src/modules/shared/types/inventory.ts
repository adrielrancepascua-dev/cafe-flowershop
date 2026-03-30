export type InventoryAdjustmentType = 'stock_in' | 'stock_out';

export interface InventoryStockRecord {
  productId: string;
  productName: string;
  currentStock: number;
  lastUpdated: string | null;
  isActiveProduct: boolean;
}

export interface InventoryLogRecord {
  id: number;
  productId: string;
  adjustmentType: InventoryAdjustmentType;
  quantity: number;
  previousStock: number;
  newStock: number;
  note: string;
  source: 'dashboard_inventory';
  createdAt: string;
}

export interface AdjustInventoryInput {
  productId: string;
  adjustmentType: InventoryAdjustmentType;
  quantity: number;
  note?: string;
}
