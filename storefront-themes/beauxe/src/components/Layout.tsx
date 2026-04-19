import React, { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useStore } from '@shared/contexts/StoreContext';
import { useCart } from '@shared/contexts/CartContext';
import { useCategories } from '@shared/hooks/useProducts';
import { useThemeSetting } from '@shared/theme/ThemeProvider';
import CartDrawer from '@shared/components/CartDrawer';
import { SearchBar } from '@shared/components/navigation/SearchBar';
import { MobileBottomNav } from '@shared/components/navigation/MobileBottomNav';
import { useTranslation } from 'react-i18next';

/**
 * Beauxe Layout — navy announcement + pink-accent header.
 *
 * ─ Navy top bar (announcement + quick links)
 * ─ White header: serif wordmark left, category nav center, icons right
 * ─ Footer: cream background, navy text, 4-col links
 */

const NAVY = 'var(--color-primary)';
const PINK = 'var(--color-secondary)';
const CREAM = 'var(--color-background)';

const Layout: React.FC = () => {
  const { store } = useStore();
  const { cart, isOpen: cartOpen, openCart, closeCart } = useCart();
  const { categories } = useCategories();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const { t } = useTranslation(['theme']);

  const showBar = useThemeSetting<boolean>('show_announcement_bar') !== false;
  const barText = useThemeSetting<string>('announcement_text') || 'SUMMER SALE · UP TO 40% OFF';

  const brand = (store?.name || 'BEAUXE').toUpperCase();
  const isActive = (path: string) =>
    location.pathname === path || (path !== '/' && location.pathname.startsWith(path));

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: CREAM, color: NAVY, fontFamily: 'var(--font-family)' }}>
      {/* ═══ TOP BAR (navy) ══════════════════════════════════════ */}
      {showBar && (
        <div className="text-white text-[11px] tracking-[0.2em] font-medium py-2.5" style={{ backgroundColor: NAVY }}>
          <div className="max-w-7xl mx-auto px-4 flex items-center justify-between">
            <div className="hidden md:flex items-center gap-4 text-[10px]">
              <span>USD ▾</span>
              <span>EN ▾</span>
            </div>
            <div className="flex-1 text-center">{barText}</div>
            <div className="hidden md:flex items-center gap-4 text-[10px]">
              <Link to="/account" className="hover:text-[var(--color-primary)]">{t('theme.layout.nav.account')}</Link>
              <Link to="/orders" className="hover:text-[var(--color-primary)]">{t('theme.layout.nav.track_order')}</Link>
            </div>
          </div>
        </div>
      )}

      {/* ═══ HEADER ══════════════════════════════════════════════ */}
      <header className="sticky top-0 z-40 bg-white border-b border-pink-100/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center py-6 gap-6">
            {/* Mobile menu */}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="md:hidden justify-self-start"
              aria-label="Menu"
            >
              <svg className="w-6 h-6" fill="none" stroke={NAVY} viewBox="0 0 24 24" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d={menuOpen ? 'M6 18L18 6M6 6l12 12' : 'M4 6h16M4 12h16M4 18h16'} />
              </svg>
            </button>

            {/* Left: nav */}
            <nav className="hidden md:flex items-center gap-7 text-[12px] tracking-[0.15em] uppercase" style={{ color: NAVY }}>
              <Link to="/" className={isActive('/') && location.pathname === '/' ? 'font-bold' : 'hover:text-[var(--color-primary)]'}>{t('theme.layout.nav.home')}</Link>
              <Link to="/products" className={isActive('/products') ? 'font-bold' : 'hover:text-[var(--color-primary)]'}>{t('theme.layout.nav.shop')}</Link>
              {categories.slice(0, 3).map((cat) => (
                <Link key={cat._id} to={`/categories/${cat.slug}`} className="hover:text-[var(--color-primary)]">
                  {cat.name}
                </Link>
              ))}
            </nav>

            {/* Center: serif wordmark */}
            <Link
              to="/"
              className="font-serif text-3xl md:text-4xl tracking-tight text-center whitespace-nowrap"
              style={{ fontFamily: 'var(--font-family-heading)', color: NAVY }}
            >
              {brand}
            </Link>

            {/* Right: icons */}
            <div className="flex items-center gap-4 md:gap-5 justify-end" style={{ color: NAVY }}>
              <Link to="/about" className="hidden md:block hover:text-[var(--color-primary)] text-[12px] tracking-[0.15em] uppercase">{t('theme.layout.nav.about')}</Link>
              <Link to="/contact" className="hidden md:block hover:text-[var(--color-primary)] text-[12px] tracking-[0.15em] uppercase">{t('theme.layout.nav.contact')}</Link>
              <SearchBar variant="compact" className="hover:text-[var(--color-primary)] hover:bg-pink-50" />
              <Link to="/wishlist" aria-label="Wishlist" className="hover:text-[var(--color-primary)]">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.6}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                </svg>
              </Link>
              <button onClick={openCart} aria-label="Cart" className="relative hover:text-[var(--color-primary)]">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.6}>
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
          <nav className="md:hidden border-t border-pink-100/50 px-6 py-4 space-y-3 text-sm uppercase tracking-wider" style={{ color: NAVY }}>
            <Link onClick={() => setMenuOpen(false)} to="/" className="block">{t('theme.layout.nav.home')}</Link>
            <Link onClick={() => setMenuOpen(false)} to="/products" className="block">{t('theme.layout.nav.shop')}</Link>
            {categories.slice(0, 6).map((cat) => (
              <Link key={cat._id} onClick={() => setMenuOpen(false)} to={`/categories/${cat.slug}`} className="block">{cat.name}</Link>
            ))}
            <Link onClick={() => setMenuOpen(false)} to="/about" className="block">{t('theme.layout.nav.about')}</Link>
            <Link onClick={() => setMenuOpen(false)} to="/contact" className="block">{t('theme.layout.nav.contact')}</Link>
          </nav>
        )}
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      {/* ═══ FOOTER ══════════════════════════════════════════════ */}
      <footer className="mt-20 pt-16 pb-6" style={{ backgroundColor: 'var(--color-accent)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-10 mb-12">
            <div className="md:col-span-2">
              <div className="font-serif text-4xl mb-4" style={{ fontFamily: 'var(--font-family-heading)', color: NAVY }}>
                {brand}
              </div>
              <p className="text-sm mb-5 max-w-xs" style={{ color: NAVY, opacity: 0.75 }}>
                {t('theme.footer.tagline')}
              </p>
              <div className="flex gap-3">
                {['f', 'i', 'p', 't'].map((s) => (
                  <a
                    key={s}
                    href="#"
                    className="w-9 h-9 rounded-full border border-current/20 flex items-center justify-center text-xs hover:bg-current/5 transition"
                    style={{ color: NAVY }}
                  >
                    {s}
                  </a>
                ))}
              </div>
            </div>
            {[
              { h: t('theme.footer.shop_heading'), items: [t('theme.footer.shop_all'), t('theme.footer.best_sellers'), t('theme.footer.new_arrivals'), t('theme.footer.gift_sets')] },
              { h: t('theme.footer.help_heading'), items: [t('theme.footer.shipping'), t('theme.footer.returns'), t('theme.footer.faqs'), t('theme.footer.contact')] },
              { h: t('theme.footer.about_heading'), items: [t('theme.footer.our_story'), t('theme.footer.ingredients'), t('theme.footer.sustainability'), t('theme.footer.careers')] },
            ].map((col) => (
              <div key={col.h}>
                <h4 className="text-[11px] tracking-[0.22em] uppercase font-bold mb-5" style={{ color: NAVY }}>
                  {col.h}
                </h4>
                <div className="space-y-3 text-sm" style={{ color: NAVY, opacity: 0.8 }}>
                  {col.items.map((item) => (
                    <a key={item} href="#" className="block hover:opacity-100 hover:underline transition">{item}</a>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="border-t border-pink-200/60 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px]" style={{ color: NAVY, opacity: 0.7 }}>
            <span>{t('theme.footer.copyright', { year: new Date().getFullYear(), brand })}</span>
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
