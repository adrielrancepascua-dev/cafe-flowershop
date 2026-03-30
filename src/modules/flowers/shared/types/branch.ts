export interface FlowerBranchSummary {
  branchId: string;
  branchCode: string;
  branchName: string;
  isActive: boolean;
}

export interface OwnerBranchScope {
  mode: 'all' | 'selected';
  branchIds: string[];
}
