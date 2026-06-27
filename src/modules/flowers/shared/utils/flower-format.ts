export async function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
        return;
      }

      reject(new Error('Failed to read file.'));
    };
    reader.onerror = () => reject(new Error('Failed to read file.'));
    reader.readAsDataURL(file);
  });
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
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
}

export function fromDateInputValue(value: string): string {
  if (!value) {
    return '';
  }

  return new Date(value).toISOString();
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
