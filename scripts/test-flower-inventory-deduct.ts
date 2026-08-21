import {
  alreadyDeductedQuantityForOrder,
  hasCompleteOrderDeduction,
  missingOrderDeductionByProduct,
  netOrderDeductedByProduct,
  planOrderInventoryDeduction,
  quantitiesToRestoreFromHistoricalReconcile,
} from '../src/modules/flowers/shared/utils/flower-inventory-deduct';
import { effectiveSoldPendingDeductionByProductId } from '../src/modules/flowers/shared/utils/flower-daily-inventory';
import { formatInventoryMovementActor } from '../src/modules/flowers/shared/utils/flower-format';
import { getInventoryDeductionBuckets } from '../src/services/flowers/orders/flowers-order-day-close';

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
  "Order deduct · ran on Rance Pascua's session",
  'auto deduct should not be mistaken for a manual stock out',
);

const spoilageOrderId = 'PP-1787047880756-6584';
const pinkRoseId = 'local-rose-pink';

assertEqual(
  Object.fromEntries(
    missingOrderDeductionByProduct({
      orderId: spoilageOrderId,
      items: [
        { product_id: 'gerbera-pink', quantity: 1 },
        { product_id: pinkRoseId, quantity: 4 },
      ],
      movements: [
        {
          movement_type: 'order_deduct',
          product_id: 'gerbera-pink',
          quantity: 1,
          branch_id: branchId,
          note: `Order ${spoilageOrderId} · SPOILAGE · day-close deduct`,
          created_at: '2026-08-18T11:04:00.000Z',
        },
      ],
    }),
  ),
  { [pinkRoseId]: 4 },
  'marked-deducted spoilage with only gerbera removed must still show 4 missing pink roses',
);

assertEqual(
  hasCompleteOrderDeduction({
    orderId: spoilageOrderId,
    items: [{ product_id: pinkRoseId, quantity: 4 }],
    movements: [
      {
        movement_type: 'order_deduct',
        product_id: pinkRoseId,
        quantity: 4,
        branch_id: branchId,
        note: `Order ${spoilageOrderId} · SPOILAGE · day-close deduct`,
        created_at: '2026-08-18T11:04:00.000Z',
      },
    ],
  }),
  true,
  'complete order deduct should pass completeness check',
);

assertEqual(
  Object.fromEntries(
    effectiveSoldPendingDeductionByProductId(
      [
        {
          id: spoilageOrderId,
          branch_id: branchId,
          branch_name: 'San Carlos',
          receiver: 'SPOILAGE',
          customer_social: '',
          scheduled_for: '2026-08-18T10:08:00.000Z',
          status: 'picked_up',
          claim_mode: 'walk_in',
          wrapper_color: '',
          greeting_card: '',
          special_instructions: '',
          downpayment: 0,
          payment_mode: 'cash',
          payment_reference: '',
          total_amount: 1,
          balance: 1,
          balance_paid: false,
          notes: '',
          photo_inspo_data_url: '',
          proof_dp_data_url: '',
          order_form_ss_data_url: '',
          ready_photo_data_url: '',
          created_by_id: 'admin',
          created_by_name: 'Papers & Petals Co-admin',
          inventory_deducted: true,
          content_edited_at: null,
          items: [
            { id: 1, product_id: 'gerbera-pink', item_name: 'Gerbera (Pink)', quantity: 1 },
            { id: 2, product_id: pinkRoseId, item_name: 'Local Rose (Pink)', quantity: 4 },
          ],
        },
      ],
      [
        {
          movement_type: 'order_deduct',
          product_id: 'gerbera-pink',
          quantity: 1,
          branch_id: branchId,
          note: `Order ${spoilageOrderId} · SPOILAGE · day-close deduct`,
          created_at: '2026-08-18T11:04:00.000Z',
        },
      ],
      '2026-08-18',
      branchId,
    ),
  ),
  { [pinkRoseId]: 4 },
  'expected count must still subtract under-deducted spoilage stems',
);

const sanCarlosBranch = 'san-carlos';
const sanCarlosDayMovements = [
  {
    movement_type: 'stock_out',
    product_id: pinkRoseId,
    quantity: 4,
    branch_id: sanCarlosBranch,
    note: 'Manual correction',
    created_at: '2026-08-18T05:02:00.000Z',
  },
  {
    movement_type: 'stock_in',
    product_id: pinkRoseId,
    quantity: 4,
    branch_id: sanCarlosBranch,
    note: 'Manual correction undo',
    created_at: '2026-08-18T05:29:00.000Z',
  },
];

assertEqual(
  planOrderInventoryDeduction({
    orderId: spoilageOrderId,
    branchId: sanCarlosBranch,
    items: [{ product_id: pinkRoseId, quantity: 4 }],
    movements: sanCarlosDayMovements,
  }),
  [{ product_id: pinkRoseId, quantity: 4 }],
  'same-day manual stock out/in must never skip spoilage order_deduct',
);

assertEqual(
  getInventoryDeductionBuckets(
    [
      {
        scheduled_for: '2026-08-18T10:08:00.000Z',
        branch_id: sanCarlosBranch,
        status: 'picked_up',
        inventory_deducted: true,
      },
    ],
    Date.UTC(2026, 7, 18, 12, 0, 0, 0),
  ),
  [],
  'already-deducted days must not be revisited for historical reconcile',
);

const beforeSevenPmUtc = Date.UTC(2026, 7, 20, 8, 0, 0, 0); // 4:00 PM Manila
const dagupanPending = {
  scheduled_for: '2026-08-20T02:00:00.000Z',
  branch_id: 'branch-dagupan',
  status: 'delivered' as const,
  inventory_deducted: false,
};

assertEqual(
  getInventoryDeductionBuckets([dagupanPending], beforeSevenPmUtc),
  [],
  'scheduled 7 PM deduct must wait until 7 PM Manila',
);

assertEqual(
  getInventoryDeductionBuckets([dagupanPending], beforeSevenPmUtc, { skipTimeGate: true }),
  [{ dateKey: '2026-08-20', branchId: 'branch-dagupan' }],
  'Run order deduct now must include pending terminal orders before 7 PM',
);

assertEqual(
  quantitiesToRestoreFromHistoricalReconcile(
    [
      {
        movement_type: 'order_deduct',
        product_id: pinkRoseId,
        quantity: 4,
        branch_id: sanCarlosBranch,
        note: `Order ${spoilageOrderId} · SPOILAGE · day-close deduct`,
        created_at: '2026-08-19T03:40:00.000Z',
      },
      {
        movement_type: 'order_deduct',
        product_id: pinkRoseId,
        quantity: 4,
        branch_id: sanCarlosBranch,
        note: `Order ${spoilageOrderId} · SPOILAGE · day-close deduct`,
        created_at: '2026-08-18T11:04:00.000Z',
      },
    ],
  ),
  [
    {
      branchId: sanCarlosBranch,
      productId: pinkRoseId,
      quantity: 4,
      orderId: 'BULK',
      receiver: 'inventory repair',
    },
  ],
  'only post-cutoff extra order_deducts are restored',
);

console.log('inventory deduct harden tests passed');
