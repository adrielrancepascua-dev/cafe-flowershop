import type {
  CreateFlowerSupplyTransferInput,
  FlowerSupplyTransfer,
  ListFlowerSupplyTransfersOptions,
} from '../../../modules/flowers/shared/types/flower-supply-transfer';
import { getFlowerStorageMode, shouldUseFlowerSupabase } from '../storage-mode';
import {
  createFlowerSupplyTransferLocal,
  getFlowerSupplyTransferLocal,
  listFlowerSupplyTransfersLocal,
} from './flowers-supply-transfers.local';

export async function listFlowerSupplyTransfers(
  options: ListFlowerSupplyTransfersOptions = {},
): Promise<FlowerSupplyTransfer[]> {
  const mode = getFlowerStorageMode();

  if (shouldUseFlowerSupabase(mode)) {
    try {
      const { listFlowerSupplyTransfersSupabase } = await import('./flowers-supply-transfers.supabase');
      return await listFlowerSupplyTransfersSupabase(options);
    } catch (error) {
      if (mode === 'supabase') {
        throw error;
      }
      console.warn('Falling back to local supply transfers.', error);
    }
  }

  return listFlowerSupplyTransfersLocal(options);
}

export async function getFlowerSupplyTransfer(
  transferId: string,
): Promise<FlowerSupplyTransfer | null> {
  const mode = getFlowerStorageMode();

  if (shouldUseFlowerSupabase(mode)) {
    try {
      const { getFlowerSupplyTransferSupabase } = await import('./flowers-supply-transfers.supabase');
      return await getFlowerSupplyTransferSupabase(transferId);
    } catch (error) {
      if (mode === 'supabase') {
        throw error;
      }
    }
  }

  return getFlowerSupplyTransferLocal(transferId);
}

export async function createFlowerSupplyTransfer(
  input: CreateFlowerSupplyTransferInput,
): Promise<FlowerSupplyTransfer> {
  const mode = getFlowerStorageMode();

  if (shouldUseFlowerSupabase(mode)) {
    try {
      const { createFlowerSupplyTransferSupabase } = await import('./flowers-supply-transfers.supabase');
      return await createFlowerSupplyTransferSupabase(input);
    } catch (error) {
      if (mode === 'supabase') {
        throw error;
      }
      console.warn('Falling back to local supply transfer create.', error);
    }
  }

  return createFlowerSupplyTransferLocal(input);
}
