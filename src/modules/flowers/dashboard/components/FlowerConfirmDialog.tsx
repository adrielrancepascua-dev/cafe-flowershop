type FlowerConfirmDialogProps = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function FlowerConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  busy = false,
  onConfirm,
  onCancel,
}: FlowerConfirmDialogProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[110] flex items-end justify-center bg-brand-dark/40 p-4 sm:items-center">
      <button
        type="button"
        aria-label="Close dialog"
        className="absolute inset-0"
        onClick={busy ? undefined : onCancel}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="flower-confirm-title"
        className="flower-card relative w-full max-w-md p-5 sm:p-6"
      >
        <h2 id="flower-confirm-title" className="font-serif text-lg font-semibold text-brand-dark">
          {title}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-brand-brown/80">{message}</p>

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            className="flower-btn-secondary w-full sm:w-auto"
            onClick={onCancel}
            disabled={busy}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`w-full sm:w-auto ${
              destructive
                ? 'rounded-xl border border-red-300 bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60'
                : 'flower-btn-primary'
            }`}
            onClick={onConfirm}
            disabled={busy}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
