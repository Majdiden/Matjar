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
import { SearchBar } from '@matjar/theme-shared/components/navigation/SearchBar';
import { MobileBottomNav } from '@matjar/theme-shared/components/navigation/MobileBottomNav';
import { MobileMenu } from '@matjar/theme-shared/components/navigation/MobileMenu';

/**
 * Aurum Layout — dark editorial luxury chrome.
 *
 *   ─ Optional thin gold-on-black announcement bar
 *   ─ Header (sticky, near-black): nav links / serif wordmark / utility links
 *   ─ Footer: giant full-width serif wordmark, 4-col info grid, copyright
 */

const SOCIAL_ICONS: Record<string, React.ReactNode> = {
  instagram: (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
    </svg>
  ),
  facebook: (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  ),
  twitter: (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  ),
  tiktok: (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
    </svg>
  ),
};

const Layout: React.FC = () => {
  const { t } = useTranslation(['theme', 'common']);
  const { store } = useStore();
  const { cart, isOpen: cartOpen, openCart, closeCart } = useCart();
  const { categories } = useCategories();
  // Store-managed header nav; while loading/empty fall back to the
  // category list so the nav never disappears.
  const { items: menuItems } = useMenu('header');
  const hasMenu = menuItems.length > 0;
  const itemHref = (item: MenuItem) => item.resolvedUrl || item.url || '/';
  const isExternal = (item: MenuItem) =>
    item.type === 'external' || item.target === '_blank';
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const showBar = useThemeSetting<boolean>('show_announcement_bar') !== false;
  const barText = useThemeSetting<string>('announcement_text') || t('theme.announcement.default_text');

  const brand = (store?.name || 'AURUM').toUpperCase();
  const socials = Object.entries(store?.socialLinks || {}).filter(
    ([key, url]) => Boolean(url) && Boolean(SOCIAL_ICONS[key.toLowerCase()])
  );
  const isActive = (path: string) =>
    location.pathname === path || (path !== '/' && location.pathname.startsWith(path));
  const navCls = (path: string) =>
    isActive(path) ? 'text-ink' : 'text-mute hover:text-ink transition-colors';

  const fallbackNav = (onClick?: () => void, block = false) => {
    const cls = block ? 'block py-1' : '';
    return (
      <>
        <Link onClick={onClick} to="/products" className={`${cls} ${navCls('/products')}`}>{t('theme.nav.shop')}</Link>
        {categories.slice(0, block ? 6 : 3).map((cat) => (
          <Link
            key={cat._id}
            onClick={onClick}
            to={`/categories/${cat.slug}`}
            className={`${cls} ${navCls(`/categories/${cat.slug}`)}`}
          >
            {cat.name}
          </Link>
        ))}
        <Link onClick={onClick} to="/about" className={`${cls} ${navCls('/about')}`}>{t('theme.nav.about')}</Link>
      </>
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-night text-ink">
      {/* ═══ ANNOUNCEMENT BAR ════════════════════════════════════ */}
      {showBar && (
        <div className="bg-black text-[10px] tracking-[0.3em] uppercase text-gold py-2.5 text-center px-4">
          {barText}
        </div>
      )}

      {/* ═══ HEADER ══════════════════════════════════════════════ */}
      <header className="sticky top-0 z-40 bg-night border-b border-line">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-8">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center py-5 gap-4">
            {/* Start: nav (desktop) / hamburger (mobile) */}
            <div className="flex items-center">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                aria-label={t('common:aria.menu')}
                className="md:hidden text-ink"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.4}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={menuOpen ? 'M6 18L18 6M6 6l12 12' : 'M4 6h16M4 12h16M4 18h16'} />
                </svg>
              </button>
              <nav className="hidden md:flex items-center gap-7 text-[11px] tracking-[0.15em] uppercase">
                {hasMenu
                  ? menuItems.slice(0, 5).map((item) => {
                      const href = itemHref(item);
                      const cls = navCls(href);
                      return isExternal(item) ? (
                        <a key={item._id || href} href={href} target={item.target || '_blank'} rel="noopener noreferrer" className={cls}>{item.label}</a>
                      ) : (
                        <Link key={item._id || href} to={href} className={cls}>{item.label}</Link>
                      );
                    })
                  : fallbackNav()}
              </nav>
            </div>

            {/* Center: serif wordmark / logo */}
            <Link to="/" className="justify-self-center flex items-center" aria-label={brand}>
              {store?.logo ? (
                <img src={store.logo} alt={brand} className="h-9 md:h-10 object-contain" />
              ) : (
                <span
                  className="font-display text-2xl md:text-[28px] tracking-[0.18em] uppercase leading-none text-ink"
                  style={{ fontFamily: 'var(--font-family-heading)' }}
                >
                  {brand}
                </span>
              )}
            </Link>

            {/* End: utility text links */}
            <div className="flex items-center justify-end gap-6 text-[11px] tracking-[0.15em] uppercase">
              <div className="hidden md:block">
                <LanguageSwitcher />
              </div>
              <button
                onClick={() => setSearchOpen(!searchOpen)}
                className="hidden md:block text-mute hover:text-ink transition-colors uppercase tracking-[0.15em]"
              >
                {t('theme.header.search')}
              </button>
              <Link to="/account" className="hidden md:block text-mute hover:text-ink transition-colors">
                {t('theme.header.account')}
              </Link>
              <button onClick={openCart} className="relative text-mute hover:text-ink transition-colors uppercase tracking-[0.15em]">
                {t('theme.header.cart')}
                {(cart?.itemCount || 0) > 0 && (
                  <span className="absolute -top-2 -end-3.5 min-w-[16px] h-4 px-1 bg-gold text-black text-[9px] rounded-full flex items-center justify-center font-semibold">
                    {cart?.itemCount}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Expandable search row */}
        {searchOpen && (
          <div className="border-t border-line py-3 px-4 sm:px-8">
            <div className="max-w-xl mx-auto">
              <SearchBar variant="expanded" />
            </div>
          </div>
        )}

      </header>

      <MobileMenu isOpen={menuOpen} onClose={() => setMenuOpen(false)} items={menuItems} />

      <main className="flex-1">
        <Outlet />
      </main>

      {/* ═══ FOOTER ══════════════════════════════════════════════ */}
      <footer className="mt-28 border-t border-line">
        {/* Giant wordmark */}
        <div className="overflow-hidden select-none py-8 md:py-12" aria-hidden>
          <div
            className="font-display text-[17vw] leading-[0.95] uppercase text-center whitespace-nowrap text-ink/90"
            style={{ fontFamily: 'var(--font-family-heading)' }}
          >
            {brand}
          </div>
        </div>

        <div className="max-w-[1440px] mx-auto px-4 sm:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-10 py-14 border-t border-line">
            {/* About */}
            <div className="col-span-2 md:col-span-1">
              <h4 className="text-[11px] tracking-[0.22em] uppercase text-ink mb-5">{t('theme.footer.col_about')}</h4>
              <p className="text-sm text-mute leading-relaxed mb-5">
                {store?.description || t('theme.footer.tagline')}
              </p>
              {socials.length > 0 && (
                <div className="flex items-center gap-4 text-mute">
                  {socials.map(([key, url]) => (
                    <a
                      key={key}
                      href={url as string}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={key}
                      className="hover:text-gold transition-colors"
                    >
                      {SOCIAL_ICONS[key.toLowerCase()]}
                    </a>
                  ))}
                </div>
              )}
            </div>

            {/* Collections */}
            <div>
              <h4 className="text-[11px] tracking-[0.22em] uppercase text-ink mb-5">{t('theme.footer.col_collections')}</h4>
              <div className="space-y-3 text-sm text-mute">
                <Link to="/products" className="block hover:text-ink transition-colors">{t('theme.footer.all_products')}</Link>
                {categories.slice(0, 5).map((cat) => (
                  <Link key={cat._id} to={`/categories/${cat.slug}`} className="block hover:text-ink transition-colors">
                    {cat.name}
                  </Link>
                ))}
              </div>
            </div>

            {/* Information */}
            <div>
              <h4 className="text-[11px] tracking-[0.22em] uppercase text-ink mb-5">{t('theme.footer.col_information')}</h4>
              <div className="space-y-3 text-sm text-mute">
                <Link to="/search" className="block hover:text-ink transition-colors">{t('theme.footer.search')}</Link>
                <Link to="/about" className="block hover:text-ink transition-colors">{t('theme.footer.faqs')}</Link>
                <Link to="/account" className="block hover:text-ink transition-colors">{t('theme.footer.order_tracking')}</Link>
                <Link to="/contact" className="block hover:text-ink transition-colors">{t('theme.footer.contact')}</Link>
              </div>
            </div>

            {/* Newsletter */}
            <div className="col-span-2 md:col-span-1">
              <h4 className="text-[11px] tracking-[0.22em] uppercase text-ink mb-5">{t('theme.footer.col_newsletter')}</h4>
              <p className="text-sm text-mute mb-5">{t('theme.footer.newsletter_subtitle')}</p>
              <form className="flex border border-line focus-within:border-ink transition-colors" onSubmit={(e) => e.preventDefault()}>
                <input
                  type="email"
                  placeholder={t('theme.footer.email_placeholder')}
                  className="flex-1 min-w-0 px-4 py-3 text-sm bg-transparent text-ink placeholder:text-mute focus:outline-none"
                />
                <button
                  type="submit"
                  className="px-5 text-[10px] tracking-[0.22em] uppercase text-ink hover:bg-ink hover:text-black transition-colors"
                >
                  {t('theme.footer.subscribe')}
                </button>
              </form>
            </div>
          </div>

          {/* Copyright */}
          <div className="border-t border-line py-7 flex flex-col sm:flex-row items-center justify-between gap-4 text-[10px] tracking-[0.18em] uppercase text-mute">
            <span>{t('theme.footer.copyright', { year: new Date().getFullYear(), name: brand })}</span>
            <div className="flex items-center gap-2.5">
              {['VISA', 'MC', 'AMEX', 'PP'].map((p) => (
                <span key={p} className="h-6 px-2.5 border border-line text-[9px] font-medium flex items-center text-mute">{p}</span>
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
