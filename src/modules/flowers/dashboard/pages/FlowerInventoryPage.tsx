import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import {
  adjustFlowerInventory,
  listFlowerBranches,
  listFlowerInventoryMovements,
  listFlowerInventoryStock,
  transferFlowerInventory,
} from '../../../../services/flowers/inventory';
import { useFlowerAuth } from '../../../../lib/auth/FlowerAuthContext';
import type { FlowerBranchOption, FlowerInventoryMovementRow, FlowerInventoryStockRow } from '../../shared/types/flower-inventory';
import FlowerPageHeader from '../../shared/components/FlowerPageHeader';
import { RequireFlowerAdmin } from '../components/RequireFlowerAuth';
import FlowerInventoryStockPrint from '../components/FlowerPrintableInventoryStockPanel';
import { Minus, Plus, ArrowLeftRight, Package, Printer } from 'lucide-react';
import { INVENTORY_MOVEMENT_TYPE_LABELS } from '../../shared/utils/flower-format';
import {
  compareInventoryStockRows,
  flowerProductColorSwatchClass,
  groupInventoryStockByFlowerType,
  normalizeFlowerProductColor,
} from '../../shared/utils/flower-product-colors';

function aggregateStockByProduct(rows: FlowerInventoryStockRow[]): FlowerInventoryStockRow[] {
  const totals = new Map<string, FlowerInventoryStockRow>();

  for (const row of rows) {
    const existing = totals.get(row.product_id);
    if (existing) {
      existing.on_hand += row.on_hand;
      continue;
    }

    totals.set(row.product_id, {
      ...row,
      branch_id: 'all',
      branch_name: 'All branches',
      on_hand: row.on_hand,
      last_updated: null,
    });
  }

  return [...totals.values()].sort(compareInventoryStockRows);
}

function InventoryFlowerTypeSectionHeader({
  flowerType,
  itemCount,
  unitTotal,
}: {
  flowerType: string;
  itemCount: number;
  unitTotal: number;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-brand-muted/40 bg-brand-beige/35 px-3 py-2.5">
      <p className="font-semibold text-brand-dark">{flowerType}</p>
      <p className="shrink-0 text-xs font-medium text-brand-brown/70">
        {itemCount} color{itemCount === 1 ? '' : 's'} · {unitTotal} units
      </p>
    </div>
  );
}

function InventoryStockRowLabel({ name, color }: { name: string; color: string }) {
  const normalizedColor = normalizeFlowerProductColor(color);

  return (
    <div className="flex min-w-0 items-center gap-2">
      <span
        className={`h-3.5 w-3.5 shrink-0 rounded-full ${flowerProductColorSwatchClass(normalizedColor)}`}
        aria-hidden="true"
      />
      <div className="min-w-0">
        <p className="font-medium text-brand-dark">{name}</p>
        <p className="text-xs text-brand-brown/65">{normalizedColor}</p>
      </div>
    </div>
  );
}

