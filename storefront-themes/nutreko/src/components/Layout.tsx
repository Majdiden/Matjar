import React, { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useStore } from '@shared/contexts/StoreContext';
import { useCart } from '@shared/contexts/CartContext';
import { useCategories } from '@shared/hooks/useProducts';
import { useWishlist } from '@shared/hooks/useWishlist';
import { useThemeSetting } from '@shared/theme/ThemeProvider';
import CartDrawer from '@shared/components/CartDrawer';
import { LanguageSwitcher } from '../../../_shared/components/LanguageSwitcher';
import { SearchBar } from '@shared/components/navigation/SearchBar';
import { MobileBottomNav } from '@shared/components/navigation/MobileBottomNav';

/**
 * Nutreko Layout — bold black header with lime accent.
 *
 * ─ Lime info strip with free shipping / authentic guarantee
 * ─ Black sticky header: chunky wordmark left, uppercase nav center, icons right
 * ─ Black footer with lime highlights
 */

const DARK = 'var(--color-secondary)';
const LIME = 'var(--color-primary)';

const Layout: React.FC = () => {
  const { t } = useTranslation('theme');
  const { store } = useStore();
  const { cart, isOpen: cartOpen, openCart, closeCart } = useCart();
  const { categories } = useCategories();
  const { items: wishlistItems } = useWishlist();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const showBar = useThemeSetting<boolean>('show_announcement_bar') !== false;
  const barText = useThemeSetting<string>('announcement_text') || t('theme.announcement.default', { defaultValue: 'FREE SHIPPING ON ORDERS OVER $75' });

  const brand = (store?.name || 'NUTREKO').toUpperCase();
  const isActive = (path: string) =>
    location.pathname === path || (path !== '/' && location.pathname.startsWith(path));

  return (
    <div className="min-h-screen flex flex-col bg-white" style={{ color: DARK }}>
      {/* ═══ TOP STRIP (lime) ══════════════════════════════════════ */}
      {showBar && (
        <div className="text-[11px] tracking-[0.2em] font-bold py-2.5" style={{ backgroundColor: LIME, color: DARK }}>
          <div className="max-w-7xl mx-auto px-4 flex items-center justify-center gap-8">
            <span className="flex items-center gap-2">★ {barText}</span>
          </div>
        </div>
      )}

      {/* ═══ HEADER (black) ══════════════════════════════════════ */}
      <header className="sticky top-0 z-40 bg-black border-b-4 text-white" style={{ borderColor: LIME }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between py-5 gap-6">
            {/* Mobile menu */}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="md:hidden"
              aria-label={t('common:aria.menu')}
            >
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.2}>
                <path strokeLinecap="round" strokeLinejoin="round" d={menuOpen ? 'M6 18L18 6M6 6l12 12' : 'M4 6h16M4 12h16M4 18h16'} />
              </svg>
            </button>

            {/* Wordmark */}
            <Link
              to="/"
              className="font-display text-3xl md:text-4xl tracking-tighter"
              style={{ fontFamily: 'var(--font-family-heading)' }}
            >
              {brand}<span style={{ color: LIME }}>.</span>
            </Link>

            {/* Nav (hidden on mobile) */}
            <nav className="hidden md:flex items-center gap-7 text-[12px] tracking-[0.15em] uppercase font-bold">
              <Link to="/" className={isActive('/') && location.pathname === '/' ? 'text-[var(--color-primary)]' : 'hover:text-[var(--color-primary)]'}>{t('theme.nav.home')}</Link>
              <Link to="/products" className={isActive('/products') ? 'text-[var(--color-primary)]' : 'hover:text-[var(--color-primary)]'}>{t('theme.nav.shop_all')}</Link>
              {categories.slice(0, 4).map((cat) => (
                <Link key={cat._id} to={`/categories/${cat.slug}`} className="hover:text-[var(--color-primary)]">
                  {cat.name}
                </Link>
              ))}
              <Link to="/about" className="hover:text-[var(--color-primary)]">{t('theme.nav.about')}</Link>
            </nav>

            {/* Icons (desktop only — mobile uses the drawer + bottom nav) */}
            <div className="hidden md:flex items-center gap-4 md:gap-5">
              <LanguageSwitcher />
              <SearchBar variant="compact" className="text-white hover:text-[var(--color-primary)] hover:bg-white/10" />
              <Link to="/wishlist" aria-label={t('common:aria.wishlist')} className="relative hover:text-[var(--color-primary)] hidden md:block">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                </svg>
                {wishlistItems.length > 0 && (
                  <span className="absolute -top-2 -end-2 min-w-[18px] h-[18px] px-1 text-black text-[10px] rounded-full flex items-center justify-center font-black" style={{ backgroundColor: LIME }}>
                    {wishlistItems.length}
                  </span>
                )}
              </Link>
              <Link to="/account" aria-label={t('common:aria.account')} className="hover:text-[var(--color-primary)] hidden md:block">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                </svg>
              </Link>
              <button onClick={openCart} aria-label={t('common:aria.cart')} className="relative hover:text-[var(--color-primary)] hidden md:block">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
                </svg>
                {(cart?.itemCount || 0) > 0 && (
                  <span className="absolute -top-2 -end-2 min-w-[18px] h-[18px] px-1 text-black text-[10px] rounded-full flex items-center justify-center font-black" style={{ backgroundColor: LIME }}>
                    {cart?.itemCount}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>

        {menuOpen && (
          <nav className="md:hidden border-t border-white/10 px-6 py-4 space-y-3 text-sm uppercase tracking-wider font-bold">
            <Link onClick={() => setMenuOpen(false)} to="/" className="block">{t('theme.nav.home')}</Link>
            <Link onClick={() => setMenuOpen(false)} to="/products" className="block">{t('theme.nav.shop_all')}</Link>
            {categories.slice(0, 6).map((cat) => (
              <Link key={cat._id} onClick={() => setMenuOpen(false)} to={`/categories/${cat.slug}`} className="block">{cat.name}</Link>
            ))}
            <Link onClick={() => setMenuOpen(false)} to="/about" className="block">{t('theme.nav.about')}</Link>
            <Link onClick={() => setMenuOpen(false)} to="/contact" className="block">{t('theme.nav.contact')}</Link>
            <LanguageSwitcher />
          </nav>
        )}
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      {/* ═══ FOOTER (black) ══════════════════════════════════════ */}
      <footer className="mt-20 pt-16 pb-6 bg-black text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-10 mb-12">
            <div className="md:col-span-2">
              <div className="font-display text-4xl mb-4" style={{ fontFamily: 'var(--font-family-heading)' }}>
                {brand}<span style={{ color: LIME }}>.</span>
              </div>
              <p className="text-sm mb-5 max-w-xs text-white/60">
                {t('theme.footer.tagline')}
              </p>
              <div className="flex gap-3">
                {['f', 'i', 'y', 't'].map((s) => (
                  <a
                    key={s}
                    href="#"
                    className="w-10 h-10 border-2 border-white/20 flex items-center justify-center text-sm font-bold hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition"
                  >
                    {s.toUpperCase()}
                  </a>
                ))}
              </div>
            </div>
            <div>
              <h4 className="text-[11px] tracking-[0.22em] uppercase font-black mb-5" style={{ color: LIME }}>{t('theme.footer.col_shop')}</h4>
              <div className="space-y-3 text-sm text-white/70">
                <a href="#" className="block hover:text-white transition">{t('theme.footer.item_all_products')}</a>
                <a href="#" className="block hover:text-white transition">{t('theme.footer.item_protein')}</a>
                <a href="#" className="block hover:text-white transition">{t('theme.footer.item_pre_workout')}</a>
                <a href="#" className="block hover:text-white transition">{t('theme.footer.item_recovery')}</a>
              </div>
            </div>
            <div>
              <h4 className="text-[11px] tracking-[0.22em] uppercase font-black mb-5" style={{ color: LIME }}>{t('theme.footer.col_support')}</h4>
              <div className="space-y-3 text-sm text-white/70">
                <a href="#" className="block hover:text-white transition">{t('theme.footer.item_shipping')}</a>
                <a href="#" className="block hover:text-white transition">{t('theme.footer.item_returns')}</a>
                <a href="#" className="block hover:text-white transition">{t('theme.footer.item_faqs')}</a>
                <a href="#" className="block hover:text-white transition">{t('theme.footer.item_contact')}</a>
              </div>
            </div>
            <div>
              <h4 className="text-[11px] tracking-[0.22em] uppercase font-black mb-5" style={{ color: LIME }}>{t('theme.footer.col_company')}</h4>
              <div className="space-y-3 text-sm text-white/70">
                <a href="#" className="block hover:text-white transition">{t('theme.footer.item_about')}</a>
                <a href="#" className="block hover:text-white transition">{t('theme.footer.item_blog')}</a>
                <a href="#" className="block hover:text-white transition">{t('theme.footer.item_ambassadors')}</a>
                <a href="#" className="block hover:text-white transition">{t('theme.footer.item_careers')}</a>
              </div>
            </div>
          </div>
          <div className="border-t border-white/10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-white/50">
            <span>{t('theme.footer.copyright_html', { year: new Date().getFullYear(), brand })}</span>
            <div className="flex gap-2">
              {['VISA', 'MC', 'AMEX', 'PP'].map((p) => (
                <span key={p} className="h-5 px-2 border border-white/30 text-[9px] font-bold flex items-center">{p}</span>
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
