import { useMemo, useState } from 'react';
import type { CafeProduct } from '../../../shared/types/product';

interface PosProductBrowserProps {
  products: CafeProduct[];
  onAddProduct: (product: CafeProduct) => void;
}

const FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=600&q=80';

const PRICE_FORMATTER = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export default function PosProductBrowser({ products, onAddProduct }: PosProductBrowserProps) {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');

  const categories = useMemo(
    () => ['All', ...new Set(products.map((product) => product.category))],
    [products],
  );

  const visibleProducts = useMemo(() => {
    const searchTerm = search.trim().toLowerCase();

    return products.filter((product) => {
      const categoryMatch = activeCategory === 'All' || product.category === activeCategory;
      const searchMatch =
        searchTerm.length === 0 ||
        product.name.toLowerCase().includes(searchTerm) ||
        product.description.toLowerCase().includes(searchTerm);

      return categoryMatch && searchMatch;
    });
  }, [activeCategory, products, search]);

  return (
    <section className="rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-200 p-4">
        <h3 className="text-sm font-semibold text-slate-900">Products</h3>
        <p className="mt-1 text-xs text-slate-500">Tap an item to add it to the current order.</p>
      </div>

      <div className="p-4">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search products"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-slate-300 focus:ring-2"
        />

        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {categories.map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => setActiveCategory(category)}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                category === activeCategory
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      <div className="grid max-h-[540px] grid-cols-1 gap-3 overflow-y-auto border-t border-slate-200 p-4 md:grid-cols-2">
        {visibleProducts.map((product) => (
          <button
            key={product.id}
            type="button"
            onClick={() => onAddProduct(product)}
            className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 text-left transition hover:border-slate-400 hover:bg-slate-50"
          >
            <div className="h-16 w-16 overflow-hidden rounded-md bg-slate-100">
              <img
                src={product.image}
                alt={product.name}
                loading="lazy"
                className="h-full w-full object-cover"
                onError={(event) => {
                  const target = event.target as HTMLImageElement;
                  target.src = FALLBACK_IMAGE;
                  target.onerror = null;
                }}
              />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <p className="line-clamp-1 text-sm font-semibold text-slate-900">{product.name}</p>
                <p className="text-xs font-bold text-slate-700">{PRICE_FORMATTER.format(product.price)}</p>
              </div>

              <p className="mt-1 line-clamp-2 text-xs text-slate-500">{product.description}</p>

              <div className="mt-2 flex gap-2">
                {product.is_best_seller && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                    Best Seller
                  </span>
                )}
                {product.is_new && (
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                    New
                  </span>
                )}
              </div>
            </div>
          </button>
        ))}

        {visibleProducts.length === 0 && (
          <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 md:col-span-2">
            No products match your filter.
          </div>
        )}
      </div>
    </section>
  );
}
