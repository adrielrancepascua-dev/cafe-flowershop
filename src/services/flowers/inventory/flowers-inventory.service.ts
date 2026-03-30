import type {
  AdjustFlowerInventoryInput,
  FlowerBranchOption,
  FlowerInventoryMovementRow,
  FlowerInventoryStockRow,
  ListFlowerInventoryOptions,
} from '../../../modules/flowers/shared/types/flower-inventory';
import {
  adjustFlowerInventorySupabase,
  listFlowerBranchesSupabase,
  listFlowerInventoryMovementsSupabase,
  listFlowerInventoryStockSupabase,
} from './flowers-inventory.supabase';

export async function listFlowerBranches(): Promise<FlowerBranchOption[]> {
  return listFlowerBranchesSupabase();
}

export async function listFlowerInventoryStock(
  options: ListFlowerInventoryOptions = {},
): Promise<FlowerInventoryStockRow[]> {
  return listFlowerInventoryStockSupabase(options);
}

export async function listFlowerInventoryMovements(
  options: ListFlowerInventoryOptions & { limit?: number } = {},
): Promise<FlowerInventoryMovementRow[]> {
  return listFlowerInventoryMovementsSupabase(options);
}

export async function adjustFlowerInventory(input: AdjustFlowerInventoryInput): Promise<void> {
  return adjustFlowerInventorySupabase(input);
}
