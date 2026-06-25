import { useEffect, useMemo, useState } from 'react';
import { listFlowerBranches } from '../../../../services/flowers/inventory';
import { listFlowerProducts } from '../../../../services/flowers/products';
import { createFlowerOrder, listFlowerOrders } from '../../../../services/flowers/orders';
import type { FlowerBranchOption } from '../../shared/types/flower-inventory';
import type { FlowerProduct } from '../../shared/types/flower-product';
import type { FlowerOrder } from '../../shared/types/flower-order';

import DemoModeBanner from '../../shared/components/DemoModeBanner';
import FlowerPageHeader from '../../shared/components/FlowerPageHeader';

const PRICE_FORMATTER = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

type OrderItemDraft = {
  rowId: string;
  productId: string;
  itemName: string;
  quantity: string;
  unitPrice: string;
};

type ScheduleFilter = 'all' | 'advance_only' | 'unscheduled';

function createItemDraft(): OrderItemDraft {
  return {
    rowId: `${Date.now()}-${Math.random()}`,
    productId: '',
    itemName: '',
    quantity: '1',
    unitPrice: '0',
  };
}

export default function FlowerOrdersPlaceholder() {
  const [branches, setBranches] = useState<FlowerBranchOption[]>([]);
  const [products, setProducts] = useState<FlowerProduct[]>([]);

  const [branchId, setBranchId] = useState('');
  const [scheduledForInput, setScheduledForInput] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [notes, setNotes] = useState('');
  const [itemDrafts, setItemDrafts] = useState<OrderItemDraft[]>([createItemDraft()]);
  const [totalAmountDraft, setTotalAmountDraft] = useState('0');
  const [isTotalOverridden, setIsTotalOverridden] = useState(false);

  const [orders, setOrders] = useState<FlowerOrder[]>([]);
  const [orderBranchFilter, setOrderBranchFilter] = useState('all');
  const [scheduleFilter, setScheduleFilter] = useState<ScheduleFilter>('all');

  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isReloadingOrders, setIsReloadingOrders] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    void bootstrapPage();
  }, []);

  useEffect(() => {
    void reloadOrders();
  }, [orderBranchFilter]);

  const activeProducts = useMemo(
    () => products.filter((product) => product.is_active),
    [products],
  );

  const computedTotal = useMemo(() => {
    return itemDrafts.reduce((sum, row) => {
      const quantity = Number(row.quantity);
      const unitPrice = Number(row.unitPrice);
      if (!Number.isFinite(quantity) || !Number.isFinite(unitPrice) || quantity <= 0 || unitPrice < 0) {
        return sum;
      }

      return sum + quantity * unitPrice;
    }, 0);
  }, [itemDrafts]);

  useEffect(() => {
    if (!isTotalOverridden) {
      setTotalAmountDraft(computedTotal.toFixed(2));
    }
  }, [computedTotal, isTotalOverridden]);

  const visibleOrders = useMemo(() => {
    const now = Date.now();

    return orders.filter((order) => {
      if (scheduleFilter === 'unscheduled') {
        return !order.scheduled_for;
      }

      if (scheduleFilter === 'advance_only') {
        return Boolean(order.scheduled_for) && new Date(order.scheduled_for as string).getTime() > now;
      }

      return true;
    });
  }, [orders, scheduleFilter]);

  async function bootstrapPage() {
    try {
      setIsBootstrapping(true);
      const [nextBranches, nextProducts] = await Promise.all([
        listFlowerBranches(),
        listFlowerProducts(),
      ]);

      setBranches(nextBranches);
      setProducts(nextProducts);

      const firstActiveBranch = nextBranches.find((branch) => branch.is_active) ?? nextBranches[0];
      if (firstActiveBranch) {
        setBranchId(firstActiveBranch.id);
      }

      await reloadOrders();
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to initialize flower order module.');
    } finally {
      setIsBootstrapping(false);
    }
  }

  async function reloadOrders() {
    try {
      setIsReloadingOrders(true);

      const branchFilter = orderBranchFilter === 'all' ? undefined : orderBranchFilter;
      const data = await listFlowerOrders({ branchId: branchFilter });
      setOrders(data);
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to load flower orders.');
    } finally {
      setIsReloadingOrders(false);
    }
  }

  function handleProductChange(rowId: string, productId: string) {
    const selectedProduct = activeProducts.find((product) => product.id === productId);

    setItemDrafts((current) =>
      current.map((row) => {
        if (row.rowId !== rowId) {
          return row;
        }

        if (!selectedProduct) {
          return {
            ...row,
            productId,
          };
        }

        return {
          ...row,
          productId,
          itemName: selectedProduct.name,
          unitPrice: selectedProduct.base_price.toFixed(2),
        };
      }),
    );
  }

  function handleDraftChange(rowId: string, field: 'itemName' | 'quantity' | 'unitPrice', value: string) {
    setItemDrafts((current) =>
      current.map((row) => (row.rowId === rowId ? { ...row, [field]: value } : row)),
    );
  }

  function addItemRow() {
    setItemDrafts((current) => [...current, createItemDraft()]);
  }

  function removeItemRow(rowId: string) {
    setItemDrafts((current) => {
      if (current.length === 1) {
        return current;
      }

      return current.filter((row) => row.rowId !== rowId);
    });
  }

  function useComputedTotal() {
    setTotalAmountDraft(computedTotal.toFixed(2));
    setIsTotalOverridden(false);
  }

  async function submitOrder() {
    if (!branchId) {
      setErrorMessage('Please select a branch.');
      return;
    }

    const parsedTotal = Number(totalAmountDraft);
    if (!Number.isFinite(parsedTotal) || parsedTotal < 0) {
      setErrorMessage('Total amount must be 0 or greater.');
      return;
    }

    const normalizedItems = itemDrafts
      .map((row) => {
        const quantity = Number(row.quantity);
        const unitPrice = Number(row.unitPrice);

        return {
          product_id: row.productId,
          item_name: row.itemName.trim(),
          quantity,
          unit_price: unitPrice,
          line_total: quantity * unitPrice,
        };
      })
      .filter((row) => row.product_id && row.item_name);

    if (normalizedItems.length === 0) {
      setErrorMessage('Add at least one complete order item.');
      return;
    }

    if (normalizedItems.some((row) => !Number.isFinite(row.quantity) || row.quantity <= 0 || !Number.isInteger(row.quantity))) {
      setErrorMessage('Item quantities must be whole numbers greater than 0.');
      return;
    }

    if (normalizedItems.some((row) => !Number.isFinite(row.unit_price) || row.unit_price < 0)) {
      setErrorMessage('Item unit prices must be 0 or greater.');
      return;
    }

    let scheduledForIso: string | null = null;
    if (scheduledForInput) {
      const parsed = new Date(scheduledForInput);
      if (Number.isNaN(parsed.getTime())) {
        setErrorMessage('Scheduled date is invalid.');
        return;
      }

      scheduledForIso = parsed.toISOString();
    }

    try {
      setIsSubmitting(true);
      const created = await createFlowerOrder({
        branch_id: branchId,
        scheduled_for: scheduledForIso,
        customer_name: customerName,
        notes,
        total_amount: parsedTotal,
        items: normalizedItems,
      });

      setOrders((current) => [created, ...current]);
      setScheduledForInput('');
      setCustomerName('');
      setNotes('');
      setItemDrafts([createItemDraft()]);
      setIsTotalOverridden(false);
      setTotalAmountDraft('0');
      setSuccessMessage(`Order ${created.id.slice(0, 8)} created successfully.`);
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to create flower order.');
      setSuccessMessage(null);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div>
      <DemoModeBanner />

      <FlowerPageHeader
        label="Orders"
        title="Order Management"
        description="Manual order entry with optional scheduling. For walk-in sales, use the POS module. Inventory is deducted on order creation."
      />

      <div className="mt-6 rounded-2xl border border-brand-muted/40 bg-white p-4 sm:p-5">
        <h3 className="text-sm font-semibold text-slate-900">Create Order</h3>

        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="block text-sm font-medium text-slate-700">
            Branch
            <select
              value={branchId}
              onChange={(event) => setBranchId(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
              disabled={isBootstrapping}
            >
              <option value="">Select branch</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Scheduled Date (Optional)
            <input
              type="datetime-local"
              value={scheduledForInput}
              onChange={(event) => setScheduledForInput(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
            />
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Customer Name (Optional)
            <input
              type="text"
              value={customerName}
              onChange={(event) => setCustomerName(event.target.value)}
              placeholder="Walk-in or customer name"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
            />
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Notes (Optional)
            <input
              type="text"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Special requests, reminders, etc."
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
            />
          </label>
        </div>

        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2 font-semibold">Product</th>
                <th className="px-3 py-2 font-semibold">Item Name</th>
                <th className="px-3 py-2 font-semibold">Qty</th>
                <th className="px-3 py-2 font-semibold">Unit Price</th>
                <th className="px-3 py-2 font-semibold">Line Total</th>
                <th className="px-3 py-2 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {itemDrafts.map((row) => {
                const quantity = Number(row.quantity);
                const unitPrice = Number(row.unitPrice);
                const lineTotal = Number.isFinite(quantity) && Number.isFinite(unitPrice) ? quantity * unitPrice : 0;

                return (
                  <tr key={row.rowId} className="border-t border-slate-200">
                    <td className="px-3 py-2">
                      <select
                        value={row.productId}
                        onChange={(event) => handleProductChange(row.rowId, event.target.value)}
                        className="w-56 rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                      >
                        <option value="">Select product</option>
                        {activeProducts.map((product) => (
                          <option key={product.id} value={product.id}>
                            {product.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={row.itemName}
                        onChange={(event) => handleDraftChange(row.rowId, 'itemName', event.target.value)}
                        placeholder="Item name"
                        className="w-56 rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={row.quantity}
                        onChange={(event) => handleDraftChange(row.rowId, 'quantity', event.target.value)}
                        className="w-20 rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={row.unitPrice}
                        onChange={(event) => handleDraftChange(row.rowId, 'unitPrice', event.target.value)}
                        className="w-28 rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                      />
                    </td>
                    <td className="px-3 py-2 font-semibold text-slate-900">{PRICE_FORMATTER.format(lineTotal)}</td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => removeItemRow(row.rowId)}
                        disabled={itemDrafts.length === 1}
                        className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={addItemRow}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            Add Item Row
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            Computed Item Total: <span className="font-semibold">{PRICE_FORMATTER.format(computedTotal)}</span>
          </div>

          <label className="block text-sm font-medium text-slate-700">
            Custom Total Amount
            <input
              type="number"
              min="0"
              step="0.01"
              value={totalAmountDraft}
              onChange={(event) => {
                setTotalAmountDraft(event.target.value);
                setIsTotalOverridden(true);
              }}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
            />
          </label>

          <button
            type="button"
            onClick={useComputedTotal}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            Use Computed
          </button>
        </div>

        <div className="mt-4">
          <button
            type="button"
            onClick={submitOrder}
            disabled={isSubmitting || isBootstrapping}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? 'Saving Order...' : 'Create Order'}
          </button>
        </div>
      </div>

      {errorMessage ? (
        <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{errorMessage}</p>
      ) : null}

      {successMessage ? (
        <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          {successMessage}
        </p>
      ) : null}

      <div className="mt-8 rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Order Overview</h3>
            <p className="text-xs text-slate-500">Recent manually encoded flower orders.</p>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <label className="text-sm font-medium text-slate-700">
              Branch
              <select
                value={orderBranchFilter}
                onChange={(event) => setOrderBranchFilter(event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
              >
                <option value="all">All Branches</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm font-medium text-slate-700">
              Schedule Filter
              <select
                value={scheduleFilter}
                onChange={(event) => setScheduleFilter(event.target.value as ScheduleFilter)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
              >
                <option value="all">All Orders</option>
                <option value="advance_only">Advance/Scheduled Only</option>
                <option value="unscheduled">Unscheduled Only</option>
              </select>
            </label>
          </div>
        </div>

        <p className="mt-3 text-sm text-slate-600">
          Showing <span className="font-semibold">{visibleOrders.length}</span> of {orders.length} order(s).
        </p>

        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 font-semibold">Created</th>
                <th className="px-4 py-3 font-semibold">Branch</th>
                <th className="px-4 py-3 font-semibold">Customer</th>
                <th className="px-4 py-3 font-semibold">Scheduled</th>
                <th className="px-4 py-3 font-semibold">Items</th>
                <th className="px-4 py-3 font-semibold">Total</th>
                <th className="px-4 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {(isBootstrapping || isReloadingOrders) && (
                <tr>
                  <td className="px-4 py-4 text-slate-500" colSpan={7}>
                    Loading orders...
                  </td>
                </tr>
              )}

              {!isBootstrapping && !isReloadingOrders && visibleOrders.length === 0 && (
                <tr>
                  <td className="px-4 py-4 text-slate-500" colSpan={7}>
                    No orders found for the current filter.
                  </td>
                </tr>
              )}

              {!isBootstrapping && !isReloadingOrders && visibleOrders.map((order) => (
                <tr key={order.id} className="border-t border-slate-200 align-top">
                  <td className="px-4 py-3 text-slate-600">
                    <p>{new Date(order.created_at).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })}</p>
                    <p className="mt-1 text-xs text-slate-500">{order.id.slice(0, 8)}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{order.branch_name}</td>
                  <td className="px-4 py-3 text-slate-700">{order.customer_name || 'N/A'}</td>
                  <td className="px-4 py-3 text-slate-700">
                    {order.scheduled_for
                      ? new Date(order.scheduled_for).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })
                      : 'Not scheduled'}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{order.items.length}</td>
                  <td className="px-4 py-3 font-semibold text-slate-900">{PRICE_FORMATTER.format(order.total_amount)}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700">
                      {order.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
