export const FLOWER_PAYMENT_MODE_LABELS = {
  cash: 'Cash',
  gcash: 'GCash',
  metrobank: 'Metrobank',
  bpi: 'BPI',
  eastwest: 'Eastwest',
  /** @deprecated Legacy value from before branch-specific bank options. */
  bank: 'Bank',
} as const;

export type FlowerPaymentMode = keyof typeof FLOWER_PAYMENT_MODE_LABELS;

export const FLOWER_PAYMENT_MODES = Object.keys(
  FLOWER_PAYMENT_MODE_LABELS,
) as FlowerPaymentMode[];

const BRANCH_PAYMENT_MODES_BY_ID: Record<string, FlowerPaymentMode[]> = {
  'branch-dagupan': ['cash', 'gcash', 'metrobank', 'bpi'],
  'branch-san-carlos': ['cash', 'gcash', 'eastwest'],
  'branch-urdaneta': ['cash', 'gcash'],
};

function resolveBranchKey(branchId: string, branchName?: string): string {
  const normalizedName = (branchName ?? '').trim().toLowerCase();
  if (normalizedName.includes('dagupan')) {
    return 'branch-dagupan';
  }
  if (normalizedName.includes('san carlos')) {
    return 'branch-san-carlos';
  }
  if (normalizedName.includes('urdaneta')) {
    return 'branch-urdaneta';
  }

  return branchId.trim().toLowerCase();
}

export function getFlowerPaymentModesForBranch(
  branchId: string,
  branchName?: string,
): FlowerPaymentMode[] {
  const branchKey = resolveBranchKey(branchId, branchName);
  return BRANCH_PAYMENT_MODES_BY_ID[branchKey] ?? ['cash', 'gcash'];
}

export function isFlowerPaymentMode(value: string): value is FlowerPaymentMode {
  return value in FLOWER_PAYMENT_MODE_LABELS;
}

export function normalizeFlowerPaymentMode(
  value: string | null | undefined,
  branchId?: string,
  branchName?: string,
): FlowerPaymentMode {
  if (!value) {
    return 'cash';
  }

  if (value === 'bank') {
    const modes = branchId ? getFlowerPaymentModesForBranch(branchId, branchName) : [];
    const firstBankMode = modes.find((mode) => mode !== 'cash' && mode !== 'gcash');
    return firstBankMode ?? 'bank';
  }

  if (isFlowerPaymentMode(value)) {
    return value;
  }

  return 'cash';
}

export function formatFlowerPaymentModeLabel(value: string | null | undefined): string {
  if (!value) {
    return FLOWER_PAYMENT_MODE_LABELS.cash;
  }

  if (isFlowerPaymentMode(value)) {
    return FLOWER_PAYMENT_MODE_LABELS[value];
  }

  return value;
}

export function requiresFlowerPaymentReference(mode: FlowerPaymentMode | ''): boolean {
  return Boolean(mode) && mode !== 'cash';
}
