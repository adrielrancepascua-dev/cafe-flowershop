export type FlowerPrintPageHeight = 'auto' | number;

export interface FlowerPrintSettings {
  presetId: string;
  /** Label / coupon width in millimeters. */
  widthMm: number;
  /** Page margin in millimeters. */
  marginMm: number;
  /** Multiplier for all print font sizes (0.75–2). */
  fontScale: number;
  /** Roll paper uses auto height; fixed labels can set a height in mm. */
  pageHeight: FlowerPrintPageHeight;
}

export interface FlowerPrintPreset {
  id: string;
  label: string;
  description: string;
  widthMm: number;
  marginMm: number;
  fontScale: number;
  pageHeight: FlowerPrintPageHeight;
}

export const FLOWER_PRINT_SETTINGS_STORAGE_KEY = 'papers_petals_flower_print_settings_v3';
export const FLOWER_PRINT_PAGE_STYLE_ID = 'flower-print-page-style';

export const FLOWER_PRINT_PRESETS: FlowerPrintPreset[] = [
  {
    id: '4x6in',
    label: '4 × 6 in coupon',
    description: '100 × 150 mm label — recommended for order slips',
    widthMm: 100,
    marginMm: 3,
    fontScale: 1,
    pageHeight: 150,
  },
  {
    id: '80mm',
    label: '80 mm receipt',
    description: 'Standard thermal roll (most common)',
    widthMm: 80,
    marginMm: 3,
    fontScale: 1,
    pageHeight: 'auto',
  },
  {
    id: '58mm',
    label: '58 mm receipt',
    description: 'Narrow thermal roll',
    widthMm: 58,
    marginMm: 2,
    fontScale: 0.9,
    pageHeight: 'auto',
  },
  {
    id: '110mm',
    label: '110 mm wide',
    description: 'Wide label or receipt printer',
    widthMm: 110,
    marginMm: 4,
    fontScale: 1.1,
    pageHeight: 'auto',
  },
  {
    id: 'a6',
    label: 'A6 sheet',
    description: '148 × 105 mm card',
    widthMm: 105,
    marginMm: 5,
    fontScale: 1.15,
    pageHeight: 148,
  },
  {
    id: 'custom',
    label: 'Custom',
    description: 'Set your own coupon width and font size',
    widthMm: 80,
    marginMm: 3,
    fontScale: 1,
    pageHeight: 'auto',
  },
];

export const DEFAULT_FLOWER_PRINT_SETTINGS: FlowerPrintSettings = {
  ...FLOWER_PRINT_PRESETS.find((preset) => preset.id === '4x6in')!,
  presetId: '4x6in',
};

export function isCouponPrintSettings(settings: FlowerPrintSettings): boolean {
  return settings.pageHeight !== 'auto' && settings.pageHeight >= 120;
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizePageHeight(value: unknown): FlowerPrintPageHeight {
  if (value === 'auto') {
    return 'auto';
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 'auto';
  }

  return clampNumber(parsed, 20, 400);
}

export function normalizeFlowerPrintSettings(raw: Partial<FlowerPrintSettings> | null | undefined): FlowerPrintSettings {
  const preset =
    FLOWER_PRINT_PRESETS.find((entry) => entry.id === raw?.presetId) ?? FLOWER_PRINT_PRESETS[0];

  const widthMm = clampNumber(Number(raw?.widthMm ?? preset.widthMm), 40, 220);
  const marginMm = clampNumber(Number(raw?.marginMm ?? preset.marginMm), 0, 20);
  const fontScale = clampNumber(Number(raw?.fontScale ?? preset.fontScale), 0.75, 2);
  const pageHeight = normalizePageHeight(raw?.pageHeight ?? preset.pageHeight);
  const presetId = raw?.presetId === 'custom' || FLOWER_PRINT_PRESETS.some((entry) => entry.id === raw?.presetId)
    ? (raw?.presetId ?? preset.id)
    : preset.id;

  return {
    presetId,
    widthMm,
    marginMm,
    fontScale,
    pageHeight,
  };
}

export function readFlowerPrintSettings(): FlowerPrintSettings {
  if (typeof window === 'undefined') {
    return DEFAULT_FLOWER_PRINT_SETTINGS;
  }

  try {
    const raw = window.localStorage.getItem(FLOWER_PRINT_SETTINGS_STORAGE_KEY);
    if (!raw) {
      return DEFAULT_FLOWER_PRINT_SETTINGS;
    }

    return normalizeFlowerPrintSettings(JSON.parse(raw) as Partial<FlowerPrintSettings>);
  } catch {
    return DEFAULT_FLOWER_PRINT_SETTINGS;
  }
}

export function saveFlowerPrintSettings(settings: FlowerPrintSettings): FlowerPrintSettings {
  const normalized = normalizeFlowerPrintSettings(settings);

  if (typeof window !== 'undefined') {
    window.localStorage.setItem(FLOWER_PRINT_SETTINGS_STORAGE_KEY, JSON.stringify(normalized));
  }

  applyFlowerPrintSettings(normalized);
  return normalized;
}

function formatPageHeight(pageHeight: FlowerPrintPageHeight): string {
  return pageHeight === 'auto' ? 'auto' : `${pageHeight}mm`;
}

export function updateFlowerPrintPageStyle(settings: FlowerPrintSettings): void {
  if (typeof document === 'undefined') {
    return;
  }

  let styleEl = document.getElementById(FLOWER_PRINT_PAGE_STYLE_ID);
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = FLOWER_PRINT_PAGE_STYLE_ID;
    document.head.appendChild(styleEl);
  }

  const pageHeight = formatPageHeight(settings.pageHeight);
  styleEl.textContent = `@media print {
  @page {
    size: ${settings.widthMm}mm ${pageHeight};
    margin: ${settings.marginMm}mm;
  }
}`;
}

