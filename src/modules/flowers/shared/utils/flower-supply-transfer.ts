import type { FlowerProduct } from '../types/flower-product';
import type {
  CreateFlowerSupplyTransferInput,
  FlowerSupplyTransferLine,
  FlowerSupplyTransferLineInput,
  FlowerSupplyTransferType,
} from '../types/flower-supply-transfer';
import {
  deriveFlowerTypeFromProduct,
  formatInventoryStockLabel,
  normalizeFlowerProductColor,
} from './flower-product-colors';
import { normalizeFlowerProductKind } from './flower-product-kind';

export const DAGUPAN_BRANCH_ID = 'branch-dagupan';

export function buildSupplyTransferLine(
  input: FlowerSupplyTransferLineInput,
  product: FlowerProduct,
  lineId: string,
): FlowerSupplyTransferLine {
  const unitCost = Number(product.unit_cost) || 0;
  const quantity = Math.max(0, Math.floor(input.quantity));

  return {
    id: lineId,
    product_id: product.id,
    product_name: product.name,
    product_color: normalizeFlowerProductColor(product.color),
    quantity,
    unit_cost: unitCost,
    line_liability: unitCost * quantity,
  };
}

export function computeFlowerLiability(lines: FlowerSupplyTransferLine[]): number {
  return lines.reduce((sum, line) => sum + line.line_liability, 0);
}

export function computeSupplyTransferTotalLiability(input: {
  transfer_type: FlowerSupplyTransferType;
  flower_liability: number;
  amount_paid_supplies?: number;
  amount_paid_transpo?: number;
}): number {
  const flowerLiability = Number(input.flower_liability) || 0;

  if (input.transfer_type === 'new_arrival') {
    const supplies = Number(input.amount_paid_supplies) || 0;
    const transpo = Number(input.amount_paid_transpo) || 0;
    return flowerLiability + supplies + transpo;
  }

  return flowerLiability;
}

export function formatSupplyTransferLineLabel(line: FlowerSupplyTransferLine): string {
  return formatInventoryStockLabel({
    product_id: line.product_id,
    product_name: line.product_name,
    product_color: line.product_color,
    product_kind: 'flower',
    product_flower_type: deriveFlowerTypeFromProduct(line.product_name, line.product_color),
    branch_id: '',
    branch_name: '',
    on_hand: 0,
    last_updated: null,
    product_is_active: true,
  });
}

export function validateCreateSupplyTransferInput(input: CreateFlowerSupplyTransferInput): string | null {
  if (!input.from_branch_id || !input.to_branch_id) {
    return 'Select both source and destination branches.';
  }

  if (input.from_branch_id === input.to_branch_id) {
    return 'Source and destination branches must be different.';
  }

  if (!input.prepared_by.trim() || !input.received_by.trim()) {
    return 'Enter prepared by and received by names.';
  }

  if (input.transfer_type === 'new_arrival') {
    if (!input.arrived_at_branch_id) {
      return 'Select where the supplies arrived.';
    }

    if (!input.supplier?.trim()) {
      return 'Enter the supplier name.';
    }
  }

  if (input.transfer_type === 'old_stock' && !input.original_arrival_date) {
    return 'Enter the original date of arrival.';
  }

  const validItems = input.items.filter((item) => item.productId && item.quantity > 0);
  if (validItems.length === 0) {
    return 'Add at least one flower line with quantity.';
  }

  return null;
}

export function filterFlowerProductsForSupply(products: FlowerProduct[]): FlowerProduct[] {
  return products.filter(
    (product) => product.is_active && normalizeFlowerProductKind(product.product_kind) === 'flower',
  );
}

export function groupFlowerProductsByType(products: FlowerProduct[]): Array<{
  flowerType: string;
  products: FlowerProduct[];
}> {
  const buckets = new Map<string, FlowerProduct[]>();

  for (const product of filterFlowerProductsForSupply(products)) {
    const flowerType = deriveFlowerTypeFromProduct(product.name, product.color);
    const bucket = buckets.get(flowerType) ?? [];
    bucket.push(product);
    buckets.set(flowerType, bucket);
  }

  return [...buckets.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([flowerType, typeProducts]) => ({
      flowerType,
      products: [...typeProducts].sort((left, right) =>
        normalizeFlowerProductColor(left.color).localeCompare(normalizeFlowerProductColor(right.color)),
      ),
    }));
}

export function describeSupplyTransferType(type: FlowerSupplyTransferType): string {
  return type === 'new_arrival' ? 'New arrivals' : 'Old stock';
}
