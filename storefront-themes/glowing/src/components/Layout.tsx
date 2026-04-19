import React, { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useStore } from '@shared/contexts/StoreContext';
import { useCart } from '@shared/contexts/CartContext';
import { useCategories } from '@shared/hooks/useProducts';
import { useThemeSetting } from '@shared/theme/ThemeProvider';
import CartDrawer from '@shared/components/CartDrawer';
import { SearchBar } from '@shared/components/navigation/SearchBar';
import { MobileBottomNav } from '@shared/components/navigation/MobileBottomNav';

/**
 * Glowing Layout — ultra minimalist cosmetics chrome.
 *
 *   ─ Top strip: black announcement with centered shipping message
 *   ─ Utility row: search / centered serif wordmark / account + wishlist + cart
 *   ─ Nav row: centered thin nav links (HOME • SHOP • COLLECTIONS • ABOUT • CONTACT)
 *   ─ Footer: 4-col link grid on white, centered wordmark above
 */

const Layout: React.FC = () => {
  const { t } = useTranslation(['theme', 'common']);
  const { store } = useStore();
  const { cart, isOpen: cartOpen, openCart, closeCart } = useCart();
  const { categories } = useCategories();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const showStrip = useThemeSetting<boolean>('show_announcement_bar') !== false;
  const stripText = useThemeSetting<string>('announcement_text') || t('theme.announcement.default_text');

  const brand = (store?.name || 'GLOWING').toUpperCase();
  const isActive = (path: string) =>
    location.pathname === path || (path !== '/' && location.pathname.startsWith(path));

  return (
    <div className="min-h-screen flex flex-col bg-white text-neutral-900">
      {/* ═══ TOP STRIP ═══════════════════════════════════════════ */}
      {showStrip && (
        <div className="bg-black text-white text-[11px] tracking-[0.18em] font-medium py-2.5 text-center">
          {stripText}
        </div>
      )}

      {/* ═══ HEADER ══════════════════════════════════════════════ */}
      <header className="sticky top-0 z-40 bg-white border-b border-neutral-100">
        {/* Utility row */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-3 items-center py-6">
            {/* Left: search */}
            <div className="flex items-center gap-5">
              <SearchBar variant="compact" className="text-neutral-600 hover:text-black hover:bg-neutral-100" />
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                aria-label="Menu"
                className="md:hidden text-neutral-700"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={menuOpen ? 'M6 18L18 6M6 6l12 12' : 'M4 6h16M4 12h16M4 18h16'} />
                </svg>
              </button>
            </div>

            {/* Center: serif wordmark */}
            <Link
              to="/"
              className="font-display text-center text-3xl md:text-4xl tracking-tight text-black leading-none"
              style={{ fontFamily: 'var(--font-family-heading)' }}
            >
              {brand}
            </Link>

            {/* Right: account / wishlist / cart */}
            <div className="flex items-center gap-5 justify-end text-neutral-700">
              <Link to="/account" aria-label="Account" className="hover:text-black">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.6}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.5 20.25a7.5 7.5 0 1115 0v.75H4.5v-.75z" />
                </svg>
              </Link>
              <Link to="/wishlist" aria-label="Wishlist" className="hover:text-black hidden sm:block">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.6}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                </svg>
              </Link>
              <button onClick={openCart} aria-label="Cart" className="relative hover:text-black">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.6}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
                </svg>
                {(cart?.itemCount || 0) > 0 && (
                  <span className="absolute -top-2 -right-2 min-w-[18px] h-[18px] px-1 bg-black text-white text-[10px] rounded-full flex items-center justify-center font-semibold">
                    {cart?.itemCount}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Nav row — desktop */}
        <nav className="hidden md:flex justify-center gap-10 pb-5 text-[11px] tracking-[0.22em] uppercase text-neutral-700 border-t border-neutral-100 pt-4">
          <Link to="/" className={isActive('/') && location.pathname === '/' ? 'text-black font-semibold' : 'hover:text-black'}>{t('theme.nav.home')}</Link>
          <Link to="/products" className={isActive('/products') ? 'text-black font-semibold' : 'hover:text-black'}>{t('theme.nav.shop')}</Link>
          {categories.slice(0, 4).map((cat) => (
            <Link
              key={cat._id}
              to={`/categories/${cat.slug}`}
              className={isActive(`/categories/${cat.slug}`) ? 'text-black font-semibold' : 'hover:text-black'}
            >
              {cat.name}
            </Link>
          ))}
          <Link to="/about" className="hover:text-black">{t('theme.nav.about')}</Link>
          <Link to="/contact" className="hover:text-black">{t('theme.nav.contact')}</Link>
        </nav>

        {/* Mobile nav */}
        {menuOpen && (
          <nav className="md:hidden border-t border-neutral-100 px-6 py-4 space-y-3 text-sm uppercase tracking-wider">
            <Link onClick={() => setMenuOpen(false)} to="/" className="block">{t('theme.nav.home')}</Link>
            <Link onClick={() => setMenuOpen(false)} to="/products" className="block">{t('theme.nav.shop')}</Link>
            {categories.slice(0, 6).map((cat) => (
              <Link key={cat._id} onClick={() => setMenuOpen(false)} to={`/categories/${cat.slug}`} className="block">{cat.name}</Link>
            ))}
            <Link onClick={() => setMenuOpen(false)} to="/about" className="block">{t('theme.nav.about')}</Link>
            <Link onClick={() => setMenuOpen(false)} to="/contact" className="block">{t('theme.nav.contact')}</Link>
          </nav>
        )}
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      {/* ═══ FOOTER ══════════════════════════════════════════════ */}
      <footer className="mt-24 bg-white border-t border-neutral-100 pt-16 pb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-14">
            <div className="font-display text-4xl tracking-tight mb-4" style={{ fontFamily: 'var(--font-family-heading)' }}>
              {brand}
            </div>
            <p className="text-sm text-neutral-500 max-w-md mx-auto">
              {t('theme.footer.tagline')}
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-10 mb-12">
            <div>
              <h4 className="text-[11px] tracking-[0.22em] uppercase text-black font-semibold mb-5">{t('theme.footer.col_shop')}</h4>
              <div className="space-y-3 text-sm text-neutral-600">
                <Link to="/products" className="block hover:text-black">{t('theme.footer.all_products')}</Link>
                <Link to="/products" className="block hover:text-black">{t('theme.footer.best_sellers')}</Link>
                <Link to="/products" className="block hover:text-black">{t('theme.footer.new_arrivals')}</Link>
                <Link to="/products" className="block hover:text-black">{t('theme.footer.gift_cards')}</Link>
              </div>
            </div>
            <div>
              <h4 className="text-[11px] tracking-[0.22em] uppercase text-black font-semibold mb-5">{t('theme.footer.col_help')}</h4>
              <div className="space-y-3 text-sm text-neutral-600">
                <a href="#" className="block hover:text-black">{t('theme.footer.shipping')}</a>
                <a href="#" className="block hover:text-black">{t('theme.footer.returns')}</a>
                <a href="#" className="block hover:text-black">{t('theme.footer.faq')}</a>
                <Link to="/contact" className="block hover:text-black">{t('theme.footer.contact')}</Link>
              </div>
            </div>
            <div>
              <h4 className="text-[11px] tracking-[0.22em] uppercase text-black font-semibold mb-5">{t('theme.footer.col_company')}</h4>
              <div className="space-y-3 text-sm text-neutral-600">
                <Link to="/about" className="block hover:text-black">{t('theme.footer.about_us')}</Link>
                <a href="#" className="block hover:text-black">{t('theme.footer.ingredients')}</a>
                <a href="#" className="block hover:text-black">{t('theme.footer.sustainability')}</a>
                <a href="#" className="block hover:text-black">{t('theme.footer.journal')}</a>
              </div>
            </div>
            <div>
              <h4 className="text-[11px] tracking-[0.22em] uppercase text-black font-semibold mb-5">{t('theme.footer.col_newsletter')}</h4>
              <p className="text-sm text-neutral-600 mb-4">{t('theme.footer.newsletter_subtitle')}</p>
              <form className="flex border-b border-neutral-300 focus-within:border-black transition">
                <input
                  type="email"
                  placeholder={t('theme.footer.email_placeholder')}
                  className="flex-1 py-2 text-sm bg-transparent focus:outline-none"
                />
                <button type="submit" className="text-xs uppercase tracking-wider font-semibold px-2">→</button>
              </form>
            </div>
          </div>

          <div className="border-t border-neutral-100 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] tracking-wide text-neutral-500">
            <span>{t('theme.footer.copyright', { year: new Date().getFullYear(), name: brand })}</span>
            <div className="flex items-center gap-3">
              {['VISA', 'MC', 'AMEX', 'PP'].map((p) => (
                <span key={p} className="h-5 px-2 border border-neutral-300 text-[9px] font-bold flex items-center">{p}</span>
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
