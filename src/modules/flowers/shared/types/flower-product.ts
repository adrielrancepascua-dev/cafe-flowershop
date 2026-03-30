export interface FlowerProduct {
  id: string;
  name: string;
  base_price: number;
  is_active: boolean;
  created_at: string;
}

export interface CreateFlowerProductInput {
  name: string;
  base_price: number;
  is_active?: boolean;
}

export interface UpdateFlowerProductInput {
  name: string;
  base_price: number;
}
