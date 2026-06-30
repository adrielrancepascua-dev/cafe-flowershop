import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, ChevronUp, List } from 'lucide-react';
import { listFlowerBranches } from '../../../../services/flowers/inventory';
import {
  createFlowerOrder,
  getFlowerOrder,
  listFlowerOrders,
  updateFlowerOrder,
  updateFlowerOrderStatus,
} from '../../../../services/flowers/orders';
import { listFlowerProducts } from '../../../../services/flowers/products';
import { useFlowerAuth } from '../../../../lib/auth/FlowerAuthContext';
import type { FlowerOrder } from '../../shared/types/flower-order';
import type { FlowerBranchOption } from '../../shared/types/flower-inventory';
import type { FlowerProduct } from '../../shared/types/flower-product';
import FlowerPageHeader from '../../shared/components/FlowerPageHeader';
import FlowerMobileCardList from '../../shared/components/FlowerMobileCardList';
import FlowerOrderFormModal from '../components/FlowerOrderFormModal';
import OrderDeadlineAlertsPanel from '../components/OrderDeadlineAlertsPanel';
import OrderDeadlineBadge from '../components/OrderDeadlineBadge';
import {
  ORDER_STATUS_LABELS,
  PRICE_FORMATTER,
  formatPickupDateTimeLocal,
  summarizeFlowerLines,
  toDateKey,
} from '../../shared/utils/flower-format';

type ViewMode = 'calendar' | 'list';

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function getMonthMatrix(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  const startOffset = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: Array<{ date: Date | null; key: string }> = [];

  for (let i = 0; i < startOffset; i += 1) {
    cells.push({ date: null, key: `empty-start-${i}` });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(year, month, day);
    cells.push({ date, key: toDateKey(date) });
  }

  while (cells.length % 7 !== 0) {
    cells.push({ date: null, key: `empty-end-${cells.length}` });
  }

  return cells;
}