export function applyFlowerPrintSettings(settings: FlowerPrintSettings): FlowerPrintSettings {
  const normalized = normalizeFlowerPrintSettings(settings);

  if (typeof document === 'undefined') {
    return normalized;
  }

  const root = document.documentElement;
  root.style.setProperty('--flower-print-width', `${normalized.widthMm}mm`);
  root.style.setProperty('--flower-print-margin', `${normalized.marginMm}mm`);
  root.style.setProperty('--flower-print-font-scale', String(normalized.fontScale));
  root.style.setProperty(
    '--flower-print-page-height',
    normalized.pageHeight === 'auto' ? 'auto' : `${normalized.pageHeight}mm`,
  );
  root.dataset.flowerPrintPreset = normalized.presetId;

  if (isCouponPrintSettings(normalized)) {
    root.dataset.flowerPrintCoupon = 'true';
  } else {
    delete root.dataset.flowerPrintCoupon;
  }

  updateFlowerPrintPageStyle(normalized);
  return normalized;
}

export function settingsFromPreset(presetId: string, current?: FlowerPrintSettings): FlowerPrintSettings {
  const preset = FLOWER_PRINT_PRESETS.find((entry) => entry.id === presetId);
  if (!preset) {
    return normalizeFlowerPrintSettings(current);
  }

  if (presetId === 'custom') {
    return normalizeFlowerPrintSettings({
      presetId: 'custom',
      widthMm: current?.widthMm ?? preset.widthMm,
      marginMm: current?.marginMm ?? preset.marginMm,
      fontScale: current?.fontScale ?? preset.fontScale,
      pageHeight: current?.pageHeight ?? preset.pageHeight,
    });
  }

  return normalizeFlowerPrintSettings({
    presetId: preset.id,
    widthMm: preset.widthMm,
    marginMm: preset.marginMm,
    fontScale: preset.fontScale,
    pageHeight: preset.pageHeight,
  });
}

export function describeFlowerPrintSettings(settings: FlowerPrintSettings): string {
  const preset = FLOWER_PRINT_PRESETS.find((entry) => entry.id === settings.presetId);
  const presetLabel = preset && settings.presetId !== 'custom' ? preset.label : 'Custom';
  const heightLabel = settings.pageHeight === 'auto' ? 'roll' : `${settings.pageHeight} mm tall`;
  return `${presetLabel} · ${settings.widthMm} mm wide · ${Math.round(settings.fontScale * 100)}% text · ${heightLabel}`;
}

export function printFlowerCoupon(): void {
  applyFlowerPrintSettings(readFlowerPrintSettings());
  window.print();
}

export function scheduleFlowerCouponPrint(): void {
  applyFlowerPrintSettings(readFlowerPrintSettings());
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      window.print();
    });
  });
}
