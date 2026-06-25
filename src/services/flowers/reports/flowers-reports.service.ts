import type {
  FlowerReportsData,
  FlowerReportsOptions,
} from '../../../modules/flowers/shared/types/flower-report';
import { getFlowerReportsLocal } from './flowers-reports.local';
import { getFlowerReportsSupabase } from './flowers-reports.supabase';
import { getFlowerStorageMode, shouldUseFlowerSupabase } from '../storage-mode';

export async function getFlowerReports(options: FlowerReportsOptions = {}): Promise<FlowerReportsData> {
  const mode = getFlowerStorageMode();

  if (shouldUseFlowerSupabase(mode)) {
    try {
      return await getFlowerReportsSupabase(options);
    } catch (error) {
      if (mode === 'supabase') {
        throw error;
      }
      console.warn('Falling back to local flower reports after Supabase read failure.', error);
    }
  }

  return getFlowerReportsLocal(options);
}
