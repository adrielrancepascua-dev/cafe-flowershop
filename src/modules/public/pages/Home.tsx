import Hero from '../components/Hero';
import { Coffee, Cake, Wifi, Star, MapPin, Clock, CreditCard } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

export default function Home() {
  const features = [
    {
      icon: <Coffee className="h-8 w-8 text-brand-brown" />,
      title: "Specialty Coffee",
      description: "From our classic Hojicha Latte to Spanish Latte, enjoy brews made with care."
    },
    {
      icon: <Cake className="h-8 w-8 text-brand-brown" />,
      title: "Artisanal Pastries",
      description: "Freshly baked brownies, mini cakes, and toasties perfect for any time."
    },
    {
      icon: <Wifi className="h-8 w-8 text-brand-brown" />,
      title: "Cozy Atmosphere",
      description: "Stay awhile in our aesthetic space designed for productive mornings and lazy afternoons."
    }
  ];

  return (
    <div className="flex flex-col min-h-screen">
      <Hero />
      
      {/* Social Proof & Vibe Section */}
      <section className="bg-brand-brown py-12 text-white text-center">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"
        >
            <div className="flex flex-col md:flex-row justify-center items-center gap-8 md:gap-16">
                <div className="flex items-center gap-3 bg-brand-dark/30 px-6 py-4 rounded-lg backdrop-blur-sm">
                    <Star className="h-8 w-8 text-yellow-400 fill-current" />
                    <div className="text-left">
                        <p className="font-bold text-2xl">4.9/5</p>
                        <p className="text-sm opacity-90">Rating on Foodpanda</p>
                    </div>
                </div>
                <div className="max-w-md">
                    <p className="font-serif text-xl italic font-light">
                        "Probably the best coffee shop in Dagupan. A bit expensive but worth it."
                    </p>
                </div>
            </div>
        </motion.div>
      </section>

      {/* Features Grid */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto bg-brand-cream">
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="font-serif text-4xl font-bold text-brand-dark mb-4">Why Stay Awhile?</h2>
          <p className="text-brand-accent max-w-2xl mx-auto">
            Beyond great coffee, we offer a space that feels like home.
          </p>
        </motion.div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          {features.map((feature, index) => (
            <motion.div 
              key={index} 
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.2 }}
              className="text-center p-6 rounded-xl bg-white shadow-sm hover:shadow-md transition-shadow duration-300 border border-brand-beige"
            >
              <div className="inline-block p-4 bg-brand-beige/30 rounded-full mb-6">
                {feature.icon}
              </div>
              <h3 className="font-serif text-xl font-bold text-brand-dark mb-3">{feature.title}</h3>
              <p className="text-gray-600 leading-relaxed">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Location & Payment Stripe */}
      <section className="bg-brand-beige py-16">
        <motion.div 
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"
        >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
                <div className="flex flex-col items-center">
                    <MapPin className="h-8 w-8 text-brand-brown mb-4" />
                    <h3 className="font-serif text-xl font-bold text-brand-dark mb-2">Visit Us</h3>
                    <p className="text-brand-dark/80">Coastway Complex, Arellano St.<br/>Dagupan City</p>
                </div>
                <div className="flex flex-col items-center">
                    <Clock className="h-8 w-8 text-brand-brown mb-4" />
                    <h3 className="font-serif text-xl font-bold text-brand-dark mb-2">Opening Hours</h3>
                    <p className="text-brand-dark/80">Daily: 9:00 AM – 10:00 PM</p>
                </div>
                <div className="flex flex-col items-center">
                    <CreditCard className="h-8 w-8 text-brand-brown mb-4" />
                    <h3 className="font-serif text-xl font-bold text-brand-dark mb-2">Payment Methods</h3>
                    <p className="text-brand-dark/80">Cash • Debit/Credit Cards • E-wallets</p>
                </div>
            </div>
        </motion.div>
      </section>
      
      {/* CTA */}
      <section className="py-20 bg-brand-brown text-white text-center">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="max-w-4xl mx-auto px-4"
        >
          <h2 className="font-serif text-4xl font-bold mb-6">Craving something sweet?</h2>
          <p className="text-xl mb-8 opacity-90">Order our signature Mini Cakes or customize one for your special event.</p>
          <div className="flex justify-center gap-4">
            <Link to="/menu" className="bg-brand-beige text-brand-dark px-8 py-3 rounded-full font-bold hover:bg-white transition-colors">
              Browse Menu
            </Link>
            <Link to="/contact" className="border-2 border-white px-8 py-3 rounded-full font-bold hover:bg-white hover:text-brand-dark transition-colors">
              Inquire Now
            </Link>
          </div>
        </motion.div>
      </section>
    </div>
  );
}