function DayOrderList({
  orders,
  onSelectOrder,
  nowMs,
}: {
  orders: FlowerOrder[];
  onSelectOrder: (order: FlowerOrder) => void;
  nowMs: number;
}) {
  if (orders.length === 0) {
    return (
      <div className="px-4 py-8 text-center">
        <p className="text-sm text-brand-brown/60">Tap &quot;New order&quot; to schedule one for this day.</p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-brand-muted/30">
      {orders.map((order) => (
        <li key={order.id}>
          <button
            type="button"
            onClick={() => onSelectOrder(order)}
            className="flex w-full flex-col gap-2 px-4 py-3 text-left transition hover:bg-brand-beige/30 active:bg-brand-beige/40 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-brand-dark">{order.receiver}</p>
              <p className="mt-0.5 text-sm text-brand-brown/70">
                {formatPickupDateTimeLocal(order.scheduled_for)} · {order.branch_name}
              </p>
              <p className="mt-1 truncate text-xs text-brand-brown/60">
                {summarizeFlowerLines(order.items)}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-start gap-1.5 sm:items-end">
              <OrderDeadlineBadge order={order} nowMs={nowMs} />
              <div className="flex items-center gap-3 sm:flex-col sm:items-end sm:gap-1">
              <span className="rounded-full bg-brand-beige px-2.5 py-1 text-xs font-semibold text-brand-brown">
                {ORDER_STATUS_LABELS[order.status]}
              </span>
              <span className="text-sm font-semibold text-brand-dark">
                {PRICE_FORMATTER.format(order.total_amount)}
              </span>
              </div>
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}

function DayOrdersPanelHeader({
  selectedDayLabel,
  orderCount,
  onClose,
  onNewOrder,
}: {
  selectedDayLabel: string;
  orderCount: number;
  onClose: () => void;
  onNewOrder: () => void;
}) {
  return (
    <div className="shrink-0 border-b border-brand-muted/30 px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-accent">
            Selected date
          </p>
          <h3 className="font-serif text-lg font-semibold text-brand-dark">{selectedDayLabel}</h3>
          <p className="mt-0.5 text-sm text-brand-brown/70">
            {orderCount === 0
              ? 'No orders scheduled for this day.'
              : `${orderCount} order${orderCount === 1 ? '' : 's'} scheduled`}
          </p>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <button type="button" className="flower-btn-secondary flex-1 py-2 text-xs" onClick={onClose}>
          Close
        </button>
        <button type="button" className="flower-btn-primary flex-1 py-2 text-xs" onClick={onNewOrder}>
          New order
        </button>
      </div>
    </div>
  );
}

type MobileSheetPhase = 'closed' | 'peek' | 'expanded';

const MOBILE_SHEET_PEEK_HEIGHT = 168;
const MOBILE_SHEET_MEDIA_QUERY = '(max-width: 1023px)';

function isMobileSheetViewport(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  return window.matchMedia(MOBILE_SHEET_MEDIA_QUERY).matches;
}

function getMobileSheetExpandedHeight(): number {
  if (typeof window === 'undefined') {
    return 600;
  }

  return Math.min(window.innerHeight * 0.78, 640);
}

function MobileDayOrdersSheet({
  phase,
  selectedDayLabel,
  orders,
  nowMs,
  onClose,
  onExpand,
  onCollapse,
  onNewOrder,
  onSelectOrder,
}: {
  phase: MobileSheetPhase;
  selectedDayLabel: string;
  orders: FlowerOrder[];
  nowMs: number;
  onClose: () => void;
  onExpand: () => void;
  onCollapse: () => void;
  onNewOrder: () => void;
  onSelectOrder: (order: FlowerOrder) => void;
}) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragZoneRef = useRef<HTMLDivElement>(null);
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [hasEntered, setHasEntered] = useState(false);
  const [expandedHeight, setExpandedHeight] = useState(getMobileSheetExpandedHeight);

  const dragYRef = useRef(0);
  const isDraggingRef = useRef(false);
  const phaseRef = useRef(phase);
  const dragStart = useRef({ y: 0, dragY: 0 });
  const onCloseRef = useRef(onClose);
  const onExpandRef = useRef(onExpand);
  const onCollapseRef = useRef(onCollapse);

  phaseRef.current = phase;
  dragYRef.current = dragY;
  onCloseRef.current = onClose;
  onExpandRef.current = onExpand;
  onCollapseRef.current = onCollapse;

  const isExpanded = phase === 'expanded';
  const hiddenOffset = Math.max(0, expandedHeight - MOBILE_SHEET_PEEK_HEIGHT);
  const snapOffset = isExpanded ? 0 : hiddenOffset;
  const translateY = hasEntered ? snapOffset + dragY : expandedHeight + 32;

  const dragProgress =
    hiddenOffset <= 0 ? 1 : Math.min(1, Math.max(0, 1 - translateY / hiddenOffset));
  const backdropOpacity = 0.16 + dragProgress * 0.32;

  const previewNames = orders
    .slice(0, 2)
    .map((order) => order.receiver)
    .join(' · ');
  const remainingCount = Math.max(0, orders.length - 2);

  useEffect(() => {
    if (phase === 'closed') {
      setHasEntered(false);
      setDragY(0);
      return;
    }

    setExpandedHeight(getMobileSheetExpandedHeight());
    setHasEntered(false);
    const frame = requestAnimationFrame(() => {
      requestAnimationFrame(() => setHasEntered(true));
    });

    return () => cancelAnimationFrame(frame);
  }, [phase, selectedDayLabel]);

  useEffect(() => {
    if (phase === 'closed' || !isMobileSheetViewport()) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [phase]);

  useEffect(() => {
    setDragY(0);
    dragYRef.current = 0;
  }, [phase]);

  useEffect(() => {
    const dragZone = dragZoneRef.current;
    if (!dragZone || phase === 'closed') {
      return;
    }

    const hidden = Math.max(0, getMobileSheetExpandedHeight() - MOBILE_SHEET_PEEK_HEIGHT);

    function clampDrag(next: number, currentPhase: MobileSheetPhase) {
      if (currentPhase === 'peek') {
        return Math.min(Math.max(next, -hidden), 140);
      }

      return Math.min(Math.max(next, -24), hidden + 120);
    }

    function finishDrag() {
      isDraggingRef.current = false;
      setIsDragging(false);

      const currentDragY = dragYRef.current;
      const currentPhase = phaseRef.current;

      if (currentPhase === 'peek') {
        if (currentDragY < -hidden * 0.28) {
          setDragY(0);
          onExpandRef.current();
          return;
        }

        if (currentDragY > 72) {
          setDragY(0);
          onCloseRef.current();
          return;
        }
      } else if (currentDragY > hidden * 0.32) {
        setDragY(0);
        onCollapseRef.current();
        return;
      } else if (currentDragY > hidden + 72) {
        setDragY(0);
        onCloseRef.current();
        return;
      }

      setDragY(0);
      dragYRef.current = 0;
    }

    function onTouchStart(event: TouchEvent) {
      isDraggingRef.current = true;
      setIsDragging(true);
      dragStart.current = {
        y: event.touches[0]?.clientY ?? 0,
        dragY: dragYRef.current,
      };
    }

    function onTouchMove(event: TouchEvent) {
      if (!isDraggingRef.current) {
        return;
      }

      event.preventDefault();
      const delta = (event.touches[0]?.clientY ?? dragStart.current.y) - dragStart.current.y;
      const next = clampDrag(dragStart.current.dragY + delta, phaseRef.current);
      dragYRef.current = next;
      setDragY(next);
    }

    dragZone.addEventListener('touchstart', onTouchStart, { passive: true });
    dragZone.addEventListener('touchmove', onTouchMove, { passive: false });
    dragZone.addEventListener('touchend', finishDrag);
    dragZone.addEventListener('touchcancel', finishDrag);

    return () => {
      dragZone.removeEventListener('touchstart', onTouchStart);
      dragZone.removeEventListener('touchmove', onTouchMove);
      dragZone.removeEventListener('touchend', finishDrag);
      dragZone.removeEventListener('touchcancel', finishDrag);
    };
  }, [phase]);

  if (phase === 'closed') {
    return null;
  }

  function handleBackdropClick() {
    if (isExpanded) {
      onCollapse();
      return;
    }

    onClose();
  }

  return (
    <div className="fixed inset-0 z-[90] overscroll-none lg:hidden">
      <button
        type="button"
        aria-label="Close day preview"
        className="absolute inset-0 transition-[background-color] duration-300"
        style={{ backgroundColor: `rgba(62, 39, 35, ${isDragging ? backdropOpacity : isExpanded ? 0.45 : 0.2})` }}
        onClick={handleBackdropClick}
      />

      <div
        ref={sheetRef}
        className="absolute inset-x-0 bottom-0 flex touch-none flex-col overflow-hidden rounded-t-[1.35rem] border-t border-brand-muted/30 bg-white shadow-[0_-8px_32px_rgba(62,39,35,0.14)] will-change-transform"
        style={{
          height: expandedHeight,
          transform: `translateY(${translateY}px)`,
          transition: isDragging
            ? 'none'
            : 'transform 0.38s cubic-bezier(0.32, 0.72, 0, 1), box-shadow 0.38s ease',
        }}
      >
        <div ref={dragZoneRef} className="shrink-0 touch-none select-none">
          <button
            type="button"
            aria-label={isExpanded ? 'Swipe down to minimize' : 'Swipe up to view all orders'}
            className="flex w-full flex-col items-center px-4 pt-3 pb-2"
            onClick={() => (isExpanded ? onCollapse() : onExpand())}
          >
            <div className="h-1.5 w-14 rounded-full bg-brand-muted/80 shadow-[inset_0_1px_2px_rgba(62,39,35,0.12)]" />
            <div className="mt-2 flex items-center gap-1 text-[11px] font-medium text-brand-brown/55">
              <ChevronUp
                className={`h-3.5 w-3.5 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}
              />
              {isExpanded ? 'Swipe down to minimize' : 'Swipe up to view orders'}
            </div>
          </button>

          {!isExpanded ? (
            <div className="px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] text-left">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-accent">
                Selected date
              </p>
              <p className="mt-0.5 font-serif text-base font-semibold leading-snug text-brand-dark">
                {selectedDayLabel}
              </p>
              <p className="mt-1 text-sm font-semibold text-brand-brown">
                {orders.length === 0
                  ? 'No orders yet — swipe up to add one'
                  : `${orders.length} order${orders.length === 1 ? '' : 's'} scheduled`}
              </p>
              {orders.length > 0 ? (
                <p className="mt-1 truncate text-xs text-brand-brown/65">
                  {previewNames}
                  {remainingCount > 0 ? ` · +${remainingCount} more` : ''}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        {isExpanded ? (
          <>
            <DayOrdersPanelHeader
              selectedDayLabel={selectedDayLabel}
              orderCount={orders.length}
              onClose={onClose}
              onNewOrder={onNewOrder}
            />
            <div className="flower-scroll min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain pb-[calc(4.5rem+env(safe-area-inset-bottom))]">
              <DayOrderList orders={orders} onSelectOrder={onSelectOrder} nowMs={nowMs} />
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

export default function FlowerOrdersPage() {
  const { user } = useFlowerAuth();
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window === 'undefined') {
      return 'calendar';
    }

    return (window.localStorage.getItem('pp_orders_view') as ViewMode) ?? 'calendar';
  });
  const [cursorMonth, setCursorMonth] = useState(() => new Date());
  const [orders, setOrders] = useState<FlowerOrder[]>([]);
  const [branches, setBranches] = useState<FlowerBranchOption[]>([]);
  const [products, setProducts] = useState<FlowerProduct[]>([]);
  const [branchFilter, setBranchFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<FlowerOrder | null>(null);
  const [initialPickupIso, setInitialPickupIso] = useState<string | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const [mobileSheetPhase, setMobileSheetPhase] = useState<MobileSheetPhase>('closed');
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    window.localStorage.setItem('pp_orders_view', viewMode);
  }, [viewMode]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNowMs(Date.now());
    }, 60_000);

    return () => window.clearInterval(intervalId);
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const [orderList, branchList, productList] = await Promise.all([
        listFlowerOrders({
          branchId: branchFilter === 'all' ? undefined : branchFilter,
        }),
        listFlowerBranches(),
        listFlowerProducts(),
      ]);
      setOrders(orderList);
      setBranches(branchList);
      setProducts(productList);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, [branchFilter]);

  const ordersByDate = useMemo(() => {
    const map = new Map<string, FlowerOrder[]>();

    for (const order of orders) {
      const key = order.scheduled_for.slice(0, 10);
      const bucket = map.get(key) ?? [];
      bucket.push(order);
      map.set(key, bucket);
    }

    return map;
  }, [orders]);

  const monthMatrix = useMemo(
    () => getMonthMatrix(cursorMonth.getFullYear(), cursorMonth.getMonth()),
    [cursorMonth],
  );

  function selectCalendarDate(date: Date) {
    setSelectedDateKey(toDateKey(date));
    setMobileSheetPhase(isMobileSheetViewport() ? 'peek' : 'closed');
  }

  function closeDaySheet() {
    setSelectedDateKey(null);
    setMobileSheetPhase('closed');
  }

  function expandMobileDaySheet() {
    setMobileSheetPhase('expanded');
  }

  function collapseMobileDaySheet() {
    setMobileSheetPhase('peek');
  }

  function openNewOrderForSelectedDate() {
    if (!selectedDateKey) {
      openNewOrderForDate(new Date());
      return;
    }

    const [year, month, day] = selectedDateKey.split('-').map(Number);
    openNewOrderForDate(new Date(year, month - 1, day));
  }

  function openNewOrderForDate(date: Date) {
    const pickup = new Date(date);
    pickup.setHours(10, 0, 0, 0);
    setSelectedOrder(null);
    setInitialPickupIso(pickup.toISOString());
    setFormOpen(true);
  }

  async function openExistingOrder(order: FlowerOrder) {
    setInitialPickupIso(undefined);
    setFormOpen(true);
    setSelectedOrder(order);

    try {
      const fresh = await getFlowerOrder(order.id);
      if (fresh) {
        setSelectedOrder(fresh);
      }
    } catch {
      setSelectedOrder(order);
    }
  }

  async function handleCreate(input: Parameters<typeof createFlowerOrder>[0]) {
    if (!user) {
      return;
    }

    setIsSubmitting(true);
    try {
      if (selectedOrder) {
        await updateFlowerOrder({ ...input, id: selectedOrder.id });
      } else {
        await createFlowerOrder({
          ...input,
          created_by_id: user.id,
          created_by_name: user.display_name,
        });
      }

      setFormOpen(false);
      await loadData();
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleStatusChange(orderId: string, status: FlowerOrder['status']) {
    await updateFlowerOrderStatus(orderId, status);
    await loadData();
    const refreshed = (await listFlowerOrders()).find((order) => order.id === orderId) ?? null;
    setSelectedOrder(refreshed);
  }

  const monthLabel = cursorMonth.toLocaleDateString('en-PH', {
    month: 'long',
    year: 'numeric',
  });

  const selectedDayOrders = useMemo(() => {
    if (!selectedDateKey) {
      return [];
    }

    return [...(ordersByDate.get(selectedDateKey) ?? [])].sort(
      (left, right) =>
        new Date(left.scheduled_for).getTime() - new Date(right.scheduled_for).getTime(),
    );
  }, [selectedDateKey, ordersByDate]);
  const selectedDayLabel = selectedDateKey
    ? new Date(`${selectedDateKey}T12:00:00`).toLocaleDateString('en-PH', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : '';

  return (
    <div className="animate-fade-in">
      <FlowerPageHeader
        label="Daily Orders"
        title="Orders"
        description="Calendar-first scheduling with list view. Tap a date to see that day's orders, then open one or add new."
      />

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-xl border border-brand-muted/50 bg-white p-1">
          <button
            type="button"
            onClick={() => setViewMode('calendar')}
            className={`flower-pill flex items-center gap-1.5 ${viewMode === 'calendar' ? 'flower-pill-active' : 'flower-pill-inactive'}`}
          >
            <CalendarDays className="h-3.5 w-3.5" />
            Calendar
          </button>
          <button
            type="button"
            onClick={() => setViewMode('list')}
            className={`flower-pill flex items-center gap-1.5 ${viewMode === 'list' ? 'flower-pill-active' : 'flower-pill-inactive'}`}
          >
            <List className="h-3.5 w-3.5" />
            List
          </button>
        </div>

        <select
          value={branchFilter}
          onChange={(event) => setBranchFilter(event.target.value)}
          className="flower-input max-w-[180px]"
        >
          <option value="all">All branches</option>
          {branches.map((branch) => (
            <option key={branch.id} value={branch.id}>
              {branch.name}
            </option>
          ))}
        </select>

        <button
          type="button"
          className="flower-btn-primary ml-auto"
          onClick={() => openNewOrderForDate(new Date())}
        >
          New order
        </button>
      </div>

      {!loading ? (
        <OrderDeadlineAlertsPanel orders={orders} onSelectOrder={openExistingOrder} />
      ) : null}

      {loading ? (
        <p className="mt-6 text-sm text-brand-brown/60">Loading orders...</p>
      ) : viewMode === 'calendar' ? (
        <div className="mt-5">
          <div className="mb-3 flex items-center justify-between">
            <button
              type="button"
              className="flower-btn-secondary px-3 py-2"
              onClick={() =>
                setCursorMonth(
                  new Date(cursorMonth.getFullYear(), cursorMonth.getMonth() - 1, 1),
                )
              }
            >
              Prev
            </button>
            <h3 className="font-serif text-lg font-semibold text-brand-dark">{monthLabel}</h3>
            <button
              type="button"
              className="flower-btn-secondary px-3 py-2"
              onClick={() =>
                setCursorMonth(
                  new Date(cursorMonth.getFullYear(), cursorMonth.getMonth() + 1, 1),
                )
              }
            >
              Next
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase tracking-wide text-brand-brown/60">
            {WEEKDAY_LABELS.map((label) => (
              <div key={label} className="py-1">
                {label}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {monthMatrix.map((cell) => {
              if (!cell.date) {
                return <div key={cell.key} className="min-h-[76px] rounded-xl bg-transparent sm:min-h-[96px]" />;
              }

              const dayOrders = ordersByDate.get(cell.key) ?? [];
              const hasOrders = dayOrders.length > 0;
              const isSelected = selectedDateKey === cell.key;

              return (
                <button
                  key={cell.key}
                  type="button"
                  onClick={() => selectCalendarDate(cell.date as Date)}
                  className={`relative flex min-h-[76px] flex-col rounded-xl border p-1 text-left transition sm:min-h-[96px] sm:p-1.5 ${
                    isSelected
                      ? 'border-brand-brown bg-brand-beige ring-2 ring-brand-brown/40'
                      : hasOrders
                        ? 'border-brand-brown bg-brand-beige/80 hover:border-brand-brown hover:bg-brand-beige'
                        : 'border-brand-muted/40 bg-white hover:border-brand-accent hover:bg-brand-beige/20'
                  }`}
                >
                  <span
                    className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                      hasOrders || isSelected
                        ? 'bg-brand-brown text-white'
                        : 'text-brand-dark'
                    }`}
                  >
                    {cell.date.getDate()}
                  </span>

                  {hasOrders ? (
                    <div className="mt-auto space-y-1 pt-1">
                      <span className="block rounded-md bg-brand-brown px-1 py-0.5 text-center text-[9px] font-bold leading-tight text-white sm:text-[10px]">
                        {dayOrders.length} order{dayOrders.length === 1 ? '' : 's'}
                      </span>
                      <div className="flex justify-center gap-0.5">
                        {dayOrders.slice(0, 4).map((order) => (
                          <span
                            key={order.id}
                            className="h-1.5 w-1.5 rounded-full bg-brand-brown sm:h-2 sm:w-2"
                            title={order.receiver}
                          />
                        ))}
                      </div>
                    </div>
                  ) : null}
                </button>
              );
            })}
          </div>

          {selectedDateKey ? (
            <>
              <div className="mt-5 hidden rounded-2xl border border-brand-muted/40 bg-white lg:block">
                <DayOrdersPanelHeader
                  selectedDayLabel={selectedDayLabel}
                  orderCount={selectedDayOrders.length}
                  onClose={closeDaySheet}
                  onNewOrder={openNewOrderForSelectedDate}
                />
                <DayOrderList
                  orders={selectedDayOrders}
                  onSelectOrder={openExistingOrder}
                  nowMs={nowMs}
                />
              </div>

              {mobileSheetPhase !== 'closed' ? (
                <MobileDayOrdersSheet
                  phase={mobileSheetPhase}
                  selectedDayLabel={selectedDayLabel}
                  orders={selectedDayOrders}
                  nowMs={nowMs}
                  onClose={closeDaySheet}
                  onExpand={expandMobileDaySheet}
                  onCollapse={collapseMobileDaySheet}
                  onNewOrder={openNewOrderForSelectedDate}
                  onSelectOrder={openExistingOrder}
                />
              ) : null}
            </>
          ) : (
            <p className="mt-4 text-center text-sm text-brand-brown/60">
              Tap a date on the calendar to view or add orders for that day.
            </p>
          )}
        </div>
      ) : (
        <>
          <div className="mt-5 md:hidden">
            <FlowerMobileCardList
              items={orders}
              emptyMessage="No orders yet. Tap New order to add one."
              getKey={(order) => order.id}
              renderCard={(order) => (
                <button
                  type="button"
                  onClick={() => openExistingOrder(order)}
                  className="w-full text-left"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-brand-dark">{order.receiver}</p>
                      <p className="mt-1 text-xs text-brand-brown/60">
                        {formatPickupDateTimeLocal(order.scheduled_for)}
                      </p>
                    </div>
                    <p className="shrink-0 font-semibold text-brand-dark">
                      {PRICE_FORMATTER.format(order.total_amount)}
                    </p>
                  </div>
                  <p className="mt-2 text-sm text-brand-brown/75">{order.branch_name}</p>
                  <p className="mt-1 truncate text-xs text-brand-brown/60">
                    {summarizeFlowerLines(order.items)}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <span className="rounded-full bg-brand-beige px-2.5 py-1 text-xs font-semibold text-brand-brown">
                      {ORDER_STATUS_LABELS[order.status]}
                    </span>
                    <OrderDeadlineBadge order={order} nowMs={nowMs} />
                    <span className="text-xs text-brand-brown/60">{order.created_by_name}</span>
                  </div>
                </button>
              )}
            />
          </div>

          <div className="mt-5 hidden overflow-x-auto rounded-2xl border border-brand-muted/40 md:block">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-brand-beige/40 text-brand-brown">
              <tr>
                <th className="px-3 py-2">Pickup</th>
                <th className="px-3 py-2">Receiver</th>
                <th className="px-3 py-2">Branch</th>
                <th className="px-3 py-2">Flowers</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Prep deadline</th>
                <th className="px-3 py-2">Total</th>
                <th className="px-3 py-2">By</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr
                  key={order.id}
                  className="cursor-pointer border-t border-brand-muted/30 hover:bg-brand-beige/20"
                  onClick={() => openExistingOrder(order)}
                >
                  <td className="px-3 py-2 whitespace-nowrap">
                    {formatPickupDateTimeLocal(order.scheduled_for)}
                  </td>
                  <td className="px-3 py-2">{order.receiver}</td>
                  <td className="px-3 py-2">{order.branch_name}</td>
                  <td className="max-w-[200px] truncate px-3 py-2">
                    {summarizeFlowerLines(order.items)}
                  </td>
                  <td className="px-3 py-2">{ORDER_STATUS_LABELS[order.status]}</td>
                  <td className="px-3 py-2">
                    <OrderDeadlineBadge order={order} nowMs={nowMs} />
                  </td>
                  <td className="px-3 py-2">{PRICE_FORMATTER.format(order.total_amount)}</td>
                  <td className="px-3 py-2">{order.created_by_name}</td>
                </tr>
              ))}
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-brand-brown/60">
                    No orders yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        </>
      )}

      {user ? (
        <FlowerOrderFormModal
          open={formOpen}
          onClose={() => setFormOpen(false)}
          onSubmit={handleCreate}
          onStatusChange={handleStatusChange}
          branches={branches}
          products={products}
          initialPickupIso={initialPickupIso}
          existingOrder={selectedOrder}
          staffId={user.id}
          staffName={user.display_name}
          isSubmitting={isSubmitting}
        />
      ) : null}
    </div>
  );
}
