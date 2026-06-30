import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { listFlowerInventoryStock } from '../../../../services/flowers/inventory';
import type { FlowerProduct } from '../../shared/types/flower-product';
import type { FlowerBranchOption } from '../../shared/types/flower-inventory';
import {
  FLOWER_ORDER_COMPLETE_STATUSES,
  FLOWER_ORDER_STATUS_SEQUENCE,
  normalizeOrderStatusForPicker,
  type CreateFlowerOrderInput,
  type FlowerClaimMode,
  type FlowerOrder,
  type FlowerOrderStatus,
} from '../../shared/types/flower-order';
import {
  ORDER_STATUS_LABELS,
  PRICE_FORMATTER,
  formatPickupDateTimeLocal,
  fromDateInputValue,
  readFileAsDataUrl,
  toDateInputValue,
} from '../../shared/utils/flower-format';
import {
  getOrderPrepDeadlineInfo,
  isReadyPhotoRequiredForStatusChange,
  urgencyBadgeClassName,
  urgencyPanelClassName,
} from '../../shared/utils/flower-order-deadlines';
import OrderAttachmentPreview from './OrderAttachmentPreview';

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
  onReadyPhotoSubmit?: (orderId: string, readyPhotoDataUrl: string) => Promise<void>;
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

function isCompleteOrderStatus(status: FlowerOrderStatus): boolean {
  return FLOWER_ORDER_COMPLETE_STATUSES.includes(status);
}

