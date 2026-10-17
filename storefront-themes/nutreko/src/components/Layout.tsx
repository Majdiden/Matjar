import React, { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useStore } from '@matjar/theme-shared/contexts/StoreContext';
import { useCart } from '@matjar/theme-shared/contexts/CartContext';
import { useCategories } from '@matjar/theme-shared/hooks/useProducts';
import { useMenu, type MenuItem } from '@matjar/theme-shared/hooks/useMenu';
import { useWishlist } from '@matjar/theme-shared/hooks/useWishlist';
import { TOP_STRIP_ANCHOR, useTopStripText } from '@matjar/theme-shared/theme/topStrip';
import CartDrawer from '@matjar/theme-shared/components/CartDrawer';
import { FooterPaymentBadges } from '@matjar/theme-shared/components/commerce/FooterPaymentBadges';
import { LanguageSwitcher } from '@matjar/theme-shared/components/LanguageSwitcher';
import { SocialIcon } from '@matjar/theme-shared/components/pages/PageIcon';
import { useStoreFooter } from '@matjar/theme-shared/hooks/useStoreFooter';
import { SearchBar } from '@matjar/theme-shared/components/navigation/SearchBar';
import { MobileBottomNav } from '@matjar/theme-shared/components/navigation/MobileBottomNav';
import { MobileMenu } from '@matjar/theme-shared/components/navigation/MobileMenu';
import { WishlistHeaderLink } from '@matjar/theme-shared';
import { StoreLogo } from '@matjar/theme-shared/components/StoreLogo';

/**
 * Nutreko Layout — bold black header with lime accent.
 *
 * ─ Lime info strip with the store's own announcement (when set)
 * ─ Black sticky header: chunky wordmark left, uppercase nav center, icons right
 * ─ Black footer with lime highlights
 */

const DARK = 'var(--color-secondary)';
// Store colour (PBI 10-39) on the lime signature areas; lime without one.
const LIME = 'var(--brand, var(--color-primary))';
const ON_LIME = 'var(--brand-contrast, var(--color-secondary))';
// Store colour as text on the black header/footer (lightened so dark colours stay readable).
const LIME_ON_DARK = 'var(--nk-brand-on-dark, var(--color-primary))';