function StockAdjustControls({
  branchId,
  productId,
  onAdjust,
  layout = 'stacked',
}: {
  branchId: string;
  productId: string;
  onAdjust: (
    branchId: string,
    productId: string,
    movementType: 'stock_in' | 'stock_out',
    quantity: number,
  ) => Promise<void>;
  layout?: 'stacked' | 'inline';
}) {
  const [quantity, setQuantity] = useState('1');

  function bump(delta: number) {
    const current = Number(quantity);
    const next = Number.isFinite(current) ? current + delta : 1;
    setQuantity(String(Math.max(1, next)));
  }

  async function apply(movementType: 'stock_in' | 'stock_out') {
    const parsed = Number(quantity);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return;
    }

    await onAdjust(branchId, productId, movementType, parsed);
  }

  return layout === 'inline' ? (
    <div className="flex flex-wrap items-center gap-1.5">
      <div className="inline-flex items-center rounded-xl border border-brand-muted/70 bg-white">
        <button
          type="button"
          aria-label="Decrease quantity"
          className="flex h-9 w-9 items-center justify-center text-brand-brown hover:bg-brand-beige/60"
          onClick={() => bump(-1)}
        >
          <Minus className="h-4 w-4" />
        </button>
        <input
          type="text"
          inputMode="numeric"
          value={quantity}
          onChange={(event) => setQuantity(event.target.value.replace(/[^\d]/g, ''))}
          className="h-9 w-12 border-x border-brand-muted/70 bg-transparent text-center text-sm font-semibold text-brand-dark outline-none"
        />
        <button
          type="button"
          aria-label="Increase quantity"
          className="flex h-9 w-9 items-center justify-center text-brand-brown hover:bg-brand-beige/60"
          onClick={() => bump(1)}
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
      <button
        type="button"
        className="flower-btn-secondary px-2 py-1.5 text-xs"
        onClick={() => void apply('stock_in')}
      >
        Stock in
      </button>
      <button
        type="button"
        className="flower-btn-secondary px-2 py-1.5 text-xs"
        onClick={() => void apply('stock_out')}
      >
        Stock out
      </button>
    </div>
  ) : (
    <div className="flex w-full flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-brand-brown/70">Quantity</span>
        <div className="inline-flex items-center rounded-xl border border-brand-muted/70 bg-white">
          <button
            type="button"
            aria-label="Decrease quantity"
            className="flex h-9 w-9 items-center justify-center text-brand-brown hover:bg-brand-beige/60"
            onClick={() => bump(-1)}
          >
            <Minus className="h-4 w-4" />
          </button>
          <input
            type="text"
            inputMode="numeric"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value.replace(/[^\d]/g, ''))}
            className="h-9 w-12 border-x border-brand-muted/70 bg-transparent text-center text-sm font-semibold text-brand-dark outline-none"
          />
          <button
            type="button"
            aria-label="Increase quantity"
            className="flex h-9 w-9 items-center justify-center text-brand-brown hover:bg-brand-beige/60"
            onClick={() => bump(1)}
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          className="flower-btn-secondary w-full px-2 py-2 text-xs"
          onClick={() => void apply('stock_in')}
        >
          Stock in
        </button>
        <button
          type="button"
          className="flower-btn-secondary w-full px-2 py-2 text-xs"
          onClick={() => void apply('stock_out')}
        >
          Stock out
        </button>
      </div>
    </div>
  );
}

type InventoryTab = 'stock' | 'transfer';

