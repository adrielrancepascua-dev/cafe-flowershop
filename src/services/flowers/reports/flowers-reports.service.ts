import type { FlowerReportsData, FlowerReportsOptions } from '../../../modules/flowers/shared/types/flower-report';
import { sanitizeFlowerReportsForStaff } from '../../../modules/flowers/shared/utils/flower-report-audience';
import { toDateKey } from '../../../modules/flowers/shared/utils/flower-format';
import { getFlowerStorageMode, shouldUseFlowerSupabase } from '../storage-mode';
import { getFlowerReportsLocal } from './flowers-reports.local';
import { getFlowerPrintableSalesReportLocal } from './flowers-printable-sales-report.local';
import type { FlowerPrintableSalesReport, FlowerSalesReportPeriod } from '../../../modules/flowers/shared/types/flower-report';
import { sanitizeFlowerPrintableSalesReportForStaff } from '../../../modules/flowers/shared/utils/flower-report-audience';

export async function getFlowerReports(options: FlowerReportsOptions = {}): Promise<FlowerReportsData> {
  const mode = getFlowerStorageMode();
  let data: FlowerReportsData;

  if (shouldUseFlowerSupabase(mode)) {
    try {
      const { getFlowerReportsSupabase } = await import('./flowers-reports.supabase');
      data = await getFlowerReportsSupabase(options);
    } catch (error) {
      if (mode === 'supabase') {
        throw error;
      }
      console.warn('Falling back to local flower reports.', error);
      data = await getFlowerReportsLocal(options);
    }
  } else {
    data = await getFlowerReportsLocal(options);
  }

  if (options.audience === 'staff') {
    return sanitizeFlowerReportsForStaff(data);
  }

  return data;
}

export async function getFlowerPrintableSalesReport(options: {
  anchorDate: string;
  period: FlowerSalesReportPeriod;
  branchId?: string;
  audience?: 'admin' | 'staff';
}): Promise<FlowerPrintableSalesReport> {
  const mode = getFlowerStorageMode();
  let report: FlowerPrintableSalesReport;

  if (shouldUseFlowerSupabase(mode)) {
    try {
      report = await getFlowerPrintableSalesReportLocal(options);
    } catch (error) {
      if (mode === 'supabase') {
        throw error;
      }
      console.warn('Falling back to local printable sales report.', error);
      report = await getFlowerPrintableSalesReportLocal(options);
    }
  } else {
    report = await getFlowerPrintableSalesReportLocal(options);
  }

  if (options.audience === 'staff') {
    return sanitizeFlowerPrintableSalesReportForStaff(report);
  }

  return report;
}

export async function canStaffAccessReports(
  reportDate: string,
  branchId?: string,
): Promise<boolean> {
  const todayKey = toDateKey(new Date());
  if (reportDate !== todayKey) {
    return false;
  }

  if (!branchId) {
    return false;
  }

  const { getFlowerDayCloseStatus } = await import('../orders/flowers-orders.service');
  const status = await getFlowerDayCloseStatus(reportDate, branchId);
  return status.is_closed;
}
