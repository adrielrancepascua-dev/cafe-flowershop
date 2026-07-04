import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { ClipboardList, History, Sparkles } from 'lucide-react';
import { useFlowerAuth } from '../../../../lib/auth/FlowerAuthContext';
import { listFlowerBranches } from '../../../../services/flowers/inventory';
import { listFlowerProducts } from '../../../../services/flowers/products/flowers-products.service';
import {
  createFlowerSupplyTransfer,
  listFlowerSupplyTransfers,
} from '../../../../services/flowers/supplies';
import type { FlowerBranchOption } from '../../shared/types/flower-inventory';
import type { FlowerProduct } from '../../shared/types/flower-product';
import type {
  FlowerSupplyTransfer,
  FlowerSupplyTransferType,
} from '../../shared/types/flower-supply-transfer';
import FlowerPageHeader from '../../shared/components/FlowerPageHeader';
import FlowerPrintControls from '../../shared/components/FlowerPrintControls';
import { FlowerSupplyTransferPrintDocument } from '../../shared/components/FlowerThermalPrint';
import { PRICE_FORMATTER, toDateKey } from '../../shared/utils/flower-format';
import {
  buildSupplyTransferLine,
  computeFlowerLiability,
  computeSupplyTransferTotalLiability,
  DAGUPAN_BRANCH_ID,
  describeSupplyTransferType,
} from '../../shared/utils/flower-supply-transfer';
import FlowerSupplyLineEditor, {
  createDefaultSupplyLines,
  mapSupplyLinesToInput,
  type FlowerSupplyLineDraft,
} from '../components/FlowerSupplyLineEditor';

type SuppliesTab = 'new_arrival' | 'old_stock' | 'history';

function emptyNewArrivalForm() {
  return {
    arrivedAtBranchId: DAGUPAN_BRANCH_ID,
    supplier: '',
    amountPaidSupplies: '',
    amountPaidTranspo: '',
    fromBranchId: DAGUPAN_BRANCH_ID,
    toBranchId: '',
    preparedBy: '',
    receivedBy: '',
    lines: createDefaultSupplyLines(),
  };
}

function emptyOldStockForm() {
  return {
    originalArrivalDate: toDateKey(new Date()),
    fromBranchId: DAGUPAN_BRANCH_ID,
    toBranchId: '',
    preparedBy: '',
    receivedBy: '',
    lines: createDefaultSupplyLines(),
  };
}

