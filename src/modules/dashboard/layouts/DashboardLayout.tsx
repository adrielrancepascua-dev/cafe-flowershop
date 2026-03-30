import { NavLink, Outlet } from 'react-router-dom';
import { isFlowerDemoMode } from '../../../app/app-mode';

const DASHBOARD_LINKS = [
  { label: 'Overview', to: '/dashboard' },
  { label: 'POS', to: '/dashboard/pos' },
  { label: 'Orders', to: '/dashboard/orders' },
  { label: 'Products', to: '/dashboard/products' },
  { label: 'Inventory', to: '/dashboard/inventory' },
  { label: 'Flowers Prep', to: '/dashboard/flowers' },
];

const FLOWER_DEMO_LINKS = [
  { label: 'Flower Home', to: '/dashboard/flowers' },
  { label: 'Flower Orders', to: '/dashboard/flowers/orders' },
  { label: 'Flower Products', to: '/dashboard/flowers/products' },
  { label: 'Flower Inventory', to: '/dashboard/flowers/inventory' },
  { label: 'Flower Reports', to: '/dashboard/flowers/reports' },
];

export default function DashboardLayout() {
  const flowerDemoMode = isFlowerDemoMode();
  const dashboardLinks = flowerDemoMode ? FLOWER_DEMO_LINKS : DASHBOARD_LINKS;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              {flowerDemoMode ? 'Flower Demo' : 'Internal'}
            </p>
            <h1 className="text-xl font-semibold">
              {flowerDemoMode ? 'Stay Awhile Flower Back Office' : 'Stay Awhile Cafe Dashboard'}
            </h1>
          </div>

          {!flowerDemoMode ? (
            <NavLink
              to="/"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-100"
            >
              Back to Website
            </NavLink>
          ) : null}
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[240px_1fr] lg:px-8">
        <aside className="h-fit rounded-xl border border-slate-200 bg-white p-3">
          <nav className="flex flex-col gap-1">
            {dashboardLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.to === '/dashboard'}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-2 text-sm font-medium transition ${
                    isActive ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'
                  }`
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>
        </aside>

        <main className="rounded-xl border border-slate-200 bg-white p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
