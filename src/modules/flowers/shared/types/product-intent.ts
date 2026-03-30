export interface BranchAwareFlowerProductFilter {
  branchId?: string;
  includeInactive?: boolean;
}

export interface FlowerProductPreview {
  productId: string;
  name: string;
  basePrice: number;
  isActive: boolean;
  availableBranchIds: string[];
}
