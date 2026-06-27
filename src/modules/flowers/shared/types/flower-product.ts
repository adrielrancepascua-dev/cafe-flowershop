export interface FlowerProduct {
  id: string;
  name: string;
  unit_cost: number;
  is_active: boolean;
  created_at: string;
}

export interface CreateFlowerProductInput {
  name: string;
  unit_cost: number;
  is_active?: boolean;
}

export interface UpdateFlowerProductInput {
  name: string;
  unit_cost: number;
}

/** @deprecated use unit_cost */
export type FlowerProductLegacy = FlowerProduct & { base_price?: number };
