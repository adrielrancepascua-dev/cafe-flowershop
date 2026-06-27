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
      setErrorMessage(error instanceof Error ? error.message : 'Failed to load products.');
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
        Active stems: {activeCount} / {products.length}
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
            Add stem
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
        <div className="mt-5 overflow-x-auto rounded-2xl border border-brand-muted/40">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-brand-beige/40 text-brand-brown">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Unit cost</th>
                <th className="px-3 py-2">Status</th>
                <RequireFlowerAdmin>
                  <th className="px-3 py-2">Actions</th>
                </RequireFlowerAdmin>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <ProductRow
                  key={product.id}
                  product={product}
                  onChanged={loadProducts}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
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

  async function save() {
    await updateFlowerProduct(product.id, {
      name,
      unit_cost: product.unit_cost,
    });
    await onChanged();
  }

  return (
    <tr className="border-t border-brand-muted/30">
      <td className="px-3 py-2">
        <input value={name} onChange={(event) => setName(event.target.value)} className="flower-input" readOnly={false} />
      </td>
      <td className="px-3 py-2">{PRICE_FORMATTER.format(product.unit_cost)}</td>
      <td className="px-3 py-2">
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${product.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
          {product.is_active ? 'Active' : 'Inactive'}
        </span>
      </td>
      <RequireFlowerAdmin>
        <td className="px-3 py-2">
          <div className="flex flex-wrap gap-2">
            <button type="button" className="flower-btn-secondary px-3 py-1.5 text-xs" onClick={() => void save()}>
              Save
            </button>
            <button
              type="button"
              className="flower-btn-secondary px-3 py-1.5 text-xs"
              onClick={() => void toggleFlowerProductActive(product.id, !product.is_active).then(onChanged)}
            >
              {product.is_active ? 'Deactivate' : 'Activate'}
            </button>
            <button
              type="button"
              className="flower-btn-secondary px-3 py-1.5 text-xs text-red-700"
              onClick={() => void deleteFlowerProduct(product.id).then(onChanged)}
            >
              Delete
            </button>
          </div>
        </td>
      </RequireFlowerAdmin>
    </tr>
  );
}
