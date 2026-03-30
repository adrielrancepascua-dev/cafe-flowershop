import { MapPin, Mail, Clock } from 'lucide-react';

export default function Contact() {
  return (
    <div className="bg-brand-light min-h-screen py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="font-serif text-4xl font-bold text-center text-brand-dark mb-4">Get in Touch</h1>
        <p className="text-center text-brand-dark/70 mb-16 max-w-2xl mx-auto">
          We'd love to hear from you. Whether you have a question about our menu, want to order a custom cake, or just want to say hi.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Contact Info */}
          <div className="bg-white p-8 rounded-xl shadow-sm h-full">
            <h2 className="font-serif text-2xl font-bold text-brand-dark mb-8">Contact Information</h2>
            
            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="bg-brand-beige/50 p-3 rounded-full">
                  <MapPin className="h-6 w-6 text-brand-brown" />
                </div>
                <div>
                  <h3 className="font-bold text-brand-dark">Visit Us</h3>
                  <p className="text-brand-dark/70">Coastway Complex, Arellano Street,<br/>Dagupan City, Pangasinan</p>
                  <p className="text-sm text-brand-dark/50 mt-1">Near St. Robert Bellarmine Center</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="bg-brand-beige/50 p-3 rounded-full">
                  <Clock className="h-6 w-6 text-brand-brown" />
                </div>
                <div>
                  <h3 className="font-bold text-brand-dark">Business Hours</h3>
                  <p className="text-brand-dark/70">Daily: 9:00 AM – 10:00 PM</p>
                  <p className="text-sm text-brand-dark/50 mt-1">Delivery via Foodpanda: 9:00 AM – 9:45 PM</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="bg-brand-beige/50 p-3 rounded-full">
                  <Mail className="h-6 w-6 text-brand-brown" />
                </div>
                <div>
                  <h3 className="font-bold text-brand-dark">Email Us</h3>
                  <p className="text-brand-dark/70">hello@stayawhileph.com</p>
                </div>
              </div>
              
              <div className="pt-8 border-t border-brand-beige/30">
                <h3 className="font-bold text-brand-dark mb-2">Payment Methods</h3>
                <p className="text-brand-dark/70">We accept Cash, GCash, Bank Transfer, Debit & Credit Cards.</p>
              </div>
            </div>
          </div>

          {/* Form */}
          <div className="bg-white p-8 rounded-xl shadow-sm">
             <h2 className="font-serif text-2xl font-bold text-brand-dark mb-6">Send us a Message</h2>
             <form className="space-y-6">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div>
                   <label htmlFor="name" className="block text-sm font-medium text-brand-dark mb-1">Name</label>
                   <input type="text" id="name" className="w-full px-4 py-2 border border-brand-beige rounded-lg focus:ring-2 focus:ring-brand-brown focus:border-transparent outline-none" placeholder="Your name" />
                 </div>
                 <div>
                   <label htmlFor="email" className="block text-sm font-medium text-brand-dark mb-1">Email</label>
                   <input type="email" id="email" className="w-full px-4 py-2 border border-brand-beige rounded-lg focus:ring-2 focus:ring-brand-brown focus:border-transparent outline-none" placeholder="your@email.com" />
                 </div>
               </div>
               
               <div>
                 <label htmlFor="subject" className="block text-sm font-medium text-brand-dark mb-1">Subject</label>
                 <select id="subject" className="w-full px-4 py-2 border border-brand-beige rounded-lg focus:ring-2 focus:ring-brand-brown focus:border-transparent outline-none">
                   <option>General Inquiry</option>
                   <option>Custom Cake Order</option>
                   <option>Event Booking</option>
                   <option>Feedback</option>
                 </select>
               </div>

               <div>
                 <label htmlFor="message" className="block text-sm font-medium text-brand-dark mb-1">Message</label>
                 <textarea id="message" rows={4} className="w-full px-4 py-2 border border-brand-beige rounded-lg focus:ring-2 focus:ring-brand-brown focus:border-transparent outline-none" placeholder="How can we help you?"></textarea>
               </div>

               <button type="submit" className="w-full bg-brand-brown text-white font-bold py-3 rounded-lg hover:bg-brand-accent transition-colors">
                 Send Message
               </button>
             </form>
          </div>
        </div>
        
        {/* Map */}
        <div className="mt-12 rounded-xl overflow-hidden shadow-sm border border-brand-beige h-[400px]">
           <iframe 
             src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d1916.123456!2d120.345678!3d16.046123!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zMTbCsDAyJzQ2LjAiTiAxMjDCsDIwJzUwLjAiRQ!5e0!3m2!1sen!2sph!4v1600000000000!5m2!1sen!2sph" 
             width="100%" 
             height="100%" 
             style={{ border: 0 }} 
             allowFullScreen 
             loading="lazy" 
             title="Stay Awhile Location"
           ></iframe>
        </div>
      </div>
    </div>
  );
}
