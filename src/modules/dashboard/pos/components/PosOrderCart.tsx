import type { PosCartItem } from '../hooks/usePosCart';

interface PosOrderCartProps {
  cart: PosCartItem[];
  itemCount: number;
  subtotal: number;
  total: number;
  onIncrement: (productId: string) => void;
  onDecrement: (productId: string) => void;
  onClear: () => void;
  onSubmitOrder: () => void;
  isSubmittingOrder: boolean;
  submitMessage?: string;
}

const PRICE_FORMATTER = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export default function PosOrderCart({
  cart,
  itemCount,
  subtotal,
  total,
  onIncrement,
  onDecrement,
  onClear,
  onSubmitOrder,
  isSubmittingOrder,
  submitMessage,
}: PosOrderCartProps) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-200 p-4">
        <h3 className="text-sm font-semibold text-slate-900">Current Order</h3>
        <p className="mt-1 text-xs text-slate-500">{itemCount} item(s) in cart</p>
      </div>

      <div className="max-h-[420px] overflow-y-auto p-4">
        {cart.length === 0 && (
          <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
            No items yet. Select a product from the left panel.
          </div>
        )}

        {cart.length > 0 && (
          <div className="space-y-3">
            {cart.map((item) => (
              <div
                key={item.productId}
                className="rounded-lg border border-slate-200 bg-slate-50 p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{item.name}</p>
                    <p className="text-xs text-slate-500">{item.category}</p>
                  </div>
                  <p className="text-sm font-bold text-slate-700">{PRICE_FORMATTER.format(item.price)}</p>
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <div className="inline-flex items-center overflow-hidden rounded-md border border-slate-300">
                    <button
                      type="button"
                      onClick={() => onDecrement(item.productId)}
                      className="px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
                    >
                      -
                    </button>
                    <span className="min-w-10 border-x border-slate-300 px-3 py-1.5 text-center text-sm font-semibold text-slate-900">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => onIncrement(item.productId)}
                      className="px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
                    >
                      +
                    </button>
                  </div>

                  <p className="text-sm font-semibold text-slate-900">
                    {PRICE_FORMATTER.format(item.quantity * item.price)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-slate-200 p-4">
        {submitMessage && (
          <div className="mb-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
            {submitMessage}
          </div>
        )}

        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between text-slate-600">
            <span>Subtotal</span>
            <span className="font-semibold text-slate-900">{PRICE_FORMATTER.format(subtotal)}</span>
          </div>
          <div className="flex items-center justify-between text-slate-900">
            <span className="font-semibold">Total</span>
            <span className="text-base font-bold">{PRICE_FORMATTER.format(total)}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={onSubmitOrder}
          disabled={cart.length === 0 || isSubmittingOrder}
          className="mt-4 w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition enabled:hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isSubmittingOrder ? 'Submitting...' : 'Submit Order'}
        </button>

        <button
          type="button"
          onClick={onClear}
          disabled={cart.length === 0}
          className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition enabled:hover:border-slate-400 enabled:hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Clear Order
        </button>
      </div>
    </section>
  );
}
