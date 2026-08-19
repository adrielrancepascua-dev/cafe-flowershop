import { useEffect, useRef } from 'react';
import {
  restoreHistoricalReconcileDeductions,
  runDueInventoryDeductions,
} from '../../../../services/flowers/orders';
import { HISTORICAL_RECONCILE_BUG_ENDED_AT } from '../../shared/utils/flower-inventory-deduct';

const INVENTORY_RESTORE_POLL_MS = 60_000;

/**
 * Until today's 7 PM, only undo the bad historical reconcile.
 * Old dashboard tabs may still be deducting every minute — keep restoring
 * while those tabs are open. Resume normal 7 PM deduct after the cutoff.
 */
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
        await restoreHistoricalReconcileDeductions();
        if (Date.now() >= Date.parse(HISTORICAL_RECONCILE_BUG_ENDED_AT)) {
          await runDueInventoryDeductions();
        }
        onCompleteRef.current?.();
      } catch (error) {
        console.warn('Scheduled inventory restore/deduction check failed.', error);
      }
    };

    void tick();
    const intervalId = window.setInterval(tick, INVENTORY_RESTORE_POLL_MS);

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
