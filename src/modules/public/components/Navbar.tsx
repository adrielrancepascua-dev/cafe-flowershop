import { Link, NavLink } from 'react-router-dom';
import { Menu, X, Coffee } from 'lucide-react';
import { useState } from 'react';

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);

  const navigation = [
    { name: 'Home', href: '/' },
    { name: 'About', href: '/about' },
    { name: 'Menu', href: '/menu' },
    { name: 'Order', href: '/order' },
    { name: 'Staff Dashboard', href: '/dashboard' },
    { name: 'Gallery', href: '/gallery' },
    { name: 'Contact', href: '/contact' },
  ];

  return (
    <nav className="bg-brand-beige/90 backdrop-blur-sm fixed w-full z-50 shadow-sm font-sans">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-20 items-center">
          <div className="flex-shrink-0 flex items-center gap-2">
            <Link to="/" className="flex items-center gap-2">
              <Coffee className="h-8 w-8 text-brand-brown" />
              <span className="font-serif text-2xl font-bold text-brand-dark">Stay Awhile</span>
            </Link>
          </div>
          
          <div className="hidden md:flex items-center space-x-8">
            {navigation.map((item) => (
              <NavLink
                key={item.name}
                to={item.href}
                className={({ isActive }) =>
                  `text-sm font-medium transition-colors duration-200 ${
                    isActive ? 'text-brand-brown underline underline-offset-4' : 'text-brand-dark hover:text-brand-brown'
                  }`
                }
              >
                {item.name}
              </NavLink>
            ))}
            <a 
              href="https://www.foodpanda.ph/restaurant/lpee/stay-awhile-cafe-and-bakery" 
              target="_blank" 
              rel="noopener noreferrer"
              className="bg-brand-brown text-white px-4 py-2 rounded-full hover:bg-brand-accent transition-colors text-sm font-medium"
            >
              Order Online
            </a>
          </div>

          <div className="md:hidden flex items-center">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="text-brand-dark hover:text-brand-brown focus:outline-none"
            >
              {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {isOpen && (
        <div className="md:hidden bg-brand-light border-t border-brand-beige">
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
            {navigation.map((item) => (
              <NavLink
                key={item.name}
                to={item.href}
                onClick={() => setIsOpen(false)}
                className={({ isActive }) =>
                  `block px-3 py-2 rounded-md text-base font-medium ${
                    isActive ? 'bg-brand-beige text-brand-brown' : 'text-brand-dark hover:bg-brand-beige hover:text-brand-brown'
                  }`
                }
              >
                {item.name}
              </NavLink>
            ))}
            <a 
              href="https://www.foodpanda.ph/restaurant/lpee/stay-awhile-cafe-and-bakery" 
              target="_blank" 
              rel="noopener noreferrer"
              className="block w-full text-center mt-4 bg-brand-brown text-white px-4 py-3 rounded-md hover:bg-brand-accent transition-colors font-medium"
            >
              Order Online
            </a>
          </div>
        </div>
      )}
    </nav>
  );
}
