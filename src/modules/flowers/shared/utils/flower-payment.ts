export const FLOWER_PAYMENT_MODES = ['cash', 'gcash', 'bank'] as const;

export type FlowerPaymentMode = (typeof FLOWER_PAYMENT_MODES)[number];

export const FLOWER_PAYMENT_MODE_LABELS: Record<FlowerPaymentMode, string> = {
  cash: 'Cash',
  gcash: 'GCash',
  bank: 'Bank',
};

export function normalizeFlowerPaymentMode(value: string | null | undefined): FlowerPaymentMode {
  if (value === 'gcash' || value === 'bank') {
    return value;
  }

  return 'cash';
}

export function formatFlowerPaymentModeLabel(value: string | null | undefined): string {
  const mode = normalizeFlowerPaymentMode(value);
  return FLOWER_PAYMENT_MODE_LABELS[mode];
}
