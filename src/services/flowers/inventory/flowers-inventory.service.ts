import type {
  AdjustFlowerInventoryInput,
  FlowerBranchOption,
  FlowerInventoryMovementRow,
  FlowerInventoryStockRow,
  ListFlowerInventoryOptions,
} from '../../../modules/flowers/shared/types/flower-inventory';
import {
  adjustFlowerInventoryLocal,
  listFlowerBranchesLocal,
  listFlowerInventoryMovementsLocal,
  listFlowerInventoryStockLocal,
} from './flowers-inventory.local';
import {
  adjustFlowerInventorySupabase,
  listFlowerBranchesSupabase,
  listFlowerInventoryMovementsSupabase,
  listFlowerInventoryStockSupabase,
} from './flowers-inventory.supabase';
import { getFlowerStorageMode, shouldUseFlowerSupabase } from '../storage-mode';

export async function listFlowerBranches(): Promise<FlowerBranchOption[]> {
  const mode = getFlowerStorageMode();

  if (shouldUseFlowerSupabase(mode)) {
    try {
      return await listFlowerBranchesSupabase();
    } catch (error) {
      if (mode === 'supabase') {
        throw error;
      }
      console.warn('Falling back to local flower inventory after Supabase branch read failure.', error);
    }
  }

  return listFlowerBranchesLocal();
}

export async function listFlowerInventoryStock(
  options: ListFlowerInventoryOptions = {},
): Promise<FlowerInventoryStockRow[]> {
  const mode = getFlowerStorageMode();

  if (shouldUseFlowerSupabase(mode)) {
    try {
      return await listFlowerInventoryStockSupabase(options);
    } catch (error) {
      if (mode === 'supabase') {
        throw error;
      }
      console.warn('Falling back to local flower inventory after Supabase stock read failure.', error);
    }
  }

  return listFlowerInventoryStockLocal(options);
}

export async function listFlowerInventoryMovements(
  options: ListFlowerInventoryOptions & { limit?: number } = {},
): Promise<FlowerInventoryMovementRow[]> {
  const mode = getFlowerStorageMode();

  if (shouldUseFlowerSupabase(mode)) {
    try {
      return await listFlowerInventoryMovementsSupabase(options);
    } catch (error) {
      if (mode === 'supabase') {
        throw error;
      }
      console.warn('Falling back to local flower inventory after Supabase movement read failure.', error);
    }
  }

  return listFlowerInventoryMovementsLocal(options);
}

export async function adjustFlowerInventory(input: AdjustFlowerInventoryInput): Promise<void> {
  const mode = getFlowerStorageMode();

  if (shouldUseFlowerSupabase(mode)) {
    try {
      return await adjustFlowerInventorySupabase(input);
    } catch (error) {
      if (mode === 'supabase') {
        throw error;
      }
      console.warn('Falling back to local flower inventory after Supabase adjust failure.', error);
    }
  }

  return adjustFlowerInventoryLocal(input);
}
