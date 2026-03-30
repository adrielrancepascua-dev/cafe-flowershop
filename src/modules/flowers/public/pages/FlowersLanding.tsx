import { Link } from 'react-router-dom';
import PlaceholderPanel from '../../shared/components/PlaceholderPanel';

const LINKS = [
  { label: 'Flower Shop', to: '/flowers/shop' },
  { label: 'Flower Product Detail', to: '/flowers/product/sample-rose-bouquet' },
  { label: 'Flower Checkout', to: '/flowers/checkout' },
  { label: 'Flower Order Status', to: '/flowers/order-status' },
];

export default function FlowersLanding() {
  return (
    <div className="space-y-4">
      <PlaceholderPanel
        zoneLabel="Flowers Public Zone"
        title="Flower Storefront Preparation"
        summary="This section reserves the public flower storefront route space inside the existing app without implementing final ordering behavior yet."
        futureItems={[
          'Public catalog browsing',
          'Product detail flow',
          'Checkout flow with confirmed requirements',
          'Order status lookup',
        ]}
      />

      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h3 className="text-base font-semibold text-slate-900">Placeholder Routes</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          {LINKS.map((link) => (
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
