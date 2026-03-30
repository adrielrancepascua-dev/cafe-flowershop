import { useEffect, useMemo, useState } from 'react';
import type {
  FlowerBranchOption,
  FlowerInventoryMovementRow,
  FlowerInventoryStockRow,
} from '../../shared/types/flower-inventory';
import {
  adjustFlowerInventory,
  listFlowerBranches,
  listFlowerInventoryMovements,
  listFlowerInventoryStock,
} from '../../../../services/flowers/inventory';

export default function FlowerBranchInventoryPlaceholder() {
  const [branches, setBranches] = useState<FlowerBranchOption[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState('all');
  const [stockRows, setStockRows] = useState<FlowerInventoryStockRow[]>([]);
  const [movementRows, setMovementRows] = useState<FlowerInventoryMovementRow[]>([]);
  const [quantityDrafts, setQuantityDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [activeActionKey, setActiveActionKey] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    void loadBranches();
  }, []);

  useEffect(() => {
    void loadInventoryData();
  }, [selectedBranchId]);

  async function loadBranches() {
    try {
      const nextBranches = await listFlowerBranches();
      setBranches(nextBranches);
    } catch {
      // Branch fetch errors are shown by inventory load path.
    }
  }

  async function loadInventoryData() {
    try {
      setLoading(true);

      const branchId = selectedBranchId === 'all' ? undefined : selectedBranchId;

      const [stocks, movements] = await Promise.all([
        listFlowerInventoryStock({ branchId }),
        listFlowerInventoryMovements({ branchId, limit: 40 }),
      ]);

      setStockRows(stocks);
      setMovementRows(movements);
      setQuantityDrafts((current) => {
        const next = { ...current };

        for (const stock of stocks) {
          const key = `${stock.branch_id}:${stock.product_id}`;
          if (!next[key]) {
            next[key] = '1';
          }
        }

        return next;
      });
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to load flower inventory data.');
    } finally {
      setLoading(false);
    }
  }

  const visibleStockRows = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    if (!keyword) {
      return stockRows;
    }

    return stockRows.filter((row) => {
      return (
        row.product_name.toLowerCase().includes(keyword) ||
        row.branch_name.toLowerCase().includes(keyword)
      );
    });
  }, [search, stockRows]);

  const totalOnHand = useMemo(
    () => stockRows.reduce((sum, row) => sum + row.on_hand, 0),
    [stockRows],
  );

  const lowStockCount = useMemo(
    () => stockRows.filter((row) => row.on_hand <= 5).length,
    [stockRows],
  );

  async function handleAdjustStock(
    row: FlowerInventoryStockRow,
    movementType: 'stock_in' | 'stock_out',
  ) {
    const draftKey = `${row.branch_id}:${row.product_id}`;
    const quantityRaw = (quantityDrafts[draftKey] ?? '').trim();
    const quantity = Number(quantityRaw);

    if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isInteger(quantity)) {
      setErrorMessage(`Quantity for ${row.product_name} must be a whole number greater than 0.`);
      setSuccessMessage(null);
      return;
    }

    const actionKey = `${draftKey}:${movementType}`;

    try {
      setActiveActionKey(actionKey);
      setErrorMessage(null);
      setSuccessMessage(null);

      await adjustFlowerInventory({
        branchId: row.branch_id,
        productId: row.product_id,
        movementType,
        quantity,
      });

      setSuccessMessage(
        `${movementType === 'stock_in' ? 'Added' : 'Deducted'} ${quantity} for ${row.product_name} at ${row.branch_name}.`,
      );
      await loadInventoryData();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to adjust flower inventory.');
      setSuccessMessage(null);
    } finally {
      setActiveActionKey(null);
    }
  }

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Flowers Admin Zone</p>
      <h2 className="mt-2 text-2xl font-semibold text-slate-900">Branch Inventory</h2>
      <p className="mt-3 text-slate-600">
        Internal inventory module for branch-level stock tracking and manual stock adjustments.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">Stock Rows</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{stockRows.length}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">Total On Hand</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{totalOnHand}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">Low Stock (&lt;=5)</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{lowStockCount}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">Recent Movements</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{movementRows.length}</p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-[1fr_2fr]">
        <label className="block text-sm font-medium text-slate-700">
          Branch Filter
          <select
            value={selectedBranchId}
            onChange={(event) => setSelectedBranchId(event.target.value)}
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

        <label className="block text-sm font-medium text-slate-700">
          Search
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by branch or product"
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
              <th className="px-4 py-3 font-semibold">Branch</th>
              <th className="px-4 py-3 font-semibold">Product</th>
              <th className="px-4 py-3 font-semibold">On Hand</th>
              <th className="px-4 py-3 font-semibold">Last Updated</th>
              <th className="px-4 py-3 font-semibold">Adjust</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="px-4 py-4 text-slate-500" colSpan={5}>
                  Loading inventory...
                </td>
              </tr>
            ) : visibleStockRows.length === 0 ? (
              <tr>
                <td className="px-4 py-4 text-slate-500" colSpan={5}>
                  No inventory records found.
                </td>
              </tr>
            ) : (
              visibleStockRows.map((row) => {
                const draftKey = `${row.branch_id}:${row.product_id}`;
                const stockInKey = `${draftKey}:stock_in`;
                const stockOutKey = `${draftKey}:stock_out`;
                const quantityDraft = quantityDrafts[draftKey] ?? '1';

                return (
                  <tr key={draftKey} className="border-t border-slate-200 align-top">
                    <td className="px-4 py-3 text-slate-700">{row.branch_name}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{row.product_name}</p>
                      {!row.product_is_active ? (
                        <span className="mt-1 inline-flex rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-600">
                          Inactive Product
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-900">{row.on_hand}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {row.last_updated
                        ? new Date(row.last_updated).toLocaleString('en-PH', {
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
                              [draftKey]: event.target.value,
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
                          {activeActionKey === stockInKey ? 'Adding...' : 'Stock In'}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleAdjustStock(row, 'stock_out')}
                          disabled={activeActionKey === stockOutKey || Boolean(activeActionKey)}
                          className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {activeActionKey === stockOutKey ? 'Deducting...' : 'Stock Out'}
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
          <h3 className="text-sm font-semibold text-slate-900">Recent Inventory Movements</h3>
        </div>
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3 font-semibold">Time</th>
              <th className="px-4 py-3 font-semibold">Branch</th>
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
                <td className="px-4 py-4 text-slate-500" colSpan={7}>
                  Loading movement history...
                </td>
              </tr>
            ) : movementRows.length === 0 ? (
              <tr>
                <td className="px-4 py-4 text-slate-500" colSpan={7}>
                  No inventory movements yet.
                </td>
              </tr>
            ) : (
              movementRows.map((row) => (
                <tr key={row.id} className="border-t border-slate-200">
                  <td className="px-4 py-3 text-slate-600">
                    {new Date(row.created_at).toLocaleString('en-PH', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{row.branch_name}</td>
                  <td className="px-4 py-3 text-slate-900">{row.product_name}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                        row.movement_type === 'stock_in'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {row.movement_type === 'stock_in' ? 'Stock In' : 'Stock Out'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{row.quantity}</td>
                  <td className="px-4 py-3 text-slate-700">{row.previous_on_hand}</td>
                  <td className="px-4 py-3 text-slate-900">{row.new_on_hand}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
