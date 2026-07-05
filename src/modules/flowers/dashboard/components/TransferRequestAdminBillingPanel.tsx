import { useEffect, useState } from 'react';
import type { FlowerTransferRequest } from '../../shared/types/flower-inventory';
import { PRICE_FORMATTER } from '../../shared/utils/flower-format';
import { formatTransferBillingStatus } from '../../shared/utils/flower-transfer-billing';

type TransferRequestAdminBillingPanelProps = {
  request: FlowerTransferRequest;
  disabled?: boolean;
  saving?: boolean;
  onSave: (input: { total_cost: number | null; cost_paid: boolean }) => Promise<void>;
};

export default function TransferRequestAdminBillingPanel({
  request,
  disabled = false,
  saving = false,
  onSave,
}: TransferRequestAdminBillingPanelProps) {
  const [totalCostDraft, setTotalCostDraft] = useState(
    request.total_cost === null ? '' : String(request.total_cost),
  );
  const [costPaid, setCostPaid] = useState(request.cost_paid);

  useEffect(() => {
    setTotalCostDraft(request.total_cost === null ? '' : String(request.total_cost));
    setCostPaid(request.cost_paid);
  }, [request.id, request.total_cost, request.cost_paid]);

  async function handleSave() {
    const trimmed = totalCostDraft.trim();
    const total_cost = trimmed === '' ? null : Number(trimmed);

    if (total_cost !== null && (!Number.isFinite(total_cost) || total_cost < 0)) {
      throw new Error('Total cost must be zero or greater.');
    }

    await onSave({ total_cost, cost_paid: costPaid });
  }

  const statusLabel = formatTransferBillingStatus({
    ...request,
    total_cost:
      totalCostDraft.trim() === '' ? null : Number(totalCostDraft.trim()) || request.total_cost,
    cost_paid: costPaid,
  });

  return (
    <div className="mt-4 rounded-xl border border-brand-accent/35 bg-brand-cream/25 p-3 sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-brown/70">
            Branch billing · admin only
          </p>
          <p className="mt-1 text-sm text-brand-brown/75">
            {request.to_branch_name} owes {request.from_branch_name} for this transfer.
          </p>
        </div>
        <span
          className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
            statusLabel === 'Paid'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : statusLabel === 'Unpaid'
                ? 'border-amber-200 bg-amber-50 text-amber-800'
                : 'border-brand-muted/50 bg-white text-brand-brown/65'
          }`}
        >
          {statusLabel}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-end">
        <label className="block text-sm font-medium text-brand-brown">
          Total cost
          <input
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={totalCostDraft}
            disabled={disabled || saving}
            onChange={(event) => setTotalCostDraft(event.target.value)}
            placeholder="Enter amount owed"
            className="flower-input mt-1.5"
          />
        </label>

        <fieldset className="block">
          <legend className="text-sm font-medium text-brand-brown">Payment status</legend>
          <div className="mt-1.5 inline-flex rounded-xl border border-brand-muted/50 bg-white p-1">
            <button
              type="button"
              disabled={disabled || saving}
              onClick={() => setCostPaid(false)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                !costPaid ? 'bg-brand-dark text-white' : 'text-brand-brown/70 hover:bg-brand-beige/40'
              }`}
            >
              Unpaid
            </button>
            <button
              type="button"
              disabled={disabled || saving}
              onClick={() => setCostPaid(true)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                costPaid ? 'bg-emerald-600 text-white' : 'text-brand-brown/70 hover:bg-brand-beige/40'
              }`}
            >
              Paid
            </button>
          </div>
        </fieldset>

        <button
          type="button"
          disabled={disabled || saving}
          onClick={() => void handleSave()}
          className="flower-btn-secondary w-full sm:w-auto disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Save billing'}
        </button>
      </div>

      {request.total_cost !== null ? (
        <p className="mt-2 text-xs text-brand-brown/60">
          Saved amount: {PRICE_FORMATTER.format(request.total_cost)}
          {request.cost_paid ? ' · marked paid' : ' · still unpaid'}
        </p>
      ) : null}
    </div>
  );
}
