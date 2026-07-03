import type { FlowerClaimMode } from '../types/flower-order';
import { parseFlowerTimestamp } from './flower-format';

export const THERMAL_BRAND_NAME = 'Papers & Petals';

export function formatThermalOrderRef(orderId: string): string {
  const normalized = orderId.replace(/^order[-_]?/i, '').toUpperCase();
  if (normalized.length <= 10) {
    return normalized;
  }

  return normalized.slice(-8);
}

export function formatThermalClaimMode(claimMode: FlowerClaimMode): string {
  switch (claimMode) {
    case 'delivery':
      return 'DELIVERY';
    case 'walk_in':
      return 'WALK IN';
    default:
      return 'STORE PICK UP';
  }
}

export function formatThermalDateLine(iso: string): string {
  const date = parseFlowerTimestamp(iso);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date
    .toLocaleDateString('en-PH', {
      month: 'long',
      day: 'numeric',
    })
    .toUpperCase();
}

export function formatThermalTimeLine(iso: string): string {
  const date = parseFlowerTimestamp(iso);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date
    .toLocaleTimeString('en-PH', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
    .replace(' ', '')
    .toLowerCase();
}

export function formatThermalDateKey(dateKey: string): string {
  const date = new Date(`${dateKey}T12:00:00`);
  if (Number.isNaN(date.getTime())) {
    return dateKey.toUpperCase();
  }

  return date
    .toLocaleDateString('en-PH', {
      month: 'long',
      day: 'numeric',
    })
    .toUpperCase();
}

export function formatThermalItemLine(quantity: number, itemName: string): string {
  return `${quantity} x ${itemName.toUpperCase()}`;
}

export function formatThermalBulletLine(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }

  return `- ${trimmed.toUpperCase()}`;
}
