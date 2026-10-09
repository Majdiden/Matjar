import React, { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useStore } from '@matjar/theme-shared/contexts/StoreContext';
import { useCart } from '@matjar/theme-shared/contexts/CartContext';
import { useWishlist } from '@matjar/theme-shared/hooks/useWishlist';
import { useCategories } from '@matjar/theme-shared/hooks/useProducts';
import { useMenu, type MenuItem } from '@matjar/theme-shared/hooks/useMenu';
import { TOP_STRIP_ANCHOR, useTopStripText } from '@matjar/theme-shared/theme/topStrip';
import CartDrawer from '@matjar/theme-shared/components/CartDrawer';
import { FooterPaymentBadges } from '@matjar/theme-shared/components/commerce/FooterPaymentBadges';
import { LanguageSwitcher } from '@matjar/theme-shared/components/LanguageSwitcher';
import { SocialIcon, WhatsAppIcon } from '@matjar/theme-shared/components/pages/PageIcon';
import { useStoreFooter } from '@matjar/theme-shared/hooks/useStoreFooter';
import { SearchBar } from '@matjar/theme-shared/components/navigation/SearchBar';
import { MobileBottomNav } from '@matjar/theme-shared/components/navigation/MobileBottomNav';
import { MobileMenu } from '@matjar/theme-shared/components/navigation/MobileMenu';
import { AnnouncementBar } from '@matjar/theme-shared/components/marketing/AnnouncementBar';
import { useTranslation } from 'react-i18next';

/**
 * TechHub Layout — TONMART-style chrome.
 *
 * Header is a two-row affair on desktop:
 *   • Row 1 (dark navy): TONMART wordmark + primary nav + utility links
 *   • Row 2 (white): "Browse all collection" pill + big rounded search
 *     bar + account / wishlist / cart icons
 *
 * Footer is dark navy with a green wordmark, the store's link columns and
 * a contact strip (store data only).
 */
// The header/footer are a deep navy so the green wordmark + green accents
// stay legible. (`--color-secondary` is a green tint, which renders the
// "navy" chrome green-on-green and makes the wordmark/phone unreadable.)
const NAVY = '#0f172a';

