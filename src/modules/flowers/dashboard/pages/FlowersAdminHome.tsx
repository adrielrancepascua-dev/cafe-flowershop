import { Link } from 'react-router-dom';
import PlaceholderPanel from '../../shared/components/PlaceholderPanel';
import { isFlowerDemoMode } from '../../../../app/app-mode';

const FLOWER_ADMIN_LINKS = [
  { label: 'Flower Orders', to: '/dashboard/flowers/orders' },
  { label: 'Flower Products', to: '/dashboard/flowers/products' },
  { label: 'Branch Settings', to: '/dashboard/flowers/branches' },
  { label: 'Branch Inventory', to: '/dashboard/flowers/inventory' },
  { label: 'Reports', to: '/dashboard/flowers/reports' },
  { label: 'Payment Verification', to: '/dashboard/flowers/payment-verification' },
  { label: 'Walk-in Orders', to: '/dashboard/flowers/walk-in' },
  { label: 'Attendance (Later)', to: '/dashboard/flowers/attendance' },
];

const FLOWER_DEMO_LINKS = [
  { label: 'Flower Orders', to: '/dashboard/flowers/orders' },
  { label: 'Flower Products', to: '/dashboard/flowers/products' },
  { label: 'Branch Inventory', to: '/dashboard/flowers/inventory' },
  { label: 'Reports', to: '/dashboard/flowers/reports' },
];

export default function FlowersAdminHome() {
  const flowerDemoMode = isFlowerDemoMode();
  const links = flowerDemoMode ? FLOWER_DEMO_LINKS : FLOWER_ADMIN_LINKS;

  return (
    <div className="space-y-4">
      <PlaceholderPanel
        zoneLabel="Flowers Admin Zone"
        title="Flower Dashboard Preparation"
        summary={
          flowerDemoMode
            ? 'Flower-only demo mode is enabled. This deployment is scoped to flower back-office workflows only.'
            : 'This is a route-ready admin shell for future flower operations, kept intentionally lightweight until client scope is confirmed.'
        }
        futureItems={[
          'Branch-aware owner view',
          'Flower order processing module',
          'Branch inventory workflows',
          'Manual payment verification queue',
          'Walk-in order entry surface',
        ]}
      />

      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h3 className="text-base font-semibold text-slate-900">
          {flowerDemoMode ? 'Flower Demo Modules' : 'Prepared Placeholder Modules'}
        </h3>
        <div className="mt-3 flex flex-wrap gap-2">
          {links.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
