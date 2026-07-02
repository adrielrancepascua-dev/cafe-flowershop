import { Fragment, useEffect, useMemo, useState } from 'react';
import { listFlowerProducts, createFlowerProduct, updateFlowerProduct, toggleFlowerProductActive, deleteFlowerProduct } from '../../../../services/flowers/products';
import { productColorColumnSupported } from '../../../../services/flowers/products/flowers-products.supabase';
import type { FlowerProduct } from '../../shared/types/flower-product';
import FlowerPageHeader from '../../shared/components/FlowerPageHeader';
import { RequireFlowerAdmin } from '../components/RequireFlowerAuth';
import FlowerProductColorPicker from '../components/FlowerProductColorPicker';
import { PRICE_FORMATTER } from '../../shared/utils/flower-format';
import {
  compareFlowerProducts,
  compareFlowerTypeLabels,
  deriveFlowerTypeFromProduct,
  FLOWER_PRODUCT_COLOR_OPTIONS,
  normalizeFlowerProductColor,
} from '../../shared/utils/flower-product-colors';

function groupProductsByFlowerType(products: FlowerProduct[]) {
  const buckets = new Map<string, FlowerProduct[]>();

  for (const product of products) {
    const flowerType = deriveFlowerTypeFromProduct(product.name, product.color);
    const bucket = buckets.get(flowerType) ?? [];
    bucket.push(product);
    buckets.set(flowerType, bucket);
  }

  return [...buckets.entries()]
    .sort(([left], [right]) => compareFlowerTypeLabels(left, right))
    .map(([flowerType, flowerProducts]) => ({
      flowerType,
      products: [...flowerProducts].sort(compareFlowerProducts),
    }));
}
export default function FlowerProductsPage() {
  const [products, setProducts] = useState<FlowerProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState<string>(FLOWER_PRODUCT_COLOR_OPTIONS[0]);
  const [newCost, setNewCost] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [colorMigrationNeeded, setColorMigrationNeeded] = useState(false);

  async function loadProducts() {
    setLoading(true);
    try {
      const loaded = await listFlowerProducts();
      setProducts(loaded);
      setColorMigrationNeeded(!productColorColumnSupported());
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

  const productsByFlowerType = useMemo(() => groupProductsByFlowerType(products), [products]);
  const existingProductColors = useMemo(
    () => products.map((product) => product.color),
    [products],
  );

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    const unit_cost = Number(newCost);
    if (!newName.trim() || !Number.isFinite(unit_cost) || unit_cost < 0 || !newColor.trim()) {
      setErrorMessage('Enter a valid name, color, and cost.');
      return;
    }

    await createFlowerProduct({ name: newName.trim(), color: newColor.trim(), unit_cost });
    setNewName('');
    setNewColor(FLOWER_PRODUCT_COLOR_OPTIONS[0]);
    setNewCost('');
    setErrorMessage('');
    await loadProducts();
  }

  return (
    <div className="animate-fade-in">
      <FlowerPageHeader
        label="Flower Types"
        title="Products"
        description="Flower stems grouped by type in inventory. Pick a preset color or add a custom one for unusual shades."
      />

      <p className="mt-2 text-sm text-brand-brown/70">
        Active products: {activeCount} / {products.length}
      </p>

      <RequireFlowerAdmin>
        <form
          onSubmit={handleCreate}
          className="mt-5 grid grid-cols-1 gap-3 rounded-2xl border border-brand-muted/40 bg-brand-cream/20 p-4 sm:grid-cols-[1fr_minmax(140px,180px)_160px_auto]"
        >
          <input
            type="text"
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            placeholder="Flower name (e.g. Red Rose)"
            className="flower-input"
          />
          <FlowerProductColorPicker
            value={newColor}
            onChange={setNewColor}
            existingColors={existingProductColors}
            required
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

      {colorMigrationNeeded ? (
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Color categories are not saved yet — run{' '}
          <span className="font-semibold">supabase/add_flower_product_color.sql</span> in Supabase once.
          Products still load; everything shows as Uncategorized until then.
        </p>
      ) : null}

      {errorMessage ? (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {errorMessage}
        </p>
      ) : null}

      {loading ? (
        <p className="mt-6 text-sm text-brand-brown/60">Loading products...</p>
      ) : (
        <>
          <div className="mt-5 space-y-5 md:hidden">
            {productsByFlowerType.map((section) => (
              <div key={section.flowerType} className="space-y-3">
                <ProductFlowerTypeSectionHeader flowerType={section.flowerType} count={section.products.length} />
                {section.products.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    existingProductColors={existingProductColors}
                    onChanged={loadProducts}
                  />
                ))}
              </div>
            ))}
          </div>

          <div className="mt-5 hidden overflow-x-auto rounded-2xl border border-brand-muted/40 md:block">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-brand-beige/40 text-brand-brown">
                <tr>
                  <th className="min-w-[12rem] px-3 py-2">Name</th>
                  <th className="px-3 py-2">Color</th>
                  <th className="px-3 py-2">Unit cost</th>
                  <th className="px-3 py-2">Status</th>
                  <RequireFlowerAdmin silent>
                    <th className="min-w-[14rem] px-3 py-2">Actions</th>
                  </RequireFlowerAdmin>
                </tr>
              </thead>
              <tbody>
                {productsByFlowerType.map((section) => (
                  <Fragment key={section.flowerType}>
                    <tr className="border-t border-brand-muted/30 bg-brand-beige/25">
                      <td colSpan={5} className="px-3 py-2">
                        <ProductFlowerTypeSectionHeader
                          flowerType={section.flowerType}
                          count={section.products.length}
                        />
                      </td>
                    </tr>
                    {section.products.map((product) => (
                      <ProductRow
                        key={product.id}
                        product={product}
                        existingProductColors={existingProductColors}
                        onChanged={loadProducts}
                      />
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function ProductFlowerTypeSectionHeader({
  flowerType,
  count,
}: {
  flowerType: string;
  count: number;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <p className="font-semibold text-brand-dark">{flowerType}</p>
      <p className="text-xs font-medium text-brand-brown/70">
        {count} color{count === 1 ? '' : 's'}
      </p>
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
  existingProductColors,
  onChanged,
}: {
  product: FlowerProduct;
  existingProductColors: string[];
  onChanged: () => Promise<void>;
}) {
  const [name, setName] = useState(product.name);
  const [color, setColor] = useState(normalizeFlowerProductColor(product.color));

  useEffect(() => {
    setName(product.name);
    setColor(normalizeFlowerProductColor(product.color));
  }, [product.id, product.name, product.color]);

  async function save() {
    await updateFlowerProduct(product.id, {
      name,
      color,
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

      <label className="mt-3 block text-xs font-medium uppercase tracking-wide text-brand-brown/60">
        Color category
        <div className="mt-1.5">
          <FlowerProductColorPicker
            value={color}
            onChange={setColor}
            existingColors={existingProductColors}
          />
        </div>
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
  existingProductColors,
  onChanged,
}: {
  product: FlowerProduct;
  existingProductColors: string[];
  onChanged: () => Promise<void>;
}) {
  const [name, setName] = useState(product.name);
  const [color, setColor] = useState(normalizeFlowerProductColor(product.color));

  useEffect(() => {
    setName(product.name);
    setColor(normalizeFlowerProductColor(product.color));
  }, [product.id, product.name, product.color]);

  async function save() {
    await updateFlowerProduct(product.id, {
      name,
      color,
      unit_cost: product.unit_cost,
    });
    await onChanged();
  }

  return (
    <tr className="border-t border-brand-muted/30">
      <td className="min-w-[12rem] px-3 py-2">
        <input value={name} onChange={(event) => setName(event.target.value)} className="flower-input min-w-[10rem]" />
      </td>
      <td className="px-3 py-2">
        <FlowerProductColorPicker
          value={color}
          onChange={setColor}
          existingColors={existingProductColors}
          className="flower-input min-w-[120px]"
        />
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
