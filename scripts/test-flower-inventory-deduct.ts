import {
  alreadyDeductedQuantityForOrder,
  buildBatchStockOutCreditMap,
  creditExactStockOutAgainstPending,
  effectiveSoldPendingAfterStockOut,
  planOrderInventoryDeduction,
} from '../src/modules/flowers/shared/utils/flower-inventory-deduct';

function assertEqual<T>(actual: T, expected: T, message: string): void {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);
  if (actualJson !== expectedJson) {
    throw new Error(`${message}\n  expected: ${expectedJson}\n  actual:   ${actualJson}`);
  }
}

const branchId = 'dagupan';
const dateKey = '2026-08-15';

const saleStockOut = {
  movement_type: 'stock_out',
  product_id: 'gerbera-pink',
  quantity: 5,
  branch_id: branchId,
  note: '',
  created_at: '2026-08-15T09:47:00.000Z',
};

const laterOrderDeduct = {
  movement_type: 'order_deduct',
  product_id: 'gerbera-pink',
  quantity: 5,
  branch_id: branchId,
  note: 'Order PP-1001 · Alea · day-close deduct',
  created_at: '2026-08-15T11:05:00.000Z',
};

assertEqual(
  effectiveSoldPendingAfterStockOut(5, 5),
  0,
  'exact stock-out should cancel pending sold qty on the daily count',
);
assertEqual(
  effectiveSoldPendingAfterStockOut(5, 2),
  5,
  'smaller waste stock-out should not cancel pending sold qty',
);

const pending = new Map([['gerbera-pink', 5]]);
const stockOut = new Map([['gerbera-pink', 5]]);
assertEqual(
  Object.fromEntries(creditExactStockOutAgainstPending(pending, stockOut)),
  { 'gerbera-pink': 0 },
  '7 PM deduct should skip a product already stocked out for the same sold qty',
);

const wasteOnly = new Map([['gerbera-pink', 2]]);
assertEqual(
  Object.fromEntries(creditExactStockOutAgainstPending(pending, wasteOnly)),
  { 'gerbera-pink': 5 },
  '7 PM deduct should still run when stock-out qty does not match the sale',
);

assertEqual(
  alreadyDeductedQuantityForOrder([laterOrderDeduct], 'PP-1001', 'gerbera-pink'),
  5,
  'existing order_deduct for the same order must count as already deducted',
);

const creditMap = buildBatchStockOutCreditMap({
  branchId,
  dateKey,
  pendingItems: [{ product_id: 'gerbera-pink', quantity: 5 }],
  movements: [saleStockOut],
});

assertEqual(
  planOrderInventoryDeduction({
    orderId: 'PP-1001',
    branchId,
    items: [{ product_id: 'gerbera-pink', quantity: 5 }],
    movements: [saleStockOut],
    remainingAfterStockOutCredit: creditMap,
  }),
  [],
  'Alea case: 5 sold + 5 stock out at 5:47 PM must not deduct another 5 after 7 PM',
);

assertEqual(
  planOrderInventoryDeduction({
    orderId: 'PP-1001',
    branchId,
    items: [{ product_id: 'gerbera-pink', quantity: 5 }],
    movements: [laterOrderDeduct],
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
  'normal sale with no prior stock-out still deducts at 7 PM',
);

console.log('flower-inventory-deduct tests passed');
