import type { FlowerProductKind } from '../utils/flower-product-kind';
import type { MiscProductCategory } from '../utils/flower-misc-category';

export interface FlowerProduct {
  id: string;
  name: string;
  flower_type: string;
  product_kind: FlowerProductKind;
  color: string;
  unit_cost: number;
  is_active: boolean;
  created_at: string;
}

export interface CreateFlowerProductInput {
  name: string;
  flower_type?: string;
  product_kind?: FlowerProductKind;
  misc_category?: MiscProductCategory;
  color: string;
  unit_cost: number;
  is_active?: boolean;
}

export interface UpdateFlowerProductInput {
  name: string;
  flower_type?: string;
  product_kind?: FlowerProductKind;
  misc_category?: MiscProductCategory;
  color: string;
  unit_cost: number;
}

/** @deprecated use unit_cost */
export type FlowerProductLegacy = FlowerProduct & { base_price?: number };
