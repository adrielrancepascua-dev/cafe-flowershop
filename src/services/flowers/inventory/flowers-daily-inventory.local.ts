import type {
  FlowerDailyInventoryCount,
  FlowerDailyInventoryCountLine,
  ListFlowerDailyInventoryCountsOptions,
} from '../../../modules/flowers/shared/types/flower-daily-inventory';
import { listFlowerBranchesLocal } from './flowers-inventory.local';

const DAILY_INVENTORY_STORAGE_KEY = 'papers_petals_flower_daily_inventory_v1';

function readCountsFromStorage(): FlowerDailyInventoryCount[] {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(DAILY_INVENTORY_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as FlowerDailyInventoryCount[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeCountsToStorage(counts: FlowerDailyInventoryCount[]) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(DAILY_INVENTORY_STORAGE_KEY, JSON.stringify(counts));
}

export async function getDailyInventoryCountLocal(
  branchId: string,
  countDate: string,
): Promise<FlowerDailyInventoryCount | null> {
  return (
    readCountsFromStorage().find(
      (count) => count.branch_id === branchId && count.count_date === countDate,
    ) ?? null
  );
}

export async function listDailyInventoryCountsLocal(
  options: ListFlowerDailyInventoryCountsOptions = {},
): Promise<FlowerDailyInventoryCount[]> {
  return readCountsFromStorage()
    .filter((count) => {
      if (options.branchId && count.branch_id !== options.branchId) {
        return false;
      }

      if (options.countDate && count.count_date !== options.countDate) {
        return false;
      }

      return true;
    })
    .sort((left, right) => {
      if (left.count_date !== right.count_date) {
        return right.count_date.localeCompare(left.count_date);
      }

      return left.branch_name.localeCompare(right.branch_name);
    });
}

export async function saveDailyInventoryCountLocal(input: {
  branchId: string;
  countDate: string;
  submittedById: string;
  submittedByName: string;
  lines: Omit<FlowerDailyInventoryCountLine, 'id'>[];
}): Promise<FlowerDailyInventoryCount> {
  const existing = await getDailyInventoryCountLocal(input.branchId, input.countDate);
  if (existing) {
    throw new Error('Daily inventory already submitted for this branch and date.');
  }

  const branches = await listFlowerBranchesLocal();
  const branchName = branches.find((branch) => branch.id === input.branchId)?.name ?? input.branchId;
  const now = new Date().toISOString();
  const countId = `daily-count-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const count: FlowerDailyInventoryCount = {
    id: countId,
    branch_id: input.branchId,
    branch_name: branchName,
    count_date: input.countDate,
    status: 'submitted',
    submitted_by_id: input.submittedById,
    submitted_by_name: input.submittedByName,
    submitted_at: now,
    created_at: now,
    lines: input.lines.map((line, index) => ({
      ...line,
      id: `${countId}-line-${index + 1}`,
    })),
  };

  writeCountsToStorage([count, ...readCountsFromStorage()]);
  return count;
}
