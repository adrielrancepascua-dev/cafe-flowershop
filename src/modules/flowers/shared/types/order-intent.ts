export type FlowerFulfillmentMethod = 'pickup' | 'delivery';

export type FlowerScheduleType = 'same_day' | 'scheduled';

export interface FlowerOrderIntent {
  orderId: string;
  branchId: string;
  fulfillmentMethod: FlowerFulfillmentMethod;
  scheduleType: FlowerScheduleType;
  requestedDateIso: string;
  customerName: string;
  status: string;
}
