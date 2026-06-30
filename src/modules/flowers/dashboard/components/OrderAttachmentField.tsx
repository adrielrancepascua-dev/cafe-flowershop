import { useRef } from 'react';
import OrderAttachmentPreview from './OrderAttachmentPreview';

type OrderAttachmentFieldProps = {
  label: string;
  previewLabel: string;
  value: string;
  optional?: boolean;
  readOnly?: boolean;
  onChange: (file: File | null) => void | Promise<void>;
  onEditRequest?: () => void;
};

export default function OrderAttachmentField({
  label,
  previewLabel,
  value,
  optional = false,
  readOnly = false,
  onChange,
  onEditRequest,
}: OrderAttachmentFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleChooseClick() {
    if (readOnly && onEditRequest) {
      onEditRequest();
      window.setTimeout(() => inputRef.current?.click(), 0);
      return;
    }

    inputRef.current?.click();
  }

  return (
    <div className="flex flex-col items-center text-center">
      <p className="text-sm font-medium text-brand-brown">
        {label}
        {optional ? (
          <span className="ml-1 text-xs font-normal text-brand-brown/60">(optional)</span>
        ) : null}
      </p>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={(event) => void onChange(event.target.files?.[0] ?? null)}
        className="sr-only"
        aria-hidden
        tabIndex={-1}
      />
      {!value ? (
        readOnly ? (
          <p className="mt-2 text-xs text-brand-brown/60">No photo attached.</p>
        ) : (
          <button
            type="button"
            onClick={handleChooseClick}
            className="mt-2 w-full rounded-xl border-2 border-dashed border-brand-accent bg-brand-cream/35 px-3 py-4 text-center transition hover:border-brand-brown hover:bg-brand-beige/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent"
          >
            <span className="block text-xs font-semibold text-brand-dark">Choose photo</span>
            <span className="mt-0.5 block text-[11px] text-brand-brown/65">
              {optional ? 'Optional' : 'Required'}
            </span>
          </button>
        )
      ) : (
        <>
          <OrderAttachmentPreview
            label={previewLabel}
            value={value}
            centered
            hint="Tap image to open full size."
          />
          <button
            type="button"
            onClick={handleChooseClick}
            className="flower-btn-secondary mt-2 w-full py-1.5 text-xs sm:w-auto"
          >
            Change photo
          </button>
        </>
      )}
    </div>
  );
}
