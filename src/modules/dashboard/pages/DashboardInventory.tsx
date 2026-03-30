import { useEffect, useMemo, useState } from 'react';
import type { InventoryLogRecord, InventoryStockRecord } from '../../shared/types/inventory';
import { adjustInventory, listInventoryLog, listInventoryStock } from '../../../services/inventory';

export default function DashboardInventory() {
  const [stockRows, setStockRows] = useState<InventoryStockRecord[]>([]);
  const [logRows, setLogRows] = useState<InventoryLogRecord[]>([]);
  const [quantityDrafts, setQuantityDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [activeActionKey, setActiveActionKey] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    void loadInventoryData();
  }, []);

  async function loadInventoryData() {
    try {
      setLoading(true);
      const [stocks, logs] = await Promise.all([listInventoryStock(), listInventoryLog(30)]);

      setStockRows(stocks);
      setLogRows(logs);
      setQuantityDrafts((current) => {
        const next = { ...current };

        for (const stock of stocks) {
          if (!next[stock.productId]) {
            next[stock.productId] = '1';
          }
        }

        return next;
      });
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to load inventory data.');
    } finally {
      setLoading(false);
    }
  }

  const visibleStockRows = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    if (!keyword) {
      return stockRows;
    }

    return stockRows.filter((row) => row.productName.toLowerCase().includes(keyword));
  }, [search, stockRows]);

  const productNameById = useMemo(() => {
    return stockRows.reduce<Record<string, string>>((acc, row) => {
      acc[row.productId] = row.productName;
      return acc;
    }, {});
  }, [stockRows]);

  const lowStockCount = useMemo(() => stockRows.filter((row) => row.currentStock <= 5).length, [stockRows]);

  async function handleAdjustStock(
    row: InventoryStockRecord,
    adjustmentType: 'stock_in' | 'stock_out',
  ) {
    const quantityRaw = (quantityDrafts[row.productId] ?? '').trim();
    const quantity = Number(quantityRaw);

    if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isInteger(quantity)) {
      setErrorMessage(`Quantity for ${row.productName} must be a whole number greater than 0.`);
      setSuccessMessage(null);
      return;
    }

    const actionKey = `${row.productId}:${adjustmentType}`;

    try {
      setActiveActionKey(actionKey);
      setErrorMessage(null);
      setSuccessMessage(null);

      await adjustInventory({
        productId: row.productId,
        adjustmentType,
        quantity,
      });

      setSuccessMessage(
        `${adjustmentType === 'stock_in' ? 'Added' : 'Deducted'} ${quantity} for ${row.productName}.`,
      );
      await loadInventoryData();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to adjust inventory.');
      setSuccessMessage(null);
    } finally {
      setActiveActionKey(null);
    }
  }

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Inventory Module</p>
      <h2 className="mt-2 text-2xl font-semibold text-slate-900">Inventory Foundation</h2>
      <p className="mt-3 text-slate-600">
        Phase 1 inventory for cafe products: current stock, manual stock in/out, and adjustment history.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">Products</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{stockRows.length}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">Low Stock (&lt;=5)</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{lowStockCount}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">Recent Logs</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{logRows.length}</p>
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
        <label className="block text-sm font-medium text-slate-700">
          Search product
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Type product name"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
          />
        </label>
      </div>

      {errorMessage ? (
        <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{errorMessage}</p>
      ) : null}

      {successMessage ? (
        <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          {successMessage}
        </p>
      ) : null}

      <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3 font-semibold">Product Name</th>
              <th className="px-4 py-3 font-semibold">Current Stock</th>
              <th className="px-4 py-3 font-semibold">Last Updated</th>
              <th className="px-4 py-3 font-semibold">Adjust</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="px-4 py-4 text-slate-500" colSpan={4}>
                  Loading inventory...
                </td>
              </tr>
            ) : visibleStockRows.length === 0 ? (
              <tr>
                <td className="px-4 py-4 text-slate-500" colSpan={4}>
                  No products found.
                </td>
              </tr>
            ) : (
              visibleStockRows.map((row) => {
                const stockInKey = `${row.productId}:stock_in`;
                const stockOutKey = `${row.productId}:stock_out`;
                const quantityDraft = quantityDrafts[row.productId] ?? '1';

                return (
                  <tr key={row.productId} className="border-t border-slate-200 align-top">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{row.productName}</p>
                      {!row.isActiveProduct ? (
                        <span className="mt-1 inline-flex rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-600">
                          Inactive Product
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-900">{row.currentStock}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {row.lastUpdated
                        ? new Date(row.lastUpdated).toLocaleString('en-PH', {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })
                        : 'Never'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={quantityDraft}
                          onChange={(event) =>
                            setQuantityDrafts((current) => ({
                              ...current,
                              [row.productId]: event.target.value,
                            }))
                          }
                          className="w-20 rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                        />

                        <button
                          type="button"
                          onClick={() => handleAdjustStock(row, 'stock_in')}
                          disabled={activeActionKey === stockInKey || Boolean(activeActionKey)}
                          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {activeActionKey === stockInKey ? 'Adding...' : 'Add Stock'}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleAdjustStock(row, 'stock_out')}
                          disabled={activeActionKey === stockOutKey || Boolean(activeActionKey)}
                          className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {activeActionKey === stockOutKey ? 'Deducting...' : 'Deduct Stock'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-8 overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3">
          <h3 className="text-sm font-semibold text-slate-900">Recent Inventory Log</h3>
        </div>
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3 font-semibold">Time</th>
              <th className="px-4 py-3 font-semibold">Product</th>
              <th className="px-4 py-3 font-semibold">Action</th>
              <th className="px-4 py-3 font-semibold">Qty</th>
              <th className="px-4 py-3 font-semibold">Before</th>
              <th className="px-4 py-3 font-semibold">After</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="px-4 py-4 text-slate-500" colSpan={6}>
                  Loading log...
                </td>
              </tr>
            ) : logRows.length === 0 ? (
              <tr>
                <td className="px-4 py-4 text-slate-500" colSpan={6}>
                  No inventory adjustments yet.
                </td>
              </tr>
            ) : (
              logRows.map((row) => (
                <tr key={row.id} className="border-t border-slate-200">
                  <td className="px-4 py-3 text-slate-600">
                    {new Date(row.createdAt).toLocaleString('en-PH', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </td>
                  <td className="px-4 py-3 text-slate-900">
                    {productNameById[row.productId] ?? row.productId}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                        row.adjustmentType === 'stock_in'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {row.adjustmentType === 'stock_in' ? 'Stock In' : 'Stock Out'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{row.quantity}</td>
                  <td className="px-4 py-3 text-slate-700">{row.previousStock}</td>
                  <td className="px-4 py-3 text-slate-900">{row.newStock}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
