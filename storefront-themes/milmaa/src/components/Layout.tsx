import React, { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useStore } from '@matjar/theme-shared/contexts/StoreContext';
import { useCart } from '@matjar/theme-shared/contexts/CartContext';
import { useWishlist } from '@matjar/theme-shared/hooks/useWishlist';
import { useCategories } from '@matjar/theme-shared/hooks/useProducts';
import { useMenu, type MenuItem } from '@matjar/theme-shared/hooks/useMenu';
import { TOP_STRIP_ANCHOR, useTopStripText } from '@matjar/theme-shared/theme/topStrip';
import CartDrawer from '@matjar/theme-shared/components/CartDrawer';
import { FooterPaymentBadges } from '@matjar/theme-shared/components/commerce/FooterPaymentBadges';
import { LanguageSwitcher } from '@matjar/theme-shared/components/LanguageSwitcher';
import { SocialIcon } from '@matjar/theme-shared/components/pages/PageIcon';
import { useStoreFooter } from '@matjar/theme-shared/hooks/useStoreFooter';
import { SearchBar } from '@matjar/theme-shared/components/navigation/SearchBar';
import { MobileBottomNav } from '@matjar/theme-shared/components/navigation/MobileBottomNav';
import { MobileMenu } from '@matjar/theme-shared/components/navigation/MobileMenu';

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
  const { t } = useTranslation('theme');
  const { store } = useStore();
  const { cart, isOpen: cartOpen, openCart, closeCart } = useCart();
  const { count: wishlistCount } = useWishlist();
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

  const barText = useTopStripText();
  const footer = useStoreFooter();

  const brand = (store?.name || 'Milmaa');
  const isActive = (path: string) =>
    location.pathname === path || (path !== '/' && location.pathname.startsWith(path));

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: CREAM, color: DARK_TEAL }}>
      {/* ═══ TOP STRIP ══════════════════════════════════════════ */}
      {barText && (
        <div data-section-id={TOP_STRIP_ANCHOR} className="text-white text-[12px] py-2.5 text-center font-medium" style={{ backgroundColor: TEAL }}>
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
              aria-label={t('common:aria.menu')}
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
              {hasMenu ? (
                menuItems.map(item => {
                  const cls = "hover:opacity-70";
                  const href = itemHref(item);
                  return isExternal(item) ? (
                    <a key={item._id || href} href={href} target={item.target || '_blank'} rel="noopener noreferrer" className={cls}>{item.label}</a>
                  ) : (
                    <Link key={item._id || href} to={href} className={cls}>{item.label}</Link>
                  );
                })
              ) : (
                <>
                  <Link to="/" className={isActive('/') && location.pathname === '/' ? 'font-bold' : 'hover:opacity-70'}>{t('theme.nav.home')}</Link>
                  <Link to="/products" className={isActive('/products') ? 'font-bold' : 'hover:opacity-70'}>{t('theme.nav.shop')}</Link>
                  {categories.slice(0, 2).map((cat) => (
                    <Link key={cat._id} to={`/categories/${cat.slug}`} className="hover:opacity-70">
                      {cat.name}
                    </Link>
                  ))}
                  <Link to="/about" className="hover:opacity-70">{t('theme.nav.about')}</Link>
                  <Link to="/contact" className="hover:opacity-70">{t('theme.nav.contact')}</Link>
                </>
              )}
            </nav>

            {/* Icons — desktop only; on mobile the hamburger drawer + bottom nav cover these */}
            <div className="hidden md:flex items-center gap-4" style={{ color: DARK_TEAL }}>
              <div className="hidden md:flex items-center">
                <LanguageSwitcher />
              </div>
              <SearchBar variant="compact" className="hidden md:block hover:opacity-70 hover:bg-black/5" />
              <Link to="/account" aria-label={t('common:aria.account')} className="hover:opacity-70 hidden md:block">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                </svg>
              </Link>
              <Link to="/wishlist" aria-label={t('common:aria.wishlist')} className="relative hover:opacity-70 hidden md:block">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                </svg>
                {(wishlistCount || 0) > 0 && (
                  <span className="absolute -top-2 -end-2 min-w-[18px] h-[18px] px-1 text-white text-[10px] rounded-full flex items-center justify-center font-bold" style={{ backgroundColor: PINK }}>
                    {wishlistCount}
                  </span>
                )}
              </Link>
              <button onClick={openCart} aria-label={t('common:aria.cart')} className="relative hover:opacity-70 hidden md:block">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
                </svg>
                {(cart?.itemCount || 0) > 0 && (
                  <span className="absolute -top-2 -end-2 min-w-[18px] h-[18px] px-1 text-white text-[10px] rounded-full flex items-center justify-center font-bold" style={{ backgroundColor: PINK }}>
                    {cart?.itemCount}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>

      </header>

      <MobileMenu isOpen={menuOpen} onClose={() => setMenuOpen(false)} items={menuItems} />

      <main className="flex-1">
        <Outlet />
      </main>

      {/* ═══ FOOTER — content from the store's own data ═════════ */}
      <footer className="mt-20 pt-16 pb-6" style={{ backgroundColor: DARK_TEAL, color: CREAM }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-10 mb-12">
            <div className="md:col-span-2">
              {footer.logo ? (
                <img src={footer.logo} alt={footer.storeName} className="h-12 w-auto mb-4 object-contain" />
              ) : (
                <div className="font-serif text-4xl font-bold mb-4" style={{ fontFamily: HEADING_FONT }}>
                  {brand.toLowerCase()}
                </div>
              )}
              {footer.description && (
                <p className="text-sm mb-5 max-w-xs opacity-80">{footer.description}</p>
              )}
              {footer.social.length > 0 && (
                <div className="flex gap-3">
                  {footer.social.map((s) => (
                    <a
                      key={s.platform}
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={s.name}
                      className="w-9 h-9 rounded-full border border-current/30 flex items-center justify-center hover:bg-white/10 transition"
                    >
                      <SocialIcon platform={s.platform} className="w-4 h-4" />
                    </a>
                  ))}
                </div>
              )}
            </div>
            {[
              { title: footer.titles.shop, links: footer.shop },
              { title: footer.titles.help, links: footer.help },
              { title: footer.titles.policies, links: footer.policies },
            ]
              .filter((col) => col.links.length > 0)
              .map((col) => (
                <div key={col.title}>
                  <h4 className="text-sm font-bold mb-5">{col.title}</h4>
                  <div className="space-y-3 text-sm opacity-80">
                    {col.links.map((l) => (
                      <Link key={l.to} to={l.to} className="block hover:opacity-100 hover:underline">{l.label}</Link>
                    ))}
                  </div>
                </div>
              ))}
          </div>
          <div className="border-t border-white/10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs opacity-70">
            <span>{footer.copyright}</span>
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
