import { ShoppingBag } from 'lucide-react';
import type { FlowerPosCartItem } from '../hooks/useFlowerPosCart';

interface FlowerPosOrderCartProps {
  cart: FlowerPosCartItem[];
  itemCount: number;
  subtotal: number;
  total: number;
  onIncrement: (productId: string) => void;
  onDecrement: (productId: string) => void;
  onClear: () => void;
  onSubmitOrder: () => void;
  isSubmittingOrder: boolean;
  submitMessage?: string;
  errorMessage?: string;
}

const PRICE_FORMATTER = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export default function FlowerPosOrderCart({
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
  errorMessage,
}: FlowerPosOrderCartProps) {
  return (
    <section className="flower-card overflow-hidden">
      <div className="border-b border-brand-muted/30 bg-gradient-to-r from-brand-cream/80 to-brand-beige/40 px-4 py-4 sm:px-5">
        <div className="flex items-center gap-2">
          <ShoppingBag className="h-5 w-5 text-brand-brown" strokeWidth={1.75} />
          <div>
            <h3 className="font-serif text-lg font-semibold text-brand-dark">Current Order</h3>
            <p className="text-xs text-brand-brown/70">{itemCount} item(s) in cart</p>
          </div>
        </div>
      </div>

      <div className="flower-scroll max-h-[min(40vh,360px)] overflow-y-auto p-4 sm:max-h-[420px] sm:p-5">
        {cart.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-brand-muted py-10 text-center">
            <ShoppingBag className="mb-2 h-8 w-8 text-brand-muted" strokeWidth={1.5} />
            <p className="text-sm text-brand-brown/60">No items yet</p>
            <p className="mt-1 text-xs text-brand-brown/45">Select from the catalog above</p>
          </div>
        )}

        {cart.length > 0 && (
          <div className="space-y-3">
            {cart.map((item) => (
              <div
                key={item.productId}
                className="rounded-xl border border-brand-muted/40 bg-brand-cream/30 p-3.5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold leading-snug text-brand-dark">{item.name}</p>
                    <p className="mt-0.5 text-xs text-brand-brown/65">{item.category}</p>
                  </div>
                  <p className="shrink-0 text-sm font-bold text-brand-brown">
                    {PRICE_FORMATTER.format(item.price)}
                  </p>
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <div className="inline-flex items-center overflow-hidden rounded-xl border border-brand-muted/60 bg-white">
                    <button
                      type="button"
                      onClick={() => onDecrement(item.productId)}
                      className="flex h-10 w-10 items-center justify-center text-lg font-semibold text-brand-brown transition hover:bg-brand-beige"
                      aria-label="Decrease quantity"
                    >
                      −
                    </button>
                    <span className="flex h-10 min-w-10 items-center justify-center border-x border-brand-muted/60 px-2 text-sm font-semibold text-brand-dark">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => onIncrement(item.productId)}
                      className="flex h-10 w-10 items-center justify-center text-lg font-semibold text-brand-brown transition hover:bg-brand-beige"
                      aria-label="Increase quantity"
                    >
                      +
                    </button>
                  </div>

                  <p className="text-sm font-semibold text-brand-dark">
                    {PRICE_FORMATTER.format(item.quantity * item.price)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-brand-muted/30 bg-brand-cream/20 p-4 sm:p-5">
        {errorMessage && (
          <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-700">
            {errorMessage}
          </div>
        )}

        {submitMessage && (
          <div className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs font-medium text-emerald-700">
            {submitMessage}
          </div>
        )}

        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between text-brand-brown/75">
            <span>Subtotal</span>
            <span className="font-semibold text-brand-dark">{PRICE_FORMATTER.format(subtotal)}</span>
          </div>
          <div className="flex items-center justify-between border-t border-brand-muted/30 pt-2 text-brand-dark">
            <span className="font-semibold">Total</span>
            <span className="font-serif text-xl font-bold">{PRICE_FORMATTER.format(total)}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={onSubmitOrder}
          disabled={cart.length === 0 || isSubmittingOrder}
          className="flower-btn-primary mt-4 hidden w-full lg:flex"
        >
          {isSubmittingOrder ? 'Processing...' : 'Complete Order'}
        </button>

        <button
          type="button"
          onClick={onClear}
          disabled={cart.length === 0}
          className="flower-btn-secondary mt-2 hidden w-full lg:flex"
        >
          Clear Order
        </button>
      </div>
    </section>
  );
}
