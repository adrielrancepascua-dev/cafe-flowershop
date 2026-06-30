export async function readFileAsDataUrl(file: File): Promise<string> {
  return readFileAsCompressedDataUrl(file);
}

/** Resize and compress images so demo orders fit in browser localStorage (~5MB cap). */
export async function readFileAsCompressedDataUrl(
  file: File,
  options: { maxWidth?: number; maxHeight?: number; quality?: number; maxBytes?: number } = {},
): Promise<string> {
  const { maxWidth = 1280, maxHeight = 1280, quality = 0.72, maxBytes = 350_000 } = options;

  if (!file.type.startsWith('image/')) {
    throw new Error('Please upload an image file.');
  }

  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await loadImage(objectUrl);
    const canvas = document.createElement('canvas');
    const scale = Math.min(1, maxWidth / image.width, maxHeight / image.height);
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));

    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Could not process image.');
    }

    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    let currentQuality = quality;
    let dataUrl = canvas.toDataURL('image/jpeg', currentQuality);

    while (estimateDataUrlBytes(dataUrl) > maxBytes && currentQuality > 0.45) {
      currentQuality -= 0.08;
      dataUrl = canvas.toDataURL('image/jpeg', currentQuality);
    }

    if (estimateDataUrlBytes(dataUrl) > maxBytes) {
      throw new Error(
        'Image is still too large after compression. Try a smaller photo or screenshot.',
      );
    }

    return dataUrl;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Could not load image.'));
    image.src = src;
  });
}

function estimateDataUrlBytes(dataUrl: string): number {
  const base64 = dataUrl.split(',')[1] ?? '';
  return Math.ceil((base64.length * 3) / 4);
}
export function formatPickupDateTimeLocal(iso: string): string {
  if (!iso) {
    return '';
  }

  const date = new Date(iso);
  return date.toLocaleString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function toDateInputValue(iso: string): string {
  if (!iso) {
    return '';
  }

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function fromDateInputValue(value: string): string {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toISOString();
}

/** Calendar/report day for a pickup timestamp in the user's local timezone. */
export function scheduledForToDateKey(iso: string): string {
  if (!iso) {
    return '';
  }

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return toDateKey(date);
}

export function getLocalDayBoundsIso(dateKey: string): { startIso: string; endIso: string } {
  const [year, month, day] = dateKey.split('-').map(Number);
  const start = new Date(year, month - 1, day, 0, 0, 0, 0);
  const end = new Date(year, month - 1, day, 23, 59, 59, 999);
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}

export function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export const ORDER_STATUS_LABELS: Record<string, string> = {
  not_started: 'Not started',
  ready: 'Ready',
  picked_up: 'Picked up',
  delivered: 'Delivered',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export const PRICE_FORMATTER = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function summarizeFlowerLines(
  items: Array<{ item_name: string; quantity: number }>,
): string {
  return items.map((item) => `${item.item_name} x${item.quantity}`).join(', ');
}
