import type { FlowerSalesReportPeriod } from '../types/flower-report';
import { toDateKey } from './flower-format';

function parseDateKey(dateKey: string): Date {
  return new Date(`${dateKey}T12:00:00`);
}

function formatShortDate(date: Date): string {
  return date.toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function getSalesReportPeriodRange(
  anchorDateKey: string,
  period: FlowerSalesReportPeriod,
): { fromDate: string; toDate: string; periodLabel: string } {
  const anchor = parseDateKey(anchorDateKey);

  if (period === 'day') {
    const label = anchor.toLocaleDateString('en-PH', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
    return { fromDate: anchorDateKey, toDate: anchorDateKey, periodLabel: label };
  }

  if (period === 'week') {
    const dayOfWeek = anchor.getDay();
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(anchor);
    monday.setDate(anchor.getDate() + diffToMonday);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    return {
      fromDate: toDateKey(monday),
      toDate: toDateKey(sunday),
      periodLabel: `Week of ${formatShortDate(monday)} – ${formatShortDate(sunday)}`,
    };
  }

  const firstDay = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const lastDay = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);

  return {
    fromDate: toDateKey(firstDay),
    toDate: toDateKey(lastDay),
    periodLabel: firstDay.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' }),
  };
}

export function isPickupDateInRange(pickupDate: string, fromDate: string, toDate: string): boolean {
  return pickupDate >= fromDate && pickupDate <= toDate;
}
