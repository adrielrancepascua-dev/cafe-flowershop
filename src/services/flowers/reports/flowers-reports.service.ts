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

export type StaffReportsAccessResult = {
  allowed: boolean;
  pendingIncomingTransfers: number;
  openOrders: number;
  totalOrders: number;
};

/** Staff can open reports only after confirming incoming transfers and closing the day. */
export async function getStaffReportsAccess(
  reportDate: string,
  branchId?: string,
): Promise<StaffReportsAccessResult> {
  const denied = {
    allowed: false,
    pendingIncomingTransfers: 0,
    openOrders: 0,
    totalOrders: 0,
  };

  const todayKey = toDateKey(new Date());
  if (reportDate !== todayKey || !branchId) {
    return denied;
  }

  const { listFlowerTransferRequests } = await import('../inventory/flowers-inventory.service');
  const pendingTransfers = await listFlowerTransferRequests({
    branchId,
    status: 'pending',
  });
  const pendingIncomingTransfers = pendingTransfers.filter(
    (request) => request.to_branch_id === branchId,
  ).length;

  if (pendingIncomingTransfers > 0) {
    return {
      ...denied,
      pendingIncomingTransfers,
    };
  }

  const { getFlowerDayCloseStatus } = await import('../orders/flowers-orders.service');
  const status = await getFlowerDayCloseStatus(reportDate, branchId);

  return {
    allowed: status.is_closed,
    pendingIncomingTransfers: 0,
    openOrders: status.open_orders,
    totalOrders: status.total_orders,
  };
}

export async function canStaffAccessReports(
  reportDate: string,
  branchId?: string,
): Promise<boolean> {
  const access = await getStaffReportsAccess(reportDate, branchId);
  return access.allowed;
}
