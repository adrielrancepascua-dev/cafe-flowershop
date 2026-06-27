import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { listFlowerInventoryStock } from '../../../../services/flowers/inventory';
import type { FlowerProduct } from '../../shared/types/flower-product';
import type { FlowerBranchOption } from '../../shared/types/flower-inventory';
import type {
  CreateFlowerOrderInput,
  FlowerClaimMode,
  FlowerOrder,
  FlowerOrderStatus,
} from '../../shared/types/flower-order';
import {
  ORDER_STATUS_LABELS,
  PRICE_FORMATTER,
  fromDateInputValue,
  readFileAsDataUrl,
  toDateInputValue,
} from '../../shared/utils/flower-format';

type LineDraft = {
  rowId: string;
  productId: string;
  quantity: string;
};

type OrderFormProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: CreateFlowerOrderInput) => Promise<void>;
  onStatusChange?: (orderId: string, status: FlowerOrderStatus) => Promise<void>;
  branches: FlowerBranchOption[];
  products: FlowerProduct[];
  initialPickupIso?: string;
  existingOrder?: FlowerOrder | null;
  staffId: string;
  staffName: string;
  isSubmitting?: boolean;
};

function createLineDraft(): LineDraft {
  return {
    rowId: `${Date.now()}-${Math.random()}`,
    productId: '',
    quantity: '1',
  };
}

function emptyForm(
  pickupIso: string,
  staffId: string,
  staffName: string,
): CreateFlowerOrderInput {
  return {
    branch_id: '',
    receiver: '',
    customer_social: '',
    scheduled_for: pickupIso,
    claim_mode: 'pickup',
    wrapper_color: '',
    greeting_card: '',
    special_instructions: '',
    downpayment: 0,
    payment_reference: '',
    total_amount: 0,
    notes: '',
    photo_inspo_data_url: '',
    proof_dp_data_url: '',
    order_form_ss_data_url: '',
    created_by_id: staffId,
    created_by_name: staffName,
    items: [],
  };
}

