import { Link } from 'react-router-dom';

export default function Order() {
  return (
    <div className="bg-brand-light min-h-screen py-20">
      <section className="mx-auto w-full max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-brand-beige/50 bg-white p-8 shadow-sm sm:p-10">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand-brown">Order</p>
          <h1 className="mt-3 font-serif text-4xl font-bold text-brand-dark">How would you like to order?</h1>
          <p className="mt-4 max-w-2xl text-brand-dark/80">
            This page is now part of your Phase 1 cafe app. Use this as your public order entry point while
            internal POS workflows are inside the dashboard.
          </p>

          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <a
              href="https://www.foodpanda.ph/restaurant/lpee/stay-awhile-cafe-and-bakery"
              target="_blank"
              rel="noreferrer"
              className="rounded-xl border border-brand-brown bg-brand-brown px-5 py-4 text-center font-semibold text-white transition hover:bg-brand-dark"
            >
              Order via Foodpanda
            </a>
            <Link
              to="/menu"
              className="rounded-xl border border-brand-beige bg-brand-beige/40 px-5 py-4 text-center font-semibold text-brand-dark transition hover:bg-brand-beige"
            >
              Browse Full Menu
            </Link>
          </div>

          <div className="mt-6 rounded-xl border border-brand-beige/60 bg-brand-beige/20 p-4 text-sm text-brand-dark/80">
            Staff use only: internal sales entry and POS are under /dashboard/pos.
          </div>
        </div>
      </section>
    </div>
  );
}