export default function FlowerInventoryPage() {
  const { user, isAdmin, isLoading: authLoading } = useFlowerAuth();
  const staffBranchId = !isAdmin ? user?.branch_id ?? null : null;
  const [branches, setBranches] = useState<FlowerBranchOption[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState('all');
  const branchFilterInitializedRef = useRef(false);
  const [stockRows, setStockRows] = useState<FlowerInventoryStockRow[]>([]);
  const [movementRows, setMovementRows] = useState<FlowerInventoryMovementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [transferMessage, setTransferMessage] = useState('');
  const [transferErrorMessage, setTransferErrorMessage] = useState('');

  const [fromBranchId, setFromBranchId] = useState('');
  const [toBranchId, setToBranchId] = useState('');
  const [transferProductId, setTransferProductId] = useState('');
  const [transferQty, setTransferQty] = useState('1');
  const [activeTab, setActiveTab] = useState<InventoryTab>('stock');
  const [colorFilter, setColorFilter] = useState('all');
  const [fromBranchStock, setFromBranchStock] = useState<FlowerInventoryStockRow[]>([]);
  const [fromBranchStockLoading, setFromBranchStockLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const isFirstLoadRef = useRef(true);

  async function loadData() {
    const isFirstLoad = isFirstLoadRef.current;

    if (isFirstLoad) {
      setLoading(true);
    } else {
      setIsRefreshing(true);
    }

    try {
      const stockBranchId = selectedBranchId === 'all' ? undefined : selectedBranchId;
      const movementBranchId =
        activeTab === 'transfer' ? undefined : stockBranchId;
      const [branchList, stocks, movements] = await Promise.all([
        listFlowerBranches(),
        listFlowerInventoryStock({ branchId: stockBranchId }),
        listFlowerInventoryMovements({ branchId: movementBranchId, limit: 30 }),
      ]);
      setBranches(branchList);
      setStockRows(stocks);
      setMovementRows(movements);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to load inventory.');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
      isFirstLoadRef.current = false;
    }
  }

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!branchFilterInitializedRef.current) {
      branchFilterInitializedRef.current = true;
      if (staffBranchId) {
        setSelectedBranchId(staffBranchId);
        return;
      }
    }

    void loadData();
  }, [selectedBranchId, activeTab, authLoading, staffBranchId]);

  useEffect(() => {
    setColorFilter('all');
  }, [selectedBranchId]);

  useEffect(() => {
    if (!fromBranchId) {
      setFromBranchStock([]);
      setFromBranchStockLoading(false);
      return;
    }

    setFromBranchStockLoading(true);
    void listFlowerInventoryStock({ branchId: fromBranchId })
      .then(setFromBranchStock)
      .finally(() => {
        setFromBranchStockLoading(false);
      });
  }, [fromBranchId]);

  const isAllBranchesView = selectedBranchId === 'all';

  const displayStock = useMemo(() => {
    if (!isAllBranchesView) {
      return stockRows;
    }

    return aggregateStockByProduct(stockRows);
  }, [isAllBranchesView, stockRows]);

  const filteredDisplayStock = useMemo(() => {
    if (colorFilter === 'all') {
      return displayStock;
    }

    return displayStock.filter(
      (row) => normalizeFlowerProductColor(row.product_color) === colorFilter,
    );
  }, [colorFilter, displayStock]);

  const stockByFlowerType = useMemo(
    () => groupInventoryStockByFlowerType(filteredDisplayStock),
    [filteredDisplayStock],
  );

  const availableColorFilters = useMemo(
    () =>
      [...new Set(displayStock.map((row) => normalizeFlowerProductColor(row.product_color)))].sort(
        (left, right) => left.localeCompare(right),
      ),
    [displayStock],
  );

  const totalUnitsOnHand = useMemo(
    () => filteredDisplayStock.reduce((sum, row) => sum + row.on_hand, 0),
    [filteredDisplayStock],
  );

  const stockTableColSpan = isAllBranchesView ? 2 : isAdmin ? 4 : 3;

  const selectedBranchName =
    branches.find((branch) => branch.id === selectedBranchId)?.name ?? 'All branches';

  const transferMovements = useMemo(
    () =>
      movementRows.filter(
        (movement) =>
          movement.movement_type === 'transfer_in' || movement.movement_type === 'transfer_out',
      ),
    [movementRows],
  );

  const fromBranchName = branches.find((branch) => branch.id === fromBranchId)?.name ?? '';

  const transferAvailableProducts = useMemo(
    () =>
      fromBranchStock
        .filter((row) => row.product_is_active && row.on_hand > 0)
        .sort((left, right) => left.product_name.localeCompare(right.product_name)),
    [fromBranchStock],
  );

  const selectedTransferAvailability = useMemo(() => {
    if (!transferProductId) {
      return null;
    }

    return transferAvailableProducts.find((row) => row.product_id === transferProductId)?.on_hand ?? 0;
  }, [transferAvailableProducts, transferProductId]);

  function clampTransferQty(rawValue: string, maxQuantity: number): string {
    const digits = rawValue.replace(/[^\d]/g, '');
    if (!digits) {
      return '';
    }

    if (maxQuantity <= 0) {
      return '0';
    }

    return String(Math.min(maxQuantity, Math.max(1, Number(digits))));
  }

  async function handleAdjust(
    branchId: string,
    productId: string,
    movementType: 'stock_in' | 'stock_out',
    quantity: number,
  ) {
    try {
      await adjustFlowerInventory({ branchId, productId, movementType, quantity });
      setMessage(`${movementType === 'stock_in' ? 'Stock in' : 'Stock out'} recorded.`);
      setErrorMessage('');
      await loadData();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Adjustment failed.');
    }
  }

  async function handleTransfer(event: React.FormEvent) {
    event.preventDefault();
    const quantity = Number(transferQty);

    if (!fromBranchId || !toBranchId || !transferProductId || quantity <= 0) {
      setTransferErrorMessage('Complete all transfer fields.');
      setTransferMessage('');
      return;
    }

    try {
      await transferFlowerInventory({
        fromBranchId,
        toBranchId,
        items: [{ productId: transferProductId, quantity }],
      });
      setTransferMessage('Transfer completed.');
      setTransferErrorMessage('');
      setMessage('');
      setTransferQty('1');
      await loadData();
      if (fromBranchId) {
        const refreshedStock = await listFlowerInventoryStock({ branchId: fromBranchId });
        setFromBranchStock(refreshedStock);
      }
    } catch (error) {
      setTransferErrorMessage(error instanceof Error ? error.message : 'Transfer failed.');
      setTransferMessage('');
    }
  }

  function clearTransferFeedback() {
    setTransferErrorMessage('');
    setTransferMessage('');
  }

  const isStockView = activeTab === 'stock' || !isAdmin;
  const canPrintBranchStock = isStockView && !isAllBranchesView;

  function handlePrintStock() {
    window.print();
  }

  return (
    <div className="animate-fade-in">
      <div className="print:hidden">
      <FlowerPageHeader
        label="Inventory"
        title="Branch Stock"
        description={
          isAdmin
            ? isAllBranchesView
              ? 'Totals across Dagupan, San Carlos, and Urdaneta. Select a branch to adjust stock by flower type.'
              : 'Stock grouped by flower type with colors in order. Adjust quantities for this branch below.'
            : isAllBranchesView
              ? 'Combined stock totals across all branches, grouped by flower type.'
              : 'View-only stock levels for this branch, grouped by flower type.'
        }
      />

      {isAdmin ? (
        <div className="mt-4 inline-flex rounded-xl border border-brand-muted/50 bg-white p-1">
          <button
            type="button"
            onClick={() => setActiveTab('stock')}
            className={`flower-pill flex items-center gap-1.5 ${activeTab === 'stock' ? 'flower-pill-active' : 'flower-pill-inactive'}`}
          >
            <Package className="h-3.5 w-3.5" />
            Stock levels
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('transfer')}
            className={`flower-pill flex items-center gap-1.5 ${activeTab === 'transfer' ? 'flower-pill-active' : 'flower-pill-inactive'}`}
          >
            <ArrowLeftRight className="h-3.5 w-3.5" />
            Inter-branch transfer
          </button>
        </div>
      ) : null}

      {message && (activeTab === 'stock' || !isAdmin) ? (
        <p className="mt-3 text-sm text-emerald-700">{message}</p>
      ) : null}
      {errorMessage && (activeTab === 'stock' || !isAdmin) ? (
        <p className="mt-3 text-sm text-red-700">{errorMessage}</p>
      ) : null}

      {loading && stockRows.length === 0 ? (
        <p className="mt-6 text-sm text-brand-brown/60">Loading inventory...</p>
      ) : activeTab === 'transfer' && isAdmin ? (
        <>
          <RequireFlowerAdmin>
            <form
              onSubmit={handleTransfer}
              className="mt-5 rounded-2xl border border-brand-muted/40 bg-brand-cream/20 p-4 sm:p-5"
            >
              <h3 className="text-sm font-semibold text-brand-dark">Inter-branch transfer</h3>
              <p className="mt-1 text-sm text-brand-brown/70">
                Move flowers from one branch to another. Stock is deducted from the source branch and added to the destination.
              </p>
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <label className="block text-sm font-medium text-brand-brown">
                  From branch
                  <select
                    value={fromBranchId}
                    onChange={(e) => {
                      setFromBranchId(e.target.value);
                      setTransferProductId('');
                      setTransferQty('1');
                      clearTransferFeedback();
                    }}
                    className="flower-input mt-1.5"
                    required
                  >
                    <option value="">Select branch</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm font-medium text-brand-brown">
                  To branch
                  <select
                    value={toBranchId}
                    onChange={(e) => {
                      setToBranchId(e.target.value);
                      clearTransferFeedback();
                    }}
                    className="flower-input mt-1.5"
                    required
                  >
                    <option value="">Select branch</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm font-medium text-brand-brown">
                  Flower type
                  <select
                    value={transferProductId}
                    onChange={(e) => {
                      const nextProductId = e.target.value;
                      setTransferProductId(nextProductId);
                      const maxQuantity =
                        transferAvailableProducts.find((row) => row.product_id === nextProductId)?.on_hand ?? 0;
                      setTransferQty((current) => clampTransferQty(current || '1', maxQuantity));
                      clearTransferFeedback();
                    }}
                    className="flower-input mt-1.5"
                    required
                    disabled={!fromBranchId || fromBranchStockLoading}
                  >
                    <option value="">
                      {!fromBranchId
                        ? 'Select source branch first'
                        : fromBranchStockLoading
                          ? 'Loading stock...'
                          : transferAvailableProducts.length === 0
                            ? 'No flowers in stock at this branch'
                            : 'Select flower'}
                    </option>
                    {transferAvailableProducts.map((row) => (
                      <option key={row.product_id} value={row.product_id}>
                        {row.product_name} ({row.on_hand} available)
                      </option>
                    ))}
                  </select>
                  {transferProductId && selectedTransferAvailability !== null ? (
                    <p className="mt-1.5 text-xs text-brand-brown/70">
                      {selectedTransferAvailability} available at {fromBranchName}
                    </p>
                  ) : fromBranchId && !fromBranchStockLoading && transferAvailableProducts.length === 0 ? (
                    <p className="mt-1.5 text-xs text-brand-brown/60">
                      No active flowers with stock at {fromBranchName}.
                    </p>
                  ) : null}
                </label>
                <label className="block text-sm font-medium text-brand-brown">
                  Quantity
                  <input
                    type="text"
                    inputMode="numeric"
                    value={transferQty}
                    onChange={(e) => {
                      const maxQuantity = selectedTransferAvailability ?? 0;
                      setTransferQty(clampTransferQty(e.target.value, maxQuantity));
                      clearTransferFeedback();
                    }}
                    className="flower-input mt-1.5"
                    required
                    disabled={!transferProductId || selectedTransferAvailability === 0}
                  />
                  {transferProductId && selectedTransferAvailability !== null && selectedTransferAvailability > 0 ? (
                    <p className="mt-1.5 text-xs text-brand-brown/70">
                      Max {selectedTransferAvailability}
                    </p>
                  ) : null}
                </label>
                <div className="flex items-end sm:col-span-2 lg:col-span-2">
                  <button type="submit" className="flower-btn-primary w-full sm:w-auto">
                    Transfer stock
                  </button>
                </div>
              </div>
              {transferErrorMessage ? (
                <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {transferErrorMessage}
                </p>
              ) : null}
              {transferMessage ? (
                <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                  {transferMessage}
                </p>
              ) : null}
            </form>
          </RequireFlowerAdmin>

          <div className="mt-6">
            <h3 className="text-sm font-semibold text-brand-dark">Recent transfers</h3>
            <ul className="mt-2 space-y-2 text-sm text-brand-brown/80">
              {transferMovements.length > 0 ? (
                transferMovements.map((movement) => (
                  <li key={movement.id} className="rounded-lg border border-brand-muted/30 px-3 py-2">
                    {movement.branch_name} · {movement.product_name} · {movement.movement_type} ·{' '}
                    {movement.quantity} · {movement.note}
                  </li>
                ))
              ) : (
                <li className="rounded-lg border border-brand-muted/30 px-3 py-2 text-brand-brown/60">
                  No transfers recorded yet.
                </li>
              )}
            </ul>
          </div>
        </>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <select
              value={selectedBranchId}
              onChange={(event) => setSelectedBranchId(event.target.value)}
              className="flower-input max-w-xs"
            >
              <option value="all">All branches</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
            {availableColorFilters.length > 1 ? (
              <select
                value={colorFilter}
                onChange={(event) => setColorFilter(event.target.value)}
                className="flower-input max-w-[180px]"
              >
                <option value="all">All colors</option>
                {availableColorFilters.map((color) => (
                  <option key={color} value={color}>
                    {color}
                  </option>
                ))}
              </select>
            ) : null}
          </div>
          <p className="mt-2 text-sm text-brand-brown/70">
            {isAllBranchesView
              ? `Showing combined totals for all branches (${totalUnitsOnHand} units on hand).`
              : `Showing stock for ${selectedBranchName} (${totalUnitsOnHand} units on hand), grouped by flower type.`}
            {isRefreshing ? ' · Updating…' : ''}
          </p>

          <div className="mt-5 space-y-5 md:hidden">
            {stockByFlowerType.map((section) => (
              <div key={section.flowerType} className="space-y-3">
                <InventoryFlowerTypeSectionHeader
                  flowerType={section.flowerType}
                  itemCount={section.rows.length}
                  unitTotal={section.rows.reduce((sum, row) => sum + row.on_hand, 0)}
                />
                {section.rows.map((row) => (
                  <div
                    key={isAllBranchesView ? row.product_id : `${row.branch_id}-${row.product_id}-card`}
                    className="flower-card p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <InventoryStockRowLabel name={row.product_name} color={row.product_color} />
                        <p className="mt-1 text-xs text-brand-brown/70">
                          {isAllBranchesView ? 'All branches total' : row.branch_name}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-xs font-medium uppercase tracking-wide text-brand-brown/60">
                          {isAllBranchesView ? 'Total on hand' : 'On hand'}
                        </p>
                        <p className="text-2xl font-bold leading-tight text-brand-dark">{row.on_hand}</p>
                      </div>
                    </div>
                    {isAdmin && !isAllBranchesView ? (
                      <div className="mt-4 border-t border-brand-muted/30 pt-4">
                        <StockAdjustControls
                          branchId={row.branch_id}
                          productId={row.product_id}
                          onAdjust={handleAdjust}
                        />
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            ))}
            {stockByFlowerType.length === 0 ? (
              <p className="rounded-xl border border-brand-muted/30 px-3 py-6 text-center text-sm text-brand-brown/60">
                No stock to show for this filter.
              </p>
            ) : null}
            {isAdmin && !isAllBranchesView && filteredDisplayStock.length > 0 ? (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handlePrintStock}
                  className="flower-btn-secondary inline-flex gap-2 text-sm"
                >
                  <Printer className="h-4 w-4" />
                  Print stock
                </button>
              </div>
            ) : null}
          </div>

          <div className="mt-5 hidden overflow-x-auto rounded-2xl border border-brand-muted/40 md:block">
            {isAdmin && !isAllBranchesView ? (
              <div className="flex items-center justify-end border-b border-brand-muted/30 bg-brand-beige/20 px-3 py-2">
                <button
                  type="button"
                  onClick={handlePrintStock}
                  className="flower-btn-secondary inline-flex gap-2 text-sm"
                >
                  <Printer className="h-4 w-4" />
                  Print stock
                </button>
              </div>
            ) : null}
            <table className="min-w-full text-left text-sm">
              <thead className="bg-brand-beige/40 text-brand-brown">
                <tr>
                  {isAllBranchesView ? null : <th className="px-3 py-2">Branch</th>}
                  <th className="min-w-[10rem] px-3 py-2">Flower</th>
                  <th className="px-3 py-2">{isAllBranchesView ? 'Total on hand' : 'On hand'}</th>
                  {isAdmin && !isAllBranchesView ? (
                    <th className="min-w-[16rem] px-3 py-2">Adjust stock</th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {stockByFlowerType.map((section) => (
                  <Fragment key={section.flowerType}>
                    <tr className="border-t border-brand-muted/30 bg-brand-beige/25">
                      <td colSpan={stockTableColSpan} className="px-3 py-2">
                        <InventoryFlowerTypeSectionHeader
                          flowerType={section.flowerType}
                          itemCount={section.rows.length}
                          unitTotal={section.rows.reduce((sum, row) => sum + row.on_hand, 0)}
                        />
                      </td>
                    </tr>
                    {section.rows.map((row) => (
                      <tr
                        key={isAllBranchesView ? row.product_id : `${row.branch_id}-${row.product_id}`}
                        className="border-t border-brand-muted/30"
                      >
                        {isAllBranchesView ? null : (
                          <td className="px-3 py-2 whitespace-nowrap">{row.branch_name}</td>
                        )}
                        <td className="min-w-[10rem] px-3 py-2">
                          <InventoryStockRowLabel name={row.product_name} color={row.product_color} />
                        </td>
                        <td className="px-3 py-2 font-semibold">{row.on_hand}</td>
                        {isAdmin && !isAllBranchesView ? (
                          <td className="min-w-[16rem] px-3 py-2">
                            <StockAdjustControls
                              branchId={row.branch_id}
                              productId={row.product_id}
                              onAdjust={handleAdjust}
                              layout="inline"
                            />
                          </td>
                        ) : null}
                      </tr>
                    ))}
                  </Fragment>
                ))}
                {stockByFlowerType.length === 0 ? (
                  <tr>
                    <td colSpan={stockTableColSpan} className="px-3 py-8 text-center text-brand-brown/60">
                      No stock to show for this filter.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          {isAdmin && isAllBranchesView ? (
            <p className="mt-3 text-sm text-brand-brown/60">
              Select a specific branch above to stock in or stock out. Use the Inter-branch transfer tab to move stock between branches.
            </p>
          ) : null}

          <div className="mt-6">
            <h3 className="text-sm font-semibold text-brand-dark">Recent movements</h3>
            <p className="mt-1 text-xs text-brand-brown/60">
              {isAllBranchesView ? 'All branches' : selectedBranchName}
            </p>
            <ul className="mt-2 space-y-2 text-sm text-brand-brown/80">
              {movementRows.length > 0 ? (
                movementRows.map((movement) => (
                  <li key={movement.id} className="rounded-lg border border-brand-muted/30 px-3 py-2">
                    {movement.branch_name} · {movement.product_name} ·{' '}
                    {INVENTORY_MOVEMENT_TYPE_LABELS[movement.movement_type] ?? movement.movement_type} ·{' '}
                    {movement.quantity} · {movement.note}
                  </li>
                ))
              ) : (
                <li className="rounded-lg border border-brand-muted/30 px-3 py-2 text-brand-brown/60">
                  No movements recorded yet.
                </li>
              )}
            </ul>
          </div>
        </>
      )}
      </div>

      {canPrintBranchStock ? (
        <FlowerInventoryStockPrint
          branchId={selectedBranchId}
          branchLabel={selectedBranchName}
          disabled={loading && stockRows.length === 0}
        />
      ) : null}
    </div>
  );
}
