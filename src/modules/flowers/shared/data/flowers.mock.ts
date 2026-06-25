import type { FlowerProduct } from '../types/flower-product';
import type { FlowerBranchOption } from '../types/flower-inventory';
import type { FlowerOrder } from '../types/flower-order';

export interface FlowerPosCatalogItem extends FlowerProduct {
  category: string;
  description: string;
  image: string;
}

const NOW = new Date().toISOString();

export const FLOWER_BRANCHES_MOCK: FlowerBranchOption[] = [
  { id: 'branch-main', name: 'Main Shop — Quezon City', is_active: true },
  { id: 'branch-makati', name: 'Makati Pop-up', is_active: true },
  { id: 'branch-events', name: 'Events & Catering', is_active: true },
];

export const FLOWER_PRODUCTS_CATALOG_MOCK: FlowerPosCatalogItem[] = [
  {
    id: 'fp-001',
    name: 'Classic Rose Bouquet (12 stems)',
    base_price: 1899,
    is_active: true,
    created_at: NOW,
    category: 'Bouquets',
    description: 'A dozen long-stem red roses wrapped in kraft paper.',
    image: 'https://images.unsplash.com/photo-1518895949257-7621c3c786d7?auto=format&fit=crop&w=600&q=80',
  },
  {
    id: 'fp-002',
    name: 'Pastel Garden Mix',
    base_price: 2499,
    is_active: true,
    created_at: NOW,
    category: 'Bouquets',
    description: 'Soft pinks, lavenders, and whites in a hand-tied bouquet.',
    image: 'https://images.unsplash.com/photo-1490750967868-88aa4486c946?auto=format&fit=crop&w=600&q=80',
  },
  {
    id: 'fp-003',
    name: 'Sunflower Cheer Bundle',
    base_price: 1599,
    is_active: true,
    created_at: NOW,
    category: 'Bouquets',
    description: 'Bright sunflowers with eucalyptus accents.',
    image: 'https://images.unsplash.com/photo-1597848219624-5192767503af?auto=format&fit=crop&w=600&q=80',
  },
  {
    id: 'fp-004',
    name: 'White Lily Centerpiece',
    base_price: 3299,
    is_active: true,
    created_at: NOW,
    category: 'Arrangements',
    description: 'Elegant table arrangement with lilies and greenery.',
    image: 'https://images.unsplash.com/photo-1487070183336-b86392237391?auto=format&fit=crop&w=600&q=80',
  },
  {
    id: 'fp-005',
    name: 'Tropical Paradise Vase',
    base_price: 2799,
    is_active: true,
    created_at: NOW,
    category: 'Arrangements',
    description: 'Birds of paradise, anthuriums, and tropical foliage.',
    image: 'https://images.unsplash.com/photo-1561181286-d3fee7d77250?auto=format&fit=crop&w=600&q=80',
  },
  {
    id: 'fp-006',
    name: 'Minimalist Orchid Pot',
    base_price: 1999,
    is_active: true,
    created_at: NOW,
    category: 'Plants',
    description: 'Single phalaenopsis orchid in a ceramic pot.',
    image: 'https://images.unsplash.com/photo-1615671524827-c1fe3973aa64?auto=format&fit=crop&w=600&q=80',
  },
  {
    id: 'fp-007',
    name: 'Succulent Garden Box',
    base_price: 1299,
    is_active: true,
    created_at: NOW,
    category: 'Plants',
    description: 'Assorted succulents in a wooden planter box.',
    image: 'https://images.unsplash.com/photo-1459150109756-9a350d176852?auto=format&fit=crop&w=600&q=80',
  },
  {
    id: 'fp-008',
    name: 'Single Red Rose',
    base_price: 199,
    is_active: true,
    created_at: NOW,
    category: 'Single Stems',
    description: 'Premium long-stem rose, individually wrapped.',
    image: 'https://images.unsplash.com/photo-1582794543139-8ac9cb0f6515?auto=format&fit=crop&w=600&q=80',
  },
  {
    id: 'fp-009',
    name: 'Tulip Stem (seasonal)',
    base_price: 249,
    is_active: true,
    created_at: NOW,
    category: 'Single Stems',
    description: 'Fresh imported tulip, color varies by availability.',
    image: 'https://images.unsplash.com/photo-1520763185298-1b434c631638?auto=format&fit=crop&w=600&q=80',
  },
  {
    id: 'fp-010',
    name: 'Greeting Card Add-on',
    base_price: 75,
    is_active: true,
    created_at: NOW,
    category: 'Add-ons',
    description: 'Handwritten message on premium cardstock.',
    image: 'https://images.unsplash.com/photo-1516975080664-ed2fc6a13783?auto=format&fit=crop&w=600&q=80',
  },
  {
    id: 'fp-011',
    name: 'Premium Gift Box',
    base_price: 350,
    is_active: true,
    created_at: NOW,
    category: 'Add-ons',
    description: 'Rigid gift box with tissue and ribbon.',
    image: 'https://images.unsplash.com/photo-1549465220-1a8b9238cd48?auto=format&fit=crop&w=600&q=80',
  },
  {
    id: 'fp-012',
    name: 'Same-Day Delivery',
    base_price: 299,
    is_active: true,
    created_at: NOW,
    category: 'Add-ons',
    description: 'Metro Manila same-day delivery service.',
    image: 'https://images.unsplash.com/photo-1464349153735-7db50ed83c84?auto=format&fit=crop&w=600&q=80',
  },
];

