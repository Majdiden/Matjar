import React from 'react';
import { Outlet, Link } from 'react-router-dom';
import { useStore } from '@shared/contexts/StoreContext';
import { useCart } from '@shared/contexts/CartContext';
import { useCategories } from '@shared/hooks/useProducts';
import { SearchBar } from '@shared/components/navigation/SearchBar';
import { MobileBottomNav } from '@shared/components/navigation/MobileBottomNav';
import CartDrawer from '@shared/components/CartDrawer';
import { useTranslation } from 'react-i18next';

const Layout: React.FC = () => {
  const { store } = useStore();
  const { cart, isOpen: cartOpen, openCart, closeCart } = useCart();
  const { categories } = useCategories();
  const { t } = useTranslation(['theme']);

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
              <Link to="/products" className="text-sm transition hover:opacity-80" style={{ color: 'var(--color-muted)' }}>{t('theme.nav.products')}</Link>
              {categories.slice(0, 3).map(cat => (
                <Link key={cat._id} to={`/categories/${cat.slug}`} className="text-sm transition hover:opacity-80" style={{ color: 'var(--color-muted)' }}>
                  {cat.name}
                </Link>
              ))}
            </nav>

            <div className="flex items-center gap-3">
              <SearchBar variant="compact" className="hover:opacity-80" />
              <button onClick={openCart} className="relative hover:opacity-80" style={{ color: 'var(--color-muted)' }}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
                {cart && cart.itemCount > 0 && (
                  <span
                    className="absolute -top-1.5 -right-1.5 w-4 h-4 text-white text-[10px] rounded-full flex items-center justify-center"
                    style={{ backgroundColor: 'var(--color-primary)' }}
                  >
                    {cart.itemCount}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

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
              <span className="cursor-pointer transition hover:opacity-80">{t('theme.footer.about')}</span>
              <Link to="/contact" className="transition hover:opacity-80">{t('theme.footer.contact')}</Link>
            </div>
          </div>
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
