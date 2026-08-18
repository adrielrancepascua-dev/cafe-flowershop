import type { FlowerOrder } from '../src/modules/flowers/shared/types/flower-order';
import type { FlowerProduct } from '../src/modules/flowers/shared/types/flower-product';
import {
  formatOrderInputTimestamp,
  fromManilaDateTimeLocalValue,
  isOrderInputToday,
  toManilaDateTimeLocalValue,
} from '../src/modules/flowers/shared/utils/flower-format';
import {
  buildSupplierOrderClipboardText,
  buildSupplierOrderSummary,
  isOrderCreatedAfterCutoff,
} from '../src/modules/flowers/shared/utils/flower-supplier-order-summary';

function assertEqual<T>(actual: T, expected: T, message: string): void {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);
  if (actualJson !== expectedJson) {
    throw new Error(`${message}\n  expected: ${expectedJson}\n  actual:   ${actualJson}`);
  }
}

function assertTrue(value: boolean, message: string): void {
  if (!value) {
    throw new Error(message);
  }
}

const now = new Date('2026-08-18T08:00:00.000Z'); // 4:00 PM Manila
const twoPmManilaIso = '2026-08-18T06:00:00.000Z';
const yesterdayIso = '2026-08-17T05:00:00.000Z';

assertEqual(
  toManilaDateTimeLocalValue(twoPmManilaIso),
  '2026-08-18T14:00',
  'ISO noon-ish UTC should become 2:00 PM Manila for datetime-local',
);

assertEqual(
  fromManilaDateTimeLocalValue('2026-08-18T14:00'),
  twoPmManilaIso,
  'Manila datetime-local should round-trip to the same UTC ISO',
);

assertEqual(
  formatOrderInputTimestamp(twoPmManilaIso, now),
  'today, 2:00 PM',
  'orders inputted today should say today plus Manila time',
);

assertTrue(
  formatOrderInputTimestamp(yesterdayIso, now).includes('Aug 17, 2026') &&
    formatOrderInputTimestamp(yesterdayIso, now).includes('1:00 PM'),
  `older orders should show the calendar date, got ${formatOrderInputTimestamp(yesterdayIso, now)}`,
);

assertEqual(isOrderInputToday(twoPmManilaIso, now), true, '2 PM Manila today is new');
assertEqual(isOrderInputToday(yesterdayIso, now), false, 'yesterday is not a new input');
assertEqual(
  isOrderCreatedAfterCutoff(twoPmManilaIso, yesterdayIso),
  true,
  'later input time counts as added after the cutoff',
);
assertEqual(
  isOrderCreatedAfterCutoff(yesterdayIso, twoPmManilaIso),
  false,
  'older input time is not a new addition',
);

function makeOrder(overrides: Partial<FlowerOrder> & Pick<FlowerOrder, 'id' | 'created_at'>): FlowerOrder {
  return {
    branch_id: 'dagupan',
    branch_name: 'Dagupan',
    receiver: 'Alea',
    customer_social: '',
    scheduled_for: '2026-08-20T02:00:00.000Z',
    status: 'not_started',
    claim_mode: 'pickup',
    wrapper_color: '',
    greeting_card: '',
    special_instructions: '',
    downpayment: 0,
    payment_mode: 'cash',
    payment_reference: '',
    total_amount: 500,
    balance: 500,
    balance_paid: false,
    balance_payment_mode: '',
    balance_payment_reference: '',
    notes: '',
    photo_inspo_data_url: '',
    proof_dp_data_url: '',
    order_form_ss_data_url: '',
    ready_photo_data_url: '',
    created_by_id: 'staff-1',
    created_by_name: 'Staff',
    inventory_deducted: false,
    content_edited_at: null,
    items: [{ product_id: 'gerbera-pink', item_name: 'Pink Gerbera', quantity: 5 }],
    ...overrides,
  };
}

const products: FlowerProduct[] = [
  {
    id: 'gerbera-pink',
    name: 'Gerbera',
    flower_type: 'Gerbera',
    product_kind: 'flower',
    color: 'Pink',
    unit_cost: 38,
    is_active: true,
    created_at: twoPmManilaIso,
  },
];

const oldOrder = makeOrder({
  id: 'old',
  receiver: 'Old order',
  created_at: yesterdayIso,
  items: [{ product_id: 'gerbera-pink', item_name: 'Pink Gerbera', quantity: 10 }],
});
const newOrder = makeOrder({
  id: 'new',
  receiver: 'New order',
  created_at: twoPmManilaIso,
  items: [{ product_id: 'gerbera-pink', item_name: 'Pink Gerbera', quantity: 5 }],
});
const cancelledNew = makeOrder({
  id: 'cancelled',
  status: 'cancelled',
  created_at: '2026-08-18T07:00:00.000Z',
  items: [{ product_id: 'gerbera-pink', item_name: 'Pink Gerbera', quantity: 99 }],
});

const allSummary = buildSupplierOrderSummary([oldOrder, newOrder, cancelledNew], products, {
  dateFrom: '2026-08-20',
  dateTo: '2026-08-20',
});

assertEqual(allSummary.orderCount, 2, 'cancelled orders stay out of the full reserved total');
assertEqual(allSummary.grandTotalFlowers[0]?.reservedQty, 15, 'full summary adds old + new gerbera');
assertEqual(allSummary.grandTotalFlowers[0]?.newQty, 0, 'no cutoff means New is not split yet');
assertEqual(allSummary.createdAfterIso, null, 'no cutoff means createdAfter is null');
assertEqual(allSummary.newOrderCount, 0, 'no cutoff means there is no new-order split');

const withLastLook = buildSupplierOrderSummary([oldOrder, newOrder, cancelledNew], products, {
  dateFrom: '2026-08-20',
  dateTo: '2026-08-20',
  createdAfterIso: yesterdayIso,
  roundSettings: { flowerRoundStep: 1, miscRoundStep: 1 },
});

assertEqual(withLastLook.orderCount, 1, 'after already-ordered, only later inputted orders stay visible');
assertEqual(withLastLook.totalReservedOrderCount, 2, 'full reserved count is kept for Redo');
assertEqual(withLastLook.newOrderCount, 1, 'new count is only later inputted orders');
assertEqual(withLastLook.grandTotalFlowers[0]?.reservedQty, 5, 'visible qty is only the additions');
assertEqual(withLastLook.grandTotalFlowers[0]?.suggestedOrderQty, 5, 'to-order box is the new qty');
assertEqual(withLastLook.newOrders.map((order) => order.id), ['new'], 'newOrders lists the additions');
assertEqual(withLastLook.createdAfterIso, yesterdayIso, 'cutoff is stored on the summary');

const clipboard = buildSupplierOrderClipboardText({
  summary: withLastLook,
  orderQuantities: new Map([
    [withLastLook.grandTotalFlowers[0].key, withLastLook.grandTotalFlowers[0].suggestedOrderQty],
  ]),
});

assertTrue(clipboard.includes('NEW ADDITIONS after'), 'clipboard labels a reorder as new additions');
assertTrue(clipboard.includes('5 stems pink gerbera'), 'clipboard to-order line is the new qty');
assertTrue(!clipboard.includes('15 pink gerbera'), 'clipboard must not include already-ordered stems');
assertTrue(clipboard.includes('TO ORDER (new additions)'), 'clipboard to-order header is new-only');

console.log('order input time tests passed');
