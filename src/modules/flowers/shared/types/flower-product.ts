import type { FlowerProductKind } from '../utils/flower-product-kind';

export interface FlowerProduct {
  id: string;
  name: string;
  product_kind: FlowerProductKind;
  color: string;
  unit_cost: number;
  is_active: boolean;
  created_at: string;
}

export interface CreateFlowerProductInput {
  name: string;
  product_kind?: FlowerProductKind;
  color: string;
  unit_cost: number;
  is_active?: boolean;
}

export interface UpdateFlowerProductInput {
  name: string;
  color: string;
  unit_cost: number;
}

/** @deprecated use unit_cost */
export type FlowerProductLegacy = FlowerProduct & { base_price?: number };
