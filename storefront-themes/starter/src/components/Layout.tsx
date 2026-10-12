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
import { LanguageSwitcher } from '@matjar/theme-shared/components/LanguageSwitcher';
import { useStoreFooter } from '@matjar/theme-shared/hooks/useStoreFooter';
import { SocialIcon, WhatsAppIcon } from '@matjar/theme-shared/components/pages/PageIcon';
import { useTranslation } from 'react-i18next';
import { useTopStripText, TOP_STRIP_ANCHOR } from '@matjar/theme-shared/theme/topStrip';

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
  const { t } = useTranslation(['theme']);
  const topStripText = useTopStripText();
  const footer = useStoreFooter();
  const hasContact = !!(footer.contact.email || footer.contact.phone || footer.contact.whatsapp || footer.contact.address);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{
        backgroundColor: 'var(--color-background)',
        color: 'var(--color-foreground)',
        fontFamily: 'var(--font-family)',
      }}
    >
      {/* Top strip — the merchant's announcement text (My Store), on every page */}
      {topStripText && (
        <div
          data-section-id={TOP_STRIP_ANCHOR}
          className="min-h-9 px-4 py-2 flex items-center justify-center text-center text-xs font-medium"
          style={{ backgroundColor: 'var(--brand, var(--color-primary))', color: 'var(--brand-contrast, #ffffff)' }}
        >
          {topStripText}
        </div>
      )}

      {/* Ultra-clean sticky header */}
      <header
        className="sticky top-0 z-50 border-b"
        style={{
          backgroundColor: 'var(--color-background)',
          borderColor: 'var(--color-border)',
          // A thin line in the store's colour along the top (none without one).
          boxShadow: 'inset 0 3px 0 var(--brand, transparent)',
        }}
      >
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex items-center justify-between gap-3 h-14">
            {/* Logo (when set) + name on one line. The name keeps a roomy
                line box so `truncate`'s overflow clip never cuts Arabic
                descenders/marks. */}
            <Link
              to="/"
              className="flex items-center gap-2 min-w-0"
              style={{
                color: 'var(--brand-ink, var(--color-foreground))',
                fontFamily: 'var(--font-family-heading)',
              }}
            >
              {store?.logo && (
                <img
                  src={store.logo}
                  alt={store.name || 'Store'}
                  className="h-8 md:h-10 w-auto max-w-[80px] md:max-w-[120px] shrink-0 object-contain rounded-md"
                />
              )}
              <span className="block min-w-0 truncate text-lg font-bold leading-[1.6] py-0.5">
                {store?.name || 'Store'}
              </span>
            </Link>

            <nav className="hidden md:flex items-center gap-5">
              {hasMenu ? (
                menuItems.map(item => {
                  const cls = "text-sm transition hover:opacity-80";
                  const href = itemHref(item);
                  return isExternal(item) ? (
                    <a key={item._id || href} href={href} target={item.target || '_blank'} rel="noopener noreferrer" className={cls} style={{ color: 'var(--color-muted)' }}>{item.label}</a>
                  ) : (
                    <Link key={item._id || href} to={href} className={cls} style={{ color: 'var(--color-muted)' }}>{item.label}</Link>
                  );
                })
              ) : (
                <>
                  <Link to="/products" className="text-sm transition hover:opacity-80" style={{ color: 'var(--color-muted)' }}>{t('theme.nav.products')}</Link>
                  {categories.slice(0, 3).map(cat => (
                    <Link key={cat._id} to={`/categories/${cat.slug}`} className="text-sm transition hover:opacity-80" style={{ color: 'var(--color-muted)' }}>
                      {cat.name}
                    </Link>
                  ))}
                </>
              )}
            </nav>

            <div className="flex items-center gap-3 shrink-0">
              {/* Language switcher — desktop only; on mobile it lives in the drawer below */}
              <div className="hidden md:flex items-center">
                <LanguageSwitcher />
              </div>
              {/* Search — desktop only; mobile search lives in the bottom nav */}
              <div className="hidden md:block">
                <SearchBar variant="compact" className="hover:opacity-80" />
              </div>
