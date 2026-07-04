import { useMemo, useState } from 'react';
import { Minus, Plus, Trash2 } from 'lucide-react';
import type { FlowerProduct } from '../../shared/types/flower-product';
import {
  deriveFlowerTypeFromProduct,
  flowerProductColorSwatchClass,
  formatInventoryStockLabel,
  normalizeFlowerProductColor,
} from '../../shared/utils/flower-product-colors';
import { groupFlowerProductsByType as groupSupplyProducts } from '../../shared/utils/flower-supply-transfer';
import { PRICE_FORMATTER } from '../../shared/utils/flower-format';

export type FlowerSupplyLineDraft = {
  id: string;
  flowerType: string;
  productId: string;
  productName: string;
  productColor: string;
  unitCost: number;
  quantity: string;
};

type FlowerSupplyLineEditorProps = {
  products: FlowerProduct[];
  lines: FlowerSupplyLineDraft[];
  onChange: (lines: FlowerSupplyLineDraft[]) => void;
  disabled?: boolean;
};

function createLineId(): string {
  return `line-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

function sanitizeQuantity(rawValue: string): string {
  const digits = rawValue.replace(/[^\d]/g, '');
  if (!digits) {
    return '';
  }

  return String(Math.max(1, Number(digits)));
}

function buildLineFromProduct(product: FlowerProduct, quantity: number): FlowerSupplyLineDraft {
  return {
    id: createLineId(),
    flowerType: deriveFlowerTypeFromProduct(product.name, product.color),
    productId: product.id,
    productName: product.name,
    productColor: normalizeFlowerProductColor(product.color),
    unitCost: Number(product.unit_cost) || 0,
    quantity: String(quantity),
  };
}

export default function FlowerSupplyLineEditor({
  products,
  lines,
  onChange,
  disabled = false,
}: FlowerSupplyLineEditorProps) {
  const sections = groupSupplyProducts(products);
  const [pickerFlowerType, setPickerFlowerType] = useState('');
  const [pickerProductId, setPickerProductId] = useState('');
  const [pickerQty, setPickerQty] = useState('1');
  const [pickerError, setPickerError] = useState('');

  const colorOptions = useMemo(
    () => sections.find((section) => section.flowerType === pickerFlowerType)?.products ?? [],
    [pickerFlowerType, sections],
  );

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === pickerProductId) ?? null,
    [pickerProductId, products],
  );

  const totals = useMemo(() => {
    const units = lines.reduce((sum, line) => sum + (Number(line.quantity) || 0), 0);
    const flowerCost = lines.reduce(
      (sum, line) => sum + (Number(line.quantity) || 0) * line.unitCost,
      0,
    );

    return { items: lines.length, units, flowerCost };
  }, [lines]);

  function resetPicker() {
    setPickerFlowerType('');
    setPickerProductId('');
    setPickerQty('1');
    setPickerError('');
  }

  function updateLineQuantity(lineId: string, nextQuantity: string) {
    onChange(
      lines.map((line) =>
        line.id === lineId ? { ...line, quantity: sanitizeQuantity(nextQuantity) } : line,
      ),
    );
  }

  function bumpLineQuantity(lineId: string, delta: number) {
    onChange(
      lines.map((line) => {
        if (line.id !== lineId) {
          return line;
        }

        const next = Math.max(1, (Number(line.quantity) || 0) + delta);
        return { ...line, quantity: String(next) };
      }),
    );
  }

  function removeLine(lineId: string) {
    onChange(lines.filter((line) => line.id !== lineId));
  }

  function handleAddLine() {
    const quantity = Number(pickerQty);

    if (!pickerProductId || quantity <= 0 || !selectedProduct) {
      setPickerError('Choose a flower color and quantity before adding.');
      return;
    }

    const existing = lines.find((line) => line.productId === pickerProductId);
    if (existing) {
      onChange(
        lines.map((line) =>
          line.productId === pickerProductId
            ? { ...line, quantity: String((Number(line.quantity) || 0) + quantity) }
            : line,
        ),
      );
    } else {
      onChange([...lines, buildLineFromProduct(selectedProduct, quantity)]);
    }

    setPickerProductId('');
    setPickerQty('1');
    setPickerError('');
  }

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-brand-muted/35 bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-brand-dark">Add flowers</p>
            <p className="mt-0.5 text-xs text-brand-brown/65">
              Pick type and color, then add to the list below. Same color adds to quantity.
            </p>
          </div>
        </div>

        {sections.length === 0 ? (
          <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            No active flower products found. Add flowers on the Products page first.
          </p>
        ) : (
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1.1fr)_120px_auto]">
            <label className="block text-xs font-medium text-brand-brown">
              Flower type
              <select
                value={pickerFlowerType}
                disabled={disabled}
                onChange={(event) => {
                  setPickerFlowerType(event.target.value);
                  setPickerProductId('');
                  setPickerError('');
                }}
                className="flower-input mt-1"
              >
                <option value="">Select type</option>
                {sections.map((section) => (
                  <option key={section.flowerType} value={section.flowerType}>
                    {section.flowerType}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-xs font-medium text-brand-brown">
              Color
              <select
                value={pickerProductId}
                disabled={disabled || !pickerFlowerType}
                onChange={(event) => {
                  setPickerProductId(event.target.value);
                  setPickerError('');
                }}
                className="flower-input mt-1"
              >
                <option value="">
                  {!pickerFlowerType ? 'Select type first' : 'Select color'}
                </option>
                {colorOptions.map((product) => (
                  <option key={product.id} value={product.id}>
                    {normalizeFlowerProductColor(product.color)} · {PRICE_FORMATTER.format(product.unit_cost)}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-xs font-medium text-brand-brown">
              Qty
              <div className="mt-1 flex items-center gap-1">
                <button
                  type="button"
                  disabled={disabled || !pickerProductId}
                  onClick={() => setPickerQty((current) => sanitizeQuantity(String((Number(current) || 1) - 1)))}
                  className="inline-flex h-10 w-9 shrink-0 items-center justify-center rounded-lg border border-brand-muted/50 text-brand-brown/70 hover:bg-brand-cream/60 disabled:opacity-40"
                  aria-label="Decrease quantity"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <input
                  type="text"
                  inputMode="numeric"
                  value={pickerQty}
                  disabled={disabled || !pickerProductId}
                  onChange={(event) => setPickerQty(sanitizeQuantity(event.target.value))}
                  className="flower-input min-w-0 flex-1 text-center"
                />
                <button
                  type="button"
                  disabled={disabled || !pickerProductId}
                  onClick={() => setPickerQty((current) => sanitizeQuantity(String((Number(current) || 0) + 1)))}
                  className="inline-flex h-10 w-9 shrink-0 items-center justify-center rounded-lg border border-brand-muted/50 text-brand-brown/70 hover:bg-brand-cream/60 disabled:opacity-40"
                  aria-label="Increase quantity"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </label>

            <div className="flex items-end">
              <button
                type="button"
                disabled={disabled || !pickerProductId}
                onClick={handleAddLine}
                className="flower-btn-secondary w-full"
              >
                Add to list
              </button>
            </div>
          </div>
        )}

        {selectedProduct ? (
          <p className="mt-2 text-xs text-brand-brown/70">
            Adding {formatInventoryStockLabel({
              product_id: selectedProduct.id,
              product_name: selectedProduct.name,
              product_color: selectedProduct.color,
              product_kind: 'flower',
              product_flower_type: deriveFlowerTypeFromProduct(selectedProduct.name, selectedProduct.color),
              branch_id: '',
              branch_name: '',
              on_hand: 0,
              last_updated: null,
              product_is_active: true,
            })}{' '}
            at {PRICE_FORMATTER.format(selectedProduct.unit_cost)} unit cost
          </p>
        ) : null}

        {pickerError ? <p className="mt-2 text-xs text-red-700">{pickerError}</p> : null}
      </div>

      <div className="rounded-2xl border border-brand-muted/35 bg-brand-cream/15 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-sm font-semibold text-brand-dark">
            Flowers in this transfer
            {lines.length > 0 ? (
              <span className="ml-2 text-xs font-normal text-brand-brown/60">
                {totals.items} item{totals.items === 1 ? '' : 's'} · {totals.units} stems ·{' '}
                {PRICE_FORMATTER.format(totals.flowerCost)} flower cost
              </span>
            ) : null}
          </h4>
          {lines.length > 0 ? (
            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                onChange([]);
                resetPicker();
              }}
              className="text-xs font-semibold text-brand-brown/70 transition hover:text-brand-dark"
            >
              Clear all
            </button>
          ) : null}
        </div>

        {lines.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-brand-muted/45 bg-white/70 px-3 py-5 text-center text-sm text-brand-brown/60">
            No flowers added yet. Use the picker above to build the list.
          </p>
        ) : (
          <div className="mt-3 overflow-hidden rounded-xl border border-brand-muted/30 bg-white">
            <div className="hidden grid-cols-[minmax(0,1fr)_120px_100px_40px] gap-3 border-b border-brand-muted/25 bg-brand-cream/40 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-brand-brown/60 sm:grid">
              <span>Flower</span>
              <span className="text-right">Unit cost</span>
              <span className="text-center">Qty</span>
              <span className="sr-only">Remove</span>
            </div>
            <ul className="divide-y divide-brand-muted/20">
              {lines.map((line) => {
                const quantity = Number(line.quantity) || 0;
                const lineCost = quantity * line.unitCost;

                return (
                  <li
                    key={line.id}
                    className="grid grid-cols-1 gap-3 px-3 py-3 sm:grid-cols-[minmax(0,1fr)_120px_100px_40px] sm:items-center"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={`h-3.5 w-3.5 shrink-0 rounded-full ${flowerProductColorSwatchClass(line.productColor)}`}
                          aria-hidden
                        />
                        <p className="truncate text-sm font-medium text-brand-dark">
                          {line.flowerType} · {line.productColor}
                        </p>
                      </div>
                      <p className="mt-0.5 pl-5 text-xs text-brand-brown/60">
                        Line cost: {PRICE_FORMATTER.format(lineCost)}
                      </p>
                    </div>

                    <p className="text-sm text-brand-brown/80 sm:text-right">
                      {PRICE_FORMATTER.format(line.unitCost)}
                    </p>

                    <div className="flex items-center justify-start gap-1 sm:justify-center">
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => bumpLineQuantity(line.id, -1)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-brand-muted/50 text-brand-brown/70 hover:bg-brand-cream/60 disabled:opacity-40"
                        aria-label="Decrease quantity"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={line.quantity}
                        disabled={disabled}
                        onChange={(event) => updateLineQuantity(line.id, event.target.value)}
                        className="flower-input h-8 w-14 px-1 text-center text-sm"
                      />
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => bumpLineQuantity(line.id, 1)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-brand-muted/50 text-brand-brown/70 hover:bg-brand-cream/60 disabled:opacity-40"
                        aria-label="Increase quantity"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <div className="flex justify-end sm:justify-center">
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => removeLine(line.id)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-brand-muted/50 text-brand-brown/70 transition hover:bg-red-50 hover:text-red-700"
                        aria-label="Remove flower line"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

export function createDefaultSupplyLines(): FlowerSupplyLineDraft[] {
  return [];
}

export function mapSupplyLinesToInput(lines: FlowerSupplyLineDraft[]) {
  return lines
    .filter((line) => line.productId && Number(line.quantity) > 0)
    .map((line) => ({
      productId: line.productId,
      quantity: Number(line.quantity),
    }));
}

/** Migrate legacy drafts that only stored ids/types. */
export function hydrateSupplyLines(
  lines: FlowerSupplyLineDraft[],
  products: FlowerProduct[],
): FlowerSupplyLineDraft[] {
  const productById = new Map(products.map((product) => [product.id, product]));

  return lines.map((line) => {
    if (line.productName && line.productColor) {
      return line;
    }

    const product = productById.get(line.productId);
    if (!product) {
      return line;
    }

    return {
      ...line,
      flowerType: deriveFlowerTypeFromProduct(product.name, product.color),
      productName: product.name,
      productColor: normalizeFlowerProductColor(product.color),
      unitCost: Number(product.unit_cost) || 0,
    };
  });
}