const Layout: React.FC = () => {
  const { t } = useTranslation('theme');
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
  const { items: wishlistItems } = useWishlist();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const barText = useTopStripText();
  const footer = useStoreFooter();

  const storeName = store?.name || 'NUTREKO';
  const brand = storeName.toUpperCase();
  const logo = store?.logo;
  const isActive = (path: string) =>
    location.pathname === path || (path !== '/' && location.pathname.startsWith(path));

  return (
    <div className="min-h-screen flex flex-col bg-white" style={{ color: DARK }}>
      {/* ═══ TOP STRIP (lime) ══════════════════════════════════════ */}
      {barText && (
        <div data-section-id={TOP_STRIP_ANCHOR} className="text-[11px] tracking-[0.2em] font-bold py-2.5" style={{ backgroundColor: LIME, color: ON_LIME }}>
          <div className="max-w-7xl mx-auto px-4 flex items-center justify-center gap-8">
            <span className="flex items-center gap-2"><svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 shrink-0" aria-hidden="true"><path d="M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.62L12 2 9.19 8.62 2 9.24l5.46 4.73L5.82 21 12 17.27Z" /></svg>{barText}</span>
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
            {/* Logo (when the store has one) + wordmark. The name keeps a
                font-derived line box and a little block padding so the
                truncate clip never cuts Arabic marks or descenders. */}
            <Link
              to="/"
              aria-label={storeName}
              className="flex min-w-0 flex-1 items-center justify-center gap-2.5 md:flex-none md:justify-start md:gap-3"
            >
              {logo && (
                <span className="shrink-0 rounded-lg bg-white p-1">
                  <StoreLogo src={logo} alt={storeName} className="block h-10 w-auto max-w-[96px] rounded-md object-contain md:h-10 md:max-w-[150px]" />
                </span>
              )}
              <span
                className={`font-display min-w-0 line-clamp-2 [overflow-wrap:anywhere] max-lg:!text-[1.0625rem] max-lg:![line-height:1.3] lg:line-clamp-1 py-[0.12em] [line-height:normal] tracking-tighter ${logo ? 'text-2xl md:text-3xl' : 'text-3xl md:text-4xl'}`}
                style={{ fontFamily: 'var(--font-family-heading)' }}
              >
                {brand}<span style={{ color: LIME_ON_DARK }}>.</span>
              </span>
            </Link>

            {/* Nav (hidden on mobile) */}
            <nav className="hidden md:flex items-center gap-7 text-[12px] tracking-[0.15em] uppercase font-bold">
              {hasMenu ? (
                menuItems.map((item) => {
                  const cls = 'hover:text-[var(--nk-brand-on-dark,var(--color-primary))]';
                  const href = itemHref(item);
                  return isExternal(item) ? (
                    <a key={item._id || href} href={href} target={item.target || '_blank'} rel="noopener noreferrer" className={cls}>{item.label}</a>
                  ) : (
                    <Link key={item._id || href} to={href} className={cls}>{item.label}</Link>
                  );
                })
              ) : (
                <>
                  <Link to="/" className={isActive('/') && location.pathname === '/' ? 'text-[var(--nk-brand-on-dark,var(--color-primary))]' : 'hover:text-[var(--nk-brand-on-dark,var(--color-primary))]'}>{t('theme.nav.home')}</Link>
                  <Link to="/products" className={isActive('/products') ? 'text-[var(--nk-brand-on-dark,var(--color-primary))]' : 'hover:text-[var(--nk-brand-on-dark,var(--color-primary))]'}>{t('theme.nav.shop_all')}</Link>
                  {categories.slice(0, 4).map((cat) => (
                    <Link key={cat._id} to={`/categories/${cat.slug}`} className="hover:text-[var(--nk-brand-on-dark,var(--color-primary))]">
                      {cat.name}
                    </Link>
                  ))}
                  <Link to="/about" className="hover:text-[var(--nk-brand-on-dark,var(--color-primary))]">{t('theme.nav.about')}</Link>
                </>
              )}
            </nav>

            {/* Icons (desktop only — mobile uses the drawer + bottom nav) */}
            <div className="hidden md:flex items-center gap-4 md:gap-5 text-white">
              <LanguageSwitcher className="text-white hover:text-[var(--nk-brand-on-dark,var(--color-primary))]" />
              <SearchBar variant="compact" className="text-white hover:text-[var(--nk-brand-on-dark,var(--color-primary))] hover:bg-white/10" />
              <Link to="/wishlist" aria-label={t('common:aria.wishlist')} className="relative hover:text-[var(--nk-brand-on-dark,var(--color-primary))] hidden md:block">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                </svg>
                {wishlistItems.length > 0 && (
                  <span className="absolute -top-2 -end-2 min-w-[18px] h-[18px] px-1 text-[10px] rounded-full flex items-center justify-center font-black" style={{ backgroundColor: LIME, color: ON_LIME }}>
                    {wishlistItems.length}
                  </span>
                )}
              </Link>
              <Link to="/account" aria-label={t('common:aria.account')} className="hover:text-[var(--nk-brand-on-dark,var(--color-primary))] hidden md:block">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                </svg>
              </Link>
              <button onClick={openCart} aria-label={t('common:aria.cart')} className="relative hover:text-[var(--nk-brand-on-dark,var(--color-primary))] hidden md:block">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
                </svg>
                {(cart?.itemCount || 0) > 0 && (
                  <span className="absolute -top-2 -end-2 min-w-[18px] h-[18px] px-1 text-[10px] rounded-full flex items-center justify-center font-black" style={{ backgroundColor: LIME, color: ON_LIME }}>
                    {cart?.itemCount}
                  </span>
                )}
              </button>
            </div>

            {/* Phone: wishlist heart (cart, search and account live in the bottom nav) */}
            <WishlistHeaderLink
              className="md:hidden relative inline-flex h-10 w-10 items-center justify-center -me-2 text-white"
              iconClassName="w-6 h-6"
              badgeClassName="absolute top-0 end-0 min-w-[18px] h-[18px] px-1 text-[10px] rounded-full flex items-center justify-center font-black bg-[var(--brand,var(--color-primary))] text-[var(--brand-contrast,var(--color-secondary))]"
            />
          </div>
        </div>

      </header>

      <MobileMenu isOpen={menuOpen} onClose={() => setMenuOpen(false)} items={menuItems} />

      <main className="flex-1">
        <Outlet />
      </main>

      {/* ═══ FOOTER (black) — content from the store's own data ═══ */}
      <footer className="mt-20 pt-16 pb-6 bg-black text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-10 mb-12">
            <div className="md:col-span-2">
              {footer.logo ? (
                <span className="mb-5 inline-block rounded-xl bg-white p-2">
                  <img src={footer.logo} alt={footer.storeName} className="block h-16 w-auto max-w-[220px] rounded-lg object-contain md:h-[72px]" />
                </span>
              ) : (
                <div className="font-display text-4xl mb-4 py-[0.12em] [line-height:normal]" style={{ fontFamily: 'var(--font-family-heading)' }}>
                  {brand}<span style={{ color: LIME_ON_DARK }}>.</span>
                </div>
              )}
              {footer.description && (
                <p className="text-sm mb-5 max-w-xs text-white/60">{footer.description}</p>
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
                      className="w-10 h-10 border-2 border-white/20 flex items-center justify-center hover:border-[var(--brand,var(--color-primary))] hover:text-[var(--nk-brand-on-dark,var(--color-primary))] transition"
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
                  <h4 className="text-[11px] tracking-[0.22em] uppercase font-black mb-5" style={{ color: LIME_ON_DARK }}>{col.title}</h4>
                  <div className="space-y-3 text-sm text-white/70">
                    {col.links.map((l) => (
                      <Link key={l.to} to={l.to} className="block hover:text-white transition">{l.label}</Link>
                    ))}
                  </div>
                </div>
              ))}
          </div>
          <div className="border-t border-white/10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-white/50">
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
