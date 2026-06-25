import { NavLink, Outlet } from 'react-router-dom';
import { isFlowerDemoMode } from '../../../app/app-mode';
import FlowerMobileNav, {
  FlowerDesktopSidebarHeader,
} from '../../flowers/shared/components/FlowerMobileNav';

const DASHBOARD_LINKS = [
  { label: 'Overview', to: '/dashboard' },
  { label: 'POS', to: '/dashboard/pos' },
  { label: 'Orders', to: '/dashboard/orders' },
  { label: 'Products', to: '/dashboard/products' },
  { label: 'Inventory', to: '/dashboard/inventory' },
  { label: 'Flowers Prep', to: '/dashboard/flowers' },
];

const FLOWER_DEMO_LINKS = [
  { label: 'Home', to: '/dashboard/flowers' },
  { label: 'POS', to: '/dashboard/flowers/pos' },
  { label: 'Orders', to: '/dashboard/flowers/orders' },
  { label: 'Products', to: '/dashboard/flowers/products' },
  { label: 'Inventory', to: '/dashboard/flowers/inventory' },
  { label: 'Reports', to: '/dashboard/flowers/reports' },
];

export default function DashboardLayout() {
  const flowerDemoMode = isFlowerDemoMode();
  const dashboardLinks = flowerDemoMode ? FLOWER_DEMO_LINKS : DASHBOARD_LINKS;

  if (flowerDemoMode) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-brand-cream via-brand-light to-brand-beige/30 font-sans text-brand-dark">
        <header className="sticky top-0 z-40 border-b border-brand-muted/40 bg-white/90 backdrop-blur-md">
          <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-3.5 sm:px-6 sm:py-4 lg:px-8">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-brand-accent sm:text-xs">
                Stay Awhile Flowers
              </p>
              <h1 className="truncate font-serif text-lg font-semibold text-brand-dark sm:text-2xl">
                Flower Shop Back Office
              </h1>
            </div>
            <span className="shrink-0 rounded-full bg-brand-brown px-3 py-1 text-[11px] font-semibold text-white shadow-sm sm:text-xs">
              Demo
            </span>
          </div>
        </header>

        <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-4 px-3 py-4 sm:gap-6 sm:px-6 sm:py-6 lg:grid-cols-[220px_1fr] lg:px-8">
          <aside className="hidden h-fit lg:block">
            <div className="flower-card sticky top-[76px] p-3">
              <FlowerDesktopSidebarHeader />
              <nav className="flex flex-col gap-0.5">
                {dashboardLinks.map((link) => (
                  <NavLink
                    key={link.to}
                    to={link.to}
                    end={link.to === '/dashboard/flowers'}
                    className={({ isActive }) =>
                      `rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                        isActive
                          ? 'bg-brand-brown text-white shadow-sm'
                          : 'text-brand-brown hover:bg-brand-beige/80'
                      }`
                    }
                  >
                    {link.label}
                  </NavLink>
                ))}
              </nav>
            </div>
          </aside>

          <main className="flower-card min-h-[60vh] p-4 sm:p-6 lg:mb-0 lg:pb-6 pb-24">
            <Outlet />
          </main>
        </div>

        <FlowerMobileNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Internal</p>
            <h1 className="text-xl font-semibold">Stay Awhile Cafe Dashboard</h1>
          </div>

          <NavLink
            to="/"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-100"
          >
            Back to Website
          </NavLink>
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
