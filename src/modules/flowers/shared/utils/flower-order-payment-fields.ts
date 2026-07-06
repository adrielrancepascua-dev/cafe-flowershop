import type { FlowerPaymentMode } from '../types/flower-order';

/** Recompute downpayment, balance, and balance_paid from edited amounts. */
export function computeOrderPaymentFields(
  totalAmount: number,
  downpayment: number,
  existing?: {
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
  const balance = Math.max(0, total_amount - normalizedDownpayment);
  const balance_paid = balance === 0;

  return {
    downpayment: normalizedDownpayment,
    total_amount,
    balance,
    balance_paid,
    balance_payment_mode: balance_paid ? (existing?.balance_payment_mode ?? '') : '',
    balance_payment_reference: balance_paid ? (existing?.balance_payment_reference ?? '') : '',
  };
}
