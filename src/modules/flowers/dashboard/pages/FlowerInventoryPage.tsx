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
import FlowerPrintControls from '../../shared/components/FlowerPrintControls';
import { Minus, Plus, ArrowLeftRight, Package, ChevronDown } from 'lucide-react';
import { INVENTORY_MOVEMENT_TYPE_LABELS } from '../../shared/utils/flower-format';
import {
  compareInventoryStockRows,
  flowerProductColorSwatchClass,
  formatInventoryStockLabel,
  groupInventoryStockByFlowerType,
  groupInventoryStockMisc,
  normalizeFlowerProductColor,
} from '../../shared/utils/flower-product-colors';
import {
  FLOWER_PRODUCT_KIND_LABELS,
  normalizeFlowerProductKind,
  type FlowerProductKind,
} from '../../shared/utils/flower-product-kind';
import {
  MISC_PRODUCT_CATEGORIES,
  MISC_PRODUCT_CATEGORY_LABELS,
  miscCategoryFromFlowerType,
  type MiscProductCategory,
} from '../../shared/utils/flower-misc-category';

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

function InventoryColorVariantLabel({ color }: { color: string }) {
  const normalizedColor = normalizeFlowerProductColor(color);

  return (
    <div className="flex min-w-0 items-center gap-2 pl-2 sm:pl-4">
      <span
        className={`h-3.5 w-3.5 shrink-0 rounded-full ${flowerProductColorSwatchClass(normalizedColor)}`}
        aria-hidden="true"
      />
      <span className="inline-flex rounded-full border border-brand-muted/45 bg-white px-2.5 py-0.5 text-xs font-semibold text-brand-dark">
        {normalizedColor}
      </span>
    </div>
  );
}