const Layout: React.FC = () => {
  const { store } = useStore();
  const { cart, isOpen: cartOpen, openCart, closeCart } = useCart();
  const { count: wishlistCount } = useWishlist();
  const { categories } = useCategories();
  // Store-managed header nav. When present it drives the nav; while
  // loading/empty we fall back to the category list so nav never disappears.
  const { items: menuItems } = useMenu('header');
  // Footer content comes from the store's own data (categories, policies,
  // contact details, social pages) — no theme demo links.
  const footer = useStoreFooter();
  const hasMenu = menuItems.length > 0;
  const itemHref = (item: MenuItem) => item.resolvedUrl || item.url || '/';
  const isExternal = (item: MenuItem) =>
    item.type === 'external' || item.target === '_blank';
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [collectionOpen, setCollectionOpen] = useState(false);
  const { t } = useTranslation(['theme']);

  const announcementText = useTopStripText();

  const isActive = (path: string) =>
    location.pathname === path || (path !== '/' && location.pathname.startsWith(path));

  const brandName = (store?.name || 'TECHHUB').toUpperCase();

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: 'var(--color-background)', color: 'var(--color-foreground)' }}
    >
      {announcementText && (
        <div data-section-id={TOP_STRIP_ANCHOR}>
          <AnnouncementBar
            message={announcementText}
            bgColor="var(--color-secondary)"
            textColor="var(--color-background)"
            dismissible={false}
          />
        </div>
      )}

      {/* ═══ HEADER — Row 1: navy nav bar ═════════════════════════ */}
      <header className="sticky top-0 z-40" style={{ backgroundColor: NAVY }}>
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-16 gap-6">
            <Link to="/" className="text-2xl md:text-3xl font-black tracking-tight text-white shrink-0">
              {brandName}
            </Link>

            <nav className="hidden lg:flex items-center gap-8 flex-1 justify-center">
              {hasMenu ? (
                menuItems.map((item) => {
                  const cls = "text-sm font-semibold transition-colors";
                  const href = itemHref(item);
                  return isExternal(item) ? (
                    <a key={item._id || href} href={href} target={item.target || '_blank'} rel="noopener noreferrer" className={cls} style={{ color: 'var(--color-background)' }}>{item.label}</a>
                  ) : (
                    <Link key={item._id || href} to={href} className={cls} style={{ color: isActive(href) ? 'var(--color-primary)' : 'var(--color-background)' }}>{item.label}</Link>
                  );
                })
              ) : (
                <>
                  <Link to="/" className="text-sm font-semibold transition-colors" style={{ color: isActive('/') && location.pathname === '/' ? 'var(--color-primary)' : 'var(--color-background)' }}>{t('theme.nav.home')}</Link>
                  <Link to="/products" className="text-sm font-semibold text-white hover:opacity-80 transition">{t('theme.nav.collections')}</Link>
                  <Link to="/products" className="text-sm font-semibold text-white hover:opacity-80 transition">{t('theme.nav.products')}</Link>
                  {categories.slice(0, 2).map((cat) => (
                    <Link
                      key={cat._id}
                      to={`/categories/${cat.slug}`}
                      className="text-sm font-semibold transition-colors"
                      style={{ color: isActive(`/categories/${cat.slug}`) ? 'var(--color-primary)' : 'var(--color-background)' }}
                    >
                      {cat.name}
                    </Link>
                  ))}
                </>
              )}
            </nav>

            {/* The store's own phone number only — hidden when it has none. */}
            {footer.contact.phone && (
              <div className="hidden md:flex items-center gap-5 text-xs text-white">
                <span className="flex items-center gap-1.5">
                  <svg className="w-4 h-4" style={{ color: 'var(--color-primary)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h2l2 5-3 2a12 12 0 006 6l2-3 5 2v2a2 2 0 01-2 2A16 16 0 013 5z" />
                  </svg>
                  <span className="whitespace-nowrap">
                    {t('theme.nav.call_us')}{' '}
                    {footer.contact.phone.href ? (
                      <a href={footer.contact.phone.href} dir="ltr" style={{ color: 'var(--color-primary)' }}>{footer.contact.phone.text}</a>
                    ) : (
                      <span dir="ltr" style={{ color: 'var(--color-primary)' }}>{footer.contact.phone.text}</span>
                    )}
                  </span>
                </span>
              </div>
            )}

            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="lg:hidden text-white"
              aria-label={t('common:aria.toggle_menu')}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={menuOpen ? 'M6 18L18 6M6 6l12 12' : 'M4 6h16M4 12h16M4 18h16'} />
              </svg>
            </button>
          </div>
        </div>

        {/* ═══ HEADER — Row 2: white search bar ═════════════════ */}
        <div className="hidden md:block border-t" style={{ backgroundColor: 'var(--color-background)', borderColor: 'rgba(255,255,255,0.06)' }}>
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex items-center gap-4 py-3">
              <button
                onClick={() => setCollectionOpen(!collectionOpen)}
                className="flex items-center gap-3 px-5 py-3 rounded-lg text-xs font-bold uppercase tracking-wider text-white whitespace-nowrap transition"
                style={{ backgroundColor: 'var(--color-primary)' }}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
                {t('theme.nav.browse_all')}
              </button>

              <div className="flex-1">
                <SearchBar placeholder={t('theme.nav.search_placeholder')} variant="expanded" />
              </div>

              <LanguageSwitcher />

              <Link
                to="/account"
                className="hidden lg:flex items-center gap-2 text-xs shrink-0"
                aria-label={t('common:aria.account')}
                style={{ color: 'var(--color-foreground)' }}
              >
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14c-4 0-7 2-7 6h14c0-4-3-6-7-6z" />
                </svg>
                <div className="leading-tight">
                  <div className="font-bold text-sm">{t('theme.nav.account')}</div>
                  <div style={{ color: 'var(--color-muted)' }}>{t('theme.nav.hello_login')}</div>
                </div>
              </Link>

              <Link
                to="/wishlist"
                className="relative h-10 w-10 flex items-center justify-center shrink-0"
                aria-label={t('common:aria.wishlist')}
                style={{ color: 'var(--color-foreground)' }}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 016.364 0L12 7.636l1.318-1.318a4.5 4.5 0 116.364 6.364L12 20.364l-7.682-7.682a4.5 4.5 0 010-6.364z" />
                </svg>
                {wishlistCount > 0 && (
                  <span className="absolute -top-0.5 -end-0.5 w-5 h-5 text-white text-[10px] rounded-full flex items-center justify-center font-bold" style={{ backgroundColor: 'var(--color-primary)' }}>{wishlistCount}</span>
                )}
              </Link>

              <button
                onClick={openCart}
                className="relative h-10 w-10 flex items-center justify-center shrink-0"
                aria-label={t('common:aria.open_cart')}
                style={{ color: 'var(--color-foreground)' }}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
                </svg>
                <span
                  className="absolute -top-0.5 -end-0.5 w-5 h-5 text-white text-[10px] rounded-full flex items-center justify-center font-bold"
                  style={{ backgroundColor: 'var(--color-primary)' }}
                >
                  {cart?.itemCount || 0}
                </span>
              </button>
            </div>
          </div>

          {/* Browse-all-collection dropdown */}
          {collectionOpen && (
            <div
              className="absolute start-0 end-0 border-t shadow-lg"
              style={{ backgroundColor: 'var(--color-background)', borderColor: 'var(--color-border)' }}
            >
              <div className="max-w-7xl mx-auto px-4 py-4 grid grid-cols-2 lg:grid-cols-4 gap-2">
                {categories.slice(0, 12).map((cat) => (
                  <Link
                    key={cat._id}
                    to={`/categories/${cat.slug}`}
                    onClick={() => setCollectionOpen(false)}
                    className="px-3 py-2 text-sm rounded hover:bg-slate-50 transition"
                    style={{ color: 'var(--color-foreground)' }}
                  >
                    {cat.name}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

      </header>

      <MobileMenu isOpen={menuOpen} onClose={() => setMenuOpen(false)} items={menuItems} />

      <main className="flex-1">
        <Outlet />
      </main>

      {/* ═══ FOOTER — dark navy, content from the store's own data ═══ */}
      {/* pb is larger on mobile so the fixed MobileBottomNav (md:hidden) never
          covers the copyright row; collapses back to a tight pad from md up. */}
      <footer className="pt-16 pb-24 md:pb-4 mt-12 text-slate-300" style={{ backgroundColor: NAVY }}>
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-10">
            <div>
              {footer.logo ? (
                <img src={footer.logo} alt={footer.storeName} className="h-10 w-auto mb-4 object-contain" />
              ) : (
                <h3 className="text-2xl font-black tracking-tight mb-4" style={{ color: 'var(--color-primary)' }}>
                  {brandName}
                </h3>
              )}
              {footer.description && (
                <p className="text-sm mb-5 text-slate-400">{footer.description}</p>
              )}
              {footer.social.length > 0 && (
                <div className="flex items-center gap-2">
                  {footer.social.map((s) => (
                    <a
                      key={s.platform}
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={s.name}
                      className="h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition text-white"
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
                  <h4 className="font-bold text-sm mb-4 uppercase tracking-wide text-white">{col.title}</h4>
                  <div className="space-y-2.5 text-sm text-slate-400">
                    {col.links.map((l) => (
                      <Link key={l.to} to={l.to} className="block hover:text-white transition">{l.label}</Link>
                    ))}
                  </div>
                </div>
              ))}
          </div>

          {/* Contact strip — only the details the merchant has set */}
          {(footer.contact.phone || footer.contact.email || footer.contact.whatsapp || footer.contact.address) && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 py-6 border-y border-white/10 text-sm">
              {footer.contact.phone && (
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5 shrink-0" style={{ color: 'var(--color-primary)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h2l2 5-3 2a12 12 0 006 6l2-3 5 2v2a2 2 0 01-2 2A16 16 0 013 5z" />
                  </svg>
                  <span className="text-white font-semibold">{t('theme.footer.available_by_phone')}</span>
                  {footer.contact.phone.href ? (
                    <a href={footer.contact.phone.href} dir="ltr" style={{ color: 'var(--color-primary)' }}>{footer.contact.phone.text}</a>
                  ) : (
                    <span dir="ltr" style={{ color: 'var(--color-primary)' }}>{footer.contact.phone.text}</span>
                  )}
                </div>
              )}
              {footer.contact.whatsapp && (
                <div className="flex items-center gap-3">
                  <span style={{ color: 'var(--color-primary)' }}><WhatsAppIcon className="w-5 h-5 shrink-0" /></span>
                  <span className="text-white font-semibold">WhatsApp</span>
                  <a href={footer.contact.whatsapp.href} target="_blank" rel="noopener noreferrer" dir="ltr" className="text-slate-400 hover:text-white">
                    {footer.contact.whatsapp.display}
                  </a>
                </div>
              )}
              {footer.contact.email && (
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5 shrink-0" style={{ color: 'var(--color-primary)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l9 6 9-6M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <span className="text-white font-semibold">{t('theme.footer.email_label')}</span>
                  <a href={`mailto:${footer.contact.email}`} className="text-slate-400 hover:text-white">{footer.contact.email}</a>
                </div>
              )}
              {footer.contact.address && (
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5 shrink-0" style={{ color: 'var(--color-primary)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0zM19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                  </svg>
                  <span className="text-slate-400">{footer.contact.address}</span>
                </div>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-4 pt-6 text-xs text-slate-400">
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
