import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import {
  DEFAULT_FLOWER_PRINT_SETTINGS,
  FLOWER_PRINT_PRESETS,
  describeFlowerPrintSettings,
  normalizeFlowerPrintSettings,
  readFlowerPrintSettings,
  saveFlowerPrintSettings,
  settingsFromPreset,
  type FlowerPrintPageHeight,
  type FlowerPrintSettings,
} from '../utils/flower-print-settings';

type FlowerPrintSettingsModalProps = {
  open: boolean;
  onClose: () => void;
};

function parsePageHeightInput(value: string): FlowerPrintPageHeight {
  if (value.trim().toLowerCase() === 'auto' || value.trim() === '') {
    return 'auto';
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 'auto';
}

export default function FlowerPrintSettingsModal({ open, onClose }: FlowerPrintSettingsModalProps) {
  const [draft, setDraft] = useState<FlowerPrintSettings>(DEFAULT_FLOWER_PRINT_SETTINGS);
  const [pageHeightInput, setPageHeightInput] = useState('auto');

  useEffect(() => {
    if (!open) {
      return;
    }

    const saved = readFlowerPrintSettings();
    setDraft(saved);
    setPageHeightInput(saved.pageHeight === 'auto' ? 'auto' : String(saved.pageHeight));
  }, [open]);

  const previewDescription = useMemo(() => describeFlowerPrintSettings(draft), [draft]);

  if (!open) {
    return null;
  }

  function updateDraft(next: Partial<FlowerPrintSettings>) {
    setDraft((current) => normalizeFlowerPrintSettings({ ...current, ...next }));
  }

  function handlePresetChange(presetId: string) {
    const next = settingsFromPreset(presetId, draft);
    setDraft(next);
    setPageHeightInput(next.pageHeight === 'auto' ? 'auto' : String(next.pageHeight));
  }

  function handleSave() {
    const pageHeight = parsePageHeightInput(pageHeightInput);
    saveFlowerPrintSettings(normalizeFlowerPrintSettings({ ...draft, pageHeight }));
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-brand-dark/40 p-0 sm:items-center sm:p-4">
      <div className="flower-card flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden sm:max-h-[90vh]">
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-brand-muted/40 px-4 py-3 sm:px-5">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-accent">
              Print setup
            </p>
            <h2 className="font-serif text-lg font-semibold text-brand-dark">Coupon &amp; receipt size</h2>
            <p className="mt-1 text-sm text-brand-brown/75">
              Saved on this device. Match the width to your label or receipt paper so text fills the slip.
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 hover:bg-brand-beige/60">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flower-scroll min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
          <label className="block text-sm font-medium text-brand-brown">
            Paper preset
            <select
              value={draft.presetId}
              onChange={(event) => handlePresetChange(event.target.value)}
              className="flower-input mt-1.5"
            >
              {FLOWER_PRINT_PRESETS.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.label}
                </option>
              ))}
            </select>
          </label>
          <p className="mt-1 text-xs text-brand-brown/65">
            {FLOWER_PRINT_PRESETS.find((preset) => preset.id === draft.presetId)?.description ??
              'Custom coupon size'}
          </p>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block text-sm font-medium text-brand-brown">
              Width (mm)
              <input
                type="number"
                min={40}
                max={220}
                step={0.1}
                value={draft.widthMm}
                onChange={(event) =>
                  updateDraft({ widthMm: Number(event.target.value), presetId: 'custom' })
                }
                className="flower-input mt-1.5"
              />
            </label>

            <label className="block text-sm font-medium text-brand-brown">
              Margin (mm)
              <input
                type="number"
                min={0}
                max={20}
                step={0.5}
                value={draft.marginMm}
                onChange={(event) =>
                  updateDraft({ marginMm: Number(event.target.value), presetId: 'custom' })
                }
                className="flower-input mt-1.5"
              />
            </label>

            <label className="block text-sm font-medium text-brand-brown sm:col-span-2">
              Text size ({Math.round(draft.fontScale * 100)}%)
              <input
                type="range"
                min={0.75}
                max={2}
                step={0.05}
                value={draft.fontScale}
                onChange={(event) =>
                  updateDraft({ fontScale: Number(event.target.value), presetId: 'custom' })
                }
                className="mt-3 w-full accent-brand-brown"
              />
            </label>

            <label className="block text-sm font-medium text-brand-brown sm:col-span-2">
              Page height
              <input
                type="text"
                value={pageHeightInput}
                onChange={(event) => {
                  setPageHeightInput(event.target.value);
                  updateDraft({
                    pageHeight: parsePageHeightInput(event.target.value),
                    presetId: 'custom',
                  });
                }}
                placeholder="auto"
                className="flower-input mt-1.5"
              />
              <span className="mt-1 block text-xs text-brand-brown/60">
                Use <span className="font-medium">auto</span> for continuous roll paper, or a height in mm for
                fixed coupons (e.g. 152.4 for 6 in).
              </span>
            </label>
          </div>

          <div className="mt-5 rounded-xl border border-brand-muted/40 bg-brand-cream/30 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-brown/60">Preview width</p>
            <p className="mt-1 text-xs text-brand-brown/70">{previewDescription}</p>
            <div className="mt-3 overflow-x-auto pb-1">
              <div
                className="rounded-lg border border-dashed border-brand-muted/50 bg-white p-3 shadow-sm"
                style={{
                  width: `${draft.widthMm}mm`,
                  maxWidth: '100%',
                  fontFamily: 'Arial, Helvetica, sans-serif',
                  fontSize: `calc(14pt * ${draft.fontScale})`,
                  lineHeight: 1.4,
                }}
              >
                <p style={{ fontWeight: 700, fontSize: `calc(18pt * ${draft.fontScale})` }}>PAPERS &amp; PETALS</p>
                <p style={{ fontWeight: 700, fontSize: `calc(16pt * ${draft.fontScale})` }}>311-7814</p>
                <p style={{ fontSize: `calc(15pt * ${draft.fontScale})` }}>STORE PICK UP</p>
                <p style={{ fontSize: `calc(14pt * ${draft.fontScale})`, marginTop: '0.5rem' }}>RECEIVER: SAMPLE</p>
                <p style={{ fontSize: `calc(14pt * ${draft.fontScale})` }}>3 X LOCAL ROSE (RED)</p>
              </div>
            </div>
          </div>

          <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
            In the print dialog, choose paper that matches this width. If the slip still prints tiny, increase{' '}
            <span className="font-semibold">Text size</span> or confirm the printer paper size — not &quot;Fit to
            page&quot; or A4 scaling.
          </p>
        </div>

        <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-brand-muted/40 px-4 py-3 sm:flex-row sm:justify-end sm:px-5">
          <button type="button" onClick={onClose} className="flower-btn-secondary">
            Cancel
          </button>
          <button type="button" onClick={handleSave} className="flower-btn-primary">
            Save print size
          </button>
        </div>
      </div>
    </div>
  );
}
