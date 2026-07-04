import type {
  CreateFlowerSupplyTransferInput,
  FlowerSupplyTransfer,
  ListFlowerSupplyTransfersOptions,
} from '../../../modules/flowers/shared/types/flower-supply-transfer';
import { FLOWER_BRANCHES_MOCK } from '../../../modules/flowers/shared/data/flowers.mock';
import {
  buildSupplyTransferLine,
  computeFlowerLiability,
  computeSupplyTransferTotalLiability,
  validateCreateSupplyTransferInput,
} from '../../../modules/flowers/shared/utils/flower-supply-transfer';
import { listFlowerStemsLocal } from '../products/flowers-products.local';
import { transferFlowerInventoryLocal } from '../inventory/flowers-inventory.local';

const STORAGE_KEY = 'papers_petals_supply_transfers_v1';

function getBranchName(branchId: string): string {
  return FLOWER_BRANCHES_MOCK.find((branch) => branch.id === branchId)?.name ?? branchId;
}

function readTransfers(): FlowerSupplyTransfer[] {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as FlowerSupplyTransfer[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeTransfers(transfers: FlowerSupplyTransfer[]) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(transfers));
}

function createTransferId(): string {
  return `supply-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function listFlowerSupplyTransfersLocal(
  options: ListFlowerSupplyTransfersOptions = {},
): Promise<FlowerSupplyTransfer[]> {
  const limit = options.limit ?? 100;
  let transfers = readTransfers();

  if (options.transferType) {
    transfers = transfers.filter((transfer) => transfer.transfer_type === options.transferType);
  }

  return transfers
    .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())
    .slice(0, limit);
}

export async function createFlowerSupplyTransferLocal(
  input: CreateFlowerSupplyTransferInput,
): Promise<FlowerSupplyTransfer> {
  const validationError = validateCreateSupplyTransferInput(input);
  if (validationError) {
    throw new Error(validationError);
  }

  const products = await listFlowerStemsLocal();
  const productById = new Map(products.map((product) => [product.id, product]));
  const validItems = input.items.filter((item) => item.productId && item.quantity > 0);

  const lines = validItems.map((item, index) => {
    const product = productById.get(item.productId);
    if (!product) {
      throw new Error(`Unknown product: ${item.productId}`);
    }

    return buildSupplyTransferLine(item, product, `line-${index + 1}`);
  });

  const flowerLiability = computeFlowerLiability(lines);
  const totalLiability = computeSupplyTransferTotalLiability({
    transfer_type: input.transfer_type,
    flower_liability: flowerLiability,
    amount_paid_supplies: input.amount_paid_supplies,
    amount_paid_transpo: input.amount_paid_transpo,
  });

  const transferId = createTransferId();
  const voucherLabel = input.transfer_type === 'new_arrival' ? 'New arrivals' : 'Old stock';

  await transferFlowerInventoryLocal({
    fromBranchId: input.from_branch_id,
    toBranchId: input.to_branch_id,
    items: lines.map((line) => ({
      productId: line.product_id,
      quantity: line.quantity,
    })),
    note: `Supplies ${voucherLabel} voucher ${transferId}`,
  });

  const arrivedAtBranchId = input.arrived_at_branch_id ?? null;
  const record: FlowerSupplyTransfer = {
    id: transferId,
    transfer_type: input.transfer_type,
    arrived_at_branch_id: arrivedAtBranchId,
    arrived_at_branch_name: arrivedAtBranchId ? getBranchName(arrivedAtBranchId) : null,
    supplier: input.supplier?.trim() ?? '',
    amount_paid_supplies: Number(input.amount_paid_supplies) || 0,
    amount_paid_transpo: Number(input.amount_paid_transpo) || 0,
    original_arrival_date: input.original_arrival_date ?? null,
    from_branch_id: input.from_branch_id,
    from_branch_name: getBranchName(input.from_branch_id),
    to_branch_id: input.to_branch_id,
    to_branch_name: getBranchName(input.to_branch_id),
    prepared_by: input.prepared_by.trim(),
    received_by: input.received_by.trim(),
    flower_liability: flowerLiability,
    total_liability: totalLiability,
    items: lines,
    created_by_id: input.created_by_id,
    created_by_name: input.created_by_name,
    created_at: new Date().toISOString(),
  };

  const transfers = readTransfers();
  transfers.unshift(record);
  writeTransfers(transfers);

  return record;
}

export async function getFlowerSupplyTransferLocal(
  transferId: string,
): Promise<FlowerSupplyTransfer | null> {
  return readTransfers().find((transfer) => transfer.id === transferId) ?? null;
}
