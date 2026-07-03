import { NavLink } from 'react-router-dom';
import { BarChart3, CalendarDays, Home, Package, Receipt, Sprout, Users } from 'lucide-react';
import { useFlowerAuth } from '../../../../lib/auth/FlowerAuthContext';
import FlowerBrandLogo from './FlowerBrandLogo';
const BASE_LINKS = [
  { label: 'Home', to: '/dashboard/flowers', icon: Home, end: true, adminOnly: false },
  { label: 'Orders', to: '/dashboard/flowers/orders', icon: CalendarDays, end: false, adminOnly: false },
  { label: 'Inventory', to: '/dashboard/flowers/inventory', icon: Package, end: false, adminOnly: false },
  { label: 'Expenses', to: '/dashboard/flowers/expenses', icon: Receipt, end: false, adminOnly: false },
  { label: 'Reports', to: '/dashboard/flowers/reports', icon: BarChart3, end: false, adminOnly: false },
  { label: 'Team', to: '/dashboard/flowers/team', icon: Users, end: false, adminOnly: true },
  { label: 'Products', to: '/dashboard/flowers/products', icon: Sprout, end: false, adminOnly: true },
];

export default function FlowerMobileNav() {
  const { isAdmin } = useFlowerAuth();
  const links = BASE_LINKS.filter((link) => !link.adminOnly || isAdmin);

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 border-t border-brand-muted/50 bg-white/95 px-1 pb-[env(safe-area-inset-bottom)] pt-1 backdrop-blur-md lg:hidden"
      aria-label="Mobile navigation"
    >
      <ul className="mx-auto flex max-w-lg items-stretch justify-around">
        {links.map((link) => (
          <li key={link.to} className="flex-1">
            <NavLink
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                `flex min-h-[52px] flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1.5 text-[10px] font-semibold transition ${
                  isActive ? 'text-brand-brown' : 'text-brand-brown/50'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-full transition ${
                      isActive ? 'bg-brand-brown text-white shadow-sm' : ''
                    }`}
                  >
                    <link.icon className="h-[18px] w-[18px]" strokeWidth={isActive ? 2.25 : 1.75} />
                  </span>
                  <span>{link.label}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function FlowerDesktopSidebarHeader() {
  return (
    <div className="mb-4 hidden border-b border-brand-muted/40 px-1 pb-4 lg:block">
      <FlowerBrandLogo size="sm" subtitle="Flower shop" />
    </div>
  );
}
