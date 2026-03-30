export default function DashboardHome() {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Dashboard</p>
      <h2 className="mt-2 text-2xl font-semibold text-slate-900">Cafe Operations Overview</h2>
      <p className="mt-3 max-w-3xl text-slate-600">
        This is the Phase 1 dashboard home. Use the left navigation to access POS, orders, products, and
        inventory modules.
      </p>
      <div className="mt-6 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
        No auth enabled yet for this phase.
      </div>
    </div>
  );
}
