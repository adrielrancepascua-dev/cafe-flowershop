import { useEffect, useMemo, useState } from 'react';
import { listFlowerProducts, createFlowerProduct, updateFlowerProduct, toggleFlowerProductActive, deleteFlowerProduct } from '../../../../services/flowers/products';
import type { FlowerProduct } from '../../shared/types/flower-product';
import FlowerPageHeader from '../../shared/components/FlowerPageHeader';
import { RequireFlowerAdmin } from '../components/RequireFlowerAuth';
import { PRICE_FORMATTER } from '../../shared/utils/flower-format';

export default function FlowerProductsPage() {
  const [products, setProducts] = useState<FlowerProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [newCost, setNewCost] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  async function loadProducts() {
    setLoading(true);
    try {
      setProducts(await listFlowerProducts());
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load products.';
      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadProducts();
  }, []);

  const activeCount = useMemo(
    () => products.filter((product) => product.is_active).length,
    [products],
  );

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    const unit_cost = Number(newCost);
    if (!newName.trim() || !Number.isFinite(unit_cost) || unit_cost < 0) {
      setErrorMessage('Enter a valid name and cost.');
      return;
    }

    await createFlowerProduct({ name: newName, unit_cost });
    setNewName('');
    setNewCost('');
    setErrorMessage('');
    await loadProducts();
  }

  return (
    <div className="animate-fade-in">
      <FlowerPageHeader
        label="Flower Types"
        title="Products"
        description="Singular flower types with cost only — no fixed selling price and no images."
      />

      <p className="mt-2 text-sm text-brand-brown/70">
        Active products: {activeCount} / {products.length}
      </p>

      <RequireFlowerAdmin>
        <form onSubmit={handleCreate} className="mt-5 grid grid-cols-1 gap-3 rounded-2xl border border-brand-muted/40 bg-brand-cream/20 p-4 sm:grid-cols-[1fr_160px_auto]">
          <input
            type="text"
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            placeholder="Flower name (e.g. Red Rose)"
            className="flower-input"
          />
          <input
            type="number"
            min="0"
            step="0.01"
            value={newCost}
            onChange={(event) => setNewCost(event.target.value)}
            placeholder="Unit cost"
            className="flower-input"
          />
          <button type="submit" className="flower-btn-primary">
            Add product
          </button>
        </form>
      </RequireFlowerAdmin>

      {errorMessage ? (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {errorMessage}
        </p>
      ) : null}

      {loading ? (
        <p className="mt-6 text-sm text-brand-brown/60">Loading products...</p>
      ) : (
        <>
          <div className="mt-5 space-y-3 md:hidden">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} onChanged={loadProducts} />
            ))}
          </div>

          <div className="mt-5 hidden overflow-x-auto rounded-2xl border border-brand-muted/40 md:block">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-brand-beige/40 text-brand-brown">
                <tr>
                  <th className="min-w-[12rem] px-3 py-2">Name</th>
                  <th className="px-3 py-2">Unit cost</th>
                  <th className="px-3 py-2">Status</th>
                  <RequireFlowerAdmin silent>
                    <th className="min-w-[14rem] px-3 py-2">Actions</th>
                  </RequireFlowerAdmin>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <ProductRow key={product.id} product={product} onChanged={loadProducts} />
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function ProductStatusBadge({ isActive }: { isActive: boolean }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}
    >
      {isActive ? 'Active' : 'Inactive'}
    </span>
  );
}

function ProductActions({
  product,
  onSave,
  onChanged,
}: {
  product: FlowerProduct;
  onSave: () => Promise<void>;
  onChanged: () => Promise<void>;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
      <button type="button" className="flower-btn-secondary px-3 py-2 text-xs sm:py-1.5" onClick={() => void onSave()}>
        Save
      </button>
      <button
        type="button"
        className="flower-btn-secondary px-3 py-2 text-xs sm:py-1.5"
        onClick={() => void toggleFlowerProductActive(product.id, !product.is_active).then(onChanged)}
      >
        {product.is_active ? 'Deactivate' : 'Activate'}
      </button>
      <button
        type="button"
        className="flower-btn-secondary col-span-2 px-3 py-2 text-xs text-red-700 sm:col-span-1 sm:py-1.5"
        onClick={() => void deleteFlowerProduct(product.id).then(onChanged)}
      >
        Delete
      </button>
    </div>
  );
}

function ProductCard({
  product,
  onChanged,
}: {
  product: FlowerProduct;
  onChanged: () => Promise<void>;
}) {
  const [name, setName] = useState(product.name);

  useEffect(() => {
    setName(product.name);
  }, [product.id, product.name]);

  async function save() {
    await updateFlowerProduct(product.id, {
      name,
      unit_cost: product.unit_cost,
    });
    await onChanged();
  }

  return (
    <div className="flower-card p-4">
      <label className="block text-xs font-medium uppercase tracking-wide text-brand-brown/60">
        Flower name
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="flower-input mt-1.5"
        />
      </label>

      <div className="mt-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-brand-brown/60">Unit cost</p>
          <p className="mt-0.5 font-semibold text-brand-dark">{PRICE_FORMATTER.format(product.unit_cost)}</p>
        </div>
        <ProductStatusBadge isActive={product.is_active} />
      </div>

      <RequireFlowerAdmin silent>
        <div className="mt-4 border-t border-brand-muted/30 pt-4">
          <ProductActions product={product} onSave={save} onChanged={onChanged} />
        </div>
      </RequireFlowerAdmin>
    </div>
  );
}

function ProductRow({
  product,
  onChanged,
}: {
  product: FlowerProduct;
  onChanged: () => Promise<void>;
}) {
  const [name, setName] = useState(product.name);

  useEffect(() => {
    setName(product.name);
  }, [product.id, product.name]);

  async function save() {
    await updateFlowerProduct(product.id, {
      name,
      unit_cost: product.unit_cost,
    });
    await onChanged();
  }

  return (
    <tr className="border-t border-brand-muted/30">
      <td className="min-w-[12rem] px-3 py-2">
        <input value={name} onChange={(event) => setName(event.target.value)} className="flower-input min-w-[10rem]" />
      </td>
      <td className="px-3 py-2 whitespace-nowrap">{PRICE_FORMATTER.format(product.unit_cost)}</td>
      <td className="px-3 py-2">
        <ProductStatusBadge isActive={product.is_active} />
      </td>
      <RequireFlowerAdmin silent>
        <td className="min-w-[14rem] px-3 py-2">
          <ProductActions product={product} onSave={save} onChanged={onChanged} />
        </td>
      </RequireFlowerAdmin>
    </tr>
  );
}
