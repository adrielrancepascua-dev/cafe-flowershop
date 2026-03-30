import { useEffect, useState } from 'react';
import type { CafeOrder } from '../../shared/types/order';
import { listOrdersSupabase } from '../../../services/orders/orders.supabase';

const PRICE_FORMATTER = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export default function DashboardOrders() {
  const [orders, setOrders] = useState<CafeOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    async function loadOrderRecords() {
      setLoading(true);
      setErrorMessage('');

      try {
        const data = await listOrdersSupabase();
        setOrders(
          [...data].sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
          ),
        );
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : 'Unable to load orders from Supabase.',
        );
      } finally {
        setLoading(false);
      }
    }

    loadOrderRecords();
  }, []);

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Orders Module</p>
      <h2 className="mt-2 text-2xl font-semibold text-slate-900">Order Records</h2>
      <p className="mt-3 text-slate-600">
        Supabase-backed order list for cafe operations.
      </p>

      <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
        Total orders: <span className="font-semibold">{orders.length}</span>
      </div>

      {!!errorMessage && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      {loading && (
        <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-500">
          Loading orders...
        </div>
      )}

      {!loading && orders.length === 0 && (
        <div className="mt-4 rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
          No submitted orders yet. Create one from the POS module.
        </div>
      )}

      {!loading && orders.length > 0 && (
        <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Order ID</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Created At</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-600">Total</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-600">Item Count</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Source</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orders.map((order) => {
                  const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);

                  return (
                    <tr key={order.id}>
                      <td className="px-4 py-3 font-medium text-slate-900">{order.id}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {new Date(order.createdAt).toLocaleString('en-PH', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-900">
                        {PRICE_FORMATTER.format(order.total)}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-700">{itemCount}</td>
                      <td className="px-4 py-3 text-slate-700">{order.source}</td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700">
                          {order.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
