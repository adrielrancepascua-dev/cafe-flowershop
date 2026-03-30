import { useEffect, useMemo, useState } from 'react';
import type { CafeProduct } from '../../shared/types/product';
import { listProducts, updateProductActive, updateProductPrice } from '../../../services/products';

export default function DashboardProducts() {
  const [products, setProducts] = useState<CafeProduct[]>([]);
  const [priceDrafts, setPriceDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingPriceId, setSavingPriceId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | CafeProduct['category']>('all');

  useEffect(() => {
    let isMounted = true;

    async function load() {
      try {
        setLoading(true);
        const nextProducts = await listProducts({ includeInactive: true });

        if (!isMounted) {
          return;
        }

        setProducts(nextProducts);
        setPriceDrafts(
          nextProducts.reduce<Record<string, string>>((acc, product) => {
            acc[product.id] = product.price.toString();
            return acc;
          }, {}),
        );
        setError(null);
      } catch (loadError) {
        if (!isMounted) {
          return;
        }

        const message = loadError instanceof Error ? loadError.message : 'Failed to load products.';
        setError(message);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      isMounted = false;
    };
  }, []);

  const categories = useMemo(
    () => [...new Set(products.map((product) => product.category))].sort((a, b) => a.localeCompare(b)),
    [products],
  );

  const visibleProducts = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return products.filter((product) => {
      const matchesCategory = categoryFilter === 'all' || product.category === categoryFilter;
      const matchesSearch =
        keyword.length === 0 ||
        product.name.toLowerCase().includes(keyword) ||
        product.description.toLowerCase().includes(keyword);

      return matchesCategory && matchesSearch;
    });
  }, [products, search, categoryFilter]);

  async function handleSavePrice(product: CafeProduct) {
    const draftValue = (priceDrafts[product.id] ?? '').trim();
    const parsed = Number(draftValue);

    if (!Number.isFinite(parsed) || parsed < 0) {
      setError(`Invalid price for ${product.name}. Use a positive number.`);
      return;
    }

    try {
      setSavingPriceId(product.id);
      const updated = await updateProductPrice(product.id, parsed);

      setProducts((current) =>
        current.map((currentProduct) =>
          currentProduct.id === updated.id ? { ...currentProduct, price: updated.price } : currentProduct,
        ),
      );
      setPriceDrafts((current) => ({ ...current, [product.id]: updated.price.toString() }));
      setError(null);
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : 'Failed to update product price.';
      setError(message);
    } finally {
      setSavingPriceId(null);
    }
  }

  async function handleToggleActive(product: CafeProduct) {
    try {
      setTogglingId(product.id);
      const updated = await updateProductActive(product.id, !product.is_active);

      setProducts((current) =>
        current.map((currentProduct) =>
          currentProduct.id === updated.id
            ? { ...currentProduct, is_active: updated.is_active }
            : currentProduct,
        ),
      );
      setError(null);
    } catch (toggleError) {
      const message = toggleError instanceof Error ? toggleError.message : 'Failed to update product status.';
      setError(message);
    } finally {
      setTogglingId(null);
    }
  }

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Products Module</p>
      <h2 className="mt-2 text-2xl font-semibold text-slate-900">Product and Menu Management</h2>
      <p className="mt-3 text-slate-600">
        Manage the shared product source used by both the public menu and staff POS.
      </p>

      <div className="mt-6 grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-3">
        <label className="block text-sm font-medium text-slate-700 sm:col-span-2">
          Search product
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name or description"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
          />
        </label>

        <label className="block text-sm font-medium text-slate-700">
          Category
          <select
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value as 'all' | CafeProduct['category'])}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
          >
            <option value="all">All categories</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </label>
      </div>

      <p className="mt-4 text-sm text-slate-600">
        Showing {visibleProducts.length} of {products.length} products.
      </p>

      {error ? <p className="mt-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}

      {loading ? (
        <p className="mt-6 text-sm text-slate-600">Loading products...</p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 font-semibold">Product</th>
                <th className="px-4 py-3 font-semibold">Category</th>
                <th className="px-4 py-3 font-semibold">Price</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleProducts.map((product) => {
                const currentDraft = priceDrafts[product.id] ?? product.price.toString();
                const normalizedDraft = Number(currentDraft);
                const priceChanged = Number.isFinite(normalizedDraft) && normalizedDraft !== product.price;
                const isSavingPrice = savingPriceId === product.id;
                const isToggling = togglingId === product.id;

                return (
                  <tr key={product.id} className="border-t border-slate-200 align-top">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{product.name}</p>
                      <p className="mt-1 text-xs text-slate-500">{product.id}</p>
                      <div className="mt-2 flex gap-2 text-xs">
                        {product.is_best_seller ? (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-700">
                            Best Seller
                          </span>
                        ) : null}
                        {product.is_new ? (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-medium text-emerald-700">
                            New
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{product.category}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500">PHP</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={currentDraft}
                          onChange={(event) =>
                            setPriceDrafts((current) => ({ ...current, [product.id]: event.target.value }))
                          }
                          className="w-24 rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                          product.is_active
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {product.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => handleSavePrice(product)}
                          disabled={!priceChanged || isSavingPrice}
                          className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {isSavingPrice ? 'Saving...' : 'Save Price'}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleToggleActive(product)}
                          disabled={isToggling}
                          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {isToggling
                            ? 'Updating...'
                            : product.is_active
                              ? 'Set Inactive'
                              : 'Set Active'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
