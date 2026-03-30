import { useEffect, useState } from 'react';
import type { CafeProduct } from '../../shared/types/product';
import { listProducts } from '../../../services/products';
import { createOrder } from '../../../services/orders';
import PosProductBrowser from '../pos/components/PosProductBrowser';
import PosOrderCart from '../pos/components/PosOrderCart';
import { usePosCart } from '../pos/hooks/usePosCart';

export default function DashboardPos() {
  const [products, setProducts] = useState<CafeProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [submitMessage, setSubmitMessage] = useState('');
  const {
    cart,
    addToCart,
    incrementItem,
    decrementItem,
    clearOrder,
    itemCount,
    subtotal,
    total,
  } = usePosCart();

  useEffect(() => {
    async function loadProducts() {
      const data = await listProducts();
      setProducts(data);
      setLoading(false);
    }

    loadProducts();
  }, []);

  async function handleSubmitOrder() {
    if (cart.length === 0 || isSubmittingOrder) {
      return;
    }

    setIsSubmittingOrder(true);

    try {
      const order = await createOrder({
        items: cart.map((item) => ({
          product_id: item.productId,
          name: item.name,
          category: item.category,
          unit_price: item.price,
          quantity: item.quantity,
          line_total: item.price * item.quantity,
        })),
        subtotal,
        total,
        source: 'dashboard_pos',
      });

      clearOrder();
      setSubmitMessage(`Order ${order.id} submitted.`);
    } finally {
      setIsSubmittingOrder(false);
    }
  }

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">POS Module</p>
      <h2 className="mt-2 text-2xl font-semibold text-slate-900">Point of Sale Workspace</h2>
      <p className="mt-3 text-slate-600">
        Phase 1 flow: choose items, build cart, adjust quantities, and compute totals. Payments, order saving, and
        inventory deduction are intentionally not included yet.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">Products</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{products.length}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">Cart Items</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{itemCount}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">Line Items</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{cart.length}</p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[1.35fr_1fr]">
        {loading ? (
          <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
            Loading products...
          </div>
        ) : (
          <PosProductBrowser products={products} onAddProduct={addToCart} />
        )}

        <PosOrderCart
          cart={cart}
          itemCount={itemCount}
          subtotal={subtotal}
          total={total}
          onIncrement={incrementItem}
          onDecrement={decrementItem}
          onClear={clearOrder}
          onSubmitOrder={handleSubmitOrder}
          isSubmittingOrder={isSubmittingOrder}
          submitMessage={submitMessage}
        />
      </div>
    </div>
  );
}