export default function FlowerOrderFormModal({
  open,
  onClose,
  onSubmit,
  onStatusChange,
  branches,
  products,
  initialPickupIso,
  existingOrder,
  staffId,
  staffName,
  isSubmitting = false,
}: OrderFormProps) {
  const [form, setForm] = useState<CreateFlowerOrderInput>(() =>
    emptyForm(initialPickupIso ?? new Date().toISOString(), staffId, staffName),
  );
  const [lineDrafts, setLineDrafts] = useState<LineDraft[]>([createLineDraft()]);
  const [downpaymentDraft, setDownpaymentDraft] = useState('');
  const [totalAmountDraft, setTotalAmountDraft] = useState('');
  const [stockByProductId, setStockByProductId] = useState<Record<string, number>>({});
  const [statusDraft, setStatusDraft] = useState<FlowerOrderStatus>('not_started');
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!open) {
      return;
    }

    if (existingOrder) {
      setForm({
        branch_id: existingOrder.branch_id,
        receiver: existingOrder.receiver,
        customer_social: existingOrder.customer_social,
        scheduled_for: existingOrder.scheduled_for,
        claim_mode: existingOrder.claim_mode,
        wrapper_color: existingOrder.wrapper_color,
        greeting_card: existingOrder.greeting_card,
        special_instructions: existingOrder.special_instructions,
        downpayment: existingOrder.downpayment,
        payment_reference: existingOrder.payment_reference,
        total_amount: existingOrder.total_amount,
        notes: existingOrder.notes,
        photo_inspo_data_url: existingOrder.photo_inspo_data_url,
        proof_dp_data_url: existingOrder.proof_dp_data_url,
        order_form_ss_data_url: existingOrder.order_form_ss_data_url,
        created_by_id: existingOrder.created_by_id,
        created_by_name: existingOrder.created_by_name,
        items: existingOrder.items.map((item) => ({ ...item })),
      });
      setLineDrafts(
        existingOrder.items.length > 0
          ? existingOrder.items.map((item) => ({
              rowId: `${item.product_id}-${item.quantity}`,
              productId: item.product_id,
              quantity: String(item.quantity),
            }))
          : [createLineDraft()],
      );
      setDownpaymentDraft(String(existingOrder.downpayment));
      setTotalAmountDraft(String(existingOrder.total_amount));
      setStatusDraft(existingOrder.status);
      setStatusMessage('');
      return;
    }

    setForm(emptyForm(initialPickupIso ?? new Date().toISOString(), staffId, staffName));
    setLineDrafts([createLineDraft()]);
    setDownpaymentDraft('');
    setTotalAmountDraft('');
    setStatusDraft('not_started');
    setStatusMessage('');
    setErrorMessage('');
  }, [open, existingOrder, initialPickupIso, staffId, staffName]);

  useEffect(() => {
    if (!open || !form.branch_id) {
      setStockByProductId({});
      return;
    }

    void listFlowerInventoryStock({ branchId: form.branch_id }).then((rows) => {
      const nextStock: Record<string, number> = {};
      for (const row of rows) {
        nextStock[row.product_id] = row.on_hand;
      }
      setStockByProductId(nextStock);
    });
  }, [open, form.branch_id]);

  const creditByProductId = useMemo(() => {
    if (!existingOrder?.inventory_deducted || existingOrder.branch_id !== form.branch_id) {
      return {};
    }

    const credit: Record<string, number> = {};
    for (const item of existingOrder.items) {
      credit[item.product_id] = (credit[item.product_id] ?? 0) + item.quantity;
    }

    return credit;
  }, [existingOrder, form.branch_id]);

  function getMaxQuantityForLine(rowId: string, productId: string): number {
    if (!productId || !form.branch_id) {
      return 0;
    }

    const onHand = stockByProductId[productId] ?? 0;
    const credit = creditByProductId[productId] ?? 0;
    const usedElsewhere = lineDrafts
      .filter((row) => row.rowId !== rowId && row.productId === productId)
      .reduce((sum, row) => sum + (Number(row.quantity) || 0), 0);

    return Math.max(0, onHand + credit - usedElsewhere);
  }

  function clampQuantity(rowId: string, productId: string, rawValue: string): string {
    const digits = rawValue.replace(/[^\d]/g, '');
    if (!digits) {
      return '';
    }

    const max = getMaxQuantityForLine(rowId, productId);
    if (max <= 0) {
      return '0';
    }

    return String(Math.min(max, Math.max(1, Number(digits))));
  }

  function updateLineProduct(rowId: string, productId: string) {
    setLineDrafts((rows) =>
      rows.map((entry) => {
        if (entry.rowId !== rowId) {
          return entry;
        }

        const nextQuantity = entry.quantity
          ? clampQuantity(rowId, productId, entry.quantity)
          : productId
            ? '1'
            : '';

        return { ...entry, productId, quantity: nextQuantity };
      }),
    );
  }

  function updateLineQuantity(rowId: string, productId: string, rawValue: string) {
    setLineDrafts((rows) =>
      rows.map((entry) =>
        entry.rowId === rowId
          ? { ...entry, quantity: clampQuantity(rowId, productId, rawValue) }
          : entry,
      ),
    );
  }

  useEffect(() => {
    if (!open || !form.branch_id) {
      return;
    }

    setLineDrafts((rows) =>
      rows.map((row) => {
        if (!row.productId) {
          return row;
        }

        const onHand = stockByProductId[row.productId] ?? 0;
        const credit = creditByProductId[row.productId] ?? 0;
        const usedElsewhere = rows
          .filter((entry) => entry.rowId !== row.rowId && entry.productId === row.productId)
          .reduce((sum, entry) => sum + (Number(entry.quantity) || 0), 0);
        const max = Math.max(0, onHand + credit - usedElsewhere);

        if (max <= 0) {
          return { ...row, quantity: '0' };
        }

        const current = Number(row.quantity) || 0;
        if (current <= max) {
          return row;
        }

        return { ...row, quantity: String(max) };
      }),
    );
  }, [stockByProductId, creditByProductId, form.branch_id, open]);

  const balance = useMemo(() => {
    const total = totalAmountDraft === '' ? 0 : Number(totalAmountDraft);
    const downpayment = downpaymentDraft === '' ? 0 : Number(downpaymentDraft);
    if (!Number.isFinite(total) || !Number.isFinite(downpayment)) {
      return 0;
    }

    return Math.max(0, total - downpayment);
  }, [totalAmountDraft, downpaymentDraft]);

  const activeProducts = useMemo(
    () => products.filter((product) => product.is_active),
    [products],
  );

  if (!open) {
    return null;
  }

  function updateField<K extends keyof CreateFlowerOrderInput>(
    key: K,
    value: CreateFlowerOrderInput[K],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleFileChange(
    key: 'photo_inspo_data_url' | 'proof_dp_data_url' | 'order_form_ss_data_url',
    file: File | null,
  ) {
    if (!file) {
      updateField(key, '');
      return;
    }

    const dataUrl = await readFileAsDataUrl(file);
    updateField(key, dataUrl);
  }

  function validateForm(): CreateFlowerOrderInput | null {
    const items = lineDrafts
      .map((row) => {
        const product = activeProducts.find((entry) => entry.id === row.productId);
        const quantity = Number(row.quantity);

        if (!product || !Number.isFinite(quantity) || quantity <= 0) {
          return null;
        }

        return {
          product_id: product.id,
          item_name: product.name,
          quantity,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    if (!form.branch_id) {
      setErrorMessage('Branch is required.');
      return null;
    }

    if (!form.receiver.trim()) {
      setErrorMessage('Receiver is required.');
      return null;
    }

    if (!form.customer_social.trim()) {
      setErrorMessage('FB/IG name is required.');
      return null;
    }

    if (!form.scheduled_for) {
      setErrorMessage('Pickup date and time is required.');
      return null;
    }

    if (items.length === 0) {
      setErrorMessage('Add at least one flower type with quantity.');
      return null;
    }

    const neededByProduct = new Map<string, { name: string; qty: number }>();
    for (const item of items) {
      const existingQty = neededByProduct.get(item.product_id);
      if (existingQty) {
        existingQty.qty += item.quantity;
      } else {
        neededByProduct.set(item.product_id, { name: item.item_name, qty: item.quantity });
      }
    }

    for (const [productId, { name, qty }] of neededByProduct) {
      const available = (stockByProductId[productId] ?? 0) + (creditByProductId[productId] ?? 0);
      if (qty > available) {
        setErrorMessage(
          `Insufficient stock for ${name}. Available: ${available}, requested: ${qty}.`,
        );
        return null;
      }
    }

    if (items.some((item) => item.quantity <= 0)) {
      setErrorMessage('Each flower line must have at least 1 in stock.');
      return null;
    }

    const requiredTextFields: Array<[string, string]> = [
      ['Wrapper color', form.wrapper_color],
      ['Greeting card', form.greeting_card],
      ['Instructions', form.special_instructions],
      ['Reference #', form.payment_reference],
      ['Note', form.notes],
    ];

    for (const [label, value] of requiredTextFields) {
      if (!value.trim()) {
        setErrorMessage(`${label} is required.`);
        return null;
      }
    }

    if (!form.photo_inspo_data_url || !form.proof_dp_data_url || !form.order_form_ss_data_url) {
      setErrorMessage('All photo uploads are required.');
      return null;
    }

    if (downpaymentDraft.trim() === '') {
      setErrorMessage('Downpayment is required (use 0 if none).');
      return null;
    }

    const downpayment = Number(downpaymentDraft);
    const total_amount = Number(totalAmountDraft);

    if (!Number.isFinite(total_amount) || total_amount <= 0) {
      setErrorMessage('Total amount must be greater than 0.');
      return null;
    }

    if (!Number.isFinite(downpayment) || downpayment < 0) {
      setErrorMessage('Downpayment must be 0 or greater.');
      return null;
    }

    if (downpayment > total_amount) {
      setErrorMessage('Downpayment cannot exceed total amount.');
      return null;
    }

    setErrorMessage('');
    return { ...form, downpayment, total_amount, items };
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const payload = validateForm();
    if (!payload) {
      return;
    }

    try {
      await onSubmit(payload);
      setErrorMessage('');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to save order.');
    }
  }

  async function handleStatusSelect(nextStatus: FlowerOrderStatus) {
    if (!existingOrder || !onStatusChange) {
      return;
    }

    setStatusDraft(nextStatus);
    setStatusMessage('');

    try {
      await onStatusChange(existingOrder.id, nextStatus);
    } catch (error) {
      setStatusDraft(existingOrder.status);
      setStatusMessage(
        error instanceof Error ? error.message : 'Could not update order status.',
      );
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-brand-dark/40 p-0 sm:items-center sm:p-4">
      <div className="flower-card flex h-[100dvh] max-h-[100dvh] w-full max-w-3xl flex-col overflow-hidden sm:h-auto sm:max-h-[90vh]">
        <div className="flex shrink-0 items-center justify-between border-b border-brand-muted/40 px-4 py-3 sm:px-6">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-accent">
              {existingOrder ? 'Edit order' : 'New order'}
            </p>
            <h2 className="font-serif text-lg font-semibold text-brand-dark">
              Papers &amp; Petals — Daily Order
            </h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 hover:bg-brand-beige/60">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flower-scroll min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="block text-sm font-medium text-brand-brown md:col-span-2">
              Date &amp; time of pick up
              <input
                type="datetime-local"
                value={toDateInputValue(form.scheduled_for)}
                onChange={(event) => updateField('scheduled_for', fromDateInputValue(event.target.value))}
                className="flower-input mt-1.5"
                required
              />
            </label>

            {existingOrder && onStatusChange ? (
              <label className="block text-sm font-medium text-brand-brown md:col-span-2">
                Status
                <select
                  value={statusDraft}
                  onChange={(event) =>
                    void handleStatusSelect(event.target.value as FlowerOrderStatus)
                  }
                  className="flower-input mt-1.5"
                >
                  {Object.entries(ORDER_STATUS_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                {statusMessage ? (
                  <span className="mt-1 block text-xs text-red-700">{statusMessage}</span>
                ) : null}
              </label>
            ) : null}

            <label className="block text-sm font-medium text-brand-brown">
              Receiver
              <input
                type="text"
                value={form.receiver}
                onChange={(event) => updateField('receiver', event.target.value)}
                className="flower-input mt-1.5"
                required
              />
            </label>

            <label className="block text-sm font-medium text-brand-brown">
              FB/IG Name
              <input
                type="text"
                value={form.customer_social}
                onChange={(event) => updateField('customer_social', event.target.value)}
                className="flower-input mt-1.5"
                required
              />
            </label>

            <label className="block text-sm font-medium text-brand-brown">
              Branch
              <select
                value={form.branch_id}
                onChange={(event) => updateField('branch_id', event.target.value)}
                className="flower-input mt-1.5"
                required
              >
                <option value="">Select branch</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm font-medium text-brand-brown">
              Mode of claiming
              <select
                value={form.claim_mode}
                onChange={(event) => updateField('claim_mode', event.target.value as FlowerClaimMode)}
                className="flower-input mt-1.5"
                required
              >
                <option value="pickup">Pick up</option>
                <option value="delivery">Delivery</option>
              </select>
            </label>

            <label className="block text-sm font-medium text-brand-brown">
              Wrapper color
              <input
                type="text"
                value={form.wrapper_color}
                onChange={(event) => updateField('wrapper_color', event.target.value)}
                className="flower-input mt-1.5"
                required
              />
            </label>

            <label className="block text-sm font-medium text-brand-brown">
              Greeting card
              <input
                type="text"
                value={form.greeting_card}
                onChange={(event) => updateField('greeting_card', event.target.value)}
                className="flower-input mt-1.5"
                required
              />
            </label>

            <label className="block text-sm font-medium text-brand-brown md:col-span-2">
              Instructions
              <input
                type="text"
                value={form.special_instructions}
                onChange={(event) => updateField('special_instructions', event.target.value)}
                className="flower-input mt-1.5"
                required
              />
            </label>
          </div>

          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-brand-dark">Flowers &amp; fillers (type + qty)</h3>
              <button
                type="button"
                className="text-xs font-semibold text-brand-brown underline"
                onClick={() => setLineDrafts((rows) => [...rows, createLineDraft()])}
              >
                Add row
              </button>
            </div>

            <div className="space-y-2">
              {lineDrafts.map((row) => {
                const maxQty = row.productId ? getMaxQuantityForLine(row.rowId, row.productId) : 0;

                return (
                <div key={row.rowId}>
                  <div className="grid grid-cols-[1fr_100px_auto] gap-2">
                  <select
                    value={row.productId}
                    onChange={(event) => updateLineProduct(row.rowId, event.target.value)}
                    className="flower-input"
                    required
                    disabled={!form.branch_id}
                  >
                    <option value="">Flower type</option>
                    {activeProducts.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name}
                        {form.branch_id
                          ? ` (${(stockByProductId[product.id] ?? 0) + (creditByProductId[product.id] ?? 0)} avail.)`
                          : ''}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={row.quantity}
                    onChange={(event) =>
                      updateLineQuantity(row.rowId, row.productId, event.target.value)
                    }
                    className="flower-input"
                    required
                    disabled={!row.productId || maxQty <= 0}
                    placeholder="Qty"
                  />
                  <button
                    type="button"
                    className="flower-btn-secondary px-3"
                    onClick={() =>
                      setLineDrafts((rows) =>
                        rows.length === 1 ? rows : rows.filter((entry) => entry.rowId !== row.rowId),
                      )
                    }
                  >
                    Remove
                  </button>
                  </div>
                  {row.productId ? (
                    <p className="mt-1 text-xs text-brand-brown/70">
                      Max for this line: {maxQty}
                      {maxQty <= 0 ? ' — out of stock at this branch' : ''}
                    </p>
                  ) : null}
                </div>
              );
              })}
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
            <label className="block text-sm font-medium text-brand-brown">
              Downpayment
              <input
                type="text"
                inputMode="decimal"
                value={downpaymentDraft}
                onChange={(event) => setDownpaymentDraft(event.target.value.replace(/[^\d.]/g, ''))}
                placeholder="0.00"
                className="flower-input mt-1.5"
                required
              />
            </label>
            <label className="block text-sm font-medium text-brand-brown">
              Total amount
              <input
                type="text"
                inputMode="decimal"
                value={totalAmountDraft}
                onChange={(event) => setTotalAmountDraft(event.target.value.replace(/[^\d.]/g, ''))}
                placeholder="0.00"
                className="flower-input mt-1.5"
                required
              />
            </label>
            <label className="block text-sm font-medium text-brand-brown">
              Balance
              <input
                type="text"
                value={PRICE_FORMATTER.format(balance)}
                readOnly
                className="flower-input mt-1.5 bg-brand-beige/30"
              />
            </label>
          </div>

          <label className="mt-3 block text-sm font-medium text-brand-brown">
            Reference #
            <input
              type="text"
              value={form.payment_reference}
              onChange={(event) => updateField('payment_reference', event.target.value)}
              className="flower-input mt-1.5"
              required
            />
          </label>

          <label className="mt-3 block text-sm font-medium text-brand-brown">
            Note
            <textarea
              value={form.notes}
              onChange={(event) => updateField('notes', event.target.value)}
              className="flower-input mt-1.5 min-h-[72px]"
              required
            />
          </label>

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
            <label className="block text-sm font-medium text-brand-brown">
              Photo of order / inspo
              <input
                type="file"
                accept="image/*"
                onChange={(event) =>
                  void handleFileChange('photo_inspo_data_url', event.target.files?.[0] ?? null)
                }
                className="mt-1.5 block w-full text-xs"
                required={!form.photo_inspo_data_url}
              />
            </label>
            <label className="block text-sm font-medium text-brand-brown">
              Proof of DP
              <input
                type="file"
                accept="image/*"
                onChange={(event) =>
                  void handleFileChange('proof_dp_data_url', event.target.files?.[0] ?? null)
                }
                className="mt-1.5 block w-full text-xs"
                required={!form.proof_dp_data_url}
              />
            </label>
            <label className="block text-sm font-medium text-brand-brown">
              SS of order form
              <input
                type="file"
                accept="image/*"
                onChange={(event) =>
                  void handleFileChange('order_form_ss_data_url', event.target.files?.[0] ?? null)
                }
                className="mt-1.5 block w-full text-xs"
                required={!form.order_form_ss_data_url}
              />
            </label>
          </div>

          <p className="mt-3 text-xs text-brand-brown/70">
            Input by: {form.created_by_name}
          </p>

          {errorMessage ? (
            <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {errorMessage}
            </p>
          ) : null}
        </form>

        <div className="flex shrink-0 gap-2 border-t border-brand-muted/40 bg-white px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
          <button type="button" onClick={onClose} className="flower-btn-secondary flex-1">
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            onClick={handleSubmit}
            className="flower-btn-primary flex-1"
          >
            {isSubmitting ? 'Saving...' : existingOrder ? 'Update order' : 'Save order'}
          </button>
        </div>
      </div>
    </div>
  );
}
