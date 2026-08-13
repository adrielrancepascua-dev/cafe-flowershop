import { requireSupabaseAuthSession } from '../../../lib/auth/flower-auth.service';
import { getSupabaseClient } from '../../../lib/supabase/client';
import { toServiceError } from '../../../lib/supabase/errors';
import type {
  FlowerDailyInventoryCount,
  FlowerDailyInventoryCountLine,
  ListFlowerDailyInventoryCountsOptions,
} from '../../../modules/flowers/shared/types/flower-daily-inventory';
import { listFlowerBranchesSupabase } from './flowers-inventory.supabase';

type CountDbRow = {
  id: string;
  branch_id: string;
  count_date: string;
  status: string;
  submitted_by_id: string;
  submitted_by_name: string;
  submitted_at: string;
  created_at: string;
};

type CountLineDbRow = {
  id: string;
  count_id: string;
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
};

function requireSupabaseClient() {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  return supabase;
}

async function requireAuthenticatedSupabaseClient() {
  await requireSupabaseAuthSession();
  return requireSupabaseClient();
}

function mapLine(row: CountLineDbRow): FlowerDailyInventoryCountLine {
  return {
    id: row.id,
    product_id: row.product_id,
    product_name: row.product_name,
    product_kind: row.product_kind,
    product_color: row.product_color,
    product_flower_type: row.product_flower_type,
    system_on_hand: Number(row.system_on_hand),
    sold_pending_deduction: Number(row.sold_pending_deduction),
    expected_on_hand: Number(row.expected_on_hand),
    actual_count: Number(row.actual_count),
    variance: Number(row.variance),
  };
}

async function attachLines(
  counts: CountDbRow[],
  branchNames: Map<string, string>,
): Promise<FlowerDailyInventoryCount[]> {
  if (counts.length === 0) {
    return [];
  }

  const supabase = await requireAuthenticatedSupabaseClient();
  const { data, error } = await supabase
    .from('flower_daily_inventory_count_lines')
    .select(
      'id, count_id, product_id, product_name, product_kind, product_color, product_flower_type, system_on_hand, sold_pending_deduction, expected_on_hand, actual_count, variance',
    )
    .in(
      'count_id',
      counts.map((count) => count.id),
    );

  if (error) {
    throw toServiceError(error, 'Failed to load daily inventory lines.');
  }

  const linesByCountId = new Map<string, FlowerDailyInventoryCountLine[]>();
  for (const row of (data as CountLineDbRow[] | null) ?? []) {
    const lines = linesByCountId.get(row.count_id) ?? [];
    lines.push(mapLine(row));
    linesByCountId.set(row.count_id, lines);
  }

  return counts.map((count) => ({
    id: count.id,
    branch_id: count.branch_id,
    branch_name: branchNames.get(count.branch_id) ?? count.branch_id,
    count_date: String(count.count_date).slice(0, 10),
    status: 'submitted',
    submitted_by_id: count.submitted_by_id,
    submitted_by_name: count.submitted_by_name,
    submitted_at: count.submitted_at,
    created_at: count.created_at,
    lines: linesByCountId.get(count.id) ?? [],
  }));
}

export async function getDailyInventoryCountSupabase(
  branchId: string,
  countDate: string,
): Promise<FlowerDailyInventoryCount | null> {
  const supabase = await requireAuthenticatedSupabaseClient();
  const { data, error } = await supabase
    .from('flower_daily_inventory_counts')
    .select('id, branch_id, count_date, status, submitted_by_id, submitted_by_name, submitted_at, created_at')
    .eq('branch_id', branchId)
    .eq('count_date', countDate)
    .maybeSingle();

  if (error) {
    throw toServiceError(error, 'Failed to load daily inventory.');
  }

  if (!data) {
    return null;
  }

  const branches = await listFlowerBranchesSupabase();
  const branchNames = new Map(branches.map((branch) => [branch.id, branch.name]));
  const [count] = await attachLines([data as CountDbRow], branchNames);
  return count ?? null;
}

