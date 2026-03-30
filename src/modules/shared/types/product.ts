export type ProductCategory =
  | 'Coffee'
  | 'Non-Coffee'
  | 'Refreshers'
  | 'Ice Blended'
  | 'Matcha & Hojicha'
  | 'Pastries'
  | 'Mini Cakes'
  | 'Customized Cakes'
  | 'Pasta'
  | 'All Day Breakfast'
  | 'Snacks';

export interface CafeProduct {
  id: string;
  name: string;
  category: ProductCategory;
  price: number;
  description: string;
  image: string;
  is_best_seller: boolean;
  is_new: boolean;
  is_active: boolean;
}
