export async function readFileAsDataUrl(file: File): Promise<string> {
  return readFileAsCompressedDataUrl(file);
}

function isLikelyImageFile(file: File): boolean {
  const type = file.type.toLowerCase();
  if (type.startsWith('image/')) {
    return true;
  }

  return /\.(jpe?g|png|gif|webp|heic|heif|bmp)$/i.test(file.name);
}

async function readRawFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
        return;
      }

      reject(new Error('Could not read image file.'));
    };
    reader.onerror = () => reject(new Error('Could not read image file.'));
    reader.readAsDataURL(file);
  });
}

/** Resize and compress images so demo orders fit in browser localStorage (~5MB cap). */
export async function readFileAsCompressedDataUrl(
  file: File,
  options: { maxWidth?: number; maxHeight?: number; quality?: number; maxBytes?: number } = {},
): Promise<string> {
  const { maxWidth = 1280, maxHeight = 1280, quality = 0.72, maxBytes = 350_000 } = options;

  if (!isLikelyImageFile(file)) {
    throw new Error('Please choose a photo from your gallery or camera.');
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
  } catch (error) {
    const rawDataUrl = await readRawFileAsDataUrl(file);
    if (estimateDataUrlBytes(rawDataUrl) <= maxBytes * 4) {
      return rawDataUrl;
    }

    throw error instanceof Error
      ? error
      : new Error('Could not load photo. Try choosing a JPG or PNG from your gallery.');
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

/** Parse DB timestamps as UTC when Supabase/Postgres omits the Z suffix. */
export function parseFlowerTimestamp(iso: string): Date {
  if (!iso) {
    return new Date(Number.NaN);
  }

  const trimmed = iso.trim();
  if (/[zZ]$/.test(trimmed) || /[+-]\d{2}:\d{2}$/.test(trimmed)) {
    return new Date(trimmed);
  }

  const normalized = trimmed.replace(' ', 'T');
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(normalized)) {
    return new Date(`${normalized}Z`);
  }

  return new Date(trimmed);
}

export function formatPickupDateTimeLocal(iso: string): string {
  if (!iso) {
    return '';
  }

  const date = parseFlowerTimestamp(iso);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

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

  const date = parseFlowerTimestamp(iso);
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

export const FLOWER_BUSINESS_TIMEZONE = 'Asia/Manila';

/** Calendar day in Philippines time (matches shop operations). */
export function toManilaDateKeyFromDate(date: Date = new Date()): string {
  return date.toLocaleDateString('en-CA', { timeZone: FLOWER_BUSINESS_TIMEZONE });
}

/** Calendar/report day for a pickup timestamp in Philippines time. */
export function scheduledForToDateKey(iso: string): string {
  if (!iso) {
    return '';
  }

  const date = parseFlowerTimestamp(iso);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return toManilaDateKeyFromDate(date);
}

export function getLocalDayBoundsIso(dateKey: string): { startIso: string; endIso: string } {
  const [year, month, day] = dateKey.split('-').map(Number);
  const manilaOffsetMs = 8 * 60 * 60 * 1000;
  const startMs = Date.UTC(year, month - 1, day, 0, 0, 0, 0) - manilaOffsetMs;
  const endMs = Date.UTC(year, month - 1, day, 23, 59, 59, 999) - manilaOffsetMs;
  return { startIso: new Date(startMs).toISOString(), endIso: new Date(endMs).toISOString() };
}

export function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export const INVENTORY_MOVEMENT_TYPE_LABELS: Record<string, string> = {
  stock_in: 'Stock in',
  stock_out: 'Stock out',
  transfer_in: 'Transfer in',
  transfer_out: 'Transfer out',
  order_deduct: 'Order deduct',
};

export const INVENTORY_MOVEMENT_TYPE_BADGES: Record<string, string> = {
  stock_in: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  stock_out: 'border-red-200 bg-red-50 text-red-700',
  transfer_in: 'border-sky-200 bg-sky-50 text-sky-800',
  transfer_out: 'border-amber-200 bg-amber-50 text-amber-900',
  order_deduct: 'border-brand-muted/50 bg-brand-beige/60 text-brand-brown',
};

export function parseInventoryMovementOrderId(note: string): string | null {
  const match = note.match(/Order\s+(\S+)/i);
  return match?.[1] ?? null;
}

export function parseInventoryMovementReceiver(note: string): string | null {
  const match = note.match(/Order\s+\S+\s+·\s+(.+?)\s+·\s+day-close/i);
  return match?.[1]?.trim() || null;
}

export function formatInventoryOrderDeductNote(orderId: string, receiver: string): string {
  const trimmedReceiver = receiver.trim() || 'Unknown';
  return `Order ${orderId} · ${trimmedReceiver} · day-close deduct`;
}

export function formatInventoryOrderVoidNote(orderId: string, receiver: string): string {
  const trimmedReceiver = receiver.trim() || 'Unknown';
  return `Order ${orderId} · ${trimmedReceiver} · void/delete restore`;
}

export function resolveInventoryMovementReceiver(
  note: string,
  orderReceiverById?: ReadonlyMap<string, string>,
): string | null {
  const fromNote = parseInventoryMovementReceiver(note);
  if (fromNote) {
    return fromNote;
  }

  const orderId = parseInventoryMovementOrderId(note);
  if (orderId && orderReceiverById?.has(orderId)) {
    return orderReceiverById.get(orderId) ?? null;
  }

  return null;
}

export function formatInventoryMovementTimestamp(iso: string): string {
  return parseFlowerTimestamp(iso).toLocaleString('en-PH', {
    timeZone: 'Asia/Manila',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/** Collapse duplicate day-close order deductions already stored before the deduct guard fix. */
export function dedupeInventoryMovementRows<T extends {
  movement_type: string;
  product_id: string;
  quantity: number;
  branch_id: string;
  note: string;
}>(rows: T[]): T[] {
  const seenOrderProduct = new Set<string>();
  const result: T[] = [];

  for (const row of rows) {
    if (row.movement_type === 'order_deduct') {
      const orderId = parseInventoryMovementOrderId(row.note);
      if (orderId) {
        const key = `${orderId}|${row.product_id}|${row.quantity}|${row.branch_id}`;
        if (seenOrderProduct.has(key)) {
          continue;
        }
        seenOrderProduct.add(key);
      }
    }

    result.push(row);
  }

  return result;
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