export async function listDailyInventoryCountsSupabase(
  options: ListFlowerDailyInventoryCountsOptions = {},
): Promise<FlowerDailyInventoryCount[]> {
  const supabase = await requireAuthenticatedSupabaseClient();
  let query = supabase
    .from('flower_daily_inventory_counts')
    .select('id, branch_id, count_date, status, submitted_by_id, submitted_by_name, submitted_at, created_at')
    .order('count_date', { ascending: false });

  if (options.branchId) {
    query = query.eq('branch_id', options.branchId);
  }

  if (options.countDate) {
    query = query.eq('count_date', options.countDate);
  }

  const { data, error } = await query;
  if (error) {
    throw toServiceError(error, 'Failed to load daily inventory counts.');
  }

  const branches = await listFlowerBranchesSupabase();
  const branchNames = new Map(branches.map((branch) => [branch.id, branch.name]));
  return attachLines((data as CountDbRow[] | null) ?? [], branchNames);
}

async function replaceCountLines(
  countId: string,
  lines: Omit<FlowerDailyInventoryCountLine, 'id'>[],
): Promise<void> {
  const supabase = await requireAuthenticatedSupabaseClient();
  const { error: deleteError } = await supabase
    .from('flower_daily_inventory_count_lines')
    .delete()
    .eq('count_id', countId);

  if (deleteError) {
    throw toServiceError(deleteError, 'Failed to update daily inventory lines.');
  }

  const { error: linesError } = await supabase.from('flower_daily_inventory_count_lines').insert(
    lines.map((line) => ({
      count_id: countId,
      product_id: line.product_id,
      product_name: line.product_name,
      product_kind: line.product_kind,
      product_color: line.product_color,
      product_flower_type: line.product_flower_type,
      system_on_hand: line.system_on_hand,
      sold_pending_deduction: line.sold_pending_deduction,
      expected_on_hand: line.expected_on_hand,
      actual_count: line.actual_count,
      variance: line.variance,
    })),
  );

  if (linesError) {
    throw toServiceError(linesError, 'Failed to save daily inventory lines.');
  }
}

export async function saveDailyInventoryCountSupabase(input: {
  branchId: string;
  countDate: string;
  submittedById: string;
  submittedByName: string;
  lines: Omit<FlowerDailyInventoryCountLine, 'id'>[];
}): Promise<FlowerDailyInventoryCount> {
  const supabase = await requireAuthenticatedSupabaseClient();
  const existing = await getDailyInventoryCountSupabase(input.branchId, input.countDate);

  if (existing) {
    const { data, error } = await supabase
      .from('flower_daily_inventory_counts')
      .update({
        submitted_by_id: input.submittedById,
        submitted_by_name: input.submittedByName,
        submitted_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .select('id, branch_id, count_date, status, submitted_by_id, submitted_by_name, submitted_at, created_at')
      .single();

    if (error || !data) {
      throw toServiceError(error, 'Failed to update daily inventory.');
    }

    await replaceCountLines(existing.id, input.lines);
    const branches = await listFlowerBranchesSupabase();
    const branchNames = new Map(branches.map((branch) => [branch.id, branch.name]));
    const [count] = await attachLines([data as CountDbRow], branchNames);
    if (!count) {
      throw new Error('Failed to update daily inventory.');
    }

    return count;
  }

  const { data, error } = await supabase
    .from('flower_daily_inventory_counts')
    .insert({
      branch_id: input.branchId,
      count_date: input.countDate,
      status: 'submitted',
      submitted_by_id: input.submittedById,
      submitted_by_name: input.submittedByName,
    })
    .select('id, branch_id, count_date, status, submitted_by_id, submitted_by_name, submitted_at, created_at')
    .single();

  if (error || !data) {
    throw toServiceError(error, 'Failed to submit daily inventory. Run supabase/add_flower_daily_inventory.sql if this table is missing.');
  }

  const countRow = data as CountDbRow;
  try {
    await replaceCountLines(countRow.id, input.lines);
  } catch (lineError) {
    await supabase.from('flower_daily_inventory_counts').delete().eq('id', countRow.id);
    throw lineError;
  }

  const branches = await listFlowerBranchesSupabase();
  const branchNames = new Map(branches.map((branch) => [branch.id, branch.name]));
  const [count] = await attachLines([countRow], branchNames);
  return count ?? {
    id: countRow.id,
    branch_id: countRow.branch_id,
    branch_name: branchNames.get(countRow.branch_id) ?? countRow.branch_id,
    count_date: String(countRow.count_date).slice(0, 10),
    status: 'submitted',
    submitted_by_id: countRow.submitted_by_id,
    submitted_by_name: countRow.submitted_by_name,
    submitted_at: countRow.submitted_at,
    created_at: countRow.created_at,
    lines: [],
  };
}
