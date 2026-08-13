export interface FlowerDailyInventoryCountLine {
  id: string;
  product_id: string;
  product_name: string;
  product_kind: string;
  product_color: string;
  product_flower_type: string;
  system_on_hand: number;
  sold_pending_deduction: number;
  expected_on_hand: number;
  actual_count: number;
  variance: number;
}

export interface FlowerDailyInventoryCount {
  id: string;
  branch_id: string;
  branch_name: string;
  count_date: string;
  status: 'submitted';
  submitted_by_id: string;
  submitted_by_name: string;
  submitted_at: string;
  created_at: string;
  lines: FlowerDailyInventoryCountLine[];
}

export interface FlowerDailyInventoryWorksheetLine {
  product_id: string;
  product_name: string;
  product_kind: string;
  product_color: string;
  product_flower_type: string;
  system_on_hand: number;
  sold_pending_deduction: number;
  expected_on_hand: number;
  actual_count: number | null;
  variance: number | null;
}

export interface FlowerDailyInventoryWorksheet {
  branch_id: string;
  branch_name: string;
  count_date: string;
  submitted: FlowerDailyInventoryCount | null;
  lines: FlowerDailyInventoryWorksheetLine[];
}

export interface FlowerDailyInventoryBranchSummary {
  branch_id: string;
  branch_name: string;
  count_date: string;
  submitted: boolean;
  submitted_at: string | null;
  submitted_by_name: string | null;
  match_count: number;
  short_count: number;
  extra_count: number;
  short_units: number;
  extra_units: number;
}

export interface SubmitFlowerDailyInventoryInput {
  branchId: string;
  countDate: string;
  submittedById: string;
  submittedByName: string;
  actualCounts: Record<string, number>;
}

export interface ListFlowerDailyInventoryCountsOptions {
  countDate?: string;
  branchId?: string;
}
