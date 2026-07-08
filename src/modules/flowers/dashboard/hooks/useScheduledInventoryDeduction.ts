import { useEffect, useRef } from 'react';
import { runDueInventoryDeductions } from '../../../../services/flowers/orders';

const INVENTORY_DEDUCTION_POLL_MS = 60_000;

/** Runs 7 PM Manila inventory deductions while the dashboard is open. */
export function useScheduledInventoryDeduction(onDeductionComplete?: () => void): void {
  const onCompleteRef = useRef(onDeductionComplete);
  onCompleteRef.current = onDeductionComplete;

  useEffect(() => {
    let cancelled = false;

    const tick = async () => {
      if (cancelled || document.visibilityState === 'hidden') {
        return;
      }

      try {
        await runDueInventoryDeductions();
        onCompleteRef.current?.();
      } catch (error) {
        console.warn('Scheduled inventory deduction check failed.', error);
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