function formatTransferDateLabel(value: string): string {
  return new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function FlowerSuppliesPage() {
  const { user, isAdmin, isLoading } = useFlowerAuth();
  const [activeTab, setActiveTab] = useState<SuppliesTab>('new_arrival');
  const [branches, setBranches] = useState<FlowerBranchOption[]>([]);
  const [products, setProducts] = useState<FlowerProduct[]>([]);
  const [transfers, setTransfers] = useState<FlowerSupplyTransfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [printTransfer, setPrintTransfer] = useState<FlowerSupplyTransfer | null>(null);

  const [newArrivalForm, setNewArrivalForm] = useState(emptyNewArrivalForm);
  const [oldStockForm, setOldStockForm] = useState(emptyOldStockForm);

  async function loadData() {
    setLoading(true);
    try {
      const [branchList, productList, transferList] = await Promise.all([
        listFlowerBranches(),
        listFlowerProducts(),
        listFlowerSupplyTransfers({ limit: 100 }),
      ]);
      setBranches(branchList);
      setProducts(productList);
      setTransfers(transferList);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to load supplies data.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!isLoading && isAdmin) {
      void loadData();
    }
  }, [isAdmin, isLoading]);

  const productById = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products],
  );

  const previewNewArrival = useMemo(() => {
    const items = mapSupplyLinesToInput(newArrivalForm.lines);
    const lines = items
      .map((item, index) => {
        const product = productById.get(item.productId);
        if (!product) {
          return null;
        }

        return buildSupplyTransferLine(item, product, `preview-${index}`);
      })
      .filter((line): line is NonNullable<typeof line> => line !== null);

    const flowerLiability = computeFlowerLiability(lines);
    const totalLiability = computeSupplyTransferTotalLiability({
      transfer_type: 'new_arrival',
      flower_liability: flowerLiability,
      amount_paid_supplies: Number(newArrivalForm.amountPaidSupplies) || 0,
      amount_paid_transpo: Number(newArrivalForm.amountPaidTranspo) || 0,
    });

    return { flowerLiability, totalLiability, lineCount: lines.length };
  }, [newArrivalForm, productById]);

  const previewOldStock = useMemo(() => {
    const items = mapSupplyLinesToInput(oldStockForm.lines);
    const lines = items
      .map((item, index) => {
        const product = productById.get(item.productId);
        if (!product) {
          return null;
        }

        return buildSupplyTransferLine(item, product, `preview-${index}`);
      })
      .filter((line): line is NonNullable<typeof line> => line !== null);

    const flowerLiability = computeFlowerLiability(lines);
    const totalLiability = computeSupplyTransferTotalLiability({
      transfer_type: 'old_stock',
      flower_liability: flowerLiability,
    });

    return { flowerLiability, totalLiability, lineCount: lines.length };
  }, [oldStockForm, productById]);

  if (isLoading) {
    return <p className="text-sm text-brand-brown/60">Loading...</p>;
  }

  if (!isAdmin) {
    return <Navigate to="/dashboard/flowers" replace />;
  }

  async function handleSubmit(transferType: FlowerSupplyTransferType) {
    if (!user) {
      return;
    }

    setSubmitting(true);
    setMessage('');
    setErrorMessage('');

    try {
      const isNewArrival = transferType === 'new_arrival';
      const created = await createFlowerSupplyTransfer({
        transfer_type: transferType,
        arrived_at_branch_id: isNewArrival ? newArrivalForm.arrivedAtBranchId : null,
        supplier: isNewArrival ? newArrivalForm.supplier : '',
        amount_paid_supplies: isNewArrival ? Number(newArrivalForm.amountPaidSupplies) || 0 : 0,
        amount_paid_transpo: isNewArrival ? Number(newArrivalForm.amountPaidTranspo) || 0 : 0,
        original_arrival_date: isNewArrival ? null : oldStockForm.originalArrivalDate,
        from_branch_id: isNewArrival ? newArrivalForm.fromBranchId : oldStockForm.fromBranchId,
        to_branch_id: isNewArrival ? newArrivalForm.toBranchId : oldStockForm.toBranchId,
        prepared_by: isNewArrival ? newArrivalForm.preparedBy : oldStockForm.preparedBy,
        received_by: isNewArrival ? newArrivalForm.receivedBy : oldStockForm.receivedBy,
        items: mapSupplyLinesToInput(isNewArrival ? newArrivalForm.lines : oldStockForm.lines),
        created_by_id: user.id,
        created_by_name: user.display_name,
      });

      if (isNewArrival) {
        setNewArrivalForm(emptyNewArrivalForm());
      } else {
        setOldStockForm(emptyOldStockForm());
      }

      setMessage('Supply transfer saved. Inventory updated and voucher recorded.');
      setPrintTransfer(created);
      await loadData();
      setActiveTab('history');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to save supply transfer.');
    } finally {
      setSubmitting(false);
    }
  }

  function updateNewArrivalLines(lines: FlowerSupplyLineDraft[]) {
    setNewArrivalForm((current) => ({ ...current, lines }));
  }

  function updateOldStockLines(lines: FlowerSupplyLineDraft[]) {
    setOldStockForm((current) => ({ ...current, lines }));
  }

  return (
    <div className="animate-fade-in">
      <FlowerPageHeader
        label="Supplies"
        title="Branch supply transfers"
        description="Track Dagupan-paid supplies sent to other branches. Saving a voucher moves inventory and records branch liability."
      />

      <div className="mt-4 inline-flex flex-wrap rounded-xl border border-brand-muted/50 bg-white p-1">
        {([
          { id: 'new_arrival' as const, label: 'New arrivals', icon: Sparkles },
          { id: 'old_stock' as const, label: 'Old stock', icon: ClipboardList },
          { id: 'history' as const, label: 'History', icon: History },
        ]).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => {
              setActiveTab(tab.id);
              setMessage('');
              setErrorMessage('');
            }}
            className={`flower-pill inline-flex items-center gap-1.5 ${
              activeTab === tab.id ? 'flower-pill-active' : 'flower-pill-inactive'
            }`}
          >
            <tab.icon className="h-3.5 w-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {message ? <p className="mt-3 text-sm text-emerald-700">{message}</p> : null}
      {errorMessage ? <p className="mt-3 text-sm text-red-700">{errorMessage}</p> : null}

      {loading ? (
        <p className="mt-6 text-sm text-brand-brown/60">Loading supplies...</p>
      ) : activeTab === 'new_arrival' ? (
        <form
          className="mt-5 space-y-4 rounded-2xl border border-brand-muted/40 bg-brand-cream/20 p-4 sm:p-5"
          onSubmit={(event) => {
            event.preventDefault();
            void handleSubmit('new_arrival');
          }}
        >
          <h3 className="text-sm font-semibold text-brand-dark">Branch transfer for new arrivals</h3>
          <p className="text-sm text-brand-brown/70">
            Total liability = flower cost (qty × unit cost) + supplies paid + transpo paid.
          </p>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="block text-sm font-medium text-brand-brown">
              Arrived at
              <select
                value={newArrivalForm.arrivedAtBranchId}
                onChange={(event) =>
                  setNewArrivalForm((current) => ({
                    ...current,
                    arrivedAtBranchId: event.target.value,
                  }))
                }
                className="flower-input mt-1.5"
                required
              >
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>{branch.name}</option>
                ))}
              </select>
            </label>

            <label className="block text-sm font-medium text-brand-brown sm:col-span-2">
              Supplier
              <input
                type="text"
                value={newArrivalForm.supplier}
                onChange={(event) =>
                  setNewArrivalForm((current) => ({ ...current, supplier: event.target.value }))
                }
                className="flower-input mt-1.5"
                required
              />
            </label>

            <label className="block text-sm font-medium text-brand-brown">
              Amount paid (supplies)
              <input
                type="number"
                min="0"
                step="0.01"
                value={newArrivalForm.amountPaidSupplies}
                onChange={(event) =>
                  setNewArrivalForm((current) => ({
                    ...current,
                    amountPaidSupplies: event.target.value,
                  }))
                }
                className="flower-input mt-1.5"
              />
            </label>

            <label className="block text-sm font-medium text-brand-brown">
              Amount paid (transpo)
              <input
                type="number"
                min="0"
                step="0.01"
                value={newArrivalForm.amountPaidTranspo}
                onChange={(event) =>
                  setNewArrivalForm((current) => ({
                    ...current,
                    amountPaidTranspo: event.target.value,
                  }))
                }
                className="flower-input mt-1.5"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="block text-sm font-medium text-brand-brown">
              From
              <select
                value={newArrivalForm.fromBranchId}
                onChange={(event) =>
                  setNewArrivalForm((current) => ({ ...current, fromBranchId: event.target.value }))
                }
                className="flower-input mt-1.5"
                required
              >
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>{branch.name}</option>
                ))}
              </select>
            </label>

            <label className="block text-sm font-medium text-brand-brown">
              Prepared by
              <input
                type="text"
                value={newArrivalForm.preparedBy}
                onChange={(event) =>
                  setNewArrivalForm((current) => ({ ...current, preparedBy: event.target.value }))
                }
                className="flower-input mt-1.5"
                required
              />
            </label>

            <label className="block text-sm font-medium text-brand-brown">
              To
              <select
                value={newArrivalForm.toBranchId}
                onChange={(event) =>
                  setNewArrivalForm((current) => ({ ...current, toBranchId: event.target.value }))
                }
                className="flower-input mt-1.5"
                required
              >
                <option value="">Select branch</option>
                {branches
                  .filter((branch) => branch.id !== newArrivalForm.fromBranchId)
                  .map((branch) => (
                    <option key={branch.id} value={branch.id}>{branch.name}</option>
                  ))}
              </select>
            </label>

            <label className="block text-sm font-medium text-brand-brown">
              Received by
              <input
                type="text"
                value={newArrivalForm.receivedBy}
                onChange={(event) =>
                  setNewArrivalForm((current) => ({ ...current, receivedBy: event.target.value }))
                }
                className="flower-input mt-1.5"
                required
              />
            </label>
          </div>

          <FlowerSupplyLineEditor
            products={products}
            lines={newArrivalForm.lines}
            onChange={updateNewArrivalLines}
            disabled={submitting}
          />

          <div className="rounded-xl border border-brand-brown/15 bg-white px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-brand-brown/60">Preview</p>
            <p className="mt-1 text-sm text-brand-brown/80">
              Flower cost: {PRICE_FORMATTER.format(previewNewArrival.flowerLiability)}
            </p>
            <p className="mt-1 font-serif text-lg font-semibold text-brand-dark">
              Total liability: {PRICE_FORMATTER.format(previewNewArrival.totalLiability)}
            </p>
          </div>

          <button type="submit" disabled={submitting} className="flower-btn-primary">
            {submitting ? 'Saving...' : 'Save transfer & update inventory'}
          </button>
        </form>
      ) : activeTab === 'old_stock' ? (
        <form
          className="mt-5 space-y-4 rounded-2xl border border-brand-muted/40 bg-brand-cream/20 p-4 sm:p-5"
          onSubmit={(event) => {
            event.preventDefault();
            void handleSubmit('old_stock');
          }}
        >
          <h3 className="text-sm font-semibold text-brand-dark">Branch transfer for old stocks</h3>
          <p className="text-sm text-brand-brown/70">
            Total liability = flower cost only (qty × unit cost per color).
          </p>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="block text-sm font-medium text-brand-brown">
              Original date of arrival
              <input
                type="date"
                value={oldStockForm.originalArrivalDate}
                onChange={(event) =>
                  setOldStockForm((current) => ({
                    ...current,
                    originalArrivalDate: event.target.value,
                  }))
                }
                className="flower-input mt-1.5"
                required
              />
            </label>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="block text-sm font-medium text-brand-brown">
              From
              <select
                value={oldStockForm.fromBranchId}
                onChange={(event) =>
                  setOldStockForm((current) => ({ ...current, fromBranchId: event.target.value }))
                }
                className="flower-input mt-1.5"
                required
              >
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>{branch.name}</option>
                ))}
              </select>
            </label>

            <label className="block text-sm font-medium text-brand-brown">
              Prepared by
              <input
                type="text"
                value={oldStockForm.preparedBy}
                onChange={(event) =>
                  setOldStockForm((current) => ({ ...current, preparedBy: event.target.value }))
                }
                className="flower-input mt-1.5"
                required
              />
            </label>

            <label className="block text-sm font-medium text-brand-brown">
              To
              <select
                value={oldStockForm.toBranchId}
                onChange={(event) =>
                  setOldStockForm((current) => ({ ...current, toBranchId: event.target.value }))
                }
                className="flower-input mt-1.5"
                required
              >
                <option value="">Select branch</option>
                {branches
                  .filter((branch) => branch.id !== oldStockForm.fromBranchId)
                  .map((branch) => (
                    <option key={branch.id} value={branch.id}>{branch.name}</option>
                  ))}
              </select>
            </label>

            <label className="block text-sm font-medium text-brand-brown">
              Received by
              <input
                type="text"
                value={oldStockForm.receivedBy}
                onChange={(event) =>
                  setOldStockForm((current) => ({ ...current, receivedBy: event.target.value }))
                }
                className="flower-input mt-1.5"
                required
              />
            </label>
          </div>

          <FlowerSupplyLineEditor
            products={products}
            lines={oldStockForm.lines}
            onChange={updateOldStockLines}
            disabled={submitting}
          />

          <div className="rounded-xl border border-brand-brown/15 bg-white px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-brand-brown/60">Preview</p>
            <p className="mt-1 font-serif text-lg font-semibold text-brand-dark">
              Total liability: {PRICE_FORMATTER.format(previewOldStock.totalLiability)}
            </p>
          </div>

          <button type="submit" disabled={submitting} className="flower-btn-primary">
            {submitting ? 'Saving...' : 'Save transfer & update inventory'}
          </button>
        </form>
      ) : (
        <div className="mt-5 space-y-3">
          {transfers.length === 0 ? (
            <p className="rounded-xl border border-brand-muted/30 px-4 py-6 text-sm text-brand-brown/60">
              No supply transfers recorded yet.
            </p>
          ) : (
            transfers.map((transfer) => (
              <article
                key={transfer.id}
                className="rounded-2xl border border-brand-muted/35 bg-white p-4 sm:p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-brand-brown/60">
                      {describeSupplyTransferType(transfer.transfer_type)}
                    </p>
                    <p className="mt-1 font-serif text-lg font-semibold text-brand-dark">
                      {transfer.from_branch_name} → {transfer.to_branch_name}
                    </p>
                    <p className="mt-1 text-sm text-brand-brown/70">
                      {formatTransferDateLabel(transfer.created_at)}
                      {transfer.transfer_type === 'new_arrival' && transfer.supplier
                        ? ` · ${transfer.supplier}`
                        : ''}
                      {transfer.transfer_type === 'old_stock' && transfer.original_arrival_date
                        ? ` · Original arrival ${formatTransferDateLabel(transfer.original_arrival_date)}`
                        : ''}
                    </p>
                    <p className="mt-1 text-sm text-brand-brown/70">
                      Prepared by {transfer.prepared_by} · Received by {transfer.received_by}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs uppercase tracking-wide text-brand-brown/60">Total liability</p>
                    <p className="font-serif text-xl font-semibold text-brand-dark">
                      {PRICE_FORMATTER.format(transfer.total_liability)}
                    </p>
                    <FlowerPrintControls
                      className="mt-2 justify-end"
                      label="Print voucher"
                      showSizeHint={false}
                      onPrint={() => setPrintTransfer(transfer)}
                    />
                  </div>
                </div>

                <ul className="mt-3 space-y-1 text-sm text-brand-brown/80">
                  {transfer.items.map((item) => (
                    <li key={item.id}>
                      {item.product_name} · {item.product_color} × {item.quantity} —{' '}
                      {PRICE_FORMATTER.format(item.line_liability)}
                    </li>
                  ))}
                </ul>
              </article>
            ))
          )}
        </div>
      )}

      <div className="pointer-events-none fixed left-[-9999px] top-0 opacity-0 print:pointer-events-auto print:static print:opacity-100">
        {printTransfer ? <FlowerSupplyTransferPrintDocument transfer={printTransfer} /> : null}
      </div>
    </div>
  );
}