<WishlistHeaderLink
                className="relative inline-flex h-10 w-10 -mx-2.5 items-center justify-center hover:opacity-80 text-[var(--color-muted)]"
                iconClassName="w-5 h-5"
                icon={
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                  </svg>
                }
                badgeClassName="absolute top-1 end-1 w-4 h-4 bg-[var(--brand,var(--color-primary))] text-[var(--brand-contrast,#fff)] text-[10px] rounded-full flex items-center justify-center"
              />
              <button onClick={openCart} className="relative hover:opacity-80 hidden md:block" style={{ color: 'var(--color-muted)' }}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
                {cart && cart.itemCount > 0 && (
                  <span
                    className="absolute -top-1.5 -end-1.5 w-4 h-4 text-[var(--brand-contrast,#fff)] text-[10px] rounded-full flex items-center justify-center"
                    style={{ backgroundColor: 'var(--brand, var(--color-primary))' }}
                  >
                    {cart.itemCount}
                  </span>
                )}
              </button>

              {/* Mobile hamburger toggle */}
              <button
                className="md:hidden inline-flex h-10 w-10 -me-2 items-center justify-center hover:opacity-80"
                style={{ color: 'var(--color-foreground)' }}
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                aria-label={t('common:aria.menu')}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {mobileMenuOpen
                    ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  }
                </svg>
              </button>
            </div>
          </div>

        </div>
      </header>

      {/* Full-screen slide-over menu */}
      <MobileMenu
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        items={menuItems}
      />

      <main className="flex-1"><Outlet /></main>

      {/* Simple footer */}
      <footer
        className="border-t py-8"
        style={{
          backgroundColor: 'var(--brand-soft, var(--color-background))',
          borderColor: 'var(--color-border)',
        }}
      >
        <div className="max-w-6xl mx-auto px-4">
          {/* Store logo — clearly visible above the footer links. */}
          {footer.logo && (
            <div className="flex justify-center mb-6">
              <img
                src={footer.logo}
                alt={footer.storeName}
                className="h-14 md:h-16 w-auto max-w-[220px] object-contain rounded-lg"
              />
            </div>
          )}
          <div
            className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm"
            style={{ color: 'var(--color-muted)' }}
          >
            <p>{footer.copyright}</p>
            <nav className="flex flex-wrap justify-center gap-x-6 gap-y-2">
              {[...footer.shop, ...footer.help, ...footer.policies].map((l) => (
                <Link key={l.to} to={l.to} className="transition hover:opacity-80">{l.label}</Link>
              ))}
            </nav>
          </div>
          {/* Store contact details and social pages — only the ones set. */}
          {(hasContact || footer.social.length > 0) && (
            <div
              className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-center text-sm"
              style={{ color: 'var(--color-muted)' }}
            >
              {footer.contact.email && (
                <a href={`mailto:${footer.contact.email}`} className="transition hover:opacity-80">{footer.contact.email}</a>
              )}
              {footer.contact.phone && (
                footer.contact.phone.href
                  ? <a href={footer.contact.phone.href} dir="ltr" className="transition hover:opacity-80">{footer.contact.phone.text}</a>
                  : <span dir="ltr">{footer.contact.phone.text}</span>
              )}
              {footer.contact.whatsapp && (
                <a href={footer.contact.whatsapp.href} target="_blank" rel="noopener noreferrer" dir="ltr" className="inline-flex items-center gap-1.5 transition hover:opacity-80">
                  <WhatsAppIcon className="w-4 h-4" />
                  {footer.contact.whatsapp.display}
                </a>
              )}
              {footer.contact.address && <span>{footer.contact.address}</span>}
              {footer.social.map((s) => (
                <a
                  key={s.platform}
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={s.name}
                  className="transition hover:opacity-80"
                >
                  <SocialIcon platform={s.platform} className="w-4 h-4" />
                </a>
              ))}
            </div>
          )}
        </div>
      </footer>

      {/* Mobile Bottom Nav */}
      <MobileBottomNav onCartClick={openCart} />

      {/* Cart Drawer */}
      <CartDrawer isOpen={cartOpen} onClose={closeCart} />
    </div>
  );
};

export default Layout;
