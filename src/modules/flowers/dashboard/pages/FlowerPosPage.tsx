import { useEffect, useRef, useState } from 'react';
import { Banknote, Flower2, ShoppingCart, Store } from 'lucide-react';
import { listFlowerBranches } from '../../../../services/flowers/inventory';
import { createFlowerOrder } from '../../../../services/flowers/orders';
import { listFlowerPosCatalog } from '../../../../services/flowers/products/flowers-pos-catalog.service';
import type { FlowerPosCatalogItem } from '../../shared/data/flowers.mock';
import type { FlowerBranchOption } from '../../shared/types/flower-inventory';
import DemoModeBanner from '../../shared/components/DemoModeBanner';
import FlowerPageHeader from '../../shared/components/FlowerPageHeader';
import FlowerStatCard from '../../shared/components/FlowerStatCard';
import FlowerPosOrderCart from '../pos/components/FlowerPosOrderCart';
import FlowerPosProductBrowser from '../pos/components/FlowerPosProductBrowser';
import { useFlowerPosCart } from '../pos/hooks/useFlowerPosCart';

const PRICE_FORMATTER = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  maximumFractionDigits: 0,
});

export default function FlowerPosPage() {
  const [products, setProducts] = useState<FlowerPosCatalogItem[]>([]);
  const [branches, setBranches] = useState<FlowerBranchOption[]>([]);
  const [branchId, setBranchId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [submitMessage, setSubmitMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const cartRef = useRef<HTMLDivElement>(null);

  const {
    cart,
    addToCart,
    incrementItem,
    decrementItem,
    clearOrder,
    itemCount,
    subtotal,
    total,
  } = useFlowerPosCart();

  useEffect(() => {
    async function bootstrap() {
      try {
        const [catalog, branchList] = await Promise.all([
          listFlowerPosCatalog(),
          listFlowerBranches(),
        ]);

        setProducts(catalog);
        setBranches(branchList);

        const firstActive = branchList.find((branch) => branch.is_active) ?? branchList[0];
        if (firstActive) {
          setBranchId(firstActive.id);
        }
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : 'Failed to load POS data.');
      } finally {
        setLoading(false);
      }
    }

    void bootstrap();
  }, []);

  function scrollToCart() {
    cartRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function handleSubmitOrder() {
    if (cart.length === 0 || isSubmittingOrder) {
      return;
    }

    if (!branchId) {
      setErrorMessage('Please select a branch before submitting.');
      scrollToCart();
      return;
    }

    setIsSubmittingOrder(true);
    setErrorMessage('');
    setSubmitMessage('');

    try {
      const order = await createFlowerOrder({
        branch_id: branchId,
        customer_name: customerName,
        notes,
        total_amount: total,
        items: cart.map((item) => ({
          product_id: item.productId,
          item_name: item.name,
          quantity: item.quantity,
          unit_price: item.price,
          line_total: item.price * item.quantity,
        })),
      });

      clearOrder();
      setCustomerName('');
      setNotes('');
      setSubmitMessage(`Order ${order.id} saved successfully.`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to submit order.');
      scrollToCart();
    } finally {
      setIsSubmittingOrder(false);
    }
  }

  return (
    <div className="animate-fade-in">
      <DemoModeBanner />

      <FlowerPageHeader
        label="Flower POS"
        title="Point of Sale"
        description="Walk-in and phone orders — browse the catalog, build a cart, and submit. Inventory is deducted automatically."
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
        <FlowerStatCard label="Catalog" value={products.length} icon={Flower2} />
        <FlowerStatCard label="Cart Items" value={itemCount} icon={ShoppingCart} accent="warm" />
        <div className="col-span-2 sm:col-span-1">
          <FlowerStatCard
            label="Order Total"
            value={PRICE_FORMATTER.format(total)}
            icon={Banknote}
            accent="green"
          />
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 rounded-2xl border border-brand-muted/40 bg-brand-cream/30 p-4 sm:mt-6 sm:grid-cols-3 sm:gap-4">
        <label className="block text-sm font-medium text-brand-brown">
          Branch
          <select
            value={branchId}
            onChange={(event) => setBranchId(event.target.value)}
            className="flower-input mt-1.5"
            disabled={loading}
          >
            <option value="">Select branch</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm font-medium text-brand-brown">
          Customer
          <input
            type="text"
            value={customerName}
            onChange={(event) => setCustomerName(event.target.value)}
            placeholder="Walk-in or customer name"
            className="flower-input mt-1.5"
          />
        </label>

        <label className="block text-sm font-medium text-brand-brown">
          Notes
          <input
            type="text"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Delivery instructions, occasion..."
            className="flower-input mt-1.5"
          />
        </label>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 lg:mt-6 lg:grid-cols-[1.4fr_1fr] lg:items-start lg:gap-6 xl:gap-8">
        {loading ? (
          <div className="flower-card p-8">
            <div className="flex flex-col items-center gap-3 text-brand-brown/60">
              <div className="h-8 w-8 animate-pulse rounded-full bg-brand-beige" />
              <p className="text-sm">Loading catalog...</p>
            </div>
          </div>
        ) : (
          <FlowerPosProductBrowser products={products} onAddProduct={addToCart} />
        )}

        <div ref={cartRef} className="lg:sticky lg:top-[88px]">
          <FlowerPosOrderCart
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
            errorMessage={errorMessage}
          />
        </div>
      </div>

      {cart.length > 0 && (
        <div className="fixed inset-x-0 bottom-[calc(52px+env(safe-area-inset-bottom))] z-40 border-t border-brand-muted/50 bg-white/95 px-4 py-3 shadow-flower-lg backdrop-blur-md lg:hidden">
          <div className="mx-auto flex max-w-lg items-center gap-3">
            <button
              type="button"
              onClick={scrollToCart}
              className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-brown text-white">
                <Store className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-xs text-brand-brown/70">{itemCount} item(s)</span>
                <span className="block truncate font-serif text-lg font-semibold text-brand-dark">
                  {PRICE_FORMATTER.format(total)}
                </span>
              </span>
            </button>
            <button
              type="button"
              onClick={handleSubmitOrder}
              disabled={isSubmittingOrder}
              className="flower-btn-primary shrink-0 px-5"
            >
              {isSubmittingOrder ? 'Saving...' : 'Checkout'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
