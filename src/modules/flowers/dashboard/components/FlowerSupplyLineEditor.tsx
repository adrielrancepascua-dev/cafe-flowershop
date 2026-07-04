import { Plus, Trash2 } from 'lucide-react';
import type { FlowerProduct } from '../../shared/types/flower-product';
import { normalizeFlowerProductColor } from '../../shared/utils/flower-product-colors';
import { groupFlowerProductsByType as groupSupplyProducts } from '../../shared/utils/flower-supply-transfer';

export type FlowerSupplyLineDraft = {
  id: string;
  flowerType: string;
  productId: string;
  quantity: string;
};

type FlowerSupplyLineEditorProps = {
  products: FlowerProduct[];
  lines: FlowerSupplyLineDraft[];
  onChange: (lines: FlowerSupplyLineDraft[]) => void;
  disabled?: boolean;
};

function createEmptyLine(): FlowerSupplyLineDraft {
  return {
    id: `line-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    flowerType: '',
    productId: '',
    quantity: '1',
  };
}

export default function FlowerSupplyLineEditor({
  products,
  lines,
  onChange,
  disabled = false,
}: FlowerSupplyLineEditorProps) {
  const sections = groupSupplyProducts(products);

  function updateLine(lineId: string, patch: Partial<FlowerSupplyLineDraft>) {
    onChange(lines.map((line) => (line.id === lineId ? { ...line, ...patch } : line)));
  }

  function removeLine(lineId: string) {
    onChange(lines.filter((line) => line.id !== lineId));
  }

  function colorOptionsForType(flowerType: string): FlowerProduct[] {
    return sections.find((section) => section.flowerType === flowerType)?.products ?? [];
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-brand-dark">Flowers</p>
        <button
          type="button"
          disabled={disabled || sections.length === 0}
          onClick={() => onChange([...lines, createEmptyLine()])}
          className="flower-btn-secondary inline-flex gap-1.5 px-3 py-1.5 text-xs"
        >
          <Plus className="h-3.5 w-3.5" />
          Add flower line
        </button>
      </div>

      {sections.length === 0 ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          No active flower products found. Add flowers on the Products page first.
        </p>
      ) : null}

      {lines.length === 0 ? (
        <p className="text-sm text-brand-brown/60">Add at least one flower line with color and quantity.</p>
      ) : null}

      {lines.map((line, index) => {
        const colorOptions = colorOptionsForType(line.flowerType);

        return (
          <div
            key={line.id}
            className="grid grid-cols-1 gap-3 rounded-xl border border-brand-muted/35 bg-white p-3 sm:grid-cols-[1fr_1fr_100px_auto]"
          >
            <label className="block text-xs font-medium text-brand-brown">
              Flower type
              <select
                value={line.flowerType}
                disabled={disabled}
                onChange={(event) => {
                  updateLine(line.id, {
                    flowerType: event.target.value,
                    productId: '',
                  });
                }}
                className="flower-input mt-1"
                required
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
                value={line.productId}
                disabled={disabled || !line.flowerType}
                onChange={(event) => updateLine(line.id, { productId: event.target.value })}
                className="flower-input mt-1"
                required
              >
                <option value="">
                  {!line.flowerType ? 'Select type first' : 'Select color'}
                </option>
                {colorOptions.map((product) => (
                  <option key={product.id} value={product.id}>
                    {normalizeFlowerProductColor(product.color)} · ₱{product.unit_cost} cost
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-xs font-medium text-brand-brown">
              Qty
              <input
                type="text"
                inputMode="numeric"
                value={line.quantity}
                disabled={disabled}
                onChange={(event) => {
                  const digits = event.target.value.replace(/[^\d]/g, '');
                  updateLine(line.id, { quantity: digits || '' });
                }}
                className="flower-input mt-1"
                required
              />
            </label>

            <div className="flex items-end justify-end">
              <button
                type="button"
                disabled={disabled || lines.length <= 1}
                onClick={() => removeLine(line.id)}
                className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-2 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-40"
                aria-label={`Remove flower line ${index + 1}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Remove
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function createDefaultSupplyLines(): FlowerSupplyLineDraft[] {
  return [createEmptyLine()];
}

export function mapSupplyLinesToInput(lines: FlowerSupplyLineDraft[]) {
  return lines
    .filter((line) => line.productId && Number(line.quantity) > 0)
    .map((line) => ({
      productId: line.productId,
      quantity: Number(line.quantity),
    }));
}
