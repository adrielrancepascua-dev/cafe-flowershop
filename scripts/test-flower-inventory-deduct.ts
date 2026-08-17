import {
  alreadyDeductedQuantityForOrder,
  netOrderDeductedByProduct,
  planOrderInventoryDeduction,
} from '../src/modules/flowers/shared/utils/flower-inventory-deduct';
import { formatInventoryMovementActor } from '../src/modules/flowers/shared/utils/flower-format';

function assertEqual<T>(actual: T, expected: T, message: string): void {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);
  if (actualJson !== expectedJson) {
    throw new Error(`${message}\n  expected: ${expectedJson}\n  actual:   ${actualJson}`);
  }
}

const branchId = 'dagupan';

const orderDeduct = {
  movement_type: 'order_deduct',
  product_id: 'gerbera-pink',
  quantity: 5,
  branch_id: branchId,
  note: 'Order PP-1001 · Alea · day-close deduct',
  created_at: '2026-08-15T11:05:00.000Z',
};

const editRestore = {
  movement_type: 'stock_in',
  product_id: 'gerbera-pink',
  quantity: 2,
  branch_id: branchId,
  note: 'Order PP-1001 · Alea · order edit restore',
  created_at: '2026-08-15T11:20:00.000Z',
};

assertEqual(
  planOrderInventoryDeduction({
    orderId: 'PP-1001',
    branchId,
    items: [{ product_id: 'gerbera-pink', quantity: 5 }],
    movements: [orderDeduct],
  }),
  [],
  'repeat 7 PM poll must not write a second order_deduct for the same order',
);

assertEqual(
  planOrderInventoryDeduction({
    orderId: 'PP-1002',
    branchId,
    items: [{ product_id: 'gerbera-pink', quantity: 5 }],
    movements: [],
  }),
  [{ product_id: 'gerbera-pink', quantity: 5 }],
  'normal sale with no prior order_deduct still deducts at 7 PM',
);

assertEqual(
  alreadyDeductedQuantityForOrder([orderDeduct], 'PP-1001', 'gerbera-pink'),
  5,
  'existing order_deduct counts as already deducted',
);

assertEqual(
  Object.fromEntries(netOrderDeductedByProduct([orderDeduct, editRestore], 'PP-1001')),
  { 'gerbera-pink': 3 },
  'delete/edit restore must use net deducted after edit restores, not the original order qty',
);

assertEqual(
  formatInventoryMovementActor({ movement_type: 'stock_out', created_by_name: 'Alea' }),
  'Alea',
  'manual stock out should show the person who tapped it',
);

assertEqual(
  formatInventoryMovementActor({ movement_type: 'order_deduct', created_by_name: 'Rance Pascua' }),
  "7:00 PM deduct · ran on Rance Pascua's session",
  'auto deduct should not be mistaken for a manual stock out',
);

console.log('inventory deduct harden tests passed');
