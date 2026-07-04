import { Link } from 'react-router-dom';
import { CalendarDays, ClipboardList, Package, Receipt, ShoppingBag, Sprout, BarChart3 } from 'lucide-react';
import { isFlowerDemoMode } from '../../../../app/app-mode';
import { isSupabaseConfigured } from '../../../../lib/supabase/client';
import { useFlowerAuth } from '../../../../lib/auth/FlowerAuthContext';
import { getFlowerStorageMode, shouldUseFlowerSupabase } from '../../../../services/flowers/storage-mode';
import FlowerPageHeader from '../../shared/components/FlowerPageHeader';
import FlowerStatCard from '../../shared/components/FlowerStatCard';

function getSystemModeLabel(): string {
  const storageMode = getFlowerStorageMode();
  if (shouldUseFlowerSupabase(storageMode) && isSupabaseConfigured()) {
    return 'Live';
  }

  if (isFlowerDemoMode()) {
    return 'Demo';
  }

  return 'Local';
}

const STAFF_LINKS = [
  { label: 'Orders', to: '/dashboard/flowers/orders', icon: CalendarDays, description: 'Calendar & list order entry' },
  { label: 'Inventory', to: '/dashboard/flowers/inventory', icon: Package, description: 'View branch stock levels' },
  { label: 'My Expenses', to: '/dashboard/flowers/expenses', icon: Receipt, description: 'Log your daily expenses' },
  { label: 'Reports', to: '/dashboard/flowers/reports', icon: BarChart3, description: "Today's sales & net income after all orders are closed" },
];

const ADMIN_LINKS = [
  { label: 'Products', to: '/dashboard/flowers/products', icon: Sprout, description: 'Manage flower types & costs' },
  { label: 'Supplies', to: '/dashboard/flowers/supplies', icon: ClipboardList, description: 'Branch supply transfers & liability vouchers' },
];

export default function FlowersAdminHome() {
  const { user, isAdmin, signOut } = useFlowerAuth();

  return (
    <div className="animate-fade-in">
      <FlowerPageHeader
        label="Papers & Petals"
        title="Flower Operations"
        description={`Welcome, ${user?.display_name ?? 'Staff'}. Branches: Dagupan, San Carlos, Urdaneta.`}
      />

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <FlowerStatCard label="Branches" value={3} icon={ShoppingBag} />
        <FlowerStatCard label="Role" value={isAdmin ? 'Admin' : 'Staff'} icon={Package} accent="warm" />
        <FlowerStatCard label="System" value={getSystemModeLabel()} icon={CalendarDays} accent="green" />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {[...STAFF_LINKS, ...(isAdmin ? ADMIN_LINKS : [])].map((link) => (
          <Link
            key={link.to}
            to={link.to}
            className="flower-card block p-4 transition hover:border-brand-accent"
          >
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-beige/80 text-brand-brown">
                <link.icon className="h-5 w-5" />
              </span>
              <div>
                <h3 className="font-semibold text-brand-dark">{link.label}</h3>
                <p className="mt-1 text-sm text-brand-brown/70">{link.description}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <button type="button" onClick={() => void signOut()} className="flower-btn-secondary mt-6">
        Sign out
      </button>
    </div>
  );
}
