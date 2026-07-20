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
import { LanguageSwitcher } from '@matjar/theme-shared/components/LanguageSwitcher';
import { PolicyLinks } from '@matjar/theme-shared/components/PolicyLinks';
import { useTranslation } from 'react-i18next';

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
      {/* Ultra-clean sticky header */}
      <header
        className="sticky top-0 z-50 border-b"
        style={{
          backgroundColor: 'var(--color-background)',
          borderColor: 'var(--color-border)',
        }}
      >
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex items-center justify-between h-14">
            <Link
              to="/"
              className="text-lg font-bold"
              style={{
                color: 'var(--color-foreground)',
                fontFamily: 'var(--font-family-heading)',
              }}
            >
              {store?.name || 'Store'}
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

            <div className="flex items-center gap-3">
              {/* Language switcher — desktop only; on mobile it lives in the drawer below */}
              <div className="hidden md:flex items-center">
                <LanguageSwitcher />
              </div>
              {/* Search — desktop only; mobile search lives in the bottom nav */}
              <div className="hidden md:block">
                <SearchBar variant="compact" className="hover:opacity-80" />
              </div>
              <button onClick={openCart} className="relative hover:opacity-80 hidden md:block" style={{ color: 'var(--color-muted)' }}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
                {cart && cart.itemCount > 0 && (
                  <span
                    className="absolute -top-1.5 -end-1.5 w-4 h-4 text-white text-[10px] rounded-full flex items-center justify-center"
                    style={{ backgroundColor: 'var(--color-primary)' }}
                  >
                    {cart.itemCount}
                  </span>
                )}
              </button>

              {/* Mobile hamburger toggle */}
              <button
                className="md:hidden hover:opacity-80"
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
          backgroundColor: 'var(--color-background)',
          borderColor: 'var(--color-border)',
        }}
      >
        <div className="max-w-6xl mx-auto px-4">
          <div
            className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm"
            style={{ color: 'var(--color-muted)' }}
          >
            <p>{t('theme.footer.copyright_html', { year: new Date().getFullYear(), name: store?.name || 'Store' })}</p>
            <div className="flex gap-6">
              <Link to="/products" className="transition hover:opacity-80">{t('theme.footer.products')}</Link>
              <Link to="/about" className="transition hover:opacity-80">{t('theme.footer.about')}</Link>
              <Link to="/contact" className="transition hover:opacity-80">{t('theme.footer.contact')}</Link>
              <PolicyLinks inline className="contents" linkClassName="transition hover:opacity-80" />
            </div>
          </div>
          {/* Store contact details (from Settings → Policies) — only when set. */}
          {(store?.contact?.email || store?.contact?.phone || store?.contact?.address) && (
            <div
              className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-center text-sm"
              style={{ color: 'var(--color-muted)' }}
            >
              {store?.contact?.email && (
                <a href={`mailto:${store.contact.email}`} className="transition hover:opacity-80">{store.contact.email}</a>
              )}
              {store?.contact?.phone && (
                <a href={`tel:${store.contact.phone}`} dir="ltr" className="transition hover:opacity-80">{store.contact.phone}</a>
              )}
              {store?.contact?.address && <span>{store.contact.address}</span>}
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
