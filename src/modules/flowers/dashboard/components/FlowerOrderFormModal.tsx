import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Minus, Plus, X } from 'lucide-react';
import { listFlowerInventoryStock } from '../../../../services/flowers/inventory';
import type { FlowerProduct } from '../../shared/types/flower-product';
import type { FlowerBranchOption } from '../../shared/types/flower-inventory';
import {
  FLOWER_ORDER_COMPLETE_STATUSES,
  getFlowerOrderStatusSequenceForClaimMode,
  normalizeOrderStatusForPicker,
  type CreateFlowerOrderInput,
  type FlowerClaimMode,
  type FlowerOrder,
  type FlowerOrderStatus,
  type FlowerPaymentMode,
} from '../../shared/types/flower-order';
import {
  FLOWER_PAYMENT_MODE_LABELS,
  formatFlowerPaymentModeLabel,
  getFlowerPaymentModesForBranch,
  normalizeFlowerPaymentMode,
  requiresFlowerPaymentReference,
} from '../../shared/utils/flower-payment';
import {
  ORDER_STATUS_LABELS,
  PRICE_FORMATTER,
  formatPickupDateTimeLocal,
  fromDateInputValue,
  readFileAsDataUrl,
  toDateInputValue,
} from '../../shared/utils/flower-format';
import { normalizeFlowerProductColor } from '../../shared/utils/flower-product-colors';
import {
  groupFlowerProductsByType,
  getFlowerProductType,
  summarizeVariantQuantities,
  type FlowerProductTypeGroup,
} from '../../shared/utils/flower-product-type';
import {
  formatFinishedPhotoRequirementLabel,
  formatPrepDeadlineTimePh,
  formatRemainingTimeLabel,
  getOrderPrepDeadlineInfo,
  isReadyPhotoRequiredForStatusChange,
  urgencyBadgeClassName,
} from '../../shared/utils/flower-order-deadlines';
import OrderAttachmentField from './OrderAttachmentField';
import OrderAttachmentPreview from './OrderAttachmentPreview';

type ProductQuantities = Record<string, string>;

function formatFlowerOrderItemName(
  product: FlowerProduct,
  variantCountByType: Map<string, number>,
): string {
  const flowerType = getFlowerProductType(product);
  const variantCount = variantCountByType.get(flowerType) ?? 1;
  const color = normalizeFlowerProductColor(product.color).trim();

  if (variantCount > 1 && color) {
    return `${flowerType} (${color})`;
  }

  return flowerType;
}

function buildFlowerCatalogOrderItems(
  catalog: FlowerProduct[],
  quantities: ProductQuantities,
): CreateFlowerOrderInput['items'] {
  const variantCountByType = new Map<string, number>();

  for (const product of catalog) {
    const flowerType = getFlowerProductType(product);
    variantCountByType.set(flowerType, (variantCountByType.get(flowerType) ?? 0) + 1);
  }

  return catalog
    .map((product) => {
      const quantity = Number(quantities[product.id]);
      if (!Number.isFinite(quantity) || quantity <= 0) {
        return null;
      }

      return {
        product_id: product.id,
        item_name: formatFlowerOrderItemName(product, variantCountByType),
        quantity,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);
}

type OrderFormProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: CreateFlowerOrderInput) => Promise<void>;
  onStatusChange?: (orderId: string, status: FlowerOrderStatus) => Promise<void>;
  onReadyPhotoSubmit?: (orderId: string, readyPhotoDataUrl: string) => Promise<void>;
  onBalancePaid?: (
    orderId: string,
    balancePaymentMode: FlowerPaymentMode,
    balancePaymentReference: string,
  ) => Promise<void>;
  branches: FlowerBranchOption[];
  products: FlowerProduct[];
  initialPickupIso?: string;
  existingOrder?: FlowerOrder | null;
  staffId: string;
  staffName: string;
  isSubmitting?: boolean;
};

function quantitiesFromOrderItems(items: FlowerOrder['items']): ProductQuantities {
  const quantities: ProductQuantities = {};
  for (const item of items) {
    quantities[item.product_id] = String(item.quantity);
  }
  return quantities;
}

