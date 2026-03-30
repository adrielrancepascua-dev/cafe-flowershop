import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Hero() {
  return (
    <div className="relative bg-brand-beige h-[80vh] flex items-center justify-center overflow-hidden">
      {/* Background Image Overlay */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1 }}
        className="absolute inset-0 z-0 bg-brand-dark"
      >
        <img 
          src="https://images.unsplash.com/photo-1554118811-1e0d58224f24?ixlib=rb-1.2.1&auto=format&fit=crop&w=1920&q=80" 
          alt="Stay Awhile Café Interior" 
          className="w-full h-full object-cover opacity-60"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.src = 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=1920&q=80';
            target.onerror = null;
          }}
        />
        <div className="absolute inset-0 bg-brand-dark/30 mix-blend-multiply" />
      </motion.div>

      <div className="relative z-10 text-center px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto">
        <motion.h1 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="font-serif text-5xl md:text-7xl font-bold text-white mb-6 drop-shadow-lg leading-tight"
        >
          Your cozy corner in Dagupan
        </motion.h1>
        <motion.p 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="font-sans text-xl md:text-2xl text-brand-beige mb-4 font-light drop-shadow-md"
        >
          Coffee, cakes, and moments worth staying for.
        </motion.p>
        <motion.p 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="font-sans text-lg text-brand-beige/90 mb-10 drop-shadow-md font-medium tracking-wide"
        >
          Open daily 9 AM – 10 PM • Coastway Complex, Arellano St.
        </motion.p>
        
        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.8 }}
          className="flex flex-col sm:flex-row gap-4 justify-center items-center"
        >
          <Link 
            to="/menu" 
            className="group bg-brand-brown text-white px-8 py-3 rounded-full hover:bg-brand-dark transition-all duration-300 font-medium flex items-center gap-2 transform hover:-translate-y-1 shadow-lg"
          >
            View Menu
            <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
          </Link>
          <a 
            href="https://www.foodpanda.ph/restaurant/lpee/stay-awhile-cafe-and-bakery" 
            target="_blank"
            rel="noreferrer"
            className="group bg-brand-beige text-brand-dark px-8 py-3 rounded-full hover:bg-white transition-all duration-300 font-medium transform hover:-translate-y-1 shadow-lg border border-transparent"
          >
            Order via Foodpanda
          </a>
          <Link 
            to="/contact" 
            className="group bg-transparent text-white px-8 py-3 rounded-full hover:bg-white/10 transition-all duration-300 font-medium transform hover:-translate-y-1 border border-white"
          >
            Visit Us
          </Link>
        </motion.div>
      </div>
    </div>
  );
}
