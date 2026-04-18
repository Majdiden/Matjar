import React, { useState } from 'react';
import { Outlet, Link } from 'react-router-dom';
import { useStore } from '@shared/contexts/StoreContext';
import { useCart } from '@shared/contexts/CartContext';
import { useCategories } from '@shared/hooks/useProducts';
import { Drawer } from '@shared/components/primitives/Drawer';
import { SearchBar } from '@shared/components/navigation/SearchBar';
import { MobileBottomNav } from '@shared/components/navigation/MobileBottomNav';
import { AnnouncementBar } from '@shared/components/marketing/AnnouncementBar';
import CartDrawer from '@shared/components/CartDrawer';

const Layout: React.FC = () => {
  const { store } = useStore();
  const { cart, isOpen: cartOpen, openCart, closeCart } = useCart();
  const { categories } = useCategories();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-[#faf5ff]">
      <AnnouncementBar
        message="Free shipping on orders over $35 — Feed your reading habit!"
        className="bg-[#7c3aed] text-white text-xs text-center py-1.5 font-medium"
      />

      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-violet-100 shadow-sm">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex items-center justify-between h-16">
            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden text-gray-600 hover:text-[#7c3aed]"
              aria-label="Open menu"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            <Link to="/" className="text-xl font-bold text-[#7c3aed] tracking-tight flex items-center gap-2">
              <svg className="w-6 h-6 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
              </svg>
              {store?.name || 'BookShelf'}
            </Link>

            <nav className="hidden md:flex items-center gap-6">
              <Link to="/products" className="text-sm text-gray-600 hover:text-[#7c3aed] transition font-medium">
                Browse
              </Link>
              {categories.slice(0, 4).map(cat => (
                <Link
                  key={cat._id}
                  to={`/categories/${cat.slug}`}
                  className="text-sm text-gray-600 hover:text-[#7c3aed] transition"
                >
                  {cat.name}
                </Link>
              ))}
            </nav>

            <div className="flex items-center gap-3">
              {/* Desktop search */}
              <div className="hidden md:block w-48">
                <SearchBar
                  placeholder="Search books..."
                  className="bg-violet-50 border-violet-200 rounded-lg text-sm focus-within:ring-2 focus-within:ring-[#7c3aed]/30"
                />
              </div>

              {/* Mobile search */}
              <SearchBar variant="compact" className="md:hidden text-gray-600 hover:text-[#7c3aed] hover:bg-violet-50" />

              {/* Cart button */}
              <button
                onClick={openCart}
                className="relative text-gray-600 hover:text-[#7c3aed] transition"
                aria-label="Cart"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
                {cart && cart.itemCount > 0 && (
                  <span className="absolute -top-2 -right-2 w-4 h-4 bg-[#7c3aed] text-white text-[10px] rounded-full flex items-center justify-center font-bold">
                    {cart.itemCount}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="bg-[#4c1d95] text-violet-200 py-12">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
            <div>
              <h3 className="text-white text-lg font-bold mb-3 flex items-center gap-2">
                <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
                </svg>
                {store?.name || 'BookShelf'}
              </h3>
              <p className="text-sm leading-relaxed">Your next great read awaits. Curated selections for every reader.</p>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-3 text-sm uppercase tracking-wider">Explore</h4>
              <div className="flex flex-col gap-2 text-sm">
                <Link to="/products" className="hover:text-white transition">Browse All</Link>
                {categories.slice(0, 3).map(cat => (
                  <Link key={cat._id} to={`/categories/${cat.slug}`} className="hover:text-white transition">
                    {cat.name}
                  </Link>
                ))}
              </div>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-3 text-sm uppercase tracking-wider">Help</h4>
              <div className="flex flex-col gap-2 text-sm">
                <span className="cursor-pointer hover:text-white transition">About Us</span>
                <Link to="/contact" className="hover:text-white transition">Contact</Link>
                <span className="cursor-pointer hover:text-white transition">Shipping & Returns</span>
              </div>
            </div>
          </div>
          <div className="border-t border-violet-800 pt-6 text-center">
            <p className="text-xs text-violet-300">
              &copy; {new Date().getFullYear()} {store?.name || 'BookShelf'}. All rights reserved.
            </p>
          </div>
        </div>
      </footer>

      {/* Mobile menu drawer */}
      <Drawer isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} position="left">
        <div className="p-6 bg-white h-full">
          <h2 className="text-lg font-bold text-[#7c3aed] mb-6 flex items-center gap-2">
            <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
            </svg>
            Menu
          </h2>
          <nav className="flex flex-col gap-4">
            <Link to="/products" onClick={() => setMobileMenuOpen(false)} className="text-gray-700 font-medium hover:text-[#7c3aed]">
              Browse All
            </Link>
            {categories.map(cat => (
              <Link
                key={cat._id}
                to={`/categories/${cat.slug}`}
                onClick={() => setMobileMenuOpen(false)}
                className="text-gray-600 hover:text-[#7c3aed]"
              >
                {cat.name}
              </Link>
            ))}
          </nav>
        </div>
      </Drawer>

      <CartDrawer isOpen={cartOpen} onClose={closeCart} />

      {/* Mobile bottom navigation */}
      <MobileBottomNav onCartClick={openCart} />
    </div>
  );
};

export default Layout;
