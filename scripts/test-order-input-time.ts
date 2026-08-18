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
  getSupplierRangeStampState,
  stampSupplierDateRange,
  unstampSupplierDateRange,
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
  getSupplierRangeStampState(['2026-08-18', '2026-08-19'], '2026-08-18', '2026-08-19').status,
  'done',
  '18-19 is DONE when those pickup days are stamped',
);
assertEqual(
  getSupplierRangeStampState(['2026-08-18', '2026-08-19'], '2026-08-18', '2026-08-25').status,
  'partial',
  '18-25 is partial when only 18-19 are stamped',
);
assertEqual(
  getSupplierRangeStampState(['2026-08-18', '2026-08-19'], '2026-08-20', '2026-08-25').status,
  'open',
  '20-25 stays open until stamped',
);
assertEqual(
  stampSupplierDateRange(['2026-08-18', '2026-08-19'], '2026-08-20', '2026-08-21'),
  ['2026-08-18', '2026-08-19', '2026-08-20', '2026-08-21'],
  'stamping a later range keeps earlier DONE days',
);
assertEqual(
  unstampSupplierDateRange(['2026-08-18', '2026-08-19', '2026-08-20'], '2026-08-18', '2026-08-19'),
  ['2026-08-20'],
  'Redo on 18-19 only unstamps those days',
);

function makeOrder(overrides: Partial<FlowerOrder> & Pick<FlowerOrder, 'id' | 'created_at'>): FlowerOrder {
  return {
    branch_id: 'dagupan',
    branch_name: 'Dagupan',
    receiver: 'Alea',
    customer_social: '',
    scheduled_for: '2026-08-20T04:00:00.000Z',
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
  {
    id: 'eucalyptus',
    name: 'Eucalyptus',
    flower_type: 'Eucalyptus',
    product_kind: 'misc',
    color: 'Green',
    unit_cost: 30,
    is_active: true,
    created_at: twoPmManilaIso,
  },
];

const orderAug18 = makeOrder({
  id: 'aug18',
  receiver: 'Aug 18 order',
  created_at: yesterdayIso,
  scheduled_for: '2026-08-18T04:00:00.000Z',
  items: [{ product_id: 'gerbera-pink', item_name: 'Pink Gerbera', quantity: 10 }],
});
const orderAug19 = makeOrder({
  id: 'aug19',
  receiver: 'Aug 19 order',
  created_at: twoPmManilaIso,
  scheduled_for: '2026-08-19T04:00:00.000Z',
  items: [{ product_id: 'eucalyptus', item_name: 'Eucalyptus', quantity: 2 }],
});
const orderAug20 = makeOrder({
  id: 'aug20',
  receiver: 'Aug 20 order',
  created_at: twoPmManilaIso,
  scheduled_for: '2026-08-20T04:00:00.000Z',
  items: [
    { product_id: 'gerbera-pink', item_name: 'Pink Gerbera', quantity: 5 },
    { product_id: 'eucalyptus', item_name: 'Eucalyptus', quantity: 3 },
  ],
});
const cancelledAug20 = makeOrder({
  id: 'cancelled',
  status: 'cancelled',
  created_at: '2026-08-18T07:00:00.000Z',
  scheduled_for: '2026-08-20T04:00:00.000Z',
  items: [{ product_id: 'gerbera-pink', item_name: 'Pink Gerbera', quantity: 99 }],
});

const allOrders = [orderAug18, orderAug19, orderAug20, cancelledAug20];
const stamped1819 = ['2026-08-18', '2026-08-19'];

const openRange = buildSupplierOrderSummary(allOrders, products, {
  dateFrom: '2026-08-18',
  dateTo: '2026-08-20',
  roundSettings: { flowerRoundStep: 1, miscRoundStep: 1 },
});

assertEqual(openRange.orderCount, 3, 'cancelled orders stay out of the full reserved total');
assertEqual(openRange.stamp.status, 'open', 'unstamped range is open');
assertEqual(openRange.grandTotalFlowers[0]?.reservedQty, 15, 'open range includes 18 and 20 gerbera');

const done1819 = buildSupplierOrderSummary(allOrders, products, {
  dateFrom: '2026-08-18',
  dateTo: '2026-08-19',
  stampedDates: stamped1819,
  roundSettings: { flowerRoundStep: 1, miscRoundStep: 1 },
});

assertEqual(done1819.stamp.status, 'done', 'going back to 18-19 shows DONE');
assertEqual(done1819.orderCount, 0, 'DONE range hides those pickup orders');
assertEqual(done1819.stampedOrderCount, 2, 'the two 18-19 orders are counted as stamped');

const wideAfterStamp = buildSupplierOrderSummary(allOrders, products, {
  dateFrom: '2026-08-18',
  dateTo: '2026-08-20',
  stampedDates: stamped1819,
  roundSettings: { flowerRoundStep: 1, miscRoundStep: 1 },
});

assertEqual(wideAfterStamp.stamp.status, 'partial', '18-20 is partial after 18-19 was stamped');
assertEqual(wideAfterStamp.orderCount, 1, '18-19 stay void; 20 is still to order');
assertEqual(wideAfterStamp.visibleOrders.map((order) => order.id), ['aug20'], 'only the unstamped day remains');
assertEqual(wideAfterStamp.grandTotalFlowers[0]?.reservedQty, 5, 'only Aug 20 gerbera is still to order');
assertEqual(wideAfterStamp.grandTotalFillers[0]?.reservedQty, 3, 'new fillers on unstamped days still copy');
assertEqual(wideAfterStamp.grandTotalFillers[0]?.itemName, 'Eucalyptus', 'misc from the voided 19th is not mixed in');

const clipboard = buildSupplierOrderClipboardText({
  summary: wideAfterStamp,
  orderQuantities: new Map([
    [wideAfterStamp.grandTotalFlowers[0].key, wideAfterStamp.grandTotalFlowers[0].suggestedOrderQty],
    [wideAfterStamp.grandTotalFillers[0].key, wideAfterStamp.grandTotalFillers[0].suggestedOrderQty],
  ]),
});

assertTrue(clipboard.includes('still to order'), 'clipboard says remaining orders are still to order');
assertTrue(clipboard.includes('5 stems pink gerbera'), 'clipboard to-order is the unstamped flower qty');
assertTrue(clipboard.includes('3 eucalyptus'), 'clipboard includes fillers and misc from unstamped days');
assertTrue(!clipboard.includes('15 pink gerbera'), 'clipboard must not include DONE-range stems');

const doneClipboard = buildSupplierOrderClipboardText({
  summary: done1819,
  orderQuantities: new Map(),
});
assertTrue(doneClipboard.includes('DONE'), 'clipboard for a stamped range says DONE');
assertTrue(doneClipboard.includes('(none)'), 'DONE range copy has nothing left to order');

console.log('order input time tests passed');
