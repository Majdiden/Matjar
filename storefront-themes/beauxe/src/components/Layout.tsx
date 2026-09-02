import React, { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useStore } from '@matjar/theme-shared/contexts/StoreContext';
import { useCart } from '@matjar/theme-shared/contexts/CartContext';
import { useCategories } from '@matjar/theme-shared/hooks/useProducts';
import { useMenu, type MenuItem } from '@matjar/theme-shared/hooks/useMenu';
import { useThemeSetting } from '@matjar/theme-shared/theme/ThemeProvider';
import CartDrawer from '@matjar/theme-shared/components/CartDrawer';
import { FooterPaymentBadges } from '@matjar/theme-shared/components/commerce/FooterPaymentBadges';
import { SearchBar } from '@matjar/theme-shared/components/navigation/SearchBar';
import { MobileBottomNav } from '@matjar/theme-shared/components/navigation/MobileBottomNav';
import { MobileMenu } from '@matjar/theme-shared/components/navigation/MobileMenu';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '@matjar/theme-shared/components/LanguageSwitcher';
import { PolicyLinks } from '@matjar/theme-shared/components/PolicyLinks';

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
  // Store-managed header nav. When present (new stores ship a seeded
  // "header" menu) it drives the nav; while loading/empty (older stores)
  // we fall back to the category list below so nav never disappears.
  const { items: menuItems } = useMenu('header');
  const hasMenu = menuItems.length > 0;
  const itemHref = (item: MenuItem) => item.resolvedUrl || item.url || '/';
  const isExternal = (item: MenuItem) =>
    item.type === 'external' || item.target === '_blank';
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const { t } = useTranslation(['theme']);

  const showBar = useThemeSetting<boolean>('show_announcement_bar') !== false;
  const barText = useThemeSetting<string>('announcement_text') || t('theme.layout.announcement');

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
              <Link to="/account" className="hover:text-[var(--color-secondary)]">{t('theme.layout.nav.account')}</Link>
              <Link to="/orders" className="hover:text-[var(--color-secondary)]">{t('theme.layout.nav.track_order')}</Link>
            </div>
          </div>
        </div>
      )}

      {/* ═══ HEADER ══════════════════════════════════════════════ */}
      <header className="sticky top-0 z-40 bg-white border-b border-pink-100/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex md:grid md:grid-cols-[1fr_auto_1fr] items-center justify-between py-6 gap-6">
            {/* Left: nav (desktop) */}
            <nav className="hidden md:flex items-center gap-7 text-[12px] tracking-[0.15em] uppercase" style={{ color: NAVY }}>
              {hasMenu ? (
                menuItems.map((item) => {
                  const cls = "hover:text-[var(--color-secondary)]";
                  const href = itemHref(item);
                  return isExternal(item) ? (
                    <a key={item._id || href} href={href} target={item.target || '_blank'} rel="noopener noreferrer" className={cls}>{item.label}</a>
                  ) : (
                    <Link key={item._id || href} to={href} className={cls}>{item.label}</Link>
                  );
                })
              ) : (
                <>
                  <Link to="/" className={isActive('/') && location.pathname === '/' ? 'font-bold' : 'hover:text-[var(--color-secondary)]'}>{t('theme.layout.nav.home')}</Link>
                  <Link to="/products" className={isActive('/products') ? 'font-bold' : 'hover:text-[var(--color-secondary)]'}>{t('theme.layout.nav.shop')}</Link>
                  {categories.slice(0, 3).map((cat) => (
                    <Link key={cat._id} to={`/categories/${cat.slug}`} className="hover:text-[var(--color-secondary)]">
                      {cat.name}
                    </Link>
                  ))}
                </>
              )}
            </nav>

            {/* Center on desktop, start on mobile: serif wordmark (logo) */}
            <Link
              to="/"
              className="font-serif text-3xl md:text-4xl tracking-tight text-start md:text-center whitespace-nowrap"
              style={{ fontFamily: 'var(--font-family-heading)', color: NAVY }}
            >
              {brand}
            </Link>

            {/* Right: icons (desktop only — search/cart/account live in the bottom nav on mobile) */}
            <div className="hidden md:flex items-center gap-4 md:gap-5 justify-end" style={{ color: NAVY }}>
              <div className="hidden md:flex items-center">
                <LanguageSwitcher />
              </div>
              <div className="hidden md:flex items-center">
                <SearchBar variant="compact" className="hover:text-[var(--color-secondary)] hover:bg-pink-50" />
              </div>
              <Link to="/wishlist" aria-label={t('common:aria.wishlist')} className="hidden md:inline-flex hover:text-[var(--color-secondary)]">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.6}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                </svg>
              </Link>
              <button onClick={openCart} aria-label={t('common:aria.cart')} className="relative hidden md:inline-flex hover:text-[var(--color-secondary)]">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.6}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
                </svg>
                {(cart?.itemCount || 0) > 0 && (
                  <span className="absolute -top-2 -end-2 min-w-[18px] h-[18px] px-1 text-white text-[10px] rounded-full flex items-center justify-center font-bold" style={{ backgroundColor: NAVY }}>
                    {cart?.itemCount}
                  </span>
                )}
              </button>
            </div>

            {/* Mobile hamburger — opposite end from the logo */}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="md:hidden"
              aria-label={t('common:aria.menu')}
            >
              <svg className="w-6 h-6" fill="none" stroke={NAVY} viewBox="0 0 24 24" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d={menuOpen ? 'M6 18L18 6M6 6l12 12' : 'M4 6h16M4 12h16M4 18h16'} />
              </svg>
            </button>
          </div>
        </div>

      </header>

      <MobileMenu isOpen={menuOpen} onClose={() => setMenuOpen(false)} items={menuItems} />

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
              <PolicyLinks className="mt-6" heading={false} linkClassName="block text-[var(--color-primary)]/80 hover:opacity-100 hover:underline transition" />
            </div>
            {[
              { h: t('theme.footer.shop_heading'), items: [
                { label: t('theme.footer.shop_all'), to: '/products' },
                { label: t('theme.footer.best_sellers'), to: '/products' },
                { label: t('theme.footer.new_arrivals'), to: '/products' },
                { label: t('theme.footer.gift_sets'), to: '/products' },
              ] },
              { h: t('theme.footer.help_heading'), items: [
                { label: t('theme.footer.shipping'), to: '/policies/delivery' },
                { label: t('theme.footer.returns'), to: '/policies/returns' },
                { label: t('theme.footer.faqs'), to: '/contact' },
                { label: t('theme.footer.contact'), to: '/contact' },
              ] },
              { h: t('theme.footer.about_heading'), items: [
                { label: t('theme.footer.our_story'), to: '/about' },
                { label: t('theme.footer.ingredients'), to: '/about' },
                { label: t('theme.footer.sustainability'), to: '/about' },
                { label: t('theme.footer.careers'), to: '/about' },
              ] },
            ].map((col) => (
              <div key={col.h}>
                <h4 className="text-[11px] tracking-[0.22em] uppercase font-bold mb-5" style={{ color: NAVY }}>
                  {col.h}
                </h4>
                <div className="space-y-3 text-sm" style={{ color: NAVY, opacity: 0.8 }}>
                  {col.items.map((item) => (
                    <Link key={item.label} to={item.to} className="block hover:opacity-100 hover:underline transition">{item.label}</Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="border-t border-pink-200/60 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px]" style={{ color: NAVY, opacity: 0.7 }}>
            <span>{t('theme.footer.copyright', { year: new Date().getFullYear(), brand })}</span>
            <FooterPaymentBadges size="sm" />
          </div>
        </div>
      </footer>

      <MobileBottomNav onCartClick={openCart} />
      <CartDrawer isOpen={cartOpen} onClose={closeCart} />
    </div>
  );
};

export default Layout;
