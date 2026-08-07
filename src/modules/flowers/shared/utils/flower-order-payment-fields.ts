import type { FlowerPaymentMode } from '../types/flower-order';

/** Recompute downpayment, balance, and balance_paid from edited amounts. */
export function computeOrderPaymentFields(
  totalAmount: number,
  downpayment: number,
  existing?: {
    balance_paid?: boolean;
    balance_payment_mode?: FlowerPaymentMode | '';
    balance_payment_reference?: string;
  },
): {
  downpayment: number;
  total_amount: number;
  balance: number;
  balance_paid: boolean;
  balance_payment_mode: FlowerPaymentMode | '';
  balance_payment_reference: string;
} {
  const total_amount = totalAmount;
  const normalizedDownpayment = Math.max(0, Math.min(downpayment, total_amount));
  const remaining = Math.max(0, total_amount - normalizedDownpayment);

  // Already collected the remaining balance earlier (stored as balance=0 + balance_paid=true).
  // Keep that settlement when editing the order, otherwise Update order clears BPI/GCash
  // balance modes and reports fall back to cash.
  if (existing?.balance_paid && remaining > 0) {
    return {
      downpayment: normalizedDownpayment,
      total_amount,
      balance: 0,
      balance_paid: true,
      balance_payment_mode: existing.balance_payment_mode ?? '',
      balance_payment_reference: existing.balance_payment_reference ?? '',
    };
  }

  const balance_paid = remaining === 0;

  return {
    downpayment: normalizedDownpayment,
    total_amount,
    balance: remaining,
    balance_paid,
    balance_payment_mode: balance_paid ? (existing?.balance_payment_mode ?? '') : '',
    balance_payment_reference: balance_paid ? (existing?.balance_payment_reference ?? '') : '',
  };
}
