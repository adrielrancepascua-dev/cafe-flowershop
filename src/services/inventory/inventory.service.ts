import { isSupabaseConfigured } from '../../lib/supabase/client';
import type {
  AdjustInventoryInput,
  InventoryLogRecord,
  InventoryStockRecord,
} from '../../modules/shared/types/inventory';
import {
  adjustInventorySupabase,
  listInventoryLogSupabase,
  listInventoryStockSupabase,
} from './inventory.supabase';

function ensureSupabaseConfigured() {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured for inventory.');
  }
}

export async function listInventoryStock(): Promise<InventoryStockRecord[]> {
  ensureSupabaseConfigured();
  return listInventoryStockSupabase();
}

export async function listInventoryLog(limit = 50): Promise<InventoryLogRecord[]> {
  ensureSupabaseConfigured();
  return listInventoryLogSupabase(limit);
}

export async function adjustInventory(input: AdjustInventoryInput): Promise<void> {
  ensureSupabaseConfigured();
  return adjustInventorySupabase(input);
}
