import type {
  AdjustFlowerInventoryInput,
  TransferFlowerInventoryInput,
} from '../../../modules/flowers/shared/types/flower-inventory';
import { getFlowerStorageMode, shouldUseFlowerSupabase } from '../storage-mode';
import {
  adjustFlowerInventoryLocal,
  listFlowerBranchesLocal,
  listFlowerInventoryMovementsLocal,
  listFlowerInventoryStockLocal,
  transferFlowerInventoryLocal,
} from './flowers-inventory.local';

export async function listFlowerBranches() {
  const mode = getFlowerStorageMode();

  if (shouldUseFlowerSupabase(mode)) {
    try {
      const { listFlowerBranchesSupabase } = await import('./flowers-inventory.supabase');
      return await listFlowerBranchesSupabase();
    } catch (error) {
      if (mode === 'supabase') {
        throw error;
      }
    }
  }

  return listFlowerBranchesLocal();
}

export async function listFlowerInventoryStock(
  options: Parameters<typeof listFlowerInventoryStockLocal>[0] = {},
) {
  const mode = getFlowerStorageMode();

  if (shouldUseFlowerSupabase(mode)) {
    try {
      const { listFlowerInventoryStockSupabase } = await import('./flowers-inventory.supabase');
      return await listFlowerInventoryStockSupabase(options);
    } catch (error) {
      if (mode === 'supabase') {
        throw error;
      }
    }
  }

  return listFlowerInventoryStockLocal(options);
}

export async function listFlowerInventoryMovements(
  options: Parameters<typeof listFlowerInventoryMovementsLocal>[0] = {},
) {
  const mode = getFlowerStorageMode();

  if (shouldUseFlowerSupabase(mode)) {
    try {
      const { listFlowerInventoryMovementsSupabase } = await import('./flowers-inventory.supabase');
      return await listFlowerInventoryMovementsSupabase(options);
    } catch (error) {
      if (mode === 'supabase') {
        throw error;
      }
    }
  }

  return listFlowerInventoryMovementsLocal(options);
}

export async function adjustFlowerInventory(input: AdjustFlowerInventoryInput): Promise<void> {
  const mode = getFlowerStorageMode();

  if (shouldUseFlowerSupabase(mode)) {
    try {
      const { adjustFlowerInventorySupabase } = await import('./flowers-inventory.supabase');
      return await adjustFlowerInventorySupabase(input);
    } catch (error) {
      if (mode === 'supabase') {
        throw error;
      }
    }
  }

  return adjustFlowerInventoryLocal(input);
}

export async function transferFlowerInventory(input: TransferFlowerInventoryInput): Promise<void> {
  const mode = getFlowerStorageMode();

  if (shouldUseFlowerSupabase(mode)) {
    try {
      const { transferFlowerInventorySupabase } = await import('./flowers-inventory.supabase');
      return await transferFlowerInventorySupabase(input);
    } catch (error) {
      if (mode === 'supabase') {
        throw error;
      }
      console.warn('Falling back to local flower inventory transfer.', error);
    }
  }

  return transferFlowerInventoryLocal(input);
}
