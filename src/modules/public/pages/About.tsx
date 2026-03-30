export default function About() {
  return (
    <div className="bg-brand-light min-h-screen">
      {/* Header */}
      <div className="relative h-[60vh] flex items-center justify-center">
        <div className="absolute inset-0">
          <img 
            src="https://images.unsplash.com/photo-1559339352-11d035aa65de?ixlib=rb-1.2.1&auto=format&fit=crop&w=1920&q=80" 
            alt="About Stay Awhile" 
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-brand-dark/50" />
        </div>
        <div className="relative z-10 text-center max-w-4xl px-4">
          <h1 className="font-serif text-5xl font-bold text-white mb-6">Our Story</h1>
          <p className="text-brand-light text-lg opacity-90">Creating a cozy corner in Dagupan.</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-20">
        <div className="prose prose-lg prose-headings:font-serif prose-headings:text-brand-dark text-brand-dark/80 mx-auto">
          <h2>A Cozy Neighborhood Café</h2>
          <p>
            Launched by the team behind <strong>The Pastry Shop Dagupan</strong>, Stay Awhile Café & Bakery was born from a passion for quality coffee and artisanal baking. Located at the Coastway Complex in Dagupan City (just across St. Robert Bellarmine Center), we set out to create a sanctuary where the community can gather, study, and unwind.
          </p>
          <p>
            Our name is an invitation. We designed our space with warmth and comfort in mind—perfect for productive mornings with a laptop or lazy afternoons catching up with friends. We believe a café should be more than a stop; it should be a destination where you feel at home.
          </p>
          
          <div className="my-12 grid grid-cols-2 gap-4">
             <img src="https://images.unsplash.com/photo-1497935586351-b67a49e012bf?auto=format&fit=crop&w=600&q=80" alt="Coffee pouring" className="rounded-lg shadow-md" />
             <img src="https://images.unsplash.com/photo-1517433670267-08bbd4be890f?auto=format&fit=crop&w=600&q=80" alt="Baking pastries" className="rounded-lg shadow-md mt-8" />
          </div>

          <h2>Everything Made In-House</h2>
          <p>
             From our signature <strong>Hojicha Latte</strong> to our famous <strong>Ham & Cheese Toasties</strong>, every item on our menu is crafted with care. Our bakery produces fresh pastries, brownies, and mini cakes daily. Whether you're craving a slice of our Carrot Walnut Cake or ordering a custom cake for a special celebration, you can taste the dedication in every bite.
          </p>
          <p>
            We take pride in our menu. From our signature <strong>Hojicha Latte</strong>—a roasted green tea delight 
            that has become a local favorite—to our freshly baked pastries. Our kitchen is always busy crafting 
            toasties, pasta, and our famous mini cakes.
          </p>
          <p>
            Whether you're here for a quick lunch or a celebratory customized cake, we pour our heart into everything we serve.
          </p>
        </div>
      </div>
    </div>
  );
}
