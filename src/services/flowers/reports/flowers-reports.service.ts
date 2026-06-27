import type { FlowerReportsData, FlowerReportsOptions } from '../../../modules/flowers/shared/types/flower-report';
import { getFlowerStorageMode, shouldUseFlowerSupabase } from '../storage-mode';
import { getFlowerReportsLocal } from './flowers-reports.local';

export async function getFlowerReports(options: FlowerReportsOptions = {}): Promise<FlowerReportsData> {
  const mode = getFlowerStorageMode();

  if (shouldUseFlowerSupabase(mode)) {
    try {
      const { getFlowerReportsSupabase } = await import('./flowers-reports.supabase');
      return await getFlowerReportsSupabase(options);
    } catch (error) {
      if (mode === 'supabase') {
        throw error;
      }
      console.warn('Falling back to local flower reports.', error);
    }
  }

  return getFlowerReportsLocal(options);
}

export async function canStaffAccessReports(reportDate: string): Promise<boolean> {
  const { getFlowerDayCloseStatus } = await import('../orders/flowers-orders.service');
  const status = await getFlowerDayCloseStatus(reportDate);
  return status.is_closed;
}
