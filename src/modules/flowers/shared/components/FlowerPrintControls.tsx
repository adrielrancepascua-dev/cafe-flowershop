import { useEffect, useMemo, useState } from 'react';
import { Printer, Settings2 } from 'lucide-react';
import FlowerPrintSettingsModal from './FlowerPrintSettingsModal';
import { describeFlowerPrintSettings, readFlowerPrintSettings, scheduleFlowerCouponPrint } from '../utils/flower-print-settings';

type FlowerPrintControlsProps = {
  onPrint?: () => void | Promise<void>;
  disabled?: boolean;
  label?: string;
  className?: string;
  showSizeHint?: boolean;
  compact?: boolean;
};

export default function FlowerPrintControls({
  onPrint,
  disabled = false,
  label = 'Print',
  className = '',
  showSizeHint = true,
  compact = false,
}: FlowerPrintControlsProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [printNonce, setPrintNonce] = useState(0);
  const sizeHint = useMemo(() => describeFlowerPrintSettings(readFlowerPrintSettings()), [settingsOpen]);

  useEffect(() => {
    if (printNonce === 0) {
      return;
    }

    scheduleFlowerCouponPrint();
  }, [printNonce]);

  async function handlePrint() {
    try {
      await onPrint?.();
    } catch {
      return;
    }

    setPrintNonce((current) => current + 1);
  }

  return (
    <>
      <div className={className}>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handlePrint}
            disabled={disabled}
            className={
              compact
                ? 'inline-flex items-center gap-1.5 rounded-lg border border-brand-muted/60 bg-white px-3 py-1.5 text-xs font-semibold text-brand-brown transition hover:bg-brand-beige/50 disabled:cursor-not-allowed disabled:opacity-60'
                : 'flower-btn-primary inline-flex gap-2'
            }
          >
            <Printer className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
            {label}
          </button>
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className={
              compact
                ? 'inline-flex items-center gap-1.5 rounded-lg border border-brand-muted/60 bg-white px-2.5 py-1.5 text-xs font-semibold text-brand-brown transition hover:bg-brand-beige/50'
                : 'flower-btn-secondary inline-flex gap-2'
            }
            title="Coupon print size"
          >
            <Settings2 className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
            {compact ? null : 'Size'}
          </button>
        </div>
        {showSizeHint ? (
          <p className="mt-2 text-xs text-brand-brown/65">
            Print size: {sizeHint}. Tap <span className="font-medium">Size</span> if slips print too small.
          </p>
        ) : null}
      </div>

      <FlowerPrintSettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
}
