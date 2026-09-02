import React, { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useStore } from '@matjar/theme-shared/contexts/StoreContext';
import { useCart } from '@matjar/theme-shared/contexts/CartContext';
import { useCategories } from '@matjar/theme-shared/hooks/useProducts';
import { useMenu, type MenuItem } from '@matjar/theme-shared/hooks/useMenu';
import { useThemeSetting } from '@matjar/theme-shared/theme/ThemeProvider';
import CartDrawer from '@matjar/theme-shared/components/CartDrawer';
import { LanguageSwitcher } from '@matjar/theme-shared/components/LanguageSwitcher';
import { PolicyLinks } from '@matjar/theme-shared/components/PolicyLinks';
import { SearchBar } from '@matjar/theme-shared/components/navigation/SearchBar';
import { MobileBottomNav } from '@matjar/theme-shared/components/navigation/MobileBottomNav';
import { MobileMenu } from '@matjar/theme-shared/components/navigation/MobileMenu';

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
  // Store-managed header nav. When present it drives the nav; while
  // loading/empty we fall back to the category list so nav never disappears.
  const { items: menuItems } = useMenu('header');
  const hasMenu = menuItems.length > 0;
  const itemHref = (item: MenuItem) => item.resolvedUrl || item.url || '/';
  const isExternal = (item: MenuItem) =>
    item.type === 'external' || item.target === '_blank';
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
          <div className="flex items-center justify-between py-6">
            {/* Start: serif wordmark */}
            <Link
              to="/"
              className="font-display text-3xl md:text-4xl tracking-tight text-black leading-none"
              style={{ fontFamily: 'var(--font-family-heading)' }}
            >
              {brand}
            </Link>

            {/* End: search (desktop) / language (desktop) / account / wishlist / cart / hamburger (mobile) */}
            <div className="flex items-center gap-5 text-neutral-700">
              {/* Desktop search bar */}
              <div className="hidden md:block w-56">
                <SearchBar variant="expanded" />
              </div>
              {/* Language switcher — desktop only */}
              <div className="hidden md:flex items-center">
                <LanguageSwitcher />
              </div>
              <Link to="/account" aria-label={t('common:aria.account')} className="hover:text-black hidden md:block">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.6}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.5 20.25a7.5 7.5 0 1115 0v.75H4.5v-.75z" />
                </svg>
              </Link>
              <Link to="/wishlist" aria-label={t('common:aria.wishlist')} className="hover:text-black hidden md:block">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.6}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                </svg>
              </Link>
              <button onClick={openCart} aria-label={t('common:aria.cart')} className="relative hover:text-black hidden md:block">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.6}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
                </svg>
                {(cart?.itemCount || 0) > 0 && (
                  <span className="absolute -top-2 -end-2 min-w-[18px] h-[18px] px-1 bg-black text-white text-[10px] rounded-full flex items-center justify-center font-semibold">
                    {cart?.itemCount}
                  </span>
                )}
              </button>
              {/* Hamburger — mobile only, opposite end from the wordmark */}
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                aria-label={t('common:aria.menu')}
                className="md:hidden text-neutral-700"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={menuOpen ? 'M6 18L18 6M6 6l12 12' : 'M4 6h16M4 12h16M4 18h16'} />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Nav row — desktop */}
        <nav className="hidden md:flex justify-center gap-10 pb-5 text-[11px] tracking-[0.22em] uppercase text-neutral-700 border-t border-neutral-100 pt-4">
          {hasMenu ? (
            menuItems.map((item) => {
              const href = itemHref(item);
              const cls = isActive(href) ? 'text-black font-semibold' : 'hover:text-black';
              return isExternal(item) ? (
                <a key={item._id || href} href={href} target={item.target || '_blank'} rel="noopener noreferrer" className={cls}>{item.label}</a>
              ) : (
                <Link key={item._id || href} to={href} className={cls}>{item.label}</Link>
              );
            })
          ) : (
            <>
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
            </>
          )}
        </nav>

      </header>

      <MobileMenu isOpen={menuOpen} onClose={() => setMenuOpen(false)} items={menuItems} />

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

          <div className="grid grid-cols-2 md:grid-cols-3 gap-10 mb-12">
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
                <Link to="/policies/delivery" className="block hover:text-black">{t('theme.footer.shipping')}</Link>
                <Link to="/policies/returns" className="block hover:text-black">{t('theme.footer.returns')}</Link>
                <Link to="/contact" className="block hover:text-black">{t('theme.footer.faq')}</Link>
                <Link to="/contact" className="block hover:text-black">{t('theme.footer.contact')}</Link>
                <PolicyLinks className="mt-3" heading={false} linkClassName="block hover:text-black" />
              </div>
            </div>
            <div>
              <h4 className="text-[11px] tracking-[0.22em] uppercase text-black font-semibold mb-5">{t('theme.footer.col_company')}</h4>
              <div className="space-y-3 text-sm text-neutral-600">
                <Link to="/about" className="block hover:text-black">{t('theme.footer.about_us')}</Link>
                <Link to="/about" className="block hover:text-black">{t('theme.footer.ingredients')}</Link>
                <Link to="/about" className="block hover:text-black">{t('theme.footer.sustainability')}</Link>
                <Link to="/about" className="block hover:text-black">{t('theme.footer.journal')}</Link>
              </div>
            </div>
          </div>

          <div className="border-t border-neutral-100 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] tracking-wide text-neutral-500">
            <span>{t('theme.footer.copyright', { year: new Date().getFullYear(), name: brand })}</span>
            <div className="flex items-center gap-3">
              {['VISA', 'MC', 'AMEX', 'PP'].map((p) => (
                <span key={p} className="h-6 px-2.5 border border-neutral-300 text-[10px] font-bold flex items-center">{p}</span>
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
