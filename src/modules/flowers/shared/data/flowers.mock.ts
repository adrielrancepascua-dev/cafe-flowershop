import type { FlowerProduct } from '../types/flower-product';
import type { FlowerBranchOption } from '../types/flower-inventory';
import type { FlowerOrder } from '../types/flower-order';
import type { FlowerUser } from '../types/auth';

export type FlowerStemCatalogItem = FlowerProduct;

const NOW = new Date().toISOString();

export const FLOWER_BRANCHES_MOCK: FlowerBranchOption[] = [
  { id: 'branch-dagupan', name: 'Dagupan', is_active: true },
  { id: 'branch-san-carlos', name: 'San Carlos', is_active: true },
  { id: 'branch-urdaneta', name: 'Urdaneta', is_active: true },
];

export const FLOWER_STEMS_MOCK: FlowerStemCatalogItem[] = [
  { id: 'stem-rose-red', name: 'Red Rose', unit_cost: 45, is_active: true, created_at: NOW },
  { id: 'stem-rose-pink', name: 'Pink Rose', unit_cost: 45, is_active: true, created_at: NOW },
  { id: 'stem-tulip', name: 'Tulip', unit_cost: 55, is_active: true, created_at: NOW },
  { id: 'stem-sunflower', name: 'Sunflower', unit_cost: 40, is_active: true, created_at: NOW },
  { id: 'stem-carnation', name: 'Carnation', unit_cost: 35, is_active: true, created_at: NOW },
  { id: 'stem-lily', name: 'Lily', unit_cost: 60, is_active: true, created_at: NOW },
  { id: 'stem-babys-breath', name: "Baby's Breath", unit_cost: 25, is_active: true, created_at: NOW },
  { id: 'stem-eucalyptus', name: 'Eucalyptus', unit_cost: 30, is_active: true, created_at: NOW },
  { id: 'stem-hydrangea', name: 'Hydrangea', unit_cost: 75, is_active: true, created_at: NOW },
  { id: 'stem-gerbera', name: 'Gerbera', unit_cost: 38, is_active: true, created_at: NOW },
];

export const FLOWER_INVENTORY_SEED: Record<string, Record<string, number>> = {
  'branch-dagupan': {
    'stem-rose-red': 120,
    'stem-rose-pink': 80,
    'stem-tulip': 60,
    'stem-sunflower': 40,
    'stem-carnation': 100,
    'stem-lily': 50,
    'stem-babys-breath': 90,
    'stem-eucalyptus': 70,
    'stem-hydrangea': 30,
    'stem-gerbera': 55,
  },
  'branch-san-carlos': {
    'stem-rose-red': 90,
    'stem-rose-pink': 70,
    'stem-tulip': 45,
    'stem-sunflower': 35,
    'stem-carnation': 80,
    'stem-lily': 40,
    'stem-babys-breath': 75,
    'stem-eucalyptus': 60,
    'stem-hydrangea': 25,
    'stem-gerbera': 45,
  },
  'branch-urdaneta': {
    'stem-rose-red': 100,
    'stem-rose-pink': 65,
    'stem-tulip': 50,
    'stem-sunflower': 30,
    'stem-carnation': 85,
    'stem-lily': 35,
    'stem-babys-breath': 80,
    'stem-eucalyptus': 55,
    'stem-hydrangea': 20,
    'stem-gerbera': 40,
  },
};

export const FLOWER_DEMO_USERS: Array<
  FlowerUser & { password: string; branch_name?: string | null }
> = [
  {
    id: 'user-admin',
    email: 'admin@papersandpetals.ph',
    display_name: 'Owner Admin',
    role: 'admin',
    branch_id: null,
    branch_name: null,
    onboarding_completed: true,
    is_active: true,
    password: 'admin1234',
  },
  {
    id: 'user-staff-1',
    email: 'staff1@papersandpetals.ph',
    display_name: 'Staff One',
    role: 'staff',
    branch_id: 'branch-dagupan',
    branch_name: 'Dagupan',
    onboarding_completed: true,
    is_active: true,
    password: 'staff1234',
  },
  {
    id: 'user-staff-2',
    email: 'staff2@papersandpetals.ph',
    display_name: 'Staff Two',
    role: 'staff',
    branch_id: 'branch-san-carlos',
    branch_name: 'San Carlos',
    onboarding_completed: true,
    is_active: true,
    password: 'staff1234',
  },
];

export const FLOWER_ORDERS_SEED: FlowerOrder[] = [];

/** @deprecated use FLOWER_STEMS_MOCK */
export type FlowerPosCatalogItem = FlowerStemCatalogItem & {
  category?: string;
  description?: string;
  image?: string;
  base_price?: number;
};

/** @deprecated use FLOWER_STEMS_MOCK */
export const FLOWER_PRODUCTS_CATALOG_MOCK = FLOWER_STEMS_MOCK.map((stem) => ({
  ...stem,
  base_price: stem.unit_cost,
  category: 'Stems',
  description: '',
  image: '',
}));
