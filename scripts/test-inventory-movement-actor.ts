import { formatInventoryMovementActor } from '../src/modules/flowers/shared/utils/flower-format';

function assertEqual(actual: string, expected: string, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}\n  expected: ${expected}\n  actual:   ${actual}`);
  }
}

assertEqual(
  formatInventoryMovementActor({ movement_type: 'stock_out', created_by_name: 'Alea' }),
  'Alea',
  'manual stock out should show the person who tapped it',
);

assertEqual(
  formatInventoryMovementActor({ movement_type: 'stock_in', created_by_name: '  ' }),
  'Unknown (before names were logged)',
  'old movements without a name must say so instead of looking blank',
);

assertEqual(
  formatInventoryMovementActor({ movement_type: 'order_deduct', created_by_name: 'Rance Pascua' }),
  "Order deduct · ran on Rance Pascua's session",
  'auto deduct should not be mistaken for a manual stock out',
);

assertEqual(
  formatInventoryMovementActor({ movement_type: 'order_deduct', created_by_name: '' }),
  'Order deduct (auto)',
  'auto deduct with no session name still labels as automatic',
);

console.log('inventory movement actor label tests passed');
