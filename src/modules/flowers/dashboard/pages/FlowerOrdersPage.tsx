import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, List } from 'lucide-react';
import { listFlowerBranches } from '../../../../services/flowers/inventory';
import {
  createFlowerOrder,
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
import FlowerOrderFormModal from '../components/FlowerOrderFormModal';
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

  useEffect(() => {
    window.localStorage.setItem('pp_orders_view', viewMode);
  }, [viewMode]);

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

  function openNewOrderForDate(date: Date) {
    const pickup = new Date(date);
    pickup.setHours(10, 0, 0, 0);
    setSelectedOrder(null);
    setInitialPickupIso(pickup.toISOString());
    setFormOpen(true);
  }

  function openExistingOrder(order: FlowerOrder) {
    setSelectedOrder(order);
    setInitialPickupIso(undefined);
    setFormOpen(true);
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

  return (
    <div className="animate-fade-in">
      <FlowerPageHeader
        label="Daily Orders"
        title="Orders"
        description="Calendar-first scheduling with list view. Click a date to encode an order — all fields required."
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
                return <div key={cell.key} className="min-h-[88px] rounded-xl bg-transparent" />;
              }

              const dayOrders = ordersByDate.get(cell.key) ?? [];
              const hasOrders = dayOrders.length > 0;

              return (
                <button
                  key={cell.key}
                  type="button"
                  onClick={() => openNewOrderForDate(cell.date as Date)}
                  className={`min-h-[88px] rounded-xl border p-1.5 text-left transition hover:border-brand-accent ${
                    hasOrders
                      ? 'border-brand-brown/50 bg-brand-beige/50 hover:bg-brand-beige/70'
                      : 'border-brand-muted/40 bg-white hover:bg-brand-beige/20'
                  }`}
                >
                  <span
                    className={`inline-flex min-w-[1.25rem] items-center justify-center rounded-full text-xs font-semibold ${
                      hasOrders ? 'bg-brand-brown px-1.5 text-white' : 'text-brand-dark'
                    }`}
                  >
                    {cell.date.getDate()}
                  </span>
                  <div className="mt-1 space-y-1">
                    {dayOrders.slice(0, 2).map((order) => (
                      <span
                        key={order.id}
                        onClick={(event) => {
                          event.stopPropagation();
                          openExistingOrder(order);
                        }}
                        className="block truncate rounded-md bg-brand-brown px-1.5 py-0.5 text-[10px] font-semibold text-white shadow-sm"
                      >
                        {order.receiver}
                      </span>
                    ))}
                    {dayOrders.length > 2 ? (
                      <span className="block text-[10px] font-medium text-brand-brown">
                        +{dayOrders.length - 2} more
                      </span>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="mt-5 overflow-x-auto rounded-2xl border border-brand-muted/40">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-brand-beige/40 text-brand-brown">
              <tr>
                <th className="px-3 py-2">Pickup</th>
                <th className="px-3 py-2">Receiver</th>
                <th className="px-3 py-2">Branch</th>
                <th className="px-3 py-2">Flowers</th>
                <th className="px-3 py-2">Status</th>
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
                  <td className="px-3 py-2">{PRICE_FORMATTER.format(order.total_amount)}</td>
                  <td className="px-3 py-2">{order.created_by_name}</td>
                </tr>
              ))}
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-brand-brown/60">
                    No orders yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
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