export function toFlowerProduct(catalog: FlowerPosCatalogItem): FlowerProduct {
  return {
    id: catalog.id,
    name: catalog.name,
    base_price: catalog.base_price,
    is_active: catalog.is_active,
    created_at: catalog.created_at,
  };
}

export const FLOWER_PRODUCTS_MOCK: FlowerProduct[] = FLOWER_PRODUCTS_CATALOG_MOCK.map(toFlowerProduct);

/** Initial on-hand stock per branch × product for demo seeding. */
export const FLOWER_INVENTORY_SEED: Record<string, Record<string, number>> = {
  'branch-main': {
    'fp-001': 24,
    'fp-002': 18,
    'fp-003': 15,
    'fp-004': 8,
    'fp-005': 10,
    'fp-006': 20,
    'fp-007': 30,
    'fp-008': 50,
    'fp-009': 40,
    'fp-010': 100,
    'fp-011': 45,
    'fp-012': 999,
  },
  'branch-makati': {
    'fp-001': 12,
    'fp-002': 10,
    'fp-003': 8,
    'fp-004': 5,
    'fp-005': 6,
    'fp-006': 12,
    'fp-007': 20,
    'fp-008': 30,
    'fp-009': 25,
    'fp-010': 50,
    'fp-011': 20,
    'fp-012': 999,
  },
  'branch-events': {
    'fp-001': 40,
    'fp-002': 35,
    'fp-003': 25,
    'fp-004': 15,
    'fp-005': 12,
    'fp-006': 8,
    'fp-007': 10,
    'fp-008': 100,
    'fp-009': 60,
    'fp-010': 200,
    'fp-011': 80,
    'fp-012': 999,
  },
};

function daysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

function daysFromNow(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

/** Sample orders so reports and order list aren't empty on first load. */
export const FLOWER_ORDERS_SEED: FlowerOrder[] = [
  {
    id: 'FLR-DEMO-001',
    branch_id: 'branch-main',
    branch_name: 'Main Shop — Quezon City',
    customer_name: 'Maria Santos',
    scheduled_for: daysFromNow(3),
    status: 'encoded',
    total_amount: 4398,
    notes: 'Anniversary delivery — call before arrival.',
    created_at: daysAgo(0),
    items: [
      { product_id: 'fp-001', item_name: 'Classic Rose Bouquet (12 stems)', quantity: 1, unit_price: 1899, line_total: 1899 },
      { product_id: 'fp-004', item_name: 'White Lily Centerpiece', quantity: 1, unit_price: 3299, line_total: 3299 },
    ],
  },
  {
    id: 'FLR-DEMO-002',
    branch_id: 'branch-makati',
    branch_name: 'Makati Pop-up',
    customer_name: 'Walk-in',
    scheduled_for: null,
    status: 'fulfilled',
    total_amount: 1599,
    notes: '',
    created_at: daysAgo(1),
    items: [
      { product_id: 'fp-003', item_name: 'Sunflower Cheer Bundle', quantity: 1, unit_price: 1599, line_total: 1599 },
    ],
  },
  {
    id: 'FLR-DEMO-003',
    branch_id: 'branch-main',
    branch_name: 'Main Shop — Quezon City',
    customer_name: 'James Lim',
    scheduled_for: daysFromNow(7),
    status: 'encoded',
    total_amount: 2849,
    notes: 'Corporate event — include receipt.',
    created_at: daysAgo(2),
    items: [
      { product_id: 'fp-002', item_name: 'Pastel Garden Mix', quantity: 1, unit_price: 2499, line_total: 2499 },
      { product_id: 'fp-010', item_name: 'Greeting Card Add-on', quantity: 1, unit_price: 75, line_total: 75 },
      { product_id: 'fp-012', item_name: 'Same-Day Delivery', quantity: 1, unit_price: 299, line_total: 299 },
    ],
  },
];
