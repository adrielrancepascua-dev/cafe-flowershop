import { MapPin, Phone, Clock } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="bg-brand-dark text-brand-light pt-16 pb-8 font-sans">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          
          {/* Brand & About */}
          <div>
            <h3 className="font-serif text-2xl font-bold mb-4 text-brand-beige">Stay Awhile</h3>
            <p className="text-brand-beige/80 mb-6 leading-relaxed">
              Your cozy neighborhood café in Dagupan. A place for productive mornings, 
              lazy afternoons, and sweet moments.
            </p>
            <div className="flex space-x-4">
              <a href="#" className="text-brand-beige/80 hover:text-white transition-colors">
                <span className="font-bold">IG</span>
              </a>
              <a href="https://www.facebook.com/profile.php?id=61579230243848" target="_blank" rel="noopener noreferrer" className="text-brand-beige/80 hover:text-white transition-colors">
                 <span className="font-bold">FB</span>
              </a>
            </div>
          </div>

          {/* Quick Info */}
          <div>
            <h4 className="font-serif text-lg font-bold mb-4 text-brand-beige">Visit Us</h4>
            <ul className="space-y-4 text-brand-beige/80">
              <li className="flex items-start gap-3">
                <MapPin className="h-5 w-5 mt-0.5 flex-shrink-0" />
                <span>Coastway Complex, Arellano Street,<br/>Dagupan City, Pangasinan</span>
              </li>
              <li className="flex items-start gap-3">
                <Clock className="h-5 w-5 mt-0.5 flex-shrink-0" />
                <span>Daily: 9:00 AM – 10:00 PM</span>
              </li>
              <li className="flex items-center gap-3">
                <Phone className="h-5 w-5 flex-shrink-0" />
                <span>Available for Inquiries</span>
              </li>
            </ul>
          </div>

          {/* Newsletter / Links */}
          <div>
            <h4 className="font-serif text-lg font-bold mb-4 text-brand-beige">Stay Updated</h4>
            <p className="text-brand-beige/80 mb-4">
              Join our community for updates on seasonal cakes and events.
            </p>
            <form className="flex flex-col gap-2">
              <input 
                type="email" 
                placeholder="Enter your email" 
                className="bg-brand-brown/30 border border-brand-beige/20 rounded px-4 py-2 text-brand-light placeholder:text-brand-beige/40 focus:outline-none focus:border-brand-beige"
              />
              <button className="bg-brand-beige text-brand-dark px-4 py-2 rounded hover:bg-white transition-colors font-medium">
                Subscribe
              </button>
            </form>
            <div className="mt-8 pt-6 border-t border-brand-beige/10">
              <p className="text-sm text-brand-beige/60">We accept:</p>
              <p className="text-brand-beige/80 font-medium">Cash • GCash • Cards</p>
            </div>
          </div>
        </div>
        
        <div className="border-t border-brand-beige/10 mt-12 pt-8 text-center text-brand-beige/40 text-sm">
          <p>&copy; {new Date().getFullYear()} Stay Awhile Café & Bakery. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
