import { useMemo, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import type { FlowerPosCatalogItem } from '../../../shared/data/flowers.mock';

interface FlowerPosProductBrowserProps {
  products: FlowerPosCatalogItem[];
  onAddProduct: (product: FlowerPosCatalogItem) => void;
}

const FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1490750967868-88aa4486c946?auto=format&fit=crop&w=600&q=80';

const PRICE_FORMATTER = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export default function FlowerPosProductBrowser({
  products,
  onAddProduct,
}: FlowerPosProductBrowserProps) {
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
    <section className="flower-card overflow-hidden">
      <div className="border-b border-brand-muted/30 bg-gradient-to-r from-brand-cream/80 to-brand-beige/40 px-4 py-4 sm:px-5">
        <h3 className="font-serif text-lg font-semibold text-brand-dark">Flower Catalog</h3>
        <p className="mt-0.5 text-xs text-brand-brown/70 sm:text-sm">
          Tap an arrangement to add it to the order
        </p>
      </div>

      <div className="p-4 sm:p-5">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-brown/40" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search bouquets, stems, add-ons..."
            className="flower-input pl-10"
          />
        </div>

        <div className="flower-scroll mt-3 flex gap-2 overflow-x-auto pb-1">
          {categories.map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => setActiveCategory(category)}
              className={`flower-pill ${
                category === activeCategory ? 'flower-pill-active' : 'flower-pill-inactive'
              }`}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      <div className="flower-scroll grid max-h-[min(60vh,560px)] grid-cols-1 gap-3 overflow-y-auto border-t border-brand-muted/30 p-4 sm:grid-cols-2 sm:gap-4 sm:p-5">
        {visibleProducts.map((product) => (
          <button
            key={product.id}
            type="button"
            onClick={() => onAddProduct(product)}
            className="group flex overflow-hidden rounded-2xl border border-brand-muted/40 bg-white text-left transition hover:border-brand-accent hover:shadow-flower active:scale-[0.99] sm:flex-col"
          >
            <div className="relative h-24 w-24 shrink-0 overflow-hidden bg-brand-beige sm:h-36 sm:w-full">
              <img
                src={product.image}
                alt={product.name}
                loading="lazy"
                className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                onError={(event) => {
                  const target = event.target as HTMLImageElement;
                  target.src = FALLBACK_IMAGE;
                  target.onerror = null;
                }}
              />
              <span className="absolute right-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold text-brand-brown shadow-sm backdrop-blur-sm">
                {PRICE_FORMATTER.format(product.base_price)}
              </span>
            </div>

            <div className="flex min-w-0 flex-1 flex-col justify-between p-3 sm:p-4">
              <div>
                <p className="line-clamp-2 text-sm font-semibold leading-snug text-brand-dark sm:text-base">
                  {product.name}
                </p>
                <p className="mt-1 line-clamp-2 text-xs text-brand-brown/65 sm:text-sm">
                  {product.description}
                </p>
              </div>

              <div className="mt-2 flex items-center justify-between gap-2 sm:mt-3">
                <span className="inline-flex rounded-full bg-brand-beige/80 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-brown">
                  {product.category}
                </span>
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-brown text-white opacity-0 shadow-sm transition group-hover:opacity-100 sm:opacity-100">
                  <Plus className="h-4 w-4" />
                </span>
              </div>
            </div>
          </button>
        ))}

        {visibleProducts.length === 0 && (
          <div className="col-span-full rounded-2xl border border-dashed border-brand-muted py-12 text-center">
            <p className="text-sm text-brand-brown/60">No products match your filter.</p>
          </div>
        )}
      </div>
    </section>
  );
}