function InventoryFlowerCategoryHeader({
  flowerType,
  rows,
  expanded,
  onToggle,
}: {
  flowerType: string;
  rows: FlowerInventoryStockRow[];
  expanded: boolean;
  onToggle: () => void;
}) {
  const unitTotal = rows.reduce((sum, row) => sum + row.on_hand, 0);
  const panelId = `inventory-category-${flowerType.replace(/\s+/g, '-').toLowerCase()}`;

  return (
    <button
      type="button"
      aria-expanded={expanded}
      aria-controls={panelId}
      onClick={onToggle}
      className="flex w-full items-start gap-2 text-left transition hover:opacity-90"
    >
      <ChevronDown
        className={`mt-0.5 h-4 w-4 shrink-0 text-brand-brown/70 transition-transform ${
          expanded ? 'rotate-0' : '-rotate-90'
        }`}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold text-brand-dark">{flowerType}</p>
          <span className="rounded-full border border-brand-muted/40 bg-white/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-brown/70">
            Category
          </span>
        </div>
        <p className="mt-0.5 text-xs text-brand-brown/65">
          {rows.length} colors · {unitTotal} units · {expanded ? 'tap to collapse' : 'tap to expand'}
        </p>
        {!expanded ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {rows.map((row) => {
              const normalizedColor = normalizeFlowerProductColor(row.product_color);
              return (
                <span
                  key={row.product_id}
                  className="inline-flex items-center gap-1.5 rounded-full border border-brand-muted/45 bg-white px-2 py-0.5 text-xs font-semibold text-brand-dark"
                >
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${flowerProductColorSwatchClass(normalizedColor)}`}
                    aria-hidden
                  />
                  {normalizedColor}
                  <span className="font-normal text-brand-brown/60">({row.on_hand})</span>
                </span>
              );
            })}
          </div>
        ) : null}
      </div>
    </button>
  );
}

function InventoryFlowerCategoryMobileGroup({
  section,
  isAllBranchesView,
  isAdmin,
  onAdjust,
}: {
  section: { flowerType: string; rows: FlowerInventoryStockRow[] };
  isAllBranchesView: boolean;
  isAdmin: boolean;
  onAdjust: (
    branchId: string,
    productId: string,
    movementType: 'stock_in' | 'stock_out',
    quantity: number,
  ) => Promise<void>;
}) {
  const isCategory = section.rows.length > 1;
  const [expanded, setExpanded] = useState(false);
  const panelId = `inventory-category-mobile-${section.flowerType.replace(/\s+/g, '-').toLowerCase()}`;

  if (!isCategory) {
    const row = section.rows[0];
    if (!row) {
      return null;
    }

    return (
      <InventoryFlowerMobileStockCard
        row={row}
        isAllBranchesView={isAllBranchesView}
        isAdmin={isAdmin}
        onAdjust={onAdjust}
        showColorVariant={false}
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-brand-muted/40 bg-white shadow-sm">
      <div
        className={`bg-gradient-to-r from-brand-beige/70 to-brand-cream/40 px-3 py-3 sm:px-4 ${
          expanded ? 'border-b border-brand-muted/25' : ''
        }`}
      >
        <InventoryFlowerCategoryHeader
          flowerType={section.flowerType}
          rows={section.rows}
          expanded={expanded}
          onToggle={() => setExpanded((current) => !current)}
        />
      </div>

      {expanded ? (
        <div id={panelId} className="divide-y divide-brand-muted/15 bg-brand-cream/10">
          {section.rows.map((row) => (
            <InventoryFlowerMobileStockCard
              key={isAllBranchesView ? row.product_id : `${row.branch_id}-${row.product_id}-card`}
              row={row}
              isAllBranchesView={isAllBranchesView}
              isAdmin={isAdmin}
              onAdjust={onAdjust}
              showColorVariant
              nested
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function InventoryFlowerMobileStockCard({
  row,
  isAllBranchesView,
  isAdmin,
  onAdjust,
  showColorVariant,
  nested = false,
}: {
  row: FlowerInventoryStockRow;
  isAllBranchesView: boolean;
  isAdmin: boolean;
  onAdjust: (
    branchId: string,
    productId: string,
    movementType: 'stock_in' | 'stock_out',
    quantity: number,
  ) => Promise<void>;
  showColorVariant: boolean;
  nested?: boolean;
}) {
  return (
    <div className={nested ? 'px-4 py-3' : 'flower-card p-4'}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {showColorVariant ? (
            <InventoryColorVariantLabel color={row.product_color} />
          ) : (
            <InventoryStockRowLabel name={row.product_name} color={row.product_color} />
          )}
          <p className="mt-1 text-xs text-brand-brown/70">
            {isAllBranchesView ? 'All branches total' : row.branch_name}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xs font-medium uppercase tracking-wide text-brand-brown/60">
            {isAllBranchesView ? 'Total on hand' : 'On hand'}
          </p>
          <p
            className={`text-2xl font-bold leading-tight ${
              row.on_hand < 0 ? 'text-red-700' : 'text-brand-dark'
            }`}
          >
            {row.on_hand}
          </p>
        </div>
      </div>
      {isAdmin && !isAllBranchesView ? (
        <div className="mt-4 border-t border-brand-muted/30 pt-4">
          <StockAdjustControls branchId={row.branch_id} productId={row.product_id} onAdjust={onAdjust} />
        </div>
      ) : null}
    </div>
  );
}

function InventoryFlowerCategoryDesktopGroup({
  section,
  isAllBranchesView,
  isAdmin,
  stockTableColSpan,
  onAdjust,
}: {
  section: { flowerType: string; rows: FlowerInventoryStockRow[] };
  isAllBranchesView: boolean;
  isAdmin: boolean;
  stockTableColSpan: number;
  onAdjust: (
    branchId: string,
    productId: string,
    movementType: 'stock_in' | 'stock_out',
    quantity: number,
  ) => Promise<void>;
}) {
  const isCategory = section.rows.length > 1;
  const [expanded, setExpanded] = useState(false);

  if (!isCategory) {
    const row = section.rows[0];
    if (!row) {
      return null;
    }

    return (
      <InventoryFlowerDesktopStockRow
        row={row}
        isAllBranchesView={isAllBranchesView}
        isAdmin={isAdmin}
        onAdjust={onAdjust}
        showColorVariant={false}
      />
    );
  }

  return (
    <Fragment>
      <tr className="border-t border-brand-muted/30 bg-brand-beige/25">
        <td colSpan={stockTableColSpan} className="px-3 py-2.5">
          <InventoryFlowerCategoryHeader
            flowerType={section.flowerType}
            rows={section.rows}
            expanded={expanded}
            onToggle={() => setExpanded((current) => !current)}
          />
        </td>
      </tr>
      {expanded
        ? section.rows.map((row) => (
            <InventoryFlowerDesktopStockRow
              key={isAllBranchesView ? row.product_id : `${row.branch_id}-${row.product_id}`}
              row={row}
              isAllBranchesView={isAllBranchesView}
              isAdmin={isAdmin}
              onAdjust={onAdjust}
              showColorVariant
              nested
            />
          ))
        : null}
    </Fragment>
  );
}

function InventoryFlowerDesktopStockRow({
  row,
  isAllBranchesView,
  isAdmin,
  onAdjust,
  showColorVariant,
  nested = false,
}: {
  row: FlowerInventoryStockRow;
  isAllBranchesView: boolean;
  isAdmin: boolean;
  onAdjust: (
    branchId: string,
    productId: string,
    movementType: 'stock_in' | 'stock_out',
    quantity: number,
  ) => Promise<void>;
  showColorVariant: boolean;
  nested?: boolean;
}) {
  return (
    <tr className={`border-t border-brand-muted/30 ${nested ? 'bg-brand-cream/10' : ''}`}>
      {isAllBranchesView ? null : (
        <td className="px-3 py-2 whitespace-nowrap">{row.branch_name}</td>
      )}
      <td className="min-w-[10rem] px-3 py-2">
        {showColorVariant ? (
          <InventoryColorVariantLabel color={row.product_color} />
        ) : (
          <InventoryStockRowLabel name={row.product_name} color={row.product_color} />
        )}
      </td>
      <td className={`px-3 py-2 font-semibold ${row.on_hand < 0 ? 'text-red-700' : ''}`}>{row.on_hand}</td>
      {isAdmin && !isAllBranchesView ? (
        <td className="min-w-[16rem] px-3 py-2">
          <StockAdjustControls
            branchId={row.branch_id}
            productId={row.product_id}
            onAdjust={onAdjust}
            layout="inline"
          />
        </td>
      ) : null}
    </tr>
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

function InventoryMiscRowLabel({ name }: { name: string }) {
  return <p className="font-medium text-brand-dark">{name}</p>;
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
  const [transferKind, setTransferKind] = useState<FlowerProductKind>('flower');
  const [transferFlowerType, setTransferFlowerType] = useState('');
  const [transferProductId, setTransferProductId] = useState('');
  const [transferQty, setTransferQty] = useState('1');
  const [activeTab, setActiveTab] = useState<InventoryTab>('stock');
  const [stockKindTab, setStockKindTab] = useState<FlowerProductKind>('flower');
  const [colorFilter, setColorFilter] = useState('all');
  const [miscCategoryFilter, setMiscCategoryFilter] = useState<MiscProductCategory>('wrappers');
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
  }, [selectedBranchId, stockKindTab]);

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

  const kindFilteredDisplayStock = useMemo(() => {
    return displayStock.filter((row) => row.product_kind === stockKindTab);
  }, [displayStock, stockKindTab]);

  const filteredDisplayStock = useMemo(() => {
    if (stockKindTab === 'misc') {
      return kindFilteredDisplayStock.filter(
        (row) => miscCategoryFromFlowerType(row.product_flower_type) === miscCategoryFilter,
      );
    }

    if (colorFilter === 'all') {
      return kindFilteredDisplayStock;
    }

    return kindFilteredDisplayStock.filter(
      (row) => normalizeFlowerProductColor(row.product_color) === colorFilter,
    );
  }, [colorFilter, kindFilteredDisplayStock, miscCategoryFilter, stockKindTab]);

  const stockByFlowerType = useMemo(
    () => groupInventoryStockByFlowerType(filteredDisplayStock),
    [filteredDisplayStock],
  );
  const miscStockRows = useMemo(
    () => groupInventoryStockMisc(filteredDisplayStock),
    [filteredDisplayStock],
  );

  const availableColorFilters = useMemo(
    () =>
      [...new Set(kindFilteredDisplayStock.map((row) => normalizeFlowerProductColor(row.product_color)))].sort(
        (left, right) => left.localeCompare(right),
      ),
    [kindFilteredDisplayStock],
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

  const transferFlowerSections = useMemo(
    () =>
      groupInventoryStockByFlowerType(
        fromBranchStock.filter(
          (row) =>
            row.product_is_active && normalizeFlowerProductKind(row.product_kind) === 'flower',
        ),
      ),
    [fromBranchStock],
  );

  const transferMiscProducts = useMemo(
    () =>
      groupInventoryStockMisc(
        fromBranchStock.filter(
          (row) =>
            row.product_is_active && normalizeFlowerProductKind(row.product_kind) === 'misc',
        ),
      ),
    [fromBranchStock],
  );

  const transferColorOptions = useMemo(() => {
    if (!transferFlowerType) {
      return [];
    }

    return (
      transferFlowerSections.find((section) => section.flowerType === transferFlowerType)?.rows ??
      []
    );
  }, [transferFlowerSections, transferFlowerType]);

  const selectedTransferRow = useMemo(() => {
    if (!transferProductId) {
      return null;
    }

    return fromBranchStock.find((row) => row.product_id === transferProductId) ?? null;
  }, [fromBranchStock, transferProductId]);

  const selectedTransferOnHand = selectedTransferRow?.on_hand ?? null;

  const transferQtyNumber = Number(transferQty) || 0;
  const transferWillGoNegative =
    selectedTransferOnHand !== null && transferQtyNumber > selectedTransferOnHand;

  function sanitizeTransferQty(rawValue: string): string {
    const digits = rawValue.replace(/[^\d]/g, '');
    if (!digits) {
      return '';
    }

    return String(Math.max(1, Number(digits)));
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

  function resetTransferSelection() {
    setTransferFlowerType('');
    setTransferProductId('');
    setTransferQty('1');
  }

  function clearTransferFeedback() {
    setTransferErrorMessage('');
    setTransferMessage('');
  }

  const isStockView = activeTab === 'stock' || !isAdmin;
  const canPrintBranchStock = isStockView && !isAllBranchesView;

  return (
    <div className="animate-fade-in">
      <div className="print:hidden">
      <FlowerPageHeader
        label="Inventory"
        title="Branch Stock"
        description={
          isAdmin
            ? isAllBranchesView
              ? stockKindTab === 'flower'
                ? 'Flower totals across Dagupan, San Carlos, and Urdaneta. Select a branch to adjust stock.'
                : 'Miscellaneous totals by category. Select a branch to stock in wrappers or gift items.'
              : stockKindTab === 'flower'
                ? 'Flower stock grouped by type with colors in order.'
                : 'Stock in or out wrappers and gift items for this branch.'
            : isAllBranchesView
              ? stockKindTab === 'flower'
                ? 'Combined flower totals across all branches.'
                : 'Combined wrappers and gift item totals across all branches.'
              : stockKindTab === 'flower'
                ? 'View-only flower stock for this branch.'
                : 'View-only wrappers and gift item stock for this branch.'
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
                Move stock from one branch to another. The source branch can go negative if you transfer more than on hand.
              </p>
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <label className="block text-sm font-medium text-brand-brown">
                  From branch
                  <select
                    value={fromBranchId}
                    onChange={(e) => {
                      setFromBranchId(e.target.value);
                      resetTransferSelection();
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
              </div>
              <div className="mt-4 inline-flex rounded-xl border border-brand-muted/50 bg-white p-1">
                {(['flower', 'misc'] as const).map((kind) => (
                  <button
                    key={kind}
                    type="button"
                    onClick={() => {
                      setTransferKind(kind);
                      resetTransferSelection();
                      clearTransferFeedback();
                    }}
                    className={`flower-pill ${transferKind === kind ? 'flower-pill-active' : 'flower-pill-inactive'}`}
                  >
                    {FLOWER_PRODUCT_KIND_LABELS[kind]}
                  </button>
                ))}
              </div>
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {transferKind === 'flower' ? (
                  <>
                    <label className="block text-sm font-medium text-brand-brown">
                      Flower type
                      <select
                        value={transferFlowerType}
                        onChange={(e) => {
                          setTransferFlowerType(e.target.value);
                          setTransferProductId('');
                          setTransferQty('1');
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
                              : transferFlowerSections.length === 0
                                ? 'No flowers at this branch'
                                : 'Select flower type'}
                        </option>
                        {transferFlowerSections.map((section) => {
                          const totalOnHand = section.rows.reduce((sum, row) => sum + row.on_hand, 0);

                          return (
                            <option key={section.flowerType} value={section.flowerType}>
                              {section.flowerType} ({section.rows.length} colors · {totalOnHand} on hand)
                            </option>
                          );
                        })}
                      </select>
                    </label>
                    <label className="block text-sm font-medium text-brand-brown">
                      Color
                      <select
                        value={transferProductId}
                        onChange={(e) => {
                          setTransferProductId(e.target.value);
                          setTransferQty((current) => sanitizeTransferQty(current || '1'));
                          clearTransferFeedback();
                        }}
                        className="flower-input mt-1.5"
                        required
                        disabled={!transferFlowerType || transferColorOptions.length === 0}
                      >
                        <option value="">
                          {!transferFlowerType
                            ? 'Select flower type first'
                            : transferColorOptions.length === 0
                              ? 'No colors available'
                              : 'Select color'}
                        </option>
                        {transferColorOptions.map((row) => (
                          <option key={row.product_id} value={row.product_id}>
                            {normalizeFlowerProductColor(row.product_color)} ({row.on_hand} on hand)
                          </option>
                        ))}
                      </select>
                      {transferProductId && selectedTransferRow ? (
                        <p className="mt-1.5 flex items-center gap-2 text-xs text-brand-brown/70">
                          <span
                            className={`h-3 w-3 rounded-full ${flowerProductColorSwatchClass(
                              normalizeFlowerProductColor(selectedTransferRow.product_color),
                            )}`}
                            aria-hidden
                          />
                          Transferring {formatInventoryStockLabel(selectedTransferRow)}
                        </p>
                      ) : null}
                    </label>
                  </>
                ) : (
                  <label className="block text-sm font-medium text-brand-brown sm:col-span-2">
                    Wrapper / gift item
                    <select
                      value={transferProductId}
                      onChange={(e) => {
                        setTransferProductId(e.target.value);
                        setTransferQty((current) => sanitizeTransferQty(current || '1'));
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
                            : transferMiscProducts.length === 0
                              ? 'No misc items at this branch'
                              : 'Select item'}
                      </option>
                      {transferMiscProducts.map((row) => (
                        <option key={row.product_id} value={row.product_id}>
                          {row.product_name} ({row.on_hand} on hand)
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <label className="block text-sm font-medium text-brand-brown">
                  Quantity
                  <input
                    type="text"
                    inputMode="numeric"
                    value={transferQty}
                    onChange={(e) => {
                      setTransferQty(sanitizeTransferQty(e.target.value));
                      clearTransferFeedback();
                    }}
                    className="flower-input mt-1.5"
                    required
                    disabled={!transferProductId}
                  />
                </label>
                <div className="flex items-end sm:col-span-2 lg:col-span-3">
                  <button type="submit" className="flower-btn-primary w-full sm:w-auto">
                    Transfer stock
                  </button>
                </div>
              </div>
              {transferProductId && selectedTransferOnHand !== null ? (
                <p
                  className={`mt-3 text-xs ${
                    transferWillGoNegative ? 'text-amber-800' : 'text-brand-brown/70'
                  }`}
                >
                  {selectedTransferOnHand} on hand at {fromBranchName}
                  {selectedTransferRow ? ` for ${formatInventoryStockLabel(selectedTransferRow)}` : ''}
                  {transferWillGoNegative ? ' — source branch will go negative' : ''}
                </p>
              ) : fromBranchId && !fromBranchStockLoading ? (
                <p className="mt-3 text-xs text-brand-brown/60">
                  {transferKind === 'flower'
                    ? transferFlowerSections.length === 0
                      ? `No active flowers at ${fromBranchName}.`
                      : 'Choose a flower type, then pick the color variant to transfer.'
                    : transferMiscProducts.length === 0
                      ? `No wrappers or gift items at ${fromBranchName}.`
                      : 'Choose the item to transfer.'}
                </p>
              ) : null}
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
          <div className="mt-4 inline-flex rounded-xl border border-brand-muted/50 bg-white p-1">
            {(['flower', 'misc'] as const).map((kind) => (
              <button
                key={kind}
                type="button"
                onClick={() => setStockKindTab(kind)}
                className={`flower-pill ${stockKindTab === kind ? 'flower-pill-active' : 'flower-pill-inactive'}`}
              >
                {FLOWER_PRODUCT_KIND_LABELS[kind]}
              </button>
            ))}
          </div>

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
            {stockKindTab === 'flower' && availableColorFilters.length > 1 ? (
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
            {stockKindTab === 'misc' ? (
              <select
                value={miscCategoryFilter}
                onChange={(event) => setMiscCategoryFilter(event.target.value as MiscProductCategory)}
                className="flower-input max-w-[180px]"
              >
                {MISC_PRODUCT_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {MISC_PRODUCT_CATEGORY_LABELS[category]}
                  </option>
                ))}
              </select>
            ) : null}
          </div>
          <p className="mt-2 text-sm text-brand-brown/70">
            {isAllBranchesView
              ? `Showing combined ${stockKindTab === 'flower' ? 'flower' : MISC_PRODUCT_CATEGORY_LABELS[miscCategoryFilter].toLowerCase()} totals (${totalUnitsOnHand} units on hand).`
              : `Showing ${stockKindTab === 'flower' ? 'flower' : MISC_PRODUCT_CATEGORY_LABELS[miscCategoryFilter].toLowerCase()} stock for ${selectedBranchName} (${totalUnitsOnHand} units on hand)${
                  stockKindTab === 'flower' ? ', grouped by flower type' : ''
                }.`}
            {isRefreshing ? ' · Updating…' : ''}
          </p>

          <div className="mt-5 space-y-3 md:hidden">
            {stockKindTab === 'flower' ? (
              <>
                {stockByFlowerType.map((section) => (
                  <InventoryFlowerCategoryMobileGroup
                    key={section.flowerType}
                    section={section}
                    isAllBranchesView={isAllBranchesView}
                    isAdmin={isAdmin}
                    onAdjust={handleAdjust}
                  />
                ))}
                {stockByFlowerType.length === 0 ? (
                  <p className="rounded-xl border border-brand-muted/30 px-3 py-6 text-center text-sm text-brand-brown/60">
                    No flower stock to show for this filter.
                  </p>
                ) : null}
              </>
            ) : (
              <>
                {miscStockRows.map((row) => (
                  <div
                    key={isAllBranchesView ? row.product_id : `${row.branch_id}-${row.product_id}-card`}
                    className="flower-card p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <InventoryMiscRowLabel name={row.product_name} />
                        <p className="mt-1 text-xs text-brand-brown/70">
                          {isAllBranchesView ? 'All branches total' : row.branch_name}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-xs font-medium uppercase tracking-wide text-brand-brown/60">
                          {isAllBranchesView ? 'Total on hand' : 'On hand'}
                        </p>
                        <p className={`text-2xl font-bold leading-tight ${row.on_hand < 0 ? 'text-red-700' : 'text-brand-dark'}`}>
                          {row.on_hand}
                        </p>
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
                {miscStockRows.length === 0 ? (
                  <p className="rounded-xl border border-brand-muted/30 px-3 py-6 text-center text-sm text-brand-brown/60">
                    No {MISC_PRODUCT_CATEGORY_LABELS[miscCategoryFilter].toLowerCase()} in the catalog yet.
                  </p>
                ) : null}
              </>
            )}
            {isAdmin && !isAllBranchesView && filteredDisplayStock.length > 0 ? (
              <div className="flex justify-end">
                <FlowerPrintControls label="Print stock" showSizeHint={false} />
              </div>
            ) : null}
          </div>

          <div className="mt-5 hidden overflow-x-auto rounded-2xl border border-brand-muted/40 md:block">
            {isAdmin && !isAllBranchesView ? (
              <div className="flex items-center justify-end border-b border-brand-muted/30 bg-brand-beige/20 px-3 py-2">
                <FlowerPrintControls label="Print stock" showSizeHint={false} />
              </div>
            ) : null}
            <table className="min-w-full text-left text-sm">
              <thead className="bg-brand-beige/40 text-brand-brown">
                <tr>
                  {isAllBranchesView ? null : <th className="px-3 py-2">Branch</th>}
                  <th className="min-w-[10rem] px-3 py-2">
                    {stockKindTab === 'flower' ? 'Flower' : 'Item'}
                  </th>
                  <th className="px-3 py-2">{isAllBranchesView ? 'Total on hand' : 'On hand'}</th>
                  {isAdmin && !isAllBranchesView ? (
                    <th className="min-w-[16rem] px-3 py-2">Adjust stock</th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {stockKindTab === 'flower' ? (
                  <>
                    {stockByFlowerType.map((section) => (
                      <InventoryFlowerCategoryDesktopGroup
                        key={section.flowerType}
                        section={section}
                        isAllBranchesView={isAllBranchesView}
                        isAdmin={isAdmin}
                        stockTableColSpan={stockTableColSpan}
                        onAdjust={handleAdjust}
                      />
                    ))}
                    {stockByFlowerType.length === 0 ? (
                      <tr>
                        <td colSpan={stockTableColSpan} className="px-3 py-8 text-center text-brand-brown/60">
                          No flower stock to show for this filter.
                        </td>
                      </tr>
                    ) : null}
                  </>
                ) : (
                  <>
                    {miscStockRows.map((row) => (
                      <tr
                        key={isAllBranchesView ? row.product_id : `${row.branch_id}-${row.product_id}`}
                        className="border-t border-brand-muted/30"
                      >
                        {isAllBranchesView ? null : (
                          <td className="px-3 py-2 whitespace-nowrap">{row.branch_name}</td>
                        )}
                        <td className="min-w-[10rem] px-3 py-2">
                          <InventoryMiscRowLabel name={row.product_name} />
                        </td>
                        <td className={`px-3 py-2 font-semibold ${row.on_hand < 0 ? 'text-red-700' : ''}`}>{row.on_hand}</td>
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
                    {miscStockRows.length === 0 ? (
                      <tr>
                        <td colSpan={stockTableColSpan} className="px-3 py-8 text-center text-brand-brown/60">
                          No {MISC_PRODUCT_CATEGORY_LABELS[miscCategoryFilter].toLowerCase()} in the catalog yet.
                        </td>
                      </tr>
                    ) : null}
                  </>
                )}
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
