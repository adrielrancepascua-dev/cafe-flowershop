import { useEffect, useMemo, useState } from 'react';
import {
  adjustFlowerInventory,
  listFlowerBranches,
  listFlowerInventoryMovements,
  listFlowerInventoryStock,
  transferFlowerInventory,
} from '../../../../services/flowers/inventory';
import { listFlowerProducts } from '../../../../services/flowers/products';
import type { FlowerBranchOption, FlowerInventoryMovementRow, FlowerInventoryStockRow } from '../../shared/types/flower-inventory';
import type { FlowerProduct } from '../../shared/types/flower-product';
import FlowerPageHeader from '../../shared/components/FlowerPageHeader';
import { RequireFlowerAdmin } from '../components/RequireFlowerAuth';

export default function FlowerInventoryPage() {
  const [branches, setBranches] = useState<FlowerBranchOption[]>([]);
  const [products, setProducts] = useState<FlowerProduct[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState('all');
  const [stockRows, setStockRows] = useState<FlowerInventoryStockRow[]>([]);
  const [movementRows, setMovementRows] = useState<FlowerInventoryMovementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const [fromBranchId, setFromBranchId] = useState('');
  const [toBranchId, setToBranchId] = useState('');
  const [transferProductId, setTransferProductId] = useState('');
  const [transferQty, setTransferQty] = useState('1');

  async function loadData() {
    setLoading(true);
    try {
      const branchId = selectedBranchId === 'all' ? undefined : selectedBranchId;
      const [branchList, productList, stocks, movements] = await Promise.all([
        listFlowerBranches(),
        listFlowerProducts(),
        listFlowerInventoryStock({ branchId }),
        listFlowerInventoryMovements({ branchId, limit: 30 }),
      ]);
      setBranches(branchList);
      setProducts(productList.filter((product) => product.is_active));
      setStockRows(stocks);
      setMovementRows(movements);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to load inventory.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, [selectedBranchId]);

  const filteredStock = useMemo(() => stockRows, [stockRows]);

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
      setErrorMessage('Complete all transfer fields.');
      return;
    }

    try {
      await transferFlowerInventory({
        fromBranchId,
        toBranchId,
        items: [{ productId: transferProductId, quantity }],
      });
      setMessage('Transfer completed.');
      setErrorMessage('');
      await loadData();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Transfer failed.');
    }
  }

  return (
    <div className="animate-fade-in">
      <FlowerPageHeader
        label="Inventory"
        title="Branch Stock"
        description="Staff can view stock levels. Stock in/out and transfers are admin-only. Stock deducts when orders are marked completed."
      />

      <div className="mt-4">
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
      </div>

      {message ? <p className="mt-3 text-sm text-emerald-700">{message}</p> : null}
      {errorMessage ? <p className="mt-3 text-sm text-red-700">{errorMessage}</p> : null}

      {loading ? (
        <p className="mt-6 text-sm text-brand-brown/60">Loading inventory...</p>
      ) : (
        <>
          <div className="mt-5 overflow-x-auto rounded-2xl border border-brand-muted/40">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-brand-beige/40 text-brand-brown">
                <tr>
                  <th className="px-3 py-2">Branch</th>
                  <th className="px-3 py-2">Flower</th>
                  <th className="px-3 py-2">On hand</th>
                  <RequireFlowerAdmin>
                    <th className="px-3 py-2">Admin actions</th>
                  </RequireFlowerAdmin>
                </tr>
              </thead>
              <tbody>
                {filteredStock.map((row) => (
                  <tr key={`${row.branch_id}-${row.product_id}`} className="border-t border-brand-muted/30">
                    <td className="px-3 py-2">{row.branch_name}</td>
                    <td className="px-3 py-2">{row.product_name}</td>
                    <td className="px-3 py-2 font-semibold">{row.on_hand}</td>
                    <RequireFlowerAdmin>
                      <td className="px-3 py-2">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            className="flower-btn-secondary px-2 py-1 text-xs"
                            onClick={() =>
                              void handleAdjust(row.branch_id, row.product_id, 'stock_in', 10)
                            }
                          >
                            +10 in
                          </button>
                          <button
                            type="button"
                            className="flower-btn-secondary px-2 py-1 text-xs"
                            onClick={() =>
                              void handleAdjust(row.branch_id, row.product_id, 'stock_out', 1)
                            }
                          >
                            -1 out
                          </button>
                        </div>
                      </td>
                    </RequireFlowerAdmin>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <RequireFlowerAdmin>
            <form onSubmit={handleTransfer} className="mt-6 rounded-2xl border border-brand-muted/40 bg-brand-cream/20 p-4">
              <h3 className="text-sm font-semibold text-brand-dark">Inter-branch transfer</h3>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <select value={fromBranchId} onChange={(e) => setFromBranchId(e.target.value)} className="flower-input" required>
                  <option value="">From branch</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
                <select value={toBranchId} onChange={(e) => setToBranchId(e.target.value)} className="flower-input" required>
                  <option value="">To branch</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
                <select value={transferProductId} onChange={(e) => setTransferProductId(e.target.value)} className="flower-input" required>
                  <option value="">Flower type</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <input type="number" min="1" value={transferQty} onChange={(e) => setTransferQty(e.target.value)} className="flower-input" required />
                <button type="submit" className="flower-btn-primary">Transfer</button>
              </div>
            </form>
          </RequireFlowerAdmin>

          <div className="mt-6">
            <h3 className="text-sm font-semibold text-brand-dark">Recent movements</h3>
            <ul className="mt-2 space-y-2 text-sm text-brand-brown/80">
              {movementRows.map((movement) => (
                <li key={movement.id} className="rounded-lg border border-brand-muted/30 px-3 py-2">
                  {movement.branch_name} · {movement.product_name} · {movement.movement_type} ·{' '}
                  {movement.quantity} · {movement.note}
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
