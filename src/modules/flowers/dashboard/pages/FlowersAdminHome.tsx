import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BarChart3,
  Flower2,
  Package,
  ShoppingBag,
  ShoppingCart,
} from 'lucide-react';
import { isFlowerDemoMode } from '../../../../app/app-mode';
import DemoModeBanner from '../../shared/components/DemoModeBanner';

const FLOWER_ADMIN_LINKS = [
  {
    label: 'POS',
    to: '/dashboard/flowers/pos',
    description: 'Walk-in & phone orders',
    icon: ShoppingCart,
    color: 'bg-rose-50 text-rose-600',
  },
  {
    label: 'Orders',
    to: '/dashboard/flowers/orders',
    description: 'Manual & scheduled orders',
    icon: ShoppingBag,
    color: 'bg-amber-50 text-amber-700',
  },
  {
    label: 'Products',
    to: '/dashboard/flowers/products',
    description: 'Catalog management',
    icon: Flower2,
    color: 'bg-pink-50 text-pink-600',
  },
  {
    label: 'Inventory',
    to: '/dashboard/flowers/inventory',
    description: 'Branch stock levels',
    icon: Package,
    color: 'bg-emerald-50 text-emerald-700',
  },
  {
    label: 'Reports',
    to: '/dashboard/flowers/reports',
    description: 'Sales & advance orders',
    icon: BarChart3,
    color: 'bg-violet-50 text-violet-600',
  },
];

const FLOWER_EXTENDED_LINKS = [
  ...FLOWER_ADMIN_LINKS,
  {
    label: 'Branch Settings',
    to: '/dashboard/flowers/branches',
    description: 'Coming soon',
    icon: Package,
    color: 'bg-slate-50 text-slate-500',
  },
  {
    label: 'Payment Verification',
    to: '/dashboard/flowers/payment-verification',
    description: 'Coming soon',
    icon: ShoppingBag,
    color: 'bg-slate-50 text-slate-500',
  },
  {
    label: 'Walk-in Orders',
    to: '/dashboard/flowers/walk-in',
    description: 'Coming soon',
    icon: ShoppingCart,
    color: 'bg-slate-50 text-slate-500',
  },
];

export default function FlowersAdminHome() {
  const flowerDemoMode = isFlowerDemoMode();
  const links = flowerDemoMode ? FLOWER_ADMIN_LINKS : FLOWER_EXTENDED_LINKS;

  return (
    <div className="animate-fade-in space-y-6 sm:space-y-8">
      <DemoModeBanner />

      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-brown via-[#6D4C41] to-brand-dark px-5 py-8 text-white shadow-flower-lg sm:px-8 sm:py-10">
        <div className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/5" />
        <div className="pointer-events-none absolute -bottom-12 -left-6 h-48 w-48 rounded-full bg-white/5" />
        <div className="relative">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-brand-beige/80 sm:text-xs">
            {flowerDemoMode ? 'Flower Demo' : 'Flowers Admin'}
          </p>
          <h2 className="mt-2 font-serif text-2xl font-semibold leading-tight sm:text-4xl">
            {flowerDemoMode ? 'Welcome to the Flower Shop' : 'Flower Operations'}
          </h2>
          <p className="mt-3 max-w-lg text-sm leading-relaxed text-brand-beige/90 sm:text-base">
            {flowerDemoMode
              ? 'Take orders, manage your catalog, track branch inventory, and view sales reports — all in one place.'
              : 'Flower back-office modules for order entry, catalog, inventory, and reporting.'}
          </p>
          {flowerDemoMode ? (
            <Link
              to="/dashboard/flowers/pos"
              className="mt-5 inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-brand-brown shadow-sm transition hover:bg-brand-cream active:scale-[0.98]"
            >
              Open POS
              <ArrowRight className="h-4 w-4" />
            </Link>
          ) : null}
        </div>
      </section>

      <div>
        <h3 className="mb-3 font-serif text-lg font-semibold text-brand-dark sm:mb-4 sm:text-xl">
          Modules
        </h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
          {links.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="group flower-card flex items-start gap-4 p-4 transition hover:border-brand-accent hover:shadow-flower-lg active:scale-[0.99] sm:p-5"
            >
              <span
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${link.color}`}
              >
                <link.icon className="h-5 w-5" strokeWidth={1.75} />
              </span>
              <div className="min-w-0 flex-1">
                <h4 className="font-serif text-base font-semibold text-brand-dark group-hover:text-brand-brown sm:text-lg">
                  {link.label}
                </h4>
                <p className="mt-0.5 text-sm text-brand-brown/65">{link.description}</p>
                <p className="mt-2 flex items-center gap-1 text-xs font-semibold text-brand-accent">
                  Open
                  <ArrowRight className="h-3 w-3 transition group-hover:translate-x-0.5" />
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
