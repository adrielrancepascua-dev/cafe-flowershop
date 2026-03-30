import type {
  FlowerReportsData,
  FlowerReportsOptions,
} from '../../../modules/flowers/shared/types/flower-report';
import { getFlowerReportsSupabase } from './flowers-reports.supabase';

export async function getFlowerReports(options: FlowerReportsOptions = {}): Promise<FlowerReportsData> {
  return getFlowerReportsSupabase(options);
}
