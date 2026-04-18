import React, { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useStore } from '@shared/contexts/StoreContext';
import { useCart } from '@shared/contexts/CartContext';
import { useCategories } from '@shared/hooks/useProducts';
import { useThemeSetting } from '@shared/theme/ThemeProvider';
import CartDrawer from '@shared/components/CartDrawer';
import { SearchBar } from '@shared/components/navigation/SearchBar';
import { MobileBottomNav } from '@shared/components/navigation/MobileBottomNav';

/**
 * Milmaa Layout — cream background with teal accents.
 */

const TEAL = 'var(--color-primary)';
const DARK_TEAL = 'var(--color-foreground)';
const PINK = 'var(--color-accent)';
const CREAM = 'var(--color-background)';
const BORDER = 'var(--color-border)';
const HEADING_FONT = 'var(--font-family-heading)';

const Layout: React.FC = () => {
  const { store } = useStore();
  const { cart, isOpen: cartOpen, openCart, closeCart } = useCart();
  const { categories } = useCategories();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const showBar = useThemeSetting<boolean>('show_announcement_bar') !== false;
  const barText = useThemeSetting<string>('announcement_text') || '🌱 100% Plant-Based · Free Shipping';

  const brand = (store?.name || 'Milmaa');
  const isActive = (path: string) =>
    location.pathname === path || (path !== '/' && location.pathname.startsWith(path));

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: CREAM, color: DARK_TEAL }}>
      {/* ═══ TOP STRIP ══════════════════════════════════════════ */}
      {showBar && (
        <div className="text-white text-[12px] py-2.5 text-center font-medium" style={{ backgroundColor: TEAL }}>
          {barText}
        </div>
      )}

      {/* ═══ HEADER ══════════════════════════════════════════════ */}
      <header className="sticky top-0 z-40" style={{ backgroundColor: CREAM }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between py-5 gap-6">
            {/* Mobile menu */}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="md:hidden"
              aria-label="Menu"
              style={{ color: DARK_TEAL }}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d={menuOpen ? 'M6 18L18 6M6 6l12 12' : 'M4 6h16M4 12h16M4 18h16'} />
              </svg>
            </button>

            {/* Logo */}
            <Link
              to="/"
              className="font-serif text-3xl md:text-4xl font-bold tracking-tight"
              style={{ fontFamily: HEADING_FONT, color: DARK_TEAL }}
            >
              {brand.toLowerCase()}
            </Link>

            {/* Nav */}
            <nav className="hidden md:flex items-center gap-8 text-sm font-medium" style={{ color: DARK_TEAL }}>
              <Link to="/" className={isActive('/') && location.pathname === '/' ? 'font-bold' : 'hover:opacity-70'}>Home</Link>
              <Link to="/products" className={isActive('/products') ? 'font-bold' : 'hover:opacity-70'}>Shop</Link>
              {categories.slice(0, 2).map((cat) => (
                <Link key={cat._id} to={`/categories/${cat.slug}`} className="hover:opacity-70">
                  {cat.name}
                </Link>
              ))}
              <Link to="/about" className="hover:opacity-70">About</Link>
              <Link to="/contact" className="hover:opacity-70">Contact</Link>
            </nav>

            {/* Icons */}
            <div className="flex items-center gap-4" style={{ color: DARK_TEAL }}>
              <SearchBar variant="compact" className="hover:opacity-70 hover:bg-black/5" />
              <Link to="/account" aria-label="Account" className="hover:opacity-70 hidden md:block">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                </svg>
              </Link>
              <button onClick={openCart} aria-label="Cart" className="relative hover:opacity-70">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
                </svg>
                {(cart?.itemCount || 0) > 0 && (
                  <span className="absolute -top-2 -right-2 min-w-[18px] h-[18px] px-1 text-white text-[10px] rounded-full flex items-center justify-center font-bold" style={{ backgroundColor: PINK }}>
                    {cart?.itemCount}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>

        {menuOpen && (
          <nav className="md:hidden border-t px-6 py-4 space-y-3 text-sm" style={{ color: DARK_TEAL, borderColor: BORDER }}>
            <Link onClick={() => setMenuOpen(false)} to="/" className="block">Home</Link>
            <Link onClick={() => setMenuOpen(false)} to="/products" className="block">Shop</Link>
            {categories.slice(0, 6).map((cat) => (
              <Link key={cat._id} onClick={() => setMenuOpen(false)} to={`/categories/${cat.slug}`} className="block">{cat.name}</Link>
            ))}
            <Link onClick={() => setMenuOpen(false)} to="/about" className="block">About</Link>
            <Link onClick={() => setMenuOpen(false)} to="/contact" className="block">Contact</Link>
          </nav>
        )}
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      {/* ═══ FOOTER ══════════════════════════════════════════════ */}
      <footer className="mt-20 pt-16 pb-6" style={{ backgroundColor: DARK_TEAL, color: CREAM }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-10 mb-12">
            <div className="md:col-span-2">
              <div className="font-serif text-4xl font-bold mb-4" style={{ fontFamily: HEADING_FONT }}>
                {brand.toLowerCase()}
              </div>
              <p className="text-sm mb-5 max-w-xs opacity-80">
                Creamy, dreamy plant-based milk crafted with love. Made for families, farmers and the planet.
              </p>
              <div className="flex gap-3">
                {['f', 'i', 'p', 't'].map((s) => (
                  <a
                    key={s}
                    href="#"
                    className="w-9 h-9 rounded-full border border-current/30 flex items-center justify-center text-xs hover:bg-white/10 transition"
                  >
                    {s}
                  </a>
                ))}
              </div>
            </div>
            {[
              { h: 'Shop', items: ['All Milks', 'Banana', 'Badam', 'Cashewnut'] },
              { h: 'Company', items: ['About Us', 'Our Farmers', 'Sustainability', 'Blog'] },
              { h: 'Help', items: ['Shipping', 'Returns', 'FAQs', 'Contact'] },
            ].map((col) => (
              <div key={col.h}>
                <h4 className="text-sm font-bold mb-5">{col.h}</h4>
                <div className="space-y-3 text-sm opacity-80">
                  {col.items.map((item) => (
                    <a key={item} href="#" className="block hover:opacity-100 hover:underline">{item}</a>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="border-t border-white/10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs opacity-70">
            <span>© {new Date().getFullYear()} {brand}. Made with 🌱 love.</span>
            <div className="flex gap-2">
              {['VISA', 'MC', 'AMEX', 'PP'].map((p) => (
                <span key={p} className="h-5 px-2 border border-current/30 text-[9px] font-bold flex items-center">{p}</span>
              ))}
            </div>
          </div>
        </div>
      </footer>

      <MobileBottomNav onCartClick={openCart} />
      <CartDrawer isOpen={cartOpen} onClose={closeCart} />
    </div>
  );
};

export default Layout;