function orderStatusButtonClassName({
  status,
  isSelected,
  isCurrentStatus,
}: {
  status: FlowerOrderStatus;
  isSelected: boolean;
  isCurrentStatus: boolean;
}): string {
  const isCancelled = status === 'cancelled';
  const isComplete = isCompleteOrderStatus(status);

  if (isSelected) {
    if (isCancelled) {
      return 'border-red-700 bg-red-700 text-white';
    }

    if (isComplete) {
      return 'border-emerald-700 bg-emerald-700 text-white shadow-sm';
    }

    return 'border-brand-dark bg-brand-dark text-white';
  }

  if (isCurrentStatus) {
    if (isComplete) {
      return 'border-emerald-600 bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200';
    }

    if (isCancelled) {
      return 'border-red-300 bg-red-50 text-red-900';
    }

    return 'border-brand-dark/30 bg-brand-beige text-brand-dark';
  }

  if (isComplete) {
    return 'border-emerald-300 bg-emerald-50/70 text-emerald-900 hover:border-emerald-500';
  }

  if (isCancelled) {
    return 'border-red-200 bg-white text-red-800 hover:border-red-400';
  }

  return 'border-brand-muted/50 bg-white text-brand-brown hover:border-brand-dark/40';
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
    ready_photo_data_url: '',
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
  onReadyPhotoSubmit,
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
  const [stockLoading, setStockLoading] = useState(false);
  const [statusDraft, setStatusDraft] = useState<FlowerOrderStatus>('not_started');
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isEditMode, setIsEditMode] = useState(false);
  const [deadlineNowMs, setDeadlineNowMs] = useState(() => Date.now());
  const [isSavingReadyPhoto, setIsSavingReadyPhoto] = useState(false);
  const [readyPhotoMessage, setReadyPhotoMessage] = useState('');
  const readyPhotoInputRef = useRef<HTMLInputElement>(null);

  const isViewMode = Boolean(existingOrder && !isEditMode);
  const readOnlyFieldClass = isViewMode ? 'bg-brand-beige/40 text-brand-brown/90' : '';
  const displayOrderStatus = existingOrder
    ? normalizeOrderStatusForPicker(existingOrder.status, existingOrder.claim_mode)
    : 'not_started';
  const hasPendingReadyPhoto = Boolean(
    existingOrder && form.ready_photo_data_url !== existingOrder.ready_photo_data_url,
  );

  function loadExistingOrderIntoForm(order: FlowerOrder) {
    setForm({
      branch_id: order.branch_id,
      receiver: order.receiver,
      customer_social: order.customer_social,
      scheduled_for: order.scheduled_for,
      claim_mode: order.claim_mode,
      wrapper_color: order.wrapper_color,
      greeting_card: order.greeting_card,
      special_instructions: order.special_instructions,
      downpayment: order.downpayment,
      payment_reference: order.payment_reference,
      total_amount: order.total_amount,
      notes: order.notes,
      photo_inspo_data_url: order.photo_inspo_data_url,
      proof_dp_data_url: order.proof_dp_data_url,
      order_form_ss_data_url: order.order_form_ss_data_url,
      ready_photo_data_url: order.ready_photo_data_url,
      created_by_id: order.created_by_id,
      created_by_name: order.created_by_name,
      items: order.items.map((item) => ({ ...item })),
    });
    setLineDrafts(
      order.items.length > 0
        ? order.items.map((item) => ({
            rowId: `${item.product_id}-${item.quantity}`,
            productId: item.product_id,
            quantity: String(item.quantity),
          }))
        : [createLineDraft()],
    );
    setDownpaymentDraft(String(order.downpayment));
    setTotalAmountDraft(String(order.total_amount));
    setStatusDraft(normalizeOrderStatusForPicker(order.status, order.claim_mode));
    setStatusMessage('');
    setErrorMessage('');
    setReadyPhotoMessage('');
  }

  useEffect(() => {
    if (!open) {
      setIsEditMode(false);
      return;
    }

    if (existingOrder) {
      loadExistingOrderIntoForm(existingOrder);
      setIsEditMode(false);
      return;
    }

    setIsEditMode(true);
    setForm(emptyForm(initialPickupIso ?? new Date().toISOString(), staffId, staffName));
    setLineDrafts([createLineDraft()]);
    setDownpaymentDraft('');
    setTotalAmountDraft('');
    setStatusDraft('not_started');
    setStatusMessage('');
    setErrorMessage('');
  }, [open, existingOrder, initialPickupIso, staffId, staffName]);

  useEffect(() => {
    if (!open || !existingOrder || existingOrder.ready_photo_data_url) {
      return;
    }

    setDeadlineNowMs(Date.now());
    const intervalId = window.setInterval(() => {
      setDeadlineNowMs(Date.now());
    }, 60_000);

    return () => window.clearInterval(intervalId);
  }, [open, existingOrder]);

  const prepDeadline = existingOrder
    ? getOrderPrepDeadlineInfo(
        {
          ...existingOrder,
          ready_photo_data_url: form.ready_photo_data_url,
        },
        deadlineNowMs,
      )
    : null;

  useEffect(() => {
    if (!open || !form.branch_id || isViewMode) {
      setStockByProductId({});
      setStockLoading(false);
      return;
    }

    setStockLoading(true);
    void listFlowerInventoryStock({ branchId: form.branch_id })
      .then((rows) => {
        const nextStock: Record<string, number> = {};
        for (const row of rows) {
          nextStock[row.product_id] = row.on_hand;
        }
        setStockByProductId(nextStock);
      })
      .finally(() => {
        setStockLoading(false);
      });
  }, [open, form.branch_id, isViewMode]);

  const creditByProductId = useMemo(() => {
    if (!existingOrder || existingOrder.branch_id !== form.branch_id) {
      return {};
    }

    const credit: Record<string, number> = {};
    for (const item of existingOrder.items) {
      credit[item.product_id] = (credit[item.product_id] ?? 0) + item.quantity;
    }

    return credit;
  }, [existingOrder, form.branch_id]);

  function getMaxQuantityForLine(rowId: string, productId: string): number {
    if (!productId) {
      return 0;
    }

    if (!form.branch_id || stockLoading) {
      return 9999;
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
    if (!open || !form.branch_id || stockLoading) {
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
          if (existingOrder && row.quantity && Number(row.quantity) > 0) {
            return row;
          }

          return { ...row, quantity: '0' };
        }

        const current = Number(row.quantity) || 0;
        if (current <= max) {
          return row;
        }

        return { ...row, quantity: String(max) };
      }),
    );
  }, [stockByProductId, creditByProductId, form.branch_id, open, stockLoading, existingOrder]);

  const balance = useMemo(() => {
    const total = totalAmountDraft === '' ? 0 : Number(totalAmountDraft);
    const downpayment = downpaymentDraft === '' ? 0 : Number(downpaymentDraft);
    if (!Number.isFinite(total) || !Number.isFinite(downpayment)) {
      return 0;
    }

    return Math.max(0, total - downpayment);
  }, [totalAmountDraft, downpaymentDraft]);

  const activeProducts = useMemo(
    () =>
      products
        .filter((product) => product.is_active)
        .sort((left, right) => left.name.localeCompare(right.name)),
    [products],
  );

  const requiresDownpaymentProof = useMemo(() => {
    if (downpaymentDraft.trim() === '') {
      return false;
    }

    const downpayment = Number(downpaymentDraft);
    return Number.isFinite(downpayment) && downpayment > 0;
  }, [downpaymentDraft]);

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
    key:
      | 'photo_inspo_data_url'
      | 'proof_dp_data_url'
      | 'order_form_ss_data_url'
      | 'ready_photo_data_url',
    file: File | null,
  ) {
    if (!file) {
      updateField(key, '');
      return;
    }

    const dataUrl = await readFileAsDataUrl(file);
    updateField(key, dataUrl);
    if (key === 'ready_photo_data_url') {
      setReadyPhotoMessage('');
    }
  }

  async function handleSaveReadyPhoto() {
    if (!existingOrder || !onReadyPhotoSubmit) {
      return;
    }

    if (!form.ready_photo_data_url) {
      setReadyPhotoMessage('Choose a finished order photo first.');
      return;
    }

    if (form.ready_photo_data_url === existingOrder.ready_photo_data_url) {
      setReadyPhotoMessage('Photo is already saved.');
      return;
    }

    setIsSavingReadyPhoto(true);
    setReadyPhotoMessage('');

    try {
      await onReadyPhotoSubmit(existingOrder.id, form.ready_photo_data_url);
      setReadyPhotoMessage('Finished order photo saved.');
    } catch (error) {
      setReadyPhotoMessage(
        error instanceof Error ? error.message : 'Could not save finished order photo.',
      );
    } finally {
      setIsSavingReadyPhoto(false);
    }
  }

  function handleCancelReadyPhotoSelection() {
    if (!existingOrder) {
      return;
    }

    updateField('ready_photo_data_url', existingOrder.ready_photo_data_url);
    setReadyPhotoMessage('');
    if (readyPhotoInputRef.current) {
      readyPhotoInputRef.current.value = '';
    }
  }

  function handleChooseReadyPhotoClick() {
    readyPhotoInputRef.current?.click();
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

    if (stockLoading) {
      setErrorMessage('Branch stock is still loading. Please wait a moment.');
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

    const requiresProof = downpayment > 0;

    const requiredTextFields: Array<[string, string]> = [
      ['Wrapper color', form.wrapper_color],
      ['Greeting card', form.greeting_card],
      ['Instructions', form.special_instructions],
      ['Note', form.notes],
    ];

    if (requiresProof) {
      requiredTextFields.push(['Reference #', form.payment_reference]);
    }

    for (const [label, value] of requiredTextFields) {
      if (!value.trim()) {
        setErrorMessage(`${label} is required.`);
        return null;
      }
    }

    if (!form.photo_inspo_data_url || !form.order_form_ss_data_url) {
      setErrorMessage('Photo of order / inspo and SS of order form are required.');
      return null;
    }

    if (requiresProof && !form.proof_dp_data_url) {
      setErrorMessage('Proof of DP is required when downpayment is greater than 0.');
      return null;
    }

    setErrorMessage('');
    return { ...form, downpayment, total_amount, items };
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (isViewMode) {
      return;
    }

    const payload = validateForm();
    if (!payload) {
      return;
    }

    try {
      await onSubmit(payload);
      setErrorMessage('');
      if (existingOrder) {
        setIsEditMode(false);
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to save order.');
    }
  }

  async function handleStatusSelect(nextStatus: FlowerOrderStatus) {
    if (!existingOrder || !onStatusChange) {
      return;
    }

    if (
      isReadyPhotoRequiredForStatusChange(
        { ...existingOrder, ready_photo_data_url: form.ready_photo_data_url },
        nextStatus,
        deadlineNowMs,
      )
    ) {
      setStatusDraft(normalizeOrderStatusForPicker(existingOrder.status, existingOrder.claim_mode));
      setStatusMessage(
        'Submit the finished order photo before updating status — due 30 min before pick up or 1 hr before delivery.',
      );
      return;
    }

    setStatusDraft(nextStatus);
    setStatusMessage('');

    try {
      await onStatusChange(existingOrder.id, nextStatus);
    } catch (error) {
      setStatusDraft(normalizeOrderStatusForPicker(existingOrder.status, existingOrder.claim_mode));
      setStatusMessage(
        error instanceof Error ? error.message : 'Could not update order status.',
      );
    }
  }

  function handleCancelEdit() {
    if (existingOrder) {
      loadExistingOrderIntoForm(existingOrder);
      setIsEditMode(false);
      return;
    }

    onClose();
  }

  const branchLabel =
    branches.find((branch) => branch.id === form.branch_id)?.name ?? form.branch_id;
  const claimModeLabel = form.claim_mode === 'delivery' ? 'Delivery' : 'Pick up';

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-brand-dark/40 p-0 sm:items-center sm:p-4">
      <div className="flower-card flex h-[100dvh] max-h-[100dvh] w-full max-w-3xl min-h-0 flex-col sm:h-auto sm:max-h-[90vh]">
        <div className="flex shrink-0 items-center justify-between border-b border-brand-muted/40 px-4 py-3 sm:px-6">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-accent">
              {existingOrder ? (isViewMode ? 'View order' : 'Edit order') : 'New order'}
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
          {isViewMode ? (
            <p className="mb-4 rounded-xl border border-brand-muted/40 bg-brand-cream/30 px-3 py-2 text-sm text-brand-brown/80">
              Viewing only — tap <span className="font-semibold">Edit order</span> below to change
              details.
            </p>
          ) : null}

          {existingOrder && onStatusChange ? (
            <div className="mb-4 rounded-xl border border-brand-muted/40 bg-white p-3">
              <p className="text-sm font-semibold text-brand-dark">Order status</p>
              <div className="mt-2 overflow-x-auto pb-1">
                <div
                  className="flex min-w-max items-center gap-1 sm:gap-1.5"
                  role="listbox"
                  aria-label="Order status"
                >
                  {FLOWER_ORDER_STATUS_SEQUENCE.map((status, index) => {
                    const isSelected = statusDraft === status;
                    const isCurrentStatus = displayOrderStatus === status;
                    const isCancelled = status === 'cancelled';

                    return (
                      <Fragment key={status}>
                        {isCancelled ? (
                          <span
                            className="mx-1 h-8 w-px shrink-0 bg-brand-muted/50"
                            aria-hidden="true"
                          />
                        ) : index > 0 ? (
                          <span
                            className="shrink-0 px-0.5 text-sm text-brand-muted/50"
                            aria-hidden="true"
                          >
                            →
                          </span>
                        ) : null}
                        <button
                          type="button"
                          role="option"
                          aria-selected={isSelected}
                          onClick={() => {
                            if (isViewMode) {
                              setStatusDraft(status);
                              setStatusMessage('');
                              return;
                            }

                            void handleStatusSelect(status);
                          }}
                          className={`shrink-0 rounded-lg border px-2.5 py-2 text-xs font-semibold transition sm:px-3 sm:text-sm ${orderStatusButtonClassName(
                            {
                              status,
                              isSelected,
                              isCurrentStatus,
                            },
                          )}`}
                        >
                          {ORDER_STATUS_LABELS[status]}
                        </button>
                      </Fragment>
                    );
                  })}
                </div>
              </div>
              {isViewMode ? (
                <button
                  type="button"
                  className="flower-btn-secondary mt-3 w-full px-4 py-2.5 text-sm sm:w-auto"
                  disabled={statusDraft === displayOrderStatus}
                  onClick={() => void handleStatusSelect(statusDraft)}
                >
                  Apply status
                </button>
              ) : null}
              {statusMessage ? (
                <span className="mt-2 block text-xs text-red-700">{statusMessage}</span>
              ) : null}
            </div>
          ) : null}

          {prepDeadline && prepDeadline.urgency !== 'none' ? (
            <div
              className={`mb-4 rounded-xl border px-3 py-2.5 ${urgencyPanelClassName(prepDeadline.urgency)}`}
            >
              <p className="text-sm font-semibold text-red-950">Photo deadline</p>
              <p className="mt-1 text-sm text-brand-brown/85">{prepDeadline.detail}</p>
              <span
                className={`mt-2 inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${urgencyBadgeClassName(prepDeadline.urgency)}`}
              >
                {prepDeadline.message}
              </span>
            </div>
          ) : null}

          {existingOrder && onReadyPhotoSubmit ? (
            <div className="mb-4 rounded-xl border border-brand-muted/40 bg-white p-3">
              <p className="text-sm font-semibold text-brand-dark">Finished order photo</p>
              <p className="mt-1 text-xs text-brand-brown/75">
                Upload the completed arrangement — required 30 min before pick up or 1 hr before
                delivery.
              </p>
              <input
                ref={readyPhotoInputRef}
                type="file"
                accept="image/*"
                onChange={(event) =>
                  void handleFileChange('ready_photo_data_url', event.target.files?.[0] ?? null)
                }
                className="sr-only"
                aria-hidden
                tabIndex={-1}
              />
              <button
                type="button"
                onClick={handleChooseReadyPhotoClick}
                className={`mt-3 w-full rounded-xl border-2 border-dashed px-4 py-4 text-center transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent ${
                  hasPendingReadyPhoto
                    ? 'border-brand-accent bg-brand-accent/10 ring-2 ring-brand-accent/25'
                    : 'border-brand-accent bg-brand-cream/35 hover:border-brand-brown hover:bg-brand-beige/50'
                }`}
              >
                <span className="block text-sm font-semibold text-brand-dark">
                  {form.ready_photo_data_url ? 'Choose a different photo' : 'Choose finished order photo'}
                </span>
                <span className="mt-1 block text-xs text-brand-brown/65">Tap to select from your device</span>
              </button>
              <OrderAttachmentPreview
                label="Current finished order photo"
                value={form.ready_photo_data_url}
              />
              {hasPendingReadyPhoto ? (
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    className="flower-btn-primary w-full py-2 text-sm sm:w-auto"
                    disabled={isSavingReadyPhoto}
                    onClick={() => void handleSaveReadyPhoto()}
                  >
                    {isSavingReadyPhoto ? 'Saving photo...' : 'Save finished photo'}
                  </button>
                  <button
                    type="button"
                    className="flower-btn-secondary w-full py-2 text-sm sm:w-auto"
                    disabled={isSavingReadyPhoto}
                    onClick={handleCancelReadyPhotoSelection}
                  >
                    Cancel
                  </button>
                </div>
              ) : form.ready_photo_data_url ? (
                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                  <button
                    type="button"
                    className="flower-btn-secondary w-full py-2 text-sm sm:w-auto"
                    onClick={handleChooseReadyPhotoClick}
                  >
                    Replace photo
                  </button>
                  <p className="text-xs font-medium text-emerald-800">Photo submitted.</p>
                </div>
              ) : null}
              {readyPhotoMessage ? (
                <p className="mt-2 text-xs text-brand-brown/80">{readyPhotoMessage}</p>
              ) : null}
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="block text-sm font-medium text-brand-brown md:col-span-2">
              Date &amp; time of pick up
              {isViewMode ? (
                <p className={`flower-input mt-1.5 ${readOnlyFieldClass}`}>
                  {formatPickupDateTimeLocal(form.scheduled_for)}
                </p>
              ) : (
                <input
                  type="datetime-local"
                  value={toDateInputValue(form.scheduled_for)}
                  onChange={(event) =>
                    updateField('scheduled_for', fromDateInputValue(event.target.value))
                  }
                  className="flower-input mt-1.5"
                  required
                />
              )}
            </label>

            <label className="block text-sm font-medium text-brand-brown">
              Receiver
              <input
                type="text"
                value={form.receiver}
                onChange={(event) => updateField('receiver', event.target.value)}
                className={`flower-input mt-1.5 ${readOnlyFieldClass}`}
                readOnly={isViewMode}
                required
              />
            </label>

            <label className="block text-sm font-medium text-brand-brown">
              FB/IG Name
              <input
                type="text"
                value={form.customer_social}
                onChange={(event) => updateField('customer_social', event.target.value)}
                className={`flower-input mt-1.5 ${readOnlyFieldClass}`}
                readOnly={isViewMode}
                required
              />
            </label>

            <label className="block text-sm font-medium text-brand-brown">
              Branch
              {isViewMode ? (
                <p className={`flower-input mt-1.5 ${readOnlyFieldClass}`}>{branchLabel}</p>
              ) : (
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
              )}
            </label>

            <label className="block text-sm font-medium text-brand-brown">
              Mode of claiming
              {isViewMode ? (
                <p className={`flower-input mt-1.5 ${readOnlyFieldClass}`}>{claimModeLabel}</p>
              ) : (
                <select
                  value={form.claim_mode}
                  onChange={(event) => updateField('claim_mode', event.target.value as FlowerClaimMode)}
                  className="flower-input mt-1.5"
                  required
                >
                  <option value="pickup">Pick up</option>
                  <option value="delivery">Delivery</option>
                </select>
              )}
            </label>

            <label className="block text-sm font-medium text-brand-brown">
              Wrapper color
              <input
                type="text"
                value={form.wrapper_color}
                onChange={(event) => updateField('wrapper_color', event.target.value)}
                className={`flower-input mt-1.5 ${readOnlyFieldClass}`}
                readOnly={isViewMode}
                required
              />
            </label>

            <label className="block text-sm font-medium text-brand-brown">
              Greeting card
              <input
                type="text"
                value={form.greeting_card}
                onChange={(event) => updateField('greeting_card', event.target.value)}
                className={`flower-input mt-1.5 ${readOnlyFieldClass}`}
                readOnly={isViewMode}
                required
              />
            </label>

            <label className="block text-sm font-medium text-brand-brown md:col-span-2">
              Instructions
              <input
                type="text"
                value={form.special_instructions}
                onChange={(event) => updateField('special_instructions', event.target.value)}
                className={`flower-input mt-1.5 ${readOnlyFieldClass}`}
                readOnly={isViewMode}
                required
              />
            </label>
          </div>

          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-brand-dark">Flowers &amp; fillers (type + qty)</h3>
              {!isViewMode ? (
                <button
                  type="button"
                  className="text-xs font-semibold text-brand-brown underline"
                  onClick={() => setLineDrafts((rows) => [...rows, createLineDraft()])}
                >
                  Add row
                </button>
              ) : null}
            </div>

            {isViewMode ? (
              <ul className="space-y-2 rounded-xl border border-brand-muted/40 bg-brand-cream/20 p-3">
                {lineDrafts.map((row) => {
                  const productName =
                    activeProducts.find((product) => product.id === row.productId)?.name ??
                    existingOrder?.items.find((item) => item.product_id === row.productId)
                      ?.item_name ??
                    'Flower';

                  return (
                    <li key={row.rowId} className="flex justify-between text-sm text-brand-dark">
                      <span>{productName}</span>
                      <span className="font-semibold">x{row.quantity}</span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <>
            {!form.branch_id ? (
              <p className="mb-2 text-xs text-amber-800">
                Select a branch above to load stock limits for each flower type.
              </p>
            ) : stockLoading ? (
              <p className="mb-2 text-xs text-brand-brown/60">Loading branch stock...</p>
            ) : null}

            <div className="space-y-2">
              {lineDrafts.map((row) => {
                const maxQty = row.productId ? getMaxQuantityForLine(row.rowId, row.productId) : 0;
                const showStockHint = Boolean(form.branch_id && !stockLoading && row.productId);

                return (
                <div key={row.rowId}>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_100px_auto]">
                  <select
                    value={row.productId}
                    onChange={(event) => updateLineProduct(row.rowId, event.target.value)}
                    className="flower-input min-w-0"
                    required
                  >
                    <option value="">Flower type</option>
                    {activeProducts.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name}
                        {form.branch_id && !stockLoading
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
                    disabled={!row.productId || (showStockHint && maxQty <= 0)}
                    placeholder="Qty"
                  />
                  <button
                    type="button"
                    className="flower-btn-secondary px-3 sm:min-w-[5.5rem]"
                    onClick={() =>
                      setLineDrafts((rows) =>
                        rows.length === 1 ? rows : rows.filter((entry) => entry.rowId !== row.rowId),
                      )
                    }
                  >
                    Remove
                  </button>
                  </div>
                  {showStockHint ? (
                    <p className="mt-1 text-xs text-brand-brown/70">
                      Max for this line: {maxQty}
                      {maxQty <= 0 ? ' — out of stock at this branch' : ''}
                    </p>
                  ) : null}
                </div>
              );
              })}
            </div>
              </>
            )}
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
            <label className="block text-sm font-medium text-brand-brown">
              Downpayment
              {isViewMode ? (
                <p className={`flower-input mt-1.5 ${readOnlyFieldClass}`}>
                  {PRICE_FORMATTER.format(Number(downpaymentDraft) || 0)}
                </p>
              ) : (
                <>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={downpaymentDraft}
                    onChange={(event) =>
                      setDownpaymentDraft(event.target.value.replace(/[^\d.]/g, ''))
                    }
                    placeholder="0"
                    className="flower-input mt-1.5"
                    required
                  />
                  <span className="mt-1 block text-xs text-brand-brown/60">
                    Use 0 if no downpayment yet.
                  </span>
                </>
              )}
            </label>
            <label className="block text-sm font-medium text-brand-brown">
              Total amount
              {isViewMode ? (
                <p className={`flower-input mt-1.5 ${readOnlyFieldClass}`}>
                  {PRICE_FORMATTER.format(Number(totalAmountDraft) || 0)}
                </p>
              ) : (
                <input
                  type="text"
                  inputMode="decimal"
                  value={totalAmountDraft}
                  onChange={(event) =>
                    setTotalAmountDraft(event.target.value.replace(/[^\d.]/g, ''))
                  }
                  placeholder="0.00"
                  className="flower-input mt-1.5"
                  required
                />
              )}
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
            {requiresDownpaymentProof ? null : (
              <span className="ml-1 text-xs font-normal text-brand-brown/60">(optional when DP is 0)</span>
            )}
            <input
              type="text"
              value={form.payment_reference}
              onChange={(event) => updateField('payment_reference', event.target.value)}
              className={`flower-input mt-1.5 ${readOnlyFieldClass}`}
              readOnly={isViewMode}
              required={requiresDownpaymentProof && !isViewMode}
            />
          </label>

          <label className="mt-3 block text-sm font-medium text-brand-brown">
            Note
            <textarea
              value={form.notes}
              onChange={(event) => updateField('notes', event.target.value)}
              className={`flower-input mt-1.5 min-h-[72px] ${readOnlyFieldClass}`}
              readOnly={isViewMode}
              required={!isViewMode}
            />
          </label>

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="block text-sm font-medium text-brand-brown">
              Photo of order / inspo
              {!isViewMode ? (
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) =>
                    void handleFileChange('photo_inspo_data_url', event.target.files?.[0] ?? null)
                  }
                  className="mt-1.5 block w-full text-xs"
                  required={!form.photo_inspo_data_url}
                />
              ) : null}
              <OrderAttachmentPreview label="Current inspo photo" value={form.photo_inspo_data_url} />
            </div>
            <div className="block text-sm font-medium text-brand-brown">
              Proof of DP
              {!isViewMode && !requiresDownpaymentProof ? (
                <span className="ml-1 text-xs font-normal text-brand-brown/60">(optional when DP is 0)</span>
              ) : null}
              {!isViewMode ? (
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) =>
                    void handleFileChange('proof_dp_data_url', event.target.files?.[0] ?? null)
                  }
                  className="mt-1.5 block w-full text-xs"
                  required={requiresDownpaymentProof && !form.proof_dp_data_url}
                />
              ) : null}
              <OrderAttachmentPreview label="Current DP proof" value={form.proof_dp_data_url} />
            </div>
            <div className="block text-sm font-medium text-brand-brown">
              SS of order form
              {!isViewMode ? (
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) =>
                    void handleFileChange('order_form_ss_data_url', event.target.files?.[0] ?? null)
                  }
                  className="mt-1.5 block w-full text-xs"
                  required={!form.order_form_ss_data_url}
                />
              ) : null}
              <OrderAttachmentPreview label="Current order form SS" value={form.order_form_ss_data_url} />
            </div>
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
          {isViewMode ? (
            <>
              <button type="button" onClick={onClose} className="flower-btn-secondary flex-1">
                Close
              </button>
              <button
                type="button"
                onClick={() => setIsEditMode(true)}
                className="flower-btn-primary flex-1"
              >
                Edit order
              </button>
            </>
          ) : (
            <>
              <button type="button" onClick={handleCancelEdit} className="flower-btn-secondary flex-1">
                {existingOrder ? 'Cancel edit' : 'Cancel'}
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                onClick={handleSubmit}
                className="flower-btn-primary flex-1"
              >
                {isSubmitting ? 'Saving...' : existingOrder ? 'Update order' : 'Save order'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
