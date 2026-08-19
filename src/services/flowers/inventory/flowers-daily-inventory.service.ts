import type {
  FlowerDailyInventoryBranchSummary,
  FlowerDailyInventoryCount,
  FlowerDailyInventoryWorksheet,
  ListFlowerDailyInventoryCountsOptions,
  SubmitFlowerDailyInventoryInput,
} from '../../../modules/flowers/shared/types/flower-daily-inventory';
import {
  buildDailyInventoryBranchSummary,
  buildDailyInventoryWorksheet,
  computeDailyInventoryVariance,
  parseDailyInventoryCountInput,
} from '../../../modules/flowers/shared/utils/flower-daily-inventory';
import { getFlowerStorageMode, shouldUseFlowerSupabase } from '../storage-mode';
import { listFlowerOrders } from '../orders/flowers-orders.service';
import { listFlowerBranches, listFlowerInventoryMovements, listFlowerInventoryStock } from './flowers-inventory.service';
import {
  getDailyInventoryCountLocal,
  listDailyInventoryCountsLocal,
  saveDailyInventoryCountLocal,
} from './flowers-daily-inventory.local';

async function withDailyInventoryStorage<T>(
  operation: () => Promise<T>,
  fallback: () => Promise<T>,
): Promise<T> {
  const mode = getFlowerStorageMode();

  if (shouldUseFlowerSupabase(mode)) {
    try {
      return await operation();
    } catch (error) {
      if (mode === 'supabase') {
        throw error;
      }

      console.warn('Falling back to local daily inventory.', error);
    }
  }

  return fallback();
}

export async function getDailyInventoryCount(
  branchId: string,
  countDate: string,
): Promise<FlowerDailyInventoryCount | null> {
  return withDailyInventoryStorage(
    async () => {
      const { getDailyInventoryCountSupabase } = await import('./flowers-daily-inventory.supabase');
      return getDailyInventoryCountSupabase(branchId, countDate);
    },
    () => getDailyInventoryCountLocal(branchId, countDate),
  );
}

export async function listDailyInventoryCounts(
  options: ListFlowerDailyInventoryCountsOptions = {},
): Promise<FlowerDailyInventoryCount[]> {
  return withDailyInventoryStorage(
    async () => {
      const { listDailyInventoryCountsSupabase } = await import('./flowers-daily-inventory.supabase');
      return listDailyInventoryCountsSupabase(options);
    },
    () => listDailyInventoryCountsLocal(options),
  );
}

export async function getDailyInventoryWorksheet(options: {
  branchId: string;
  countDate: string;
}): Promise<FlowerDailyInventoryWorksheet> {
  const [branches, stockRows, orders, movements, submitted] = await Promise.all([
    listFlowerBranches(),
    listFlowerInventoryStock({ branchId: options.branchId }),
    listFlowerOrders({
      branchId: options.branchId,
      scheduledFrom: options.countDate,
      scheduledTo: options.countDate,
    }),
    listFlowerInventoryMovements({
      branchId: options.branchId,
      fromDate: options.countDate,
      toDate: options.countDate,
      limit: 2000,
    }),
    getDailyInventoryCount(options.branchId, options.countDate),
  ]);

  const branchName = branches.find((branch) => branch.id === options.branchId)?.name ?? options.branchId;

  return buildDailyInventoryWorksheet({
    branchId: options.branchId,
    branchName,
    countDate: options.countDate,
    stockRows,
    orders,
    movements,
    submitted,
  });
}

export async function listDailyInventoryBranchSummaries(options: {
  countDate: string;
}): Promise<FlowerDailyInventoryBranchSummary[]> {
  const [branches, counts] = await Promise.all([
    listFlowerBranches(),
    listDailyInventoryCounts({ countDate: options.countDate }),
  ]);

  const countsByBranch = new Map(counts.map((count) => [count.branch_id, count]));

  return branches
    .filter((branch) => branch.is_active)
    .map((branch) =>
      buildDailyInventoryBranchSummary({
        branchId: branch.id,
        branchName: branch.name,
        countDate: options.countDate,
        submitted: countsByBranch.get(branch.id) ?? null,
      }),
    );
}

export async function isDailyInventorySubmitted(branchId: string, countDate: string): Promise<boolean> {
  const count = await getDailyInventoryCount(branchId, countDate);
  return Boolean(count);
}

export async function submitDailyInventoryCount(
  input: SubmitFlowerDailyInventoryInput,
): Promise<FlowerDailyInventoryCount> {
  const worksheet = await getDailyInventoryWorksheet({
    branchId: input.branchId,
    countDate: input.countDate,
  });

  if (worksheet.lines.length === 0) {
    throw new Error('No flowers or gift items to count for this branch.');
  }

  const lines = worksheet.lines.map((line) => {
    let actualCount: number;
    try {
      actualCount = parseDailyInventoryCountInput(input.actualCounts[line.product_id]);
    } catch {
      throw new Error(`Enter a whole number count for ${line.product_name}.`);
    }

    return {
      product_id: line.product_id,
      product_name: line.product_name,
      product_kind: line.product_kind,
      product_color: line.product_color,
      product_flower_type: line.product_flower_type,
      system_on_hand: line.system_on_hand,
      sold_pending_deduction: line.sold_pending_deduction,
      expected_on_hand: line.expected_on_hand,
      actual_count: actualCount,
      variance: computeDailyInventoryVariance(actualCount, line.expected_on_hand),
    };
  });

  const payload = {
    branchId: input.branchId,
    countDate: input.countDate,
    submittedById: input.submittedById,
    submittedByName: input.submittedByName,
    lines,
  };

  return withDailyInventoryStorage(
    async () => {
      const { saveDailyInventoryCountSupabase } = await import('./flowers-daily-inventory.supabase');
      return saveDailyInventoryCountSupabase(payload);
    },
    () => saveDailyInventoryCountLocal(payload),
  );
}
