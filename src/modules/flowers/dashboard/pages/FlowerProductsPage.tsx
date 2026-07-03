import { useEffect, useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { listFlowerProducts, createFlowerProduct, updateFlowerProduct, toggleFlowerProductActive, deleteFlowerProduct } from '../../../../services/flowers/products';
import {
  productColorColumnSupported,
  productKindColumnSupported,
} from '../../../../services/flowers/products/flowers-products.supabase';
import { getFlowerStorageMode, shouldUseFlowerSupabase } from '../../../../services/flowers/storage-mode';
import { useFlowerAuth } from '../../../../lib/auth/FlowerAuthContext';
import type { FlowerProduct } from '../../shared/types/flower-product';
import FlowerPageHeader from '../../shared/components/FlowerPageHeader';
import { RequireFlowerAdmin } from '../components/RequireFlowerAuth';
import FlowerProductColorPicker from '../components/FlowerProductColorPicker';
import { PRICE_FORMATTER } from '../../shared/utils/flower-format';
import {
  FLOWER_PRODUCT_COLOR_OPTIONS,
  normalizeFlowerProductColor,
} from '../../shared/utils/flower-product-colors';
import {
  FLOWER_PRODUCT_KIND_LABELS,
  type FlowerProductKind,
} from '../../shared/utils/flower-product-kind';
import {
  MISC_PRODUCT_CATEGORIES,
  MISC_PRODUCT_CATEGORY_LABELS,
  miscCategoryFromFlowerType,
  type MiscProductCategory,
} from '../../shared/utils/flower-misc-category';
import { groupFlowerProductsByType, type FlowerProductTypeGroup } from '../../shared/utils/flower-product-type';
export default function FlowerProductsPage() {
  const [products, setProducts] = useState<FlowerProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [catalogTab, setCatalogTab] = useState<FlowerProductKind>('flower');
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState<string>(FLOWER_PRODUCT_COLOR_OPTIONS[0]);
  const [newCost, setNewCost] = useState('');
  const [newMiscCategory, setNewMiscCategory] = useState<MiscProductCategory>('wrappers');
  const [errorMessage, setErrorMessage] = useState('');
  const [colorMigrationNeeded, setColorMigrationNeeded] = useState(false);
  const [kindMigrationNeeded, setKindMigrationNeeded] = useState(false);

  const flowerProducts = useMemo(
    () => products.filter((product) => product.product_kind === 'flower'),
    [products],
  );
  const miscProducts = useMemo(
    () =>
      products
        .filter((product) => product.product_kind === 'misc')
        .sort((left, right) => left.name.localeCompare(right.name)),
    [products],
  );
  const visibleProducts = catalogTab === 'flower' ? flowerProducts : miscProducts;

  async function loadProducts() {
    setLoading(true);
    try {
      const loaded = await listFlowerProducts();
      setProducts(loaded);
      const usingSupabase = shouldUseFlowerSupabase(getFlowerStorageMode());
      setColorMigrationNeeded(usingSupabase && !productColorColumnSupported());
      setKindMigrationNeeded(usingSupabase && !productKindColumnSupported());
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
    () => visibleProducts.filter((product) => product.is_active).length,
    [visibleProducts],
  );

  const productsByFlowerType = useMemo(() => groupFlowerProductsByType(flowerProducts), [flowerProducts]);
  const existingProductColors = useMemo(
    () => flowerProducts.map((product) => product.color),
    [flowerProducts],
  );

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    const unit_cost = Number(newCost);
    if (!newName.trim() || !Number.isFinite(unit_cost) || unit_cost < 0) {
      setErrorMessage('Enter a valid name and cost.');
      return;
    }

    if (catalogTab === 'flower' && !newColor.trim()) {
      setErrorMessage('Enter a valid name, color, and cost.');
      return;
    }

    await createFlowerProduct({
      name: newName.trim(),
      ...(catalogTab === 'flower' ? { flower_type: newName.trim() } : {}),
      product_kind: catalogTab,
      misc_category: catalogTab === 'misc' ? newMiscCategory : undefined,
      color: catalogTab === 'flower' ? newColor.trim() : '',
      unit_cost,
    });
    setNewName('');
    setNewColor(FLOWER_PRODUCT_COLOR_OPTIONS[0]);
    setNewMiscCategory('wrappers');
    setNewCost('');
    setErrorMessage('');
    await loadProducts();
  }

  async function handleDeleteProduct(productId: string) {
    try {
      await deleteFlowerProduct(productId);
      setErrorMessage('');
      await loadProducts();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to delete product.');
    }
  }

  return (
    <div className="animate-fade-in">
      <FlowerPageHeader
        label="Catalog"
        title="Products"
        description="Flowers for daily orders and a separate miscellaneous list for wrappers, chocolates, and other shop supplies."
      />

      <div className="mt-4 inline-flex rounded-xl border border-brand-muted/50 bg-white p-1">
        {(['flower', 'misc'] as const).map((kind) => (
          <button
            key={kind}
            type="button"
            onClick={() => setCatalogTab(kind)}
            className={`flower-pill ${catalogTab === kind ? 'flower-pill-active' : 'flower-pill-inactive'}`}
          >
            {FLOWER_PRODUCT_KIND_LABELS[kind]}
          </button>
        ))}
      </div>

      <p className="mt-2 text-sm text-brand-brown/70">
        Active {catalogTab === 'flower' ? 'flowers' : 'misc items'}: {activeCount} / {visibleProducts.length}
      </p>

      <RequireFlowerAdmin>
        <form
          onSubmit={handleCreate}
          className={`mt-5 grid grid-cols-1 gap-3 rounded-2xl border border-brand-muted/40 bg-brand-cream/20 p-4 ${
            catalogTab === 'flower'
              ? 'sm:grid-cols-[1fr_minmax(140px,180px)_160px_auto]'
              : 'sm:grid-cols-[minmax(140px,180px)_1fr_160px_auto]'
          }`}
        >
          {catalogTab === 'misc' ? (
            <select
              value={newMiscCategory}
              onChange={(event) => setNewMiscCategory(event.target.value as MiscProductCategory)}
              className="flower-input"
              aria-label="Miscellaneous category"
            >
              {MISC_PRODUCT_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {MISC_PRODUCT_CATEGORY_LABELS[category]}
                </option>
              ))}
            </select>
          ) : null}
          <input
            type="text"
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            placeholder={
              catalogTab === 'flower' ? 'Flower type (e.g. Local Rose, Lily)' : 'Item name (e.g. Kraft wrapper, Chocolate)'
            }
            className="flower-input"
          />
          {catalogTab === 'flower' ? (
            <FlowerProductColorPicker
              value={newColor}
              onChange={setNewColor}
              existingColors={existingProductColors}
              required
            />
          ) : null}
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
            Add {catalogTab === 'flower' ? 'flower' : 'item'}
          </button>
        </form>
      </RequireFlowerAdmin>

      {colorMigrationNeeded && catalogTab === 'flower' ? (
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Color categories are not saved yet — run{' '}
          <span className="font-semibold">supabase/add_flower_product_color.sql</span> in Supabase once.
        </p>
      ) : null}

      {kindMigrationNeeded ? (
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Miscellaneous products need the product kind column — run{' '}
          <span className="font-semibold">supabase/add_flower_product_kind.sql</span> in Supabase once so wrappers and supplies appear separately from flowers.
        </p>
      ) : null}

      {errorMessage ? (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {errorMessage}
        </p>
      ) : null}

      {loading ? (
        <p className="mt-6 text-sm text-brand-brown/60">Loading products...</p>
      ) : catalogTab === 'flower' ? (
        <div className="mt-5 space-y-3">
          {productsByFlowerType.map((section) =>
            section.isCategory ? (
              <ProductCategoryGroup
                key={section.flowerType}
                section={section}
                onChanged={loadProducts}
                onDelete={handleDeleteProduct}
              />
            ) : section.variants[0] ? (
              <ProductStandaloneCard
                key={section.flowerType}
                product={section.variants[0]}
                onChanged={loadProducts}
                onDelete={handleDeleteProduct}
              />
            ) : null,
          )}
          {productsByFlowerType.length === 0 ? (
            <p className="rounded-xl border border-brand-muted/30 px-3 py-8 text-center text-sm text-brand-brown/60">
              No flowers yet.
            </p>
          ) : null}
        </div>
      ) : (
        <>
          <div className="mt-5 space-y-3 md:hidden">
            {miscProducts.map((product) => (
              <MiscProductCard key={product.id} product={product} onChanged={loadProducts} onDelete={handleDeleteProduct} />
            ))}
            {miscProducts.length === 0 ? (
              <p className="rounded-xl border border-brand-muted/30 px-3 py-6 text-center text-sm text-brand-brown/60">
                No miscellaneous items yet.
              </p>
            ) : null}
          </div>

          <div className="mt-5 hidden overflow-x-auto rounded-2xl border border-brand-muted/40 md:block">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-brand-beige/40 text-brand-brown">
                <tr>
                  <th className="min-w-[10rem] px-3 py-2">Category</th>
                  <th className="min-w-[12rem] px-3 py-2">Name</th>
                  <th className="px-3 py-2">Unit cost</th>
                  <th className="px-3 py-2">Status</th>
                  <RequireFlowerAdmin silent>
                    <th className="min-w-[14rem] px-3 py-2">Actions</th>
                  </RequireFlowerAdmin>
                </tr>
              </thead>
              <tbody>
                {miscProducts.map((product) => (
                  <MiscProductRow key={product.id} product={product} onChanged={loadProducts} onDelete={handleDeleteProduct} />
                ))}
                {miscProducts.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-8 text-center text-brand-brown/60">
                      No miscellaneous items yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function FixedFlowerColorBadge({ color }: { color: string }) {
  const label = normalizeFlowerProductColor(color) || '—';

  return (
    <span className="inline-flex rounded-full border border-brand-muted/45 bg-white px-2.5 py-0.5 text-xs font-semibold text-brand-dark">
      {label}
    </span>
  );
}

function AddColorVariationForm({
  flowerType,
  existingColors,
  onChanged,
}: {
  flowerType: string;
  existingColors: string[];
  onChanged: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [color, setColor] = useState<string>(FLOWER_PRODUCT_COLOR_OPTIONS[0]);
  const [cost, setCost] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const unit_cost = Number(cost);
    const normalizedColor = normalizeFlowerProductColor(color);

    if (!normalizedColor.trim()) {
      setErrorMessage('Choose a color.');
      return;
    }

    if (!Number.isFinite(unit_cost) || unit_cost < 0) {
      setErrorMessage('Enter a valid unit cost.');
      return;
    }

    if (existingColors.some((existing) => normalizeFlowerProductColor(existing) === normalizedColor)) {
      setErrorMessage('That color already exists for this flower.');
      return;
    }

    await createFlowerProduct({
      name: flowerType,
      flower_type: flowerType,
      product_kind: 'flower',
      color: normalizedColor,
      unit_cost,
    });
    setOpen(false);
    setCost('');
    setColor(FLOWER_PRODUCT_COLOR_OPTIONS[0]);
    setErrorMessage('');
    await onChanged();
  }

  if (!open) {
    return (
      <button
        type="button"
        className="flower-btn-secondary px-3 py-1.5 text-xs"
        onClick={() => setOpen(true)}
      >
        Add color
      </button>
    );
  }

  return (
    <form onSubmit={(event) => void handleSubmit(event)} className="flex flex-wrap items-end gap-2">
      <FlowerProductColorPicker
        value={color}
        onChange={setColor}
        existingColors={existingColors}
        required
        className="flower-input min-w-[120px] text-xs"
      />
      <input
        type="number"
        min="0"
        step="0.01"
        value={cost}
        onChange={(event) => setCost(event.target.value)}
        placeholder="Unit cost"
        className="flower-input w-28 text-xs"
      />
      <button type="submit" className="flower-btn-primary px-3 py-1.5 text-xs">
        Save
      </button>
      <button
        type="button"
        className="flower-btn-secondary px-3 py-1.5 text-xs"
        onClick={() => {
          setOpen(false);
          setErrorMessage('');
        }}
      >
        Cancel
      </button>
      {errorMessage ? <p className="w-full text-xs text-red-700">{errorMessage}</p> : null}
    </form>
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

function ProductCategoryGroup({
  section,
  onChanged,
  onDelete,
}: {
  section: FlowerProductTypeGroup;
  onChanged: () => Promise<void>;
  onDelete: (productId: string) => Promise<void>;
}) {
  const existingColors = section.variants.map((product) => product.color);
  const [expanded, setExpanded] = useState(false);
  const panelId = `product-category-${section.flowerType.replace(/\s+/g, '-').toLowerCase()}`;

  return (
    <div className="overflow-hidden rounded-xl border border-brand-muted/40 bg-white shadow-sm">
      <div
        className={`flex items-start gap-2 bg-gradient-to-r from-brand-beige/70 to-brand-cream/40 px-3 py-3 sm:px-4 ${
          expanded ? 'border-b border-brand-muted/25' : ''
        }`}
      >
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={panelId}
          onClick={() => setExpanded((current) => !current)}
          className="flex min-w-0 flex-1 items-start gap-2 text-left transition hover:opacity-90"
        >
          <ChevronDown
            className={`mt-0.5 h-4 w-4 shrink-0 text-brand-brown/70 transition-transform ${
              expanded ? 'rotate-0' : '-rotate-90'
            }`}
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold text-brand-dark">{section.flowerType}</p>
              <span className="rounded-full border border-brand-muted/40 bg-white/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-brown/70">
                Category
              </span>
            </div>
            <p className="mt-0.5 text-xs text-brand-brown/65">
              {section.variants.length} colors · {expanded ? 'tap to collapse' : 'tap to expand'}
            </p>
            {!expanded ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {section.variants.map((product) => (
                  <FixedFlowerColorBadge key={product.id} color={product.color} />
                ))}
              </div>
            ) : null}
          </div>
        </button>

        <div className="shrink-0" onClick={(event) => event.stopPropagation()}>
          <RequireFlowerAdmin silent>
            <AddColorVariationForm
              flowerType={section.flowerType}
              existingColors={existingColors}
              onChanged={onChanged}
            />
          </RequireFlowerAdmin>
        </div>
      </div>

      {expanded ? (
        <div id={panelId} className="divide-y divide-brand-muted/15 bg-brand-cream/10">
          {section.variants.map((product) => (
            <ProductCategoryVariantRow
              key={product.id}
              product={product}
              onChanged={onChanged}
              onDelete={onDelete}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ProductCategoryVariantRow({
  product,
  onChanged,
  onDelete,
}: {
  product: FlowerProduct;
  onChanged: () => Promise<void>;
  onDelete: (productId: string) => Promise<void>;
}) {
  return (
    <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3 pl-2 sm:pl-4">
        <span aria-hidden className="h-8 w-0.5 shrink-0 rounded-full bg-brand-muted/50" />
        <FixedFlowerColorBadge color={product.color} />
      </div>

      <div className="flex flex-wrap items-center gap-3 sm:justify-end">
        <p className="text-sm font-semibold text-brand-dark">{PRICE_FORMATTER.format(product.unit_cost)}</p>
        <ProductStatusBadge isActive={product.is_active} />
        <RequireFlowerAdmin silent>
          <ProductVariantActions product={product} onChanged={onChanged} onDelete={onDelete} />
        </RequireFlowerAdmin>
      </div>
    </div>
  );
}

function ProductStandaloneCard({
  product,
  onChanged,
  onDelete,
}: {
  product: FlowerProduct;
  onChanged: () => Promise<void>;
  onDelete: (productId: string) => Promise<void>;
}) {
  const { isAdmin } = useFlowerAuth();
  const fixedColor = normalizeFlowerProductColor(product.color);

  return (
    <div className="rounded-xl border border-brand-muted/40 bg-white/80 px-4 py-3 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-sm font-semibold text-brand-dark">{product.name}</p>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-brand-brown/60">Color</span>
            <FixedFlowerColorBadge color={fixedColor} />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 lg:justify-end">
          {isAdmin ? (
            <AddColorVariationForm
              flowerType={product.name}
              existingColors={[fixedColor]}
              onChanged={onChanged}
            />
          ) : null}
          <p className="text-sm font-semibold text-brand-dark">{PRICE_FORMATTER.format(product.unit_cost)}</p>
          <ProductStatusBadge isActive={product.is_active} />
          <RequireFlowerAdmin silent>
            <ProductVariantActions product={product} onChanged={onChanged} onDelete={onDelete} />
          </RequireFlowerAdmin>
        </div>
      </div>
    </div>
  );
}

function ProductVariantActions({
  product,
  onChanged,
  onDelete,
}: {
  product: FlowerProduct;
  onChanged: () => Promise<void>;
  onDelete: (productId: string) => Promise<void>;
}) {
  return (
    <div className="flex flex-wrap gap-2">
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
        onClick={() => void onDelete(product.id)}
      >
        Delete
      </button>
    </div>
  );
}

function ProductActions({
  product,
  onSave,
  onChanged,
  onDelete,
}: {
  product: FlowerProduct;
  onSave: () => Promise<void>;
  onChanged: () => Promise<void>;
  onDelete: (productId: string) => Promise<void>;
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
        onClick={() => void onDelete(product.id)}
      >
        Delete
      </button>
    </div>
  );
}

function MiscProductCard({
  product,
  onChanged,
  onDelete,
}: {
  product: FlowerProduct;
  onChanged: () => Promise<void>;
  onDelete: (productId: string) => Promise<void>;
}) {
  const [name, setName] = useState(product.name);
  const [unitCost, setUnitCost] = useState(String(product.unit_cost));
  const [miscCategory, setMiscCategory] = useState<MiscProductCategory>(
    miscCategoryFromFlowerType(product.flower_type),
  );
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    setName(product.name);
    setUnitCost(String(product.unit_cost));
    setMiscCategory(miscCategoryFromFlowerType(product.flower_type));
  }, [product.flower_type, product.id, product.name, product.unit_cost]);

  async function save() {
    const unit_cost = Number(unitCost);
    if (!name.trim()) {
      setErrorMessage('Enter an item name.');
      return;
    }

    if (!Number.isFinite(unit_cost) || unit_cost < 0) {
      setErrorMessage('Enter a valid unit cost.');
      return;
    }

    await updateFlowerProduct(product.id, {
      name: name.trim(),
      product_kind: 'misc',
      misc_category: miscCategory,
      color: '',
      unit_cost,
    });
    setErrorMessage('');
    await onChanged();
  }

  return (
    <div className="flower-card p-4">
      <label className="block text-xs font-medium uppercase tracking-wide text-brand-brown/60">
        Category
        <select
          value={miscCategory}
          onChange={(event) => setMiscCategory(event.target.value as MiscProductCategory)}
          className="flower-input mt-1.5"
        >
          {MISC_PRODUCT_CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {MISC_PRODUCT_CATEGORY_LABELS[category]}
            </option>
          ))}
        </select>
      </label>

      <label className="mt-3 block text-xs font-medium uppercase tracking-wide text-brand-brown/60">
        Item name
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="flower-input mt-1.5"
        />
      </label>

      <label className="mt-3 block text-xs font-medium uppercase tracking-wide text-brand-brown/60">
        Unit cost
        <input
          type="number"
          min="0"
          step="0.01"
          value={unitCost}
          onChange={(event) => setUnitCost(event.target.value)}
          className="flower-input mt-1.5"
        />
      </label>

      <div className="mt-3 flex items-center justify-end">
        <ProductStatusBadge isActive={product.is_active} />
      </div>

      {errorMessage ? <p className="mt-2 text-xs text-red-700">{errorMessage}</p> : null}

      <RequireFlowerAdmin silent>
        <div className="mt-4 border-t border-brand-muted/30 pt-4">
          <ProductActions product={product} onSave={save} onChanged={onChanged} onDelete={onDelete} />
        </div>
      </RequireFlowerAdmin>
    </div>
  );
}

function MiscProductRow({
  product,
  onChanged,
  onDelete,
}: {
  product: FlowerProduct;
  onChanged: () => Promise<void>;
  onDelete: (productId: string) => Promise<void>;
}) {
  const [name, setName] = useState(product.name);
  const [unitCost, setUnitCost] = useState(String(product.unit_cost));
  const [miscCategory, setMiscCategory] = useState<MiscProductCategory>(
    miscCategoryFromFlowerType(product.flower_type),
  );
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    setName(product.name);
    setUnitCost(String(product.unit_cost));
    setMiscCategory(miscCategoryFromFlowerType(product.flower_type));
  }, [product.flower_type, product.id, product.name, product.unit_cost]);

  async function save() {
    const unit_cost = Number(unitCost);
    if (!name.trim()) {
      setErrorMessage('Enter an item name.');
      return;
    }

    if (!Number.isFinite(unit_cost) || unit_cost < 0) {
      setErrorMessage('Enter a valid unit cost.');
      return;
    }

    await updateFlowerProduct(product.id, {
      name: name.trim(),
      product_kind: 'misc',
      misc_category: miscCategory,
      color: '',
      unit_cost,
    });
    setErrorMessage('');
    await onChanged();
  }

  return (
    <tr className="border-t border-brand-muted/30">
      <td className="px-3 py-2">
        <select
          value={miscCategory}
          onChange={(event) => setMiscCategory(event.target.value as MiscProductCategory)}
          className="flower-input min-w-[9rem]"
        >
          {MISC_PRODUCT_CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {MISC_PRODUCT_CATEGORY_LABELS[category]}
            </option>
          ))}
        </select>
      </td>
      <td className="min-w-[12rem] px-3 py-2">
        <input value={name} onChange={(event) => setName(event.target.value)} className="flower-input min-w-[10rem]" />
      </td>
      <td className="px-3 py-2 whitespace-nowrap">
        <input
          type="number"
          min="0"
          step="0.01"
          value={unitCost}
          onChange={(event) => setUnitCost(event.target.value)}
          className="flower-input w-28"
        />
      </td>
      <td className="px-3 py-2">
        <ProductStatusBadge isActive={product.is_active} />
      </td>
      <RequireFlowerAdmin silent>
        <td className="min-w-[14rem] px-3 py-2">
          <ProductActions product={product} onSave={save} onChanged={onChanged} onDelete={onDelete} />
          {errorMessage ? <p className="mt-1 text-xs text-red-700">{errorMessage}</p> : null}
        </td>
      </RequireFlowerAdmin>
    </tr>
  );
}
