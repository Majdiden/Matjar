import React, { useState } from 'react';
import { Outlet, Link } from 'react-router-dom';
import { useStore } from '@matjar/theme-shared/contexts/StoreContext';
import { useCart } from '@matjar/theme-shared/contexts/CartContext';
import { useCategories } from '@matjar/theme-shared/hooks/useProducts';
import { useMenu, type MenuItem } from '@matjar/theme-shared/hooks/useMenu';
import { SearchBar } from '@matjar/theme-shared/components/navigation/SearchBar';
import { MobileBottomNav } from '@matjar/theme-shared/components/navigation/MobileBottomNav';
import { MobileMenu } from '@matjar/theme-shared/components/navigation/MobileMenu';
import CartDrawer from '@matjar/theme-shared/components/CartDrawer';
import { WishlistHeaderLink } from '@matjar/theme-shared/components/commerce/WishlistHeaderLink';
import { useTopStripText, TOP_STRIP_ANCHOR } from '@matjar/theme-shared/theme/topStrip';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '@matjar/theme-shared/components/LanguageSwitcher';
import { SocialIcon } from '@matjar/theme-shared/components/pages/PageIcon';
import { useStoreFooter } from '@matjar/theme-shared/hooks/useStoreFooter';

const Layout: React.FC = () => {
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { t } = useTranslation(['theme']);
  const stripText = useTopStripText();
  const footer = useStoreFooter();

  return (
    <div className="min-h-screen flex flex-col pb-16 md:pb-0" style={{ fontFamily: 'var(--font-family, "Playfair Display", serif)' }}>
      {/* Top strip — the merchant's text from My Store, on every page */}
      {stripText && (
        <div data-section-id={TOP_STRIP_ANCHOR} className="bg-[var(--brand,#030712)] text-[var(--brand-contrast,#d1d5db)] text-xs text-center py-2 tracking-widest uppercase">
          {stripText}
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-30 bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between gap-3 h-20">
            {/* Logo — one end of the row */}
            {/* Logo (when set) beside the name, on one line. The name keeps a
                roomy line box so `truncate`'s overflow clip never cuts Arabic
                descenders/marks. */}
            <Link to="/" className="flex items-center gap-2.5 md:gap-3 min-w-0">
              {store?.logo && (
                <img
                  src={store.logo}
                  alt={store.name || 'Elegance'}
                  className="h-10 md:h-12 w-auto max-w-[88px] md:max-w-[160px] shrink-0 object-contain rounded-md"
                />
              )}
              <span className={`block min-w-0 truncate tracking-[0.2em] uppercase font-light text-gray-900 leading-[1.6] py-1 ${store?.logo ? 'text-lg md:text-2xl' : 'text-2xl'}`}>
                {store?.name || 'Elegance'}
              </span>
            </Link>

            {/* Right actions */}
            <div className="flex items-center gap-4 shrink-0">
              {/* Desktop search — on mobile, search lives in the bottom nav */}
              <div className="hidden md:block">
                <SearchBar variant="compact" className="text-gray-700 hover:text-gray-900 hover:bg-gray-100" />
              </div>

              {/* Language switcher — desktop only; on mobile it lives in the side menu */}
              <div className="hidden md:flex items-center">
                <LanguageSwitcher />
              </div>

              <Link to="/account" className="hidden md:block text-gray-700" aria-label={t('theme.layout.account_aria')}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0" />
                </svg>
              </Link>
<WishlistHeaderLink
                className="relative inline-flex h-10 w-10 -mx-2.5 items-center justify-center text-gray-700"
                iconClassName="w-5 h-5"
                icon={
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                  </svg>
                }
                badgeClassName="absolute top-1.5 end-1.5 w-4 h-4 bg-[var(--brand,#111827)] text-[var(--brand-contrast,#fff)] text-[9px] rounded-full flex items-center justify-center"
              />
              <button onClick={openCart} className="relative hidden md:inline-flex text-gray-700" aria-label={t('theme.layout.cart_aria')}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                </svg>
                {cart && cart.itemCount > 0 && (
                  <span className="absolute -top-1 -end-1 w-4 h-4 bg-[var(--brand,#111827)] text-[var(--brand-contrast,#fff)] text-[9px] rounded-full flex items-center justify-center">
                    {cart.itemCount}
                  </span>
                )}
              </button>

              {/* Mobile menu toggle — opposite end from the logo */}
              <button
                className="lg:hidden inline-flex h-10 w-10 -me-2.5 items-center justify-center text-gray-700"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                aria-label={t('theme.layout.menu_aria')}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  {mobileMenuOpen
                    ? <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    : <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                  }
                </svg>
              </button>
            </div>
          </div>

          <nav className="hidden lg:flex items-center justify-center gap-8 pb-4 -mt-1">
            {hasMenu ? (
              menuItems.map(item => {
                const cls = "text-xs tracking-[0.15em] uppercase text-gray-600 hover:text-gray-900 transition";
                const href = itemHref(item);
                return isExternal(item) ? (
                  <a key={item._id || href} href={href} target={item.target || '_blank'} rel="noopener noreferrer" className={cls}>{item.label}</a>
                ) : (
                  <Link key={item._id || href} to={href} className={cls}>{item.label}</Link>
                );
              })
            ) : (
              <>
                <Link to="/" className="text-xs tracking-[0.15em] uppercase text-gray-600 hover:text-gray-900 transition">{t('theme.layout.nav.home')}</Link>
                <Link to="/products" className="text-xs tracking-[0.15em] uppercase text-gray-600 hover:text-gray-900 transition">{t('theme.layout.nav.shop_all')}</Link>
                {categories.slice(0, 5).map(cat => (
                  <Link key={cat._id} to={`/categories/${cat.slug}`} className="text-xs tracking-[0.15em] uppercase text-gray-600 hover:text-gray-900 transition">
                    {cat.name}
                  </Link>
                ))}
              </>
            )}
          </nav>

        </div>
      </header>

      <MobileMenu isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} items={menuItems} />

      <main className="flex-1"><Outlet /></main>

      {/* Footer — content from the store's own data */}
      <footer className="bg-[var(--brand-strong,#030712)] text-[var(--brand-contrast,#9ca3af)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16">
          <div className={`grid grid-cols-1 ${footer.policies.length > 0 ? 'md:grid-cols-4' : 'md:grid-cols-3'} gap-10`}>
            <div>
              {footer.logo ? (
                <span className="inline-flex mb-5 rounded-xl bg-white/95 p-1.5">
                  <img src={footer.logo} alt={footer.storeName} className="h-14 md:h-[72px] w-auto max-w-[220px] object-contain rounded-lg" />
                </span>
              ) : (
                <h3 className="text-[var(--brand-contrast,#fff)] text-lg tracking-[0.15em] uppercase font-light mb-4">{footer.storeName}</h3>
              )}
              {footer.description && <p className="text-sm leading-relaxed">{footer.description}</p>}
              {footer.social.length > 0 && (
                <div className="flex gap-4 mt-5">
                  {footer.social.map((s) => (
                    <a
                      key={s.platform}
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={s.name}
                      className="hover:text-[var(--brand-contrast,#fff)] transition"
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
                  <h4 className="text-[var(--brand-contrast,#fff)] text-xs tracking-[0.15em] uppercase mb-4">{col.title}</h4>
                  <ul className="space-y-2 text-sm">
                    {col.links.map((l) => (
                      <li key={l.to}><Link to={l.to} className="hover:text-[var(--brand-contrast,#fff)] transition">{l.label}</Link></li>
                    ))}
                  </ul>
                </div>
              ))}
          </div>
          <div className="border-t border-[var(--brand,#1f2937)] mt-12 pt-8 text-center text-xs text-[var(--brand-contrast,#6b7280)] tracking-wider">
            {footer.copyright}
          </div>
        </div>
      </footer>

      <CartDrawer isOpen={cartOpen} onClose={closeCart} />
      <MobileBottomNav onCartClick={openCart} />
    </div>
  );
};

export default Layout;
