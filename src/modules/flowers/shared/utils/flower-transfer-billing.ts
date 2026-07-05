import type { FlowerTransferRequest } from '../types/flower-inventory';

export function stripTransferRequestBilling(
  request: FlowerTransferRequest,
): FlowerTransferRequest {
  return {
    ...request,
    total_cost: null,
    cost_paid: false,
  };
}

export function formatTransferBillingStatus(request: FlowerTransferRequest): string {
  if (request.total_cost === null || request.total_cost === undefined) {
    return 'No cost set';
  }

  return request.cost_paid ? 'Paid' : 'Unpaid';
}

export interface FlowerTransferBranchBalanceRow {
  from_branch_id: string;
  from_branch_name: string;
  to_branch_id: string;
  to_branch_name: string;
  unpaid_total: number;
  unpaid_count: number;
}

/** Receiving branch owes the sending branch for confirmed transfers with a cost on file. */
export function summarizeUnpaidTransferBalances(
  requests: FlowerTransferRequest[],
): FlowerTransferBranchBalanceRow[] {
  const byPair = new Map<string, FlowerTransferBranchBalanceRow>();

  for (const request of requests) {
    if (request.status !== 'confirmed') {
      continue;
    }

    if (request.cost_paid) {
      continue;
    }

    const totalCost = Number(request.total_cost);
    if (!Number.isFinite(totalCost) || totalCost <= 0) {
      continue;
    }

    const key = `${request.from_branch_id}:${request.to_branch_id}`;
    const existing = byPair.get(key);

    if (existing) {
      existing.unpaid_total += totalCost;
      existing.unpaid_count += 1;
      continue;
    }

    byPair.set(key, {
      from_branch_id: request.from_branch_id,
      from_branch_name: request.from_branch_name,
      to_branch_id: request.to_branch_id,
      to_branch_name: request.to_branch_name,
      unpaid_total: totalCost,
      unpaid_count: 1,
    });
  }

  return [...byPair.values()].sort((left, right) =>
    left.to_branch_name.localeCompare(right.to_branch_name),
  );
}
