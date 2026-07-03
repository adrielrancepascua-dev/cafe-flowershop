import { useMemo, useState } from 'react';
import { Printer, Settings2 } from 'lucide-react';
import FlowerPrintSettingsModal from './FlowerPrintSettingsModal';
import { describeFlowerPrintSettings, readFlowerPrintSettings, scheduleFlowerCouponPrint } from '../utils/flower-print-settings';

type FlowerPrintControlsProps = {
  onPrint?: () => void;
  disabled?: boolean;
  label?: string;
  className?: string;
  showSizeHint?: boolean;
};

export default function FlowerPrintControls({
  onPrint,
  disabled = false,
  label = 'Print',
  className = '',
  showSizeHint = true,
}: FlowerPrintControlsProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const sizeHint = useMemo(() => describeFlowerPrintSettings(readFlowerPrintSettings()), [settingsOpen]);

  function handlePrint() {
    onPrint?.();
    scheduleFlowerCouponPrint();
  }

  return (
    <>
      <div className={className}>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handlePrint}
            disabled={disabled}
            className="flower-btn-primary inline-flex gap-2"
          >
            <Printer className="h-4 w-4" />
            {label}
          </button>
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="flower-btn-secondary inline-flex gap-2"
            title="Coupon print size"
          >
            <Settings2 className="h-4 w-4" />
            Size
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
