import { useEffect, useMemo, useState } from 'react';
import type { FlowerProduct } from '../../shared/types/flower-product';
import {
  createFlowerProduct,
  deleteFlowerProduct,
  listFlowerProducts,
  toggleFlowerProductActive,
  updateFlowerProduct,
} from '../../../../services/flowers/products';
import DemoModeBanner from '../../shared/components/DemoModeBanner';
import FlowerPageHeader from '../../shared/components/FlowerPageHeader';

const PRICE_FORMATTER = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

type ProductDraft = {
  name: string;
  basePrice: string;
};

function toDraft(product: FlowerProduct): ProductDraft {
  return {
    name: product.name,
    basePrice: product.base_price.toString(),
  };
}

export default function FlowerProductsPlaceholder() {
  const [products, setProducts] = useState<FlowerProduct[]>([]);
  const [drafts, setDrafts] = useState<Record<string, ProductDraft>>({});
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [newName, setNewName] = useState('');
  const [newBasePrice, setNewBasePrice] = useState('');
  const [newIsActive, setNewIsActive] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [savingProductId, setSavingProductId] = useState<string | null>(null);
  const [togglingProductId, setTogglingProductId] = useState<string | null>(null);
  const [deleteTargetProductId, setDeleteTargetProductId] = useState<string | null>(null);
  const [deleteAcknowledged, setDeleteAcknowledged] = useState(false);
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null);

  useEffect(() => {
    void loadProducts();
  }, []);

  async function loadProducts() {
    try {
      setLoading(true);
      const nextProducts = await listFlowerProducts();

      setProducts(nextProducts);
      setDrafts(
        nextProducts.reduce<Record<string, ProductDraft>>((acc, product) => {
          acc[product.id] = toDraft(product);
          return acc;
        }, {}),
      );
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to load flower products.');
    } finally {
      setLoading(false);
    }
  }

  const activeCount = useMemo(
    () => products.filter((product) => product.is_active).length,
    [products],
  );

  async function handleCreateProduct() {
    const parsedBasePrice = Number(newBasePrice.trim());

    if (!newName.trim()) {
      setErrorMessage('Product name is required.');
      return;
    }

    if (!Number.isFinite(parsedBasePrice) || parsedBasePrice < 0) {
      setErrorMessage('Base price must be 0 or greater.');
      return;
    }

    try {
      setIsCreating(true);
      const created = await createFlowerProduct({
        name: newName,
        base_price: parsedBasePrice,
        is_active: newIsActive,
      });

      setProducts((current) => [created, ...current]);
      setDrafts((current) => ({ ...current, [created.id]: toDraft(created) }));
      setNewName('');
      setNewBasePrice('');
      setNewIsActive(true);
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to create flower product.');
    } finally {
      setIsCreating(false);
    }
  }

  async function handleSaveProduct(productId: string) {
    const draft = drafts[productId];
    const parsedBasePrice = Number((draft?.basePrice ?? '').trim());
    const nextName = (draft?.name ?? '').trim();

    if (!nextName) {
      setErrorMessage('Product name is required.');
      return;
    }

    if (!Number.isFinite(parsedBasePrice) || parsedBasePrice < 0) {
      setErrorMessage('Base price must be 0 or greater.');
      return;
    }

    try {
      setSavingProductId(productId);
      const updated = await updateFlowerProduct(productId, {
        name: nextName,
        base_price: parsedBasePrice,
      });

      setProducts((current) =>
        current.map((product) => (product.id === updated.id ? updated : product)),
      );
      setDrafts((current) => ({ ...current, [updated.id]: toDraft(updated) }));
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to update flower product.');
    } finally {
      setSavingProductId(null);
    }
  }

  async function handleToggleProduct(product: FlowerProduct) {
    try {
      setTogglingProductId(product.id);
      const updated = await toggleFlowerProductActive(product.id, !product.is_active);

      setProducts((current) =>
        current.map((currentProduct) =>
          currentProduct.id === updated.id ? updated : currentProduct,
        ),
      );
      setDrafts((current) => ({ ...current, [updated.id]: toDraft(updated) }));
      if (updated.is_active && deleteTargetProductId === updated.id) {
        setDeleteTargetProductId(null);
        setDeleteAcknowledged(false);
      }
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to update product status.');
    } finally {
      setTogglingProductId(null);
    }
  }

  function openDeleteConfirmation(productId: string) {
    setDeleteTargetProductId(productId);
    setDeleteAcknowledged(false);
    setErrorMessage(null);
  }

  function cancelDeleteConfirmation() {
    setDeleteTargetProductId(null);
    setDeleteAcknowledged(false);
  }

  async function handleDeleteProduct(productId: string) {
    if (!deleteAcknowledged) {
      setErrorMessage('Please acknowledge the warning before deleting this product.');
      return;
    }

    try {
      setDeletingProductId(productId);
      await deleteFlowerProduct(productId);

      setProducts((current) => current.filter((product) => product.id !== productId));
      setDrafts((current) => {
        const nextDrafts = { ...current };
        delete nextDrafts[productId];
        return nextDrafts;
      });
      setDeleteTargetProductId(null);
      setDeleteAcknowledged(false);
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to delete flower product.');
    } finally {
      setDeletingProductId(null);
    }
  }

  return (
    <div className="animate-fade-in">
      <DemoModeBanner />

      <FlowerPageHeader
        label="Products"
        title="Flower Product Management"
        description="Manage your reusable flower product catalog — names, prices, and availability."
      />

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
        <div className="flower-card p-4 sm:p-5">
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-brand-accent">Total Products</p>
          <p className="mt-2 font-serif text-3xl font-semibold text-brand-dark">{products.length}</p>
        </div>
        <div className="flower-card p-4 sm:p-5">
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-brand-accent">Active</p>
          <p className="mt-2 font-serif text-3xl font-semibold text-brand-dark">{activeCount}</p>
        </div>
        <div className="flower-card p-4 sm:p-5">
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-brand-accent">Inactive</p>
          <p className="mt-2 font-serif text-3xl font-semibold text-brand-dark">{products.length - activeCount}</p>
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-slate-900">Create Product</h3>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-[2fr_1fr_auto_auto] md:items-end">
          <label className="block text-sm font-medium text-slate-700">
            Name
            <input
              type="text"
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              placeholder="e.g., Classic Red Rose Bouquet"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
            />
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Base Price
            <input
              type="number"
              min="0"
              step="0.01"
              value={newBasePrice}
              onChange={(event) => setNewBasePrice(event.target.value)}
              placeholder="0.00"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
            />
          </label>

          <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={newIsActive}
              onChange={(event) => setNewIsActive(event.target.checked)}
              className="h-4 w-4"
            />
            Active
          </label>

          <button
            type="button"
            onClick={handleCreateProduct}
            disabled={isCreating}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isCreating ? 'Creating...' : 'Create'}
          </button>
        </div>
      </div>

      <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
        Recommended flow: archive a product by setting it inactive. Use hard delete only when truly necessary,
        because deleting a product may affect inventory and order history.
      </p>

      {errorMessage ? (
        <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{errorMessage}</p>
      ) : null}

      <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3 font-semibold">Name</th>
              <th className="px-4 py-3 font-semibold">Base Price</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="px-4 py-4 text-slate-500" colSpan={4}>
                  Loading flower products...
                </td>
              </tr>
            ) : products.length === 0 ? (
              <tr>
                <td className="px-4 py-4 text-slate-500" colSpan={4}>
                  No products yet. Create your first flower product above.
                </td>
              </tr>
            ) : (
              products.map((product) => {
                const draft = drafts[product.id] ?? toDraft(product);

                return (
                  <tr key={product.id} className="border-t border-slate-200 align-top">
                    <td className="px-4 py-3">
                      <input
                        type="text"
                        value={draft.name}
                        onChange={(event) =>
                          setDrafts((current) => ({
                            ...current,
                            [product.id]: {
                              ...draft,
                              name: event.target.value,
                            },
                          }))
                        }
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500">PHP</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={draft.basePrice}
                          onChange={(event) =>
                            setDrafts((current) => ({
                              ...current,
                              [product.id]: {
                                ...draft,
                                basePrice: event.target.value,
                              },
                            }))
                          }
                          className="w-28 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                        />
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        Current: {PRICE_FORMATTER.format(product.base_price)}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                          product.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {product.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => handleSaveProduct(product.id)}
                          disabled={savingProductId === product.id}
                          className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {savingProductId === product.id ? 'Saving...' : 'Save'}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleToggleProduct(product)}
                          disabled={togglingProductId === product.id}
                          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {togglingProductId === product.id
                            ? 'Updating...'
                            : product.is_active
                              ? 'Archive'
                              : 'Activate'}
                        </button>

                        <button
                          type="button"
                          onClick={() => openDeleteConfirmation(product.id)}
                          disabled={product.is_active}
                          title={product.is_active ? 'Archive this product first to unlock hard delete.' : undefined}
                          className="rounded-lg border border-rose-300 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Hard Delete
                        </button>
                      </div>

                      {deleteTargetProductId === product.id ? (
                        <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
                          <p className="font-semibold">Delete product permanently?</p>
                          <p className="mt-1">
                            This action cannot be undone, and deleting a product may affect inventory records and
                            order history.
                          </p>

                          <label className="mt-3 flex items-start gap-2 text-xs">
                            <input
                              type="checkbox"
                              checked={deleteAcknowledged}
                              onChange={(event) => setDeleteAcknowledged(event.target.checked)}
                              className="mt-0.5 h-4 w-4"
                            />
                            <span>I understand the risk and still want to permanently delete this product.</span>
                          </label>

                          <div className="mt-3 flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={cancelDeleteConfirmation}
                              disabled={deletingProductId === product.id}
                              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDeleteProduct(product.id)}
                              disabled={deletingProductId === product.id || !deleteAcknowledged}
                              className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {deletingProductId === product.id ? 'Deleting...' : 'Delete Permanently'}
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
