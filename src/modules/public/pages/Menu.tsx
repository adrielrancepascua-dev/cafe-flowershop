import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import type { CafeProduct } from '../../shared/types/product';
import { listProducts } from '../../../services/products';

const PRICE_FORMATTER = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=600&q=80';

export default function Menu() {
  const [products, setProducts] = useState<CafeProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const categoryRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    async function loadMenuProducts() {
      const data = await listProducts();
      setProducts(data);
      setLoading(false);
    }

    loadMenuProducts();
  }, []);

  const categories = useMemo(() => {
    return [...new Set(products.map((product) => product.category))];
  }, [products]);

  const productsByCategory = useMemo(() => {
    return products.reduce<Record<string, CafeProduct[]>>((acc, product) => {
      if (!acc[product.category]) {
        acc[product.category] = [];
      }
      acc[product.category].push(product);
      return acc;
    }, {});
  }, [products]);

  const scrollToCategory = (category: string) => {
    const element = categoryRefs.current[category];
    if (element) {
      const offset = 100;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - offset;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth',
      });
    }
  };

  return (
    <div className="bg-brand-light min-h-screen pb-20">
      {/* Header */}
      <div className="bg-brand-brown py-16 text-center text-white">
        <h1 className="font-serif text-4xl font-bold mb-4">Our Menu</h1>
        <p className="opacity-90 max-w-2xl mx-auto px-4">
          Discover our selection of handcrafted beverages, comfort food, and sweet treats.
        </p>
      </div>

      <div className="sticky top-20 z-10 bg-brand-light/95 backdrop-blur-sm border-b border-brand-beige shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex overflow-x-auto py-4 gap-2 no-scrollbar">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => scrollToCategory(category)}
                className="px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap bg-white text-brand-dark hover:bg-brand-brown hover:text-white transition-colors border border-brand-beige"
              >
                {category}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-16">
        {loading && (
          <div className="rounded-xl border border-brand-beige/40 bg-white p-6 text-brand-dark/80">
            Loading menu items...
          </div>
        )}

        {!loading &&
          categories.map((category) => (
          <motion.div 
            key={category}
            ref={(el) => {
              categoryRefs.current[category] = el;
            }}
            className="scroll-mt-32"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6 }}
          >
            <div className="flex items-center gap-4 mb-8">
              <h2 className="font-serif text-3xl font-bold text-brand-dark">{category}</h2>
              <div className="h-px bg-brand-beige flex-grow"></div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
              {productsByCategory[category]?.map((item) => (
                <motion.div 
                  key={item.id}
                  className="bg-white p-4 rounded-xl shadow-sm hover:shadow-md transition-shadow flex gap-4 items-start border border-brand-beige/30 group"
                  whileHover={{ y: -5 }}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  <div className="w-20 h-20 rounded-lg overflow-hidden flex-shrink-0 bg-brand-beige relative">
                    <img 
                      src={item.image} 
                      alt={item.name} 
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = FALLBACK_IMAGE;
                        target.onerror = null;
                      }}
                    />
                  </div>
                  <div className="flex-grow min-w-0">
                    <div className="flex justify-between items-start gap-2 mb-1">
                      <h3 className="font-serif text-lg font-bold text-brand-dark leading-tight">{item.name}</h3>
                      <span className="font-bold text-brand-brown text-sm whitespace-nowrap">{PRICE_FORMATTER.format(item.price)}</span>
                    </div>
                    <p className="text-brand-dark/70 text-sm leading-relaxed line-clamp-2">{item.description}</p>
                    <div className="mt-3 flex gap-2">
                      {item.is_best_seller && (
                        <span className="rounded-full bg-brand-brown text-white px-2.5 py-1 text-xs font-semibold">
                          Best Seller
                        </span>
                      )}
                      {item.is_new && (
                        <span className="rounded-full bg-emerald-100 text-emerald-700 px-2.5 py-1 text-xs font-semibold">
                          New
                        </span>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        ))}

        {/* Note */}
        <div className="mt-16 text-center text-brand-dark/60 text-sm bg-brand-beige/20 p-6 rounded-lg">
          <p className="font-medium">* Prices and availability are subject to change without prior notice.</p>
          <p>Please inform our staff of any food allergies or dietary requirements before ordering.</p>
        </div>
      </div>
    </div>
  );
}
