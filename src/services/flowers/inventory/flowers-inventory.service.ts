import type {
  AdjustFlowerInventoryInput,
  CreateFlowerTransferRequestInput,
  FlowerTransferRequest,
  ListFlowerTransferRequestsOptions,
  ResolveFlowerTransferRequestInput,
  TransferFlowerInventoryInput,
  UpdateFlowerTransferRequestBillingInput,
} from '../../../modules/flowers/shared/types/flower-inventory';
import { getFlowerStorageMode, shouldUseFlowerSupabase } from '../storage-mode';
import { toServiceError } from '../../../lib/supabase/errors';
import {
  adjustFlowerInventoryLocal,
  cancelFlowerTransferRequestLocal,
  confirmFlowerTransferRequestLocal,
  createFlowerTransferRequestLocal,
  listFlowerBranchesLocal,
  listFlowerInventoryMovementsLocal,
  listFlowerInventoryStockLocal,
  listFlowerTransferRequestsLocal,
  rejectFlowerTransferRequestLocal,
  transferFlowerInventoryLocal,
  updateFlowerTransferRequestBillingLocal,
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

export async function createFlowerTransferRequest(
  input: CreateFlowerTransferRequestInput,
): Promise<FlowerTransferRequest> {
  const mode = getFlowerStorageMode();

  if (shouldUseFlowerSupabase(mode)) {
    try {
      const { createFlowerTransferRequestSupabase } = await import('./flowers-inventory.supabase');
      return await createFlowerTransferRequestSupabase(input);
    } catch (error) {
      throw toServiceError(error, 'Transfer request failed.');
    }
  }

  return createFlowerTransferRequestLocal(input);
}

export async function listFlowerTransferRequests(
  options: ListFlowerTransferRequestsOptions = {},
): Promise<FlowerTransferRequest[]> {
  const mode = getFlowerStorageMode();

  if (shouldUseFlowerSupabase(mode)) {
    try {
      const { listFlowerTransferRequestsSupabase } = await import('./flowers-inventory.supabase');
      return await listFlowerTransferRequestsSupabase(options);
    } catch (error) {
      if (mode === 'supabase') {
        throw error;
      }
    }
  }

  return listFlowerTransferRequestsLocal(options);
}

export async function updateFlowerTransferRequestBilling(
  input: UpdateFlowerTransferRequestBillingInput,
): Promise<FlowerTransferRequest> {
  const mode = getFlowerStorageMode();

  if (shouldUseFlowerSupabase(mode)) {
    try {
      const { updateFlowerTransferRequestBillingSupabase } = await import('./flowers-inventory.supabase');
      return await updateFlowerTransferRequestBillingSupabase(input);
    } catch (error) {
      throw toServiceError(error, 'Failed to update transfer billing.');
    }
  }

  return updateFlowerTransferRequestBillingLocal(input);
}

export async function confirmFlowerTransferRequest(
  input: ResolveFlowerTransferRequestInput,
): Promise<FlowerTransferRequest> {
  const mode = getFlowerStorageMode();

  if (shouldUseFlowerSupabase(mode)) {
    try {
      const { confirmFlowerTransferRequestSupabase } = await import('./flowers-inventory.supabase');
      return await confirmFlowerTransferRequestSupabase(input);
    } catch (error) {
      if (mode === 'supabase') {
        throw error;
      }
    }
  }

  return confirmFlowerTransferRequestLocal(input);
}

export async function rejectFlowerTransferRequest(
  input: ResolveFlowerTransferRequestInput,
): Promise<FlowerTransferRequest> {
  const mode = getFlowerStorageMode();

  if (shouldUseFlowerSupabase(mode)) {
    try {
      const { rejectFlowerTransferRequestSupabase } = await import('./flowers-inventory.supabase');
      return await rejectFlowerTransferRequestSupabase(input);
    } catch (error) {
      if (mode === 'supabase') {
        throw error;
      }
    }
  }

  return rejectFlowerTransferRequestLocal(input);
}

export async function cancelFlowerTransferRequest(
  input: ResolveFlowerTransferRequestInput,
): Promise<FlowerTransferRequest> {
  const mode = getFlowerStorageMode();

  if (shouldUseFlowerSupabase(mode)) {
    try {
      const { cancelFlowerTransferRequestSupabase } = await import('./flowers-inventory.supabase');
      return await cancelFlowerTransferRequestSupabase(input);
    } catch (error) {
      if (mode === 'supabase') {
        throw error;
      }
    }
  }

  return cancelFlowerTransferRequestLocal(input);
}
