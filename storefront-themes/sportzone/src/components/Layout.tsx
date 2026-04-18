import React, { useState } from 'react';
import { Outlet, Link } from 'react-router-dom';
import { useStore } from '@shared/contexts/StoreContext';
import { useCart } from '@shared/contexts/CartContext';
import { useCategories } from '@shared/hooks/useProducts';
import CartDrawer from '@shared/components/CartDrawer';
import { SearchBar } from '@shared/components/navigation/SearchBar';
import { MobileBottomNav } from '@shared/components/navigation/MobileBottomNav';
import { AnnouncementBar } from '@shared/components/marketing/AnnouncementBar';

const Layout: React.FC = () => {
  const { store } = useStore();
  const { cart, isOpen: cartOpen, openCart, closeCart } = useCart();
  const { categories } = useCategories();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-white" style={{ '--accent': '#dc2626' } as React.CSSProperties}>
      <AnnouncementBar
        message="Free shipping on orders over $75 -- No excuses."
        linkText="Shop Now"
        href="/products"
        bgColor="#dc2626"
        textColor="#ffffff"
        dismissible
        storageKey="sportzone_announce"
      />

      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#111827] border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="text-xl font-black uppercase tracking-wider text-white">
              <span className="text-[#dc2626]">///</span> {store?.name || 'SportZone'}
            </Link>

            <nav className="hidden md:flex items-center gap-6">
              <Link to="/products" className="text-sm font-bold uppercase text-gray-300 hover:text-[#dc2626] transition">Shop</Link>
              {categories.slice(0, 4).map(cat => (
                <Link key={cat._id} to={`/categories/${cat.slug}`} className="text-sm font-bold uppercase text-gray-300 hover:text-[#dc2626] transition">
                  {cat.name}
                </Link>
              ))}
            </nav>

            <div className="flex items-center gap-3">
              {/* Desktop search */}
              <div className="hidden md:block w-52">
                <SearchBar placeholder="Search gear..." variant="expanded" className="bg-white/5 border-white/10 text-white" />
              </div>

              {/* Mobile search */}
              <SearchBar variant="compact" className="md:hidden text-gray-300 hover:text-[#dc2626] hover:bg-white/10" />

              <button onClick={openCart} className="relative text-white hover:text-[#dc2626] transition">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
                {cart && cart.itemCount > 0 && (
                  <span className="absolute -top-2 -right-2 w-5 h-5 bg-[#dc2626] text-white text-[10px] rounded-full flex items-center justify-center font-black">
                    {cart.itemCount}
                  </span>
                )}
              </button>

              <button onClick={() => setMenuOpen(!menuOpen)} className="md:hidden text-gray-300">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={menuOpen ? 'M6 18L18 6M6 6l12 12' : 'M4 6h16M4 12h16M4 18h16'} />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {menuOpen && (
          <nav className="md:hidden bg-[#111827] border-t border-white/10 px-4 py-3 space-y-2">
            <Link to="/products" onClick={() => setMenuOpen(false)} className="block text-sm font-bold uppercase text-gray-300 py-2">Shop</Link>
            {categories.slice(0, 4).map(cat => (
              <Link key={cat._id} to={`/categories/${cat.slug}`} onClick={() => setMenuOpen(false)} className="block text-sm font-bold uppercase text-gray-300 py-2">
                {cat.name}
              </Link>
            ))}
          </nav>
        )}
      </header>

      <main className="flex-1"><Outlet /></main>

      {/* Footer */}
      <footer className="bg-[#111827] text-gray-400 py-12">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div>
              <h3 className="text-white font-black text-lg uppercase mb-2">
                <span className="text-[#dc2626]">///</span> {store?.name || 'SportZone'}
              </h3>
              <p className="text-sm">Gear up. Get moving. No limits.</p>
            </div>
            <div>
              <h4 className="text-white font-bold text-sm uppercase mb-3">Shop</h4>
              <div className="space-y-2 text-sm">
                <Link to="/products" className="block hover:text-[#dc2626] transition">All Products</Link>
                {categories.slice(0, 3).map(cat => (
                  <Link key={cat._id} to={`/categories/${cat.slug}`} className="block hover:text-[#dc2626] transition">{cat.name}</Link>
                ))}
              </div>
            </div>
            <div>
              <h4 className="text-white font-bold text-sm uppercase mb-3">Info</h4>
              <div className="space-y-2 text-sm">
                <Link to="/about" className="block hover:text-[#dc2626] transition">About Us</Link>
                <Link to="/contact" className="block hover:text-[#dc2626] transition">Contact</Link>
                <span className="block">Shipping Policy</span>
              </div>
            </div>
            <div>
              <h4 className="text-white font-bold text-sm uppercase mb-3">Stay Connected</h4>
              <p className="text-sm mb-3">Join the team. Get exclusive drops.</p>
              <form className="flex" onSubmit={e => e.preventDefault()}>
                <input type="email" placeholder="your@email.com" className="flex-1 bg-white/5 border border-white/10 rounded-l px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#dc2626]" />
                <button className="bg-[#dc2626] text-white px-4 py-2 rounded-r text-sm font-black uppercase hover:bg-[#b91c1c] transition">Go</button>
              </form>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-6 text-center text-xs">
            &copy; {new Date().getFullYear()} {store?.name || 'SportZone'}. All rights reserved.
          </div>
        </div>
      </footer>

      {/* Mobile bottom nav */}
      <MobileBottomNav onCartClick={openCart} />
      <CartDrawer isOpen={cartOpen} onClose={closeCart} />
    </div>
  );
};

export default Layout;
