import { useEffect, useRef } from 'react';
import { runDueInventoryDeductions } from '../../../../services/flowers/orders';
import {
  INVENTORY_AUTO_DEDUCT_PAUSED,
  INVENTORY_DEDUCT_POLL_ENABLED,
} from '../../shared/utils/flower-inventory-deduct';

const INVENTORY_DEDUCTION_POLL_MS = 60_000;

/**
 * After 7:00 PM Manila, checks for finished orders that still need inventory deduct.
 * Safe with order-id movement lookup + per-order claims; will not re-deduct completed orders.
 * Early close before 7 PM still uses the admin "Run order deduct now" button.
 */
export function useScheduledInventoryDeduction(onDeductionComplete?: () => void): void {
  const onCompleteRef = useRef(onDeductionComplete);
  onCompleteRef.current = onDeductionComplete;
  const inFlightRef = useRef(false);

  useEffect(() => {
    if (INVENTORY_AUTO_DEDUCT_PAUSED || !INVENTORY_DEDUCT_POLL_ENABLED) {
      return;
    }

    let cancelled = false;

    const tick = async () => {
      if (cancelled || document.visibilityState === 'hidden' || inFlightRef.current) {
        return;
      }

      inFlightRef.current = true;
      try {
        const deducted = await runDueInventoryDeductions();
        // Only refresh UI when stock actually changed — avoids fighting staff stock in/out.
        if (deducted > 0) {
          onCompleteRef.current?.();
        }
      } catch (error) {
        console.warn('Scheduled inventory deduction check failed.', error);
      } finally {
        inFlightRef.current = false;
      }
    };

    void tick();
    const intervalId = window.setInterval(tick, INVENTORY_DEDUCTION_POLL_MS);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        void tick();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);
}