function parseDownpaymentDraft(draft: string): number {
  const trimmed = draft.trim();
  if (!trimmed) {
    return 0;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatWrapperColorSummary(
  catalog: FlowerProduct[],
  quantities: ProductQuantities,
): string {
  return catalog
    .map((product) => {
      const quantity = Number(quantities[product.id]) || 0;
      if (quantity <= 0) {
        return null;
      }

      return quantity === 1 ? product.name : `${product.name} x${quantity}`;
    })
    .filter((line): line is string => line !== null)
    .join(', ');
}

function buildCatalogOrderItems(
  catalog: FlowerProduct[],
  quantities: ProductQuantities,
): CreateFlowerOrderInput['items'] {
  return catalog
    .map((product) => {
      const quantity = Number(quantities[product.id]);
      if (!Number.isFinite(quantity) || quantity <= 0) {
        return null;
      }

      return {
        product_id: product.id,
        item_name: product.name,
        quantity,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);
}

function summarizeCatalogSelection(
  catalog: FlowerProduct[],
  quantities: ProductQuantities,
): { types: number; units: number } {
  let types = 0;
  let units = 0;

  for (const product of catalog) {
    const quantity = Number(quantities[product.id]) || 0;
    if (quantity > 0) {
      types += 1;
      units += quantity;
    }
  }

  return { types, units };
}

function sortPickerFlowerTypeGroups(
  groups: FlowerProductTypeGroup[],
  quantities: ProductQuantities,
): FlowerProductTypeGroup[] {
  const selected: FlowerProductTypeGroup[] = [];
  const unselected: FlowerProductTypeGroup[] = [];

  for (const group of groups) {
    const hasQuantity = group.variants.some((variant) => (Number(quantities[variant.id]) || 0) > 0);
    if (hasQuantity) {
      selected.push(group);
    } else {
      unselected.push(group);
    }
  }

  return [...selected, ...unselected];
}

function filterFlowerTypeGroups(
  groups: FlowerProductTypeGroup[],
  query: string,
): FlowerProductTypeGroup[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return groups;
  }

  return groups.filter((group) => {
    if (group.flowerType.toLowerCase().includes(normalizedQuery)) {
      return true;
    }

    return group.variants.some((variant) =>
      normalizeFlowerProductColor(variant.color).toLowerCase().includes(normalizedQuery),
    );
  });
}

function summarizeFlowerTypeSelection(
  groups: FlowerProductTypeGroup[],
  quantities: ProductQuantities,
): { types: number; units: number } {
  let types = 0;
  let units = 0;

  for (const group of groups) {
    const summary = summarizeVariantQuantities(group.variants, quantities);
    if (summary.units > 0) {
      types += 1;
      units += summary.units;
    }
  }

  return { types, units };
}

function OrderCatalogQuantityPicker({
  products,
  quantities,
  stockByProductId,
  creditByProductId,
  branchSelected,
  stockLoading,
  search,
  onSearchChange,
  searchPlaceholder,
  emptySearchMessage,
  unitLabel,
  onSetQuantity,
  onAdjustQuantity,
}: {
  products: FlowerProduct[];
  quantities: ProductQuantities;
  stockByProductId: Record<string, number>;
  creditByProductId: Record<string, number>;
  branchSelected: boolean;
  stockLoading: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder: string;
  emptySearchMessage: string;
  unitLabel: string;
  onSetQuantity: (productId: string, rawValue: string) => void;
  onAdjustQuantity: (productId: string, delta: number) => void;
}) {
  return (
    <>
      {!branchSelected ? (
        <p className="mb-2 text-xs text-amber-800">
          Select a branch above to see on-hand counts for each item.
        </p>
      ) : stockLoading ? (
        <p className="mb-2 text-xs text-brand-brown/60">Loading branch stock...</p>
      ) : (
        <p className="mb-2 text-xs text-brand-brown/65">
          Walk-in orders are allowed even at 0 stock — inventory may go negative until you stock in.
        </p>
      )}

      <input
        type="search"
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder={searchPlaceholder}
        className="flower-input mb-2"
      />

      <div className="overflow-hidden rounded-xl border border-brand-muted/40 bg-brand-cream/10">
        <div className="max-h-[min(40vh,320px)] overflow-y-auto divide-y divide-brand-muted/25">
          {products.length === 0 ? (
            <p className="px-3 py-4 text-center text-sm text-brand-brown/60">{emptySearchMessage}</p>
          ) : (
            products.map((product) => {
              const qty = Number(quantities[product.id]) || 0;
              const onHand = branchSelected && !stockLoading
                ? (stockByProductId[product.id] ?? 0) + (creditByProductId[product.id] ?? 0)
                : null;
              const isSelected = qty > 0;
              const willGoNegative = onHand !== null && qty > onHand;

              return (
                <div
                  key={product.id}
                  className={`px-3 py-2.5 ${
                    isSelected ? 'bg-brand-beige/50' : 'bg-white/70'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-brand-dark">{product.name}</p>
                      {onHand !== null ? (
                        <p
                          className={`text-xs ${
                            willGoNegative ? 'text-amber-800' : 'text-brand-brown/65'
                          }`}
                        >
                          {onHand} on hand
                          {willGoNegative ? ' — will go negative on day close' : ''}
                        </p>
                      ) : null}
                    </div>

                    <div className="flex shrink-0 items-center gap-1.5">
                      <button
                        type="button"
                        aria-label={`Remove one ${product.name}`}
                        disabled={qty <= 0}
                        onClick={() => onAdjustQuantity(product.id, -1)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-brand-muted/50 bg-white text-brand-dark transition hover:border-brand-dark/30 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={qty > 0 ? String(qty) : ''}
                        placeholder="0"
                        onChange={(event) => onSetQuantity(product.id, event.target.value)}
                        className="flower-input h-9 w-12 px-1 text-center text-sm"
                        aria-label={`${unitLabel} for ${product.name}`}
                      />
                      <button
                        type="button"
                        aria-label={`Add one ${product.name}`}
                        onClick={() => onAdjustQuantity(product.id, 1)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-brand-dark/20 bg-brand-dark text-white transition hover:bg-brand-brown"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}

function FlowerTypeOrderPicker({
  groups,
  quantities,
  stockByProductId,
  creditByProductId,
  branchSelected,
  stockLoading,
  search,
  onSearchChange,
  onSetQuantity,
  onAdjustQuantity,
}: {
  groups: FlowerProductTypeGroup[];
  quantities: ProductQuantities;
  stockByProductId: Record<string, number>;
  creditByProductId: Record<string, number>;
  branchSelected: boolean;
  stockLoading: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  onSetQuantity: (productId: string, rawValue: string) => void;
  onAdjustQuantity: (productId: string, delta: number) => void;
}) {
  return (
    <>
      {!branchSelected ? (
        <p className="mb-2 text-xs text-amber-800">
          Select a branch above to see on-hand counts for each item.
        </p>
      ) : stockLoading ? (
        <p className="mb-2 text-xs text-brand-brown/60">Loading branch stock...</p>
      ) : (
        <p className="mb-2 text-xs text-brand-brown/65">
          Walk-in orders are allowed even at 0 stock — inventory may go negative until you stock in.
        </p>
      )}

      <input
        type="search"
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder="Search flowers..."
        className="flower-input mb-2"
      />

      <div className="overflow-hidden rounded-xl border border-brand-muted/40 bg-brand-cream/10">
        <div className="max-h-[min(40vh,320px)] overflow-y-auto divide-y divide-brand-muted/25">
          {groups.length === 0 ? (
            <p className="px-3 py-4 text-center text-sm text-brand-brown/60">No flowers match your search.</p>
          ) : (
            groups.map((group) => (
              <div key={group.flowerType}>
                {group.isCategory ? (
                  <div className="border-b border-brand-muted/20 bg-brand-beige/35 px-3 py-2">
                    <p className="text-sm font-semibold text-brand-dark">{group.flowerType}</p>
                    <p className="text-xs text-brand-brown/65">
                      {group.variants.length} colors · pick quantities per color
                    </p>
                  </div>
                ) : null}

                {group.variants.map((variant) => {
                  const qty = Number(quantities[variant.id]) || 0;
                  const onHand = branchSelected && !stockLoading
                    ? (stockByProductId[variant.id] ?? 0) + (creditByProductId[variant.id] ?? 0)
                    : null;
                  const isSelected = qty > 0;
                  const willGoNegative = onHand !== null && qty > onHand;
                  const label = group.isCategory
                    ? normalizeFlowerProductColor(variant.color) || 'Color'
                    : group.flowerType;

                  return (
                    <div
                      key={variant.id}
                      className={`px-3 py-2.5 ${
                        isSelected ? 'bg-brand-beige/50' : 'bg-white/70'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-brand-dark">{label}</p>
                          {onHand !== null ? (
                            <p
                              className={`text-xs ${
                                willGoNegative ? 'text-amber-800' : 'text-brand-brown/65'
                              }`}
                            >
                              {onHand} on hand
                              {willGoNegative ? ' — will go negative on day close' : ''}
                            </p>
                          ) : null}
                        </div>

                        <div className="flex shrink-0 items-center gap-1.5">
                          <button
                            type="button"
                            aria-label={`Remove one ${label}`}
                            disabled={qty <= 0}
                            onClick={() => onAdjustQuantity(variant.id, -1)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-brand-muted/50 bg-white text-brand-dark transition hover:border-brand-dark/30 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <Minus className="h-4 w-4" />
                          </button>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={qty > 0 ? String(qty) : ''}
                            placeholder="0"
                            onChange={(event) => onSetQuantity(variant.id, event.target.value)}
                            className="flower-input h-9 w-12 px-1 text-center text-sm"
                            aria-label={`Stems for ${label}`}
                          />
                          <button
                            type="button"
                            aria-label={`Add one ${label}`}
                            onClick={() => onAdjustQuantity(variant.id, 1)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-brand-dark/20 bg-brand-dark text-white transition hover:bg-brand-brown"
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}

function sortPickerProducts<T extends { id: string }>(
  catalog: T[],
  quantities: ProductQuantities,
): T[] {
  const selected: T[] = [];
  const unselected: T[] = [];

  for (const product of catalog) {
    if ((Number(quantities[product.id]) || 0) > 0) {
      selected.push(product);
    } else {
      unselected.push(product);
    }
  }

  return [...selected, ...unselected];
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
    payment_mode: 'cash',
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
  onBalancePaid,
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
  const [productQuantities, setProductQuantities] = useState<ProductQuantities>({});
  const [flowerSearch, setFlowerSearch] = useState('');
  const [miscSearch, setMiscSearch] = useState('');
  const [downpaymentDraft, setDownpaymentDraft] = useState('');
  const [totalAmountDraft, setTotalAmountDraft] = useState('');
  const [stockByProductId, setStockByProductId] = useState<Record<string, number>>({});
  const [stockLoading, setStockLoading] = useState(false);
  const [statusDraft, setStatusDraft] = useState<FlowerOrderStatus>('not_started');
  const [statusMessage, setStatusMessage] = useState('');
  const [balancePaymentMode, setBalancePaymentMode] = useState<FlowerPaymentMode>('cash');
  const [balancePaymentReference, setBalancePaymentReference] = useState('');
  const [balancePaidMessage, setBalancePaidMessage] = useState('');
  const [isMarkingBalancePaid, setIsMarkingBalancePaid] = useState(false);
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
  const orderStatusSequence = existingOrder
    ? getFlowerOrderStatusSequenceForClaimMode(existingOrder.claim_mode)
    : getFlowerOrderStatusSequenceForClaimMode('pickup');
  const hasPendingReadyPhoto = Boolean(
    existingOrder && form.ready_photo_data_url !== existingOrder.ready_photo_data_url,
  );
  const readyPhotoSaved = Boolean(existingOrder?.ready_photo_data_url && !hasPendingReadyPhoto);
  const showReadyPhotoRequirement = Boolean(existingOrder && !readyPhotoSaved);

  function loadExistingOrderIntoForm(order: FlowerOrder) {
    const quantities = quantitiesFromOrderItems(order.items);
    const miscCatalog = products.filter(
      (product) => product.is_active && product.product_kind === 'misc',
    );
    const miscProductIds = new Set(miscCatalog.map((product) => product.id));

    const hasMiscLineItems = order.items.some((item) => miscProductIds.has(item.product_id));

    if (!hasMiscLineItems && order.wrapper_color.trim()) {
      const legacyName = order.wrapper_color
        .split(/[,;]+/)[0]
        ?.trim()
        .replace(/\s+x\d+$/i, '');
      const legacyMatch = miscCatalog.find((product) => product.name === legacyName);
      if (legacyMatch) {
        quantities[legacyMatch.id] = '1';
      }
    }

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
      payment_mode: normalizeFlowerPaymentMode(
        order.payment_mode,
        order.branch_id,
        order.branch_name,
      ),
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
    setProductQuantities(quantities);
    setFlowerSearch('');
    setMiscSearch('');
    setDownpaymentDraft(order.downpayment > 0 ? String(order.downpayment) : '');
    setTotalAmountDraft(String(order.total_amount));
    setStatusDraft(normalizeOrderStatusForPicker(order.status, order.claim_mode));
    setStatusMessage('');
    setErrorMessage('');
    setReadyPhotoMessage('');
    setBalancePaymentMode('cash');
    setBalancePaymentReference('');
    setBalancePaidMessage('');
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
    setProductQuantities({});
    setFlowerSearch('');
    setMiscSearch('');
    setDownpaymentDraft('');
    setTotalAmountDraft('');
    setStatusDraft('not_started');
    setStatusMessage('');
    setErrorMessage('');
    setBalancePaymentMode('cash');
    setBalancePaymentReference('');
    setBalancePaidMessage('');
  }, [open, existingOrder, initialPickupIso, staffId, staffName]);

  useEffect(() => {
    if (!open || !existingOrder || readyPhotoSaved) {
      return;
    }

    setDeadlineNowMs(Date.now());
    const intervalId = window.setInterval(() => {
      setDeadlineNowMs(Date.now());
    }, 30_000);

    return () => window.clearInterval(intervalId);
  }, [open, existingOrder, readyPhotoSaved]);

  const prepDeadline = existingOrder
    ? getOrderPrepDeadlineInfo(
        {
          ...existingOrder,
          claim_mode: form.claim_mode,
          ready_photo_data_url: readyPhotoSaved ? form.ready_photo_data_url : '',
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

  useEffect(() => {
    if (!open || !form.branch_id || isViewMode) {
      return;
    }

    const branchName =
      branches.find((branch) => branch.id === form.branch_id)?.name ?? form.branch_id;
    const modes = getFlowerPaymentModesForBranch(form.branch_id, branchName);
    if (!modes.includes(form.payment_mode)) {
      setForm((previous) => ({ ...previous, payment_mode: modes[0] }));
    }
  }, [open, form.branch_id, form.payment_mode, isViewMode, branches]);

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

  function setProductQuantity(productId: string, rawValue: string) {
    const digits = rawValue.replace(/[^\d]/g, '');
    const qty = digits ? Math.max(0, Number(digits)) : 0;

    setProductQuantities((current) => {
      if (!digits || qty <= 0) {
        const next = { ...current };
        delete next[productId];
        return next;
      }

      return { ...current, [productId]: String(qty) };
    });
  }

  function adjustProductQuantity(productId: string, delta: number) {
    const currentQty = Number(productQuantities[productId]) || 0;
    const nextQty = Math.max(0, currentQty + delta);

    setProductQuantities((current) => {
      if (nextQty <= 0) {
        const next = { ...current };
        delete next[productId];
        return next;
      }

      return { ...current, [productId]: String(nextQty) };
    });
  }

  const balance = useMemo(() => {
    const total = totalAmountDraft === '' ? 0 : Number(totalAmountDraft);
    const downpayment = parseDownpaymentDraft(downpaymentDraft);
    if (!Number.isFinite(total) || !Number.isFinite(downpayment)) {
      return 0;
    }

    return Math.max(0, total - downpayment);
  }, [totalAmountDraft, downpaymentDraft]);

  const hasDownpayment = useMemo(
    () => parseDownpaymentDraft(downpaymentDraft) > 0,
    [downpaymentDraft],
  );

  const activeProducts = useMemo(
    () =>
      products
        .filter((product) => product.is_active && product.product_kind === 'flower')
        .sort((left, right) => left.name.localeCompare(right.name)),
    [products],
  );
  const miscProducts = useMemo(
    () =>
      products
        .filter((product) => product.is_active && product.product_kind === 'misc')
        .sort((left, right) => left.name.localeCompare(right.name)),
    [products],
  );

  const flowerTypeGroups = useMemo(
    () => groupFlowerProductsByType(activeProducts),
    [activeProducts],
  );

  const filteredFlowerTypeGroups = useMemo(
    () => filterFlowerTypeGroups(flowerTypeGroups, flowerSearch),
    [flowerTypeGroups, flowerSearch],
  );

  const pickerFlowerTypeGroups = useMemo(
    () => sortPickerFlowerTypeGroups(filteredFlowerTypeGroups, productQuantities),
    [filteredFlowerTypeGroups, productQuantities],
  );

  const filteredMiscProducts = useMemo(() => {
    const query = miscSearch.trim().toLowerCase();
    if (!query) {
      return miscProducts;
    }

    return miscProducts.filter((product) => product.name.toLowerCase().includes(query));
  }, [miscProducts, miscSearch]);

  const pickerMiscProducts = useMemo(
    () => sortPickerProducts(filteredMiscProducts, productQuantities),
    [filteredMiscProducts, productQuantities],
  );

  const flowerSelectionSummary = useMemo(
    () => summarizeFlowerTypeSelection(flowerTypeGroups, productQuantities),
    [flowerTypeGroups, productQuantities],
  );

  const miscSelectionSummary = useMemo(
    () => summarizeCatalogSelection(miscProducts, productQuantities),
    [miscProducts, productQuantities],
  );

  const flowerViewGroups = useMemo(
    () =>
      flowerTypeGroups
        .map((group) => ({
          flowerType: group.flowerType,
          isCategory: group.isCategory,
          variants: group.variants
            .map((variant) => ({
              productId: variant.id,
              color: normalizeFlowerProductColor(variant.color),
              quantity: Number(productQuantities[variant.id]) || 0,
            }))
            .filter((variant) => variant.quantity > 0),
        }))
        .filter((group) => group.variants.length > 0),
    [flowerTypeGroups, productQuantities],
  );

  const miscViewItems = useMemo(
    () =>
      miscProducts
        .map((product) => ({
          productId: product.id,
          name: product.name,
          quantity: Number(productQuantities[product.id]) || 0,
        }))
        .filter((item) => item.quantity > 0),
    [miscProducts, productQuantities],
  );

  const requiresDownpaymentProof = useMemo(() => hasDownpayment, [hasDownpayment]);
  const activeBranchId = existingOrder?.branch_id ?? form.branch_id;
  const activeBranchName =
    branches.find((branch) => branch.id === activeBranchId)?.name ?? activeBranchId;
  const branchPaymentModes = useMemo(
    () => getFlowerPaymentModesForBranch(activeBranchId, activeBranchName),
    [activeBranchId, activeBranchName],
  );
  const requiresBalanceReference = requiresFlowerPaymentReference(balancePaymentMode);
  const showBalanceDue = Boolean(
    existingOrder && existingOrder.balance > 0 && !existingOrder.balance_paid,
  );
  const showBalancePaidBanner = Boolean(existingOrder?.balance_paid);
  const showReadyPhotoSection = Boolean(existingOrder && onReadyPhotoSubmit);
  const showTopPrepSection = showBalanceDue || showBalancePaidBanner || showReadyPhotoSection;

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

    try {
      const dataUrl = await readFileAsDataUrl(file);
      updateField(key, dataUrl);
      setErrorMessage('');
      if (key === 'ready_photo_data_url') {
        setReadyPhotoMessage('');
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not load photo.');
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
    const flowerItems = buildFlowerCatalogOrderItems(activeProducts, productQuantities);
    const miscItems = buildCatalogOrderItems(miscProducts, productQuantities);
    const items = [...flowerItems, ...miscItems];
    const wrapper_color = formatWrapperColorSummary(miscProducts, productQuantities);

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

    if (flowerItems.length === 0) {
      setErrorMessage('Add at least one flower type with quantity.');
      return null;
    }

    if (miscItems.length === 0) {
      setErrorMessage('Add at least one wrapper or miscellaneous item.');
      return null;
    }

    const trimmedDownpayment = downpaymentDraft.trim();
    const downpayment =
      trimmedDownpayment === '' ? 0 : Number(trimmedDownpayment);
    const total_amount = Number(totalAmountDraft);

    if (trimmedDownpayment !== '' && !Number.isFinite(downpayment)) {
      setErrorMessage('Downpayment must be a valid amount.');
      return null;
    }

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

    if (requiresProof && !form.payment_reference.trim()) {
      setErrorMessage('Reference # is required when downpayment is greater than 0.');
      return null;
    }

    if (requiresProof && !form.proof_dp_data_url) {
      setErrorMessage('Proof of DP is required when downpayment is greater than 0.');
      return null;
    }

    setErrorMessage('');
    return { ...form, wrapper_color, downpayment, total_amount, items };
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

  async function handleMarkBalancePaid() {
    if (!existingOrder || !onBalancePaid) {
      return;
    }

    if (requiresBalanceReference && !balancePaymentReference.trim()) {
      setBalancePaidMessage('Reference # is required for non-cash payments.');
      return;
    }

    setIsMarkingBalancePaid(true);
    setBalancePaidMessage('');

    try {
      await onBalancePaid(
        existingOrder.id,
        balancePaymentMode,
        balancePaymentReference.trim(),
      );
      setBalancePaidMessage('Balance marked as paid.');
      setStatusMessage('');
    } catch (error) {
      setBalancePaidMessage(
        error instanceof Error ? error.message : 'Could not mark balance as paid.',
      );
    } finally {
      setIsMarkingBalancePaid(false);
    }
  }

  async function handleStatusSelect(nextStatus: FlowerOrderStatus) {
    if (!existingOrder || !onStatusChange) {
      return;
    }

    if (
      (nextStatus === 'picked_up' || nextStatus === 'delivered') &&
      existingOrder.balance > 0 &&
      !existingOrder.balance_paid
    ) {
      setStatusDraft(normalizeOrderStatusForPicker(existingOrder.status, existingOrder.claim_mode));
      setStatusMessage('Mark the remaining balance as paid before completing this order.');
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
                  {orderStatusSequence.map((status, index) => {
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
                  className={`mt-3 w-full px-4 py-3 text-sm font-semibold transition sm:w-auto ${
                    statusDraft !== displayOrderStatus
                      ? 'flower-btn-primary shadow-md ring-2 ring-brand-accent/35'
                      : 'flower-btn-secondary opacity-50'
                  }`}
                  disabled={statusDraft === displayOrderStatus}
                  onClick={() => void handleStatusSelect(statusDraft)}
                >
                  {statusDraft !== displayOrderStatus ? 'Apply status change' : 'Apply status'}
                </button>
              ) : null}
              {statusMessage ? (
                <span className="mt-2 block text-xs text-red-700">{statusMessage}</span>
              ) : null}
            </div>
          ) : null}

          {showTopPrepSection ? (
            <div className="mb-4 space-y-4">
              {showBalanceDue ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <p className="text-sm font-semibold text-amber-950">
                    Balance due at pick up / delivery
                  </p>
                  <p className="mt-1 text-sm text-amber-900">
                    {PRICE_FORMATTER.format(existingOrder!.balance)} remaining — collect before
                    marking picked up or delivered.
                  </p>
                  {onBalancePaid ? (
                    <div className="mt-3 flex flex-col gap-3">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                        <label className="block flex-1 text-sm font-medium text-amber-950">
                          Balance payment mode
                          <select
                            value={balancePaymentMode}
                            onChange={(event) => {
                              const nextMode = event.target.value as FlowerPaymentMode;
                              setBalancePaymentMode(nextMode);
                              if (nextMode === 'cash') {
                                setBalancePaymentReference('');
                              }
                            }}
                            className="flower-input mt-1.5 bg-white"
                          >
                            {branchPaymentModes.map((mode) => (
                              <option key={mode} value={mode}>
                                {FLOWER_PAYMENT_MODE_LABELS[mode]}
                              </option>
                            ))}
                          </select>
                        </label>
                        {requiresBalanceReference ? (
                          <label className="block flex-1 text-sm font-medium text-amber-950">
                            Reference #
                            <input
                              type="text"
                              value={balancePaymentReference}
                              onChange={(event) =>
                                setBalancePaymentReference(event.target.value)
                              }
                              className="flower-input mt-1.5 bg-white"
                              placeholder="GCash / bank reference"
                            />
                          </label>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleMarkBalancePaid()}
                        disabled={isMarkingBalancePaid}
                        className="flower-btn-primary w-full sm:w-auto sm:self-start"
                      >
                        {isMarkingBalancePaid ? 'Saving...' : 'Mark balance paid'}
                      </button>
                    </div>
                  ) : null}
                  {balancePaidMessage ? (
                    <p
                      className={`mt-2 text-sm ${balancePaidMessage.includes('paid') ? 'text-emerald-800' : 'text-red-700'}`}
                    >
                      {balancePaidMessage}
                    </p>
                  ) : null}
                </div>
              ) : null}

              {showBalancePaidBanner ? (
                <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                  Balance paid
                  {existingOrder!.balance_payment_mode
                    ? ` via ${formatFlowerPaymentModeLabel(existingOrder!.balance_payment_mode)}`
                    : ''}
                  {existingOrder!.balance_payment_reference?.trim()
                    ? ` — ref ${existingOrder!.balance_payment_reference.trim()}`
                    : ''}
                  .
                </p>
              ) : null}

          {showReadyPhotoSection ? (
            <div
              className={`rounded-xl border p-4 ${
                showReadyPhotoRequirement &&
                prepDeadline?.minutesUntilDeadline !== undefined &&
                prepDeadline.minutesUntilDeadline < 0
                  ? 'border-red-200 bg-red-50'
                  : 'border-amber-200 bg-amber-50'
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p
                    className={`text-sm font-semibold ${
                      showReadyPhotoRequirement &&
                      prepDeadline?.minutesUntilDeadline !== undefined &&
                      prepDeadline.minutesUntilDeadline < 0
                        ? 'text-red-950'
                        : 'text-amber-950'
                    }`}
                  >
                    Finished order photo
                  </p>
                  {showReadyPhotoRequirement ? (
                    <p className="mt-1 text-sm text-amber-900">
                      {formatFinishedPhotoRequirementLabel(form.claim_mode)}
                    </p>
                  ) : (
                    <p className="mt-1 text-sm font-medium text-emerald-800">Photo submitted</p>
                  )}
                </div>
                {showReadyPhotoRequirement && prepDeadline ? (
                  <span
                    className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${urgencyBadgeClassName(prepDeadline.urgency)}`}
                  >
                    {prepDeadline.minutesUntilDeadline < 0
                      ? 'Overdue'
                      : prepDeadline.message}
                  </span>
                ) : null}
              </div>

              {showReadyPhotoRequirement && prepDeadline ? (
                <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
                  <p
                    className={`font-semibold tabular-nums ${
                      prepDeadline.minutesUntilDeadline < 0 ? 'text-red-800' : 'text-amber-950'
                    }`}
                  >
                    {formatRemainingTimeLabel(prepDeadline.minutesUntilDeadline)}
                  </p>
                  <p className="text-xs text-amber-900/80">
                    Due {formatPrepDeadlineTimePh(prepDeadline.prepDeadlineIso)} (PH)
                  </p>
                </div>
              ) : null}

              <div className="mt-3">
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
              {!form.ready_photo_data_url ? (
                <button
                  type="button"
                  onClick={handleChooseReadyPhotoClick}
                  className="flex w-full flex-col items-center justify-center rounded-xl border border-dashed border-amber-300 bg-white/70 px-4 py-8 text-center transition hover:border-amber-400 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent"
                >
                  <span className="text-sm font-semibold text-amber-950">
                    {showReadyPhotoRequirement ? 'Upload finished photo' : 'Choose finished order photo'}
                  </span>
                  <span className="mt-1 text-xs text-amber-900/75">
                    Tap to select from your device
                  </span>
                </button>
              ) : (
                <div className="flex flex-col items-center">
                  <OrderAttachmentPreview
                    label="Current finished order photo"
                    value={form.ready_photo_data_url}
                    size="large"
                    centered
                    hint="Tap image to open full size."
                  />
                  {hasPendingReadyPhoto ? (
                    <div className="mt-4 flex w-full flex-col items-stretch gap-2 sm:flex-row sm:justify-center">
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
                        onClick={handleChooseReadyPhotoClick}
                      >
                        Change photo
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
                  ) : (
                    <div className="mt-4 flex w-full flex-col items-center gap-2 sm:flex-row sm:justify-center">
                      <button
                        type="button"
                        className="flower-btn-secondary w-full py-2 text-sm sm:w-auto"
                        onClick={handleChooseReadyPhotoClick}
                      >
                        Change photo
                      </button>
                    </div>
                  )}
                </div>
              )}
              {readyPhotoMessage ? (
                <p className="mt-3 text-center text-xs text-amber-900/80">{readyPhotoMessage}</p>
              ) : null}
              </div>
            </div>
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
              Greeting card
              <span className="ml-1 text-xs font-normal text-brand-brown/60">(optional)</span>
              <input
                type="text"
                value={form.greeting_card}
                onChange={(event) => updateField('greeting_card', event.target.value)}
                className={`flower-input mt-1.5 ${readOnlyFieldClass}`}
                readOnly={isViewMode}
              />
            </label>

            <label className="block text-sm font-medium text-brand-brown md:col-span-2">
              Instructions
              <span className="ml-1 text-xs font-normal text-brand-brown/60">(optional)</span>
              <input
                type="text"
                value={form.special_instructions}
                onChange={(event) => updateField('special_instructions', event.target.value)}
                className={`flower-input mt-1.5 ${readOnlyFieldClass}`}
                readOnly={isViewMode}
              />
            </label>
          </div>

          <div className="mt-5">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-brand-dark">Wrappers &amp; miscellaneous</h3>
              {miscSelectionSummary.types > 0 ? (
                <p className="text-xs font-medium text-brand-brown/75">
                  {miscSelectionSummary.types} item{miscSelectionSummary.types === 1 ? '' : 's'} ·{' '}
                  {miscSelectionSummary.units} unit{miscSelectionSummary.units === 1 ? '' : 's'}
                </p>
              ) : !isViewMode ? (
                <p className="text-xs text-brand-brown/60">Tap + to add wrappers, chocolates, etc.</p>
              ) : null}
            </div>

            {isViewMode ? (
              miscViewItems.length > 0 ? (
                <ul className="space-y-2 rounded-xl border border-brand-muted/40 bg-brand-cream/20 p-3">
                  {miscViewItems.map((item) => (
                    <li key={item.productId} className="flex justify-between text-sm text-brand-dark">
                      <span>{item.name}</span>
                      <span className="font-semibold">x{item.quantity}</span>
                    </li>
                  ))}
                </ul>
              ) : form.wrapper_color.trim() ? (
                <p className="rounded-xl border border-brand-muted/40 bg-brand-cream/20 px-3 py-2 text-sm text-brand-dark">
                  {form.wrapper_color}
                </p>
              ) : (
                <p className="rounded-xl border border-brand-muted/30 px-3 py-4 text-center text-sm text-brand-brown/60">
                  No wrappers or miscellaneous items selected.
                </p>
              )
            ) : miscProducts.length === 0 ? (
              <p className="rounded-xl border border-brand-muted/30 px-3 py-4 text-center text-sm text-brand-brown/60">
                Add wrappers and supplies under Products → Miscellaneous first.
              </p>
            ) : (
              <OrderCatalogQuantityPicker
                products={pickerMiscProducts}
                quantities={productQuantities}
                stockByProductId={stockByProductId}
                creditByProductId={creditByProductId}
                branchSelected={Boolean(form.branch_id)}
                stockLoading={stockLoading}
                search={miscSearch}
                onSearchChange={setMiscSearch}
                searchPlaceholder="Search wrappers, chocolates..."
                emptySearchMessage="No miscellaneous items match your search."
                unitLabel="Quantity"
                onSetQuantity={setProductQuantity}
                onAdjustQuantity={adjustProductQuantity}
              />
            )}
          </div>

          <div className="mt-5">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-brand-dark">Flowers &amp; fillers</h3>
              {flowerSelectionSummary.types > 0 ? (
                <p className="text-xs font-medium text-brand-brown/75">
                  {flowerSelectionSummary.types} type{flowerSelectionSummary.types === 1 ? '' : 's'} ·{' '}
                  {flowerSelectionSummary.units} stem{flowerSelectionSummary.units === 1 ? '' : 's'}
                </p>
              ) : !isViewMode ? (
                <p className="text-xs text-brand-brown/60">Tap + to add stems per flower type and color</p>
              ) : null}
            </div>

            {isViewMode ? (
              flowerViewGroups.length > 0 ? (
                <ul className="space-y-2 rounded-xl border border-brand-muted/40 bg-brand-cream/20 p-3">
                  {flowerViewGroups.map((group) => (
                    <li key={group.flowerType} className="text-sm text-brand-dark">
                      {group.isCategory ? (
                        <>
                          <p className="font-semibold">{group.flowerType}</p>
                          <ul className="mt-1 space-y-1 pl-3">
                            {group.variants.map((variant) => (
                              <li key={variant.productId} className="flex justify-between gap-3">
                                <span>{variant.color || 'Color'}</span>
                                <span className="font-semibold">x{variant.quantity}</span>
                              </li>
                            ))}
                          </ul>
                        </>
                      ) : (
                        <div className="flex justify-between gap-3">
                          <span>{group.flowerType}</span>
                          <span className="font-semibold">x{group.variants[0]?.quantity ?? 0}</span>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="rounded-xl border border-brand-muted/30 px-3 py-4 text-center text-sm text-brand-brown/60">
                  No flowers selected.
                </p>
              )
            ) : (
              <FlowerTypeOrderPicker
                groups={pickerFlowerTypeGroups}
                quantities={productQuantities}
                stockByProductId={stockByProductId}
                creditByProductId={creditByProductId}
                branchSelected={Boolean(form.branch_id)}
                stockLoading={stockLoading}
                search={flowerSearch}
                onSearchChange={setFlowerSearch}
                onSetQuantity={setProductQuantity}
                onAdjustQuantity={adjustProductQuantity}
              />
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
                  />
                  <span className="mt-1 block text-xs text-brand-brown/60">
                    Leave blank if no downpayment yet.
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
            Mode of payment (downpayment)
            {isViewMode ? (
              <p className={`flower-input mt-1.5 ${readOnlyFieldClass}`}>
                {hasDownpayment ? formatFlowerPaymentModeLabel(form.payment_mode) : '—'}
              </p>
            ) : (
              <select
                value={form.payment_mode}
                onChange={(event) =>
                  updateField('payment_mode', event.target.value as FlowerPaymentMode)
                }
                className={`flower-input mt-1.5 ${hasDownpayment ? '' : 'cursor-not-allowed bg-brand-beige/40 text-brand-brown/50'}`}
                disabled={!hasDownpayment}
              >
                {branchPaymentModes.map((mode) => (
                  <option key={mode} value={mode}>
                    {FLOWER_PAYMENT_MODE_LABELS[mode]}
                  </option>
                ))}
              </select>
            )}
            {!isViewMode && !hasDownpayment ? (
              <span className="mt-1 block text-xs text-brand-brown/60">
                Choose a downpayment amount first.
              </span>
            ) : null}
          </label>

          <label className="mt-3 block text-sm font-medium text-brand-brown">
            Reference # (downpayment)
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
            <span className="ml-1 text-xs font-normal text-brand-brown/60">(optional)</span>
            <textarea
              value={form.notes}
              onChange={(event) => updateField('notes', event.target.value)}
              className={`flower-input mt-1.5 min-h-[72px] ${readOnlyFieldClass}`}
              readOnly={isViewMode}
            />
          </label>

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
            <OrderAttachmentField
              label="Photo of order / inspo"
              previewLabel="Current inspo photo"
              value={form.photo_inspo_data_url}
              optional
              readOnly={isViewMode}
              onEditRequest={() => setIsEditMode(true)}
              onChange={(file) => void handleFileChange('photo_inspo_data_url', file)}
            />
            <OrderAttachmentField
              label="Proof of DP"
              previewLabel="Current DP proof"
              value={form.proof_dp_data_url}
              optional={!requiresDownpaymentProof}
              readOnly={isViewMode}
              onEditRequest={() => setIsEditMode(true)}
              onChange={(file) => void handleFileChange('proof_dp_data_url', file)}
            />
            <OrderAttachmentField
              label="SS of order form"
              previewLabel="Current order form SS"
              value={form.order_form_ss_data_url}
              optional
              readOnly={isViewMode}
              onEditRequest={() => setIsEditMode(true)}
              onChange={(file) => void handleFileChange('order_form_ss_data_url', file)}
            />
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
