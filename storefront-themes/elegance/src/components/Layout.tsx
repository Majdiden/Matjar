import React, { useState } from 'react';
import { Outlet, Link } from 'react-router-dom';
import { useStore } from '@shared/contexts/StoreContext';
import { useCart } from '@shared/contexts/CartContext';
import { useCategories } from '@shared/hooks/useProducts';
import { SearchBar } from '@shared/components/navigation/SearchBar';
import { MobileBottomNav } from '@shared/components/navigation/MobileBottomNav';
import CartDrawer from '@shared/components/CartDrawer';

const Layout: React.FC = () => {
  const { store } = useStore();
  const { cart, isOpen: cartOpen, openCart, closeCart } = useCart();
  const { categories } = useCategories();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col pb-16 md:pb-0" style={{ fontFamily: 'var(--font-family, "Playfair Display", serif)' }}>
      {/* Top bar */}
      <div className="bg-gray-950 text-gray-300 text-xs text-center py-2 tracking-widest uppercase">
        Complimentary shipping on orders over $200
      </div>

      {/* Header */}
      <header className="sticky top-0 z-30 bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-20">
            <div className="flex items-center gap-3">
              <button className="lg:hidden text-gray-700" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <SearchBar variant="compact" className="text-gray-700 hover:text-gray-900 hover:bg-gray-100" />
            </div>

            <Link to="/" className="absolute left-1/2 -translate-x-1/2">
              {store?.logo ? (
                <img src={store.logo} alt={store.name} className="h-10" />
              ) : (
                <span className="text-2xl tracking-[0.2em] uppercase font-light text-gray-900">
                  {store?.name || 'Elegance'}
                </span>
              )}
            </Link>

            <div className="flex items-center gap-4">
              <Link to="/account" className="hidden md:block text-gray-700">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0" />
                </svg>
              </Link>
              <button onClick={openCart} className="relative text-gray-700">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                </svg>
                {cart && cart.itemCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-gray-900 text-white text-[9px] rounded-full flex items-center justify-center">
                    {cart.itemCount}
                  </span>
                )}
              </button>
            </div>
          </div>

          <nav className="hidden lg:flex items-center justify-center gap-8 pb-4 -mt-1">
            <Link to="/" className="text-xs tracking-[0.15em] uppercase text-gray-600 hover:text-gray-900 transition">Home</Link>
            <Link to="/products" className="text-xs tracking-[0.15em] uppercase text-gray-600 hover:text-gray-900 transition">Shop All</Link>
            {categories.slice(0, 5).map(cat => (
              <Link key={cat._id} to={`/categories/${cat.slug}`} className="text-xs tracking-[0.15em] uppercase text-gray-600 hover:text-gray-900 transition">
                {cat.name}
              </Link>
            ))}
          </nav>

          {mobileMenuOpen && (
            <nav className="lg:hidden pb-4 space-y-2 border-t pt-4">
              <Link to="/" onClick={() => setMobileMenuOpen(false)} className="block py-2 text-xs tracking-[0.15em] uppercase text-gray-600">Home</Link>
              <Link to="/products" onClick={() => setMobileMenuOpen(false)} className="block py-2 text-xs tracking-[0.15em] uppercase text-gray-600">Shop All</Link>
              {categories.slice(0, 6).map(cat => (
                <Link key={cat._id} to={`/categories/${cat.slug}`} onClick={() => setMobileMenuOpen(false)} className="block py-2 text-xs tracking-[0.15em] uppercase text-gray-600">{cat.name}</Link>
              ))}
            </nav>
          )}
        </div>
      </header>

      <main className="flex-1"><Outlet /></main>

      <footer className="bg-gray-950 text-gray-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
            <div>
              <h3 className="text-white text-lg tracking-[0.15em] uppercase font-light mb-4">{store?.name || 'Elegance'}</h3>
              <p className="text-sm leading-relaxed">{store?.description || 'Luxury fashion and accessories.'}</p>
            </div>
            <div>
              <h4 className="text-white text-xs tracking-[0.15em] uppercase mb-4">Shop</h4>
              <ul className="space-y-2 text-sm">
                <li><Link to="/products" className="hover:text-white transition">All Collections</Link></li>
                {categories.slice(0, 4).map(cat => (
                  <li key={cat._id}><Link to={`/categories/${cat.slug}`} className="hover:text-white transition">{cat.name}</Link></li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-white text-xs tracking-[0.15em] uppercase mb-4">Help</h4>
              <ul className="space-y-2 text-sm">
                <li><span className="cursor-pointer hover:text-white">Size Guide</span></li>
                <li><span className="cursor-pointer hover:text-white">Shipping & Returns</span></li>
                <li><Link to="/contact" className="hover:text-white transition">Contact Us</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white text-xs tracking-[0.15em] uppercase mb-4">Newsletter</h4>
              <p className="text-sm mb-3">Be first to know about new arrivals.</p>
              <form onSubmit={e => e.preventDefault()} className="flex">
                <input type="email" placeholder="Email address" className="flex-1 px-3 py-2 bg-transparent border border-gray-700 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-gray-400" />
                <button type="submit" className="px-4 py-2 bg-white text-gray-900 text-xs tracking-wider uppercase">Join</button>
              </form>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-12 pt-8 text-center text-xs text-gray-600 tracking-wider">
            &copy; {new Date().getFullYear()} {store?.name || 'Elegance'}. All rights reserved.
          </div>
        </div>
      </footer>

      <CartDrawer isOpen={cartOpen} onClose={closeCart} />
      <MobileBottomNav onCartClick={openCart} />
    </div>
  );
};

export default Layout;
