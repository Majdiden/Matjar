import React, { useState } from 'react';
import { Outlet, Link } from 'react-router-dom';
import { useStore } from '@shared/contexts/StoreContext';
import { useCart } from '@shared/contexts/CartContext';
import { useCategories } from '@shared/hooks/useProducts';
import { SearchBar } from '@shared/components/navigation/SearchBar';
import { MobileBottomNav } from '@shared/components/navigation/MobileBottomNav';
import { AnnouncementBar } from '@shared/components/marketing/AnnouncementBar';
import CartDrawer from '@shared/components/CartDrawer';
import { useTranslation } from 'react-i18next';

const Layout: React.FC = () => {
  const { store } = useStore();
  const { cart, isOpen: cartOpen, openCart, closeCart } = useCart();
  const { categories } = useCategories();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { t } = useTranslation(['theme']);

  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-background)] pb-16 md:pb-0">
      {/* Announcement Bar */}
      <AnnouncementBar
        message={t('theme.layout.announcement')}
        href="/products"
        linkText={t('theme.layout.announcement_link')}
        className="bg-[var(--color-primary)] text-[var(--color-border)]"
      />

      {/* Header */}
      <header className="sticky top-0 z-30 bg-[var(--color-background)]/95 backdrop-blur-md border-b border-[var(--color-border)]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex items-center justify-between h-20">
            {/* Logo */}
            <Link to="/" className="shrink-0">
              <span className="text-2xl font-bold text-[var(--color-primary)] italic tracking-wide">
                {store?.name || 'Artisan'}
              </span>
            </Link>

            {/* Desktop Nav */}
            <nav className="hidden lg:flex items-center gap-1">
              <Link to="/" className="px-3 py-2 text-sm text-[var(--color-primary)]/70 hover:text-[var(--color-primary)] transition">{t('theme.layout.nav.home')}</Link>
              <Link to="/products" className="px-3 py-2 text-sm text-[var(--color-primary)]/70 hover:text-[var(--color-primary)] transition">{t('theme.layout.nav.collection')}</Link>
              {categories.slice(0, 4).map(cat => (
                <Link
                  key={cat._id}
                  to={`/categories/${cat.slug}`}
                  className="px-3 py-2 text-sm text-[var(--color-primary)]/70 hover:text-[var(--color-primary)] transition"
                >
                  {cat.name}
                </Link>
              ))}
              <Link to="/about" className="px-3 py-2 text-sm text-[var(--color-primary)]/70 hover:text-[var(--color-primary)] transition">{t('theme.layout.nav.our_story')}</Link>
            </nav>

            {/* Right Actions */}
            <div className="flex items-center gap-2">
              {/* Desktop Search */}
              <div className="hidden md:block w-56">
                <SearchBar placeholder={t('theme.products.search_placeholder')} className="w-full" />
              </div>

              {/* Mobile Search */}
              <SearchBar variant="compact" className="md:hidden text-[var(--color-primary)]/60 hover:text-[var(--color-primary)]" />

              {/* Cart */}
              <button
                onClick={openCart}
                className="relative p-2 text-[var(--color-primary)]/60 hover:text-[var(--color-primary)] transition"
                aria-label="Cart"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
                {cart && cart.itemCount > 0 && (
                  <span className="absolute -top-0.5 -end-0.5 min-w-[16px] h-[16px] rounded-full bg-[var(--color-accent)] text-white text-[10px] font-bold flex items-center justify-center px-1">
                    {cart.itemCount > 99 ? '99+' : cart.itemCount}
                  </span>
                )}
              </button>

              {/* Mobile menu toggle */}
              <button
                className="lg:hidden p-2 text-[var(--color-primary)]/60 hover:text-[var(--color-primary)] transition"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                aria-label="Menu"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {mobileMenuOpen
                    ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                    : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
                  }
                </svg>
              </button>
            </div>
          </div>

          {/* Mobile Nav */}
          {mobileMenuOpen && (
            <nav className="lg:hidden pb-4 border-t border-[var(--color-border)] pt-3 space-y-1">
              <Link to="/" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2.5 text-sm text-[var(--color-primary)]/80 hover:text-[var(--color-primary)] hover:bg-[var(--color-muted)]/20 rounded-lg">{t('theme.layout.nav.home')}</Link>
              <Link to="/products" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2.5 text-sm text-[var(--color-primary)]/80 hover:text-[var(--color-primary)] hover:bg-[var(--color-muted)]/20 rounded-lg">{t('theme.layout.nav.collection')}</Link>
              {categories.slice(0, 6).map(cat => (
                <Link
                  key={cat._id}
                  to={`/categories/${cat.slug}`}
                  onClick={() => setMobileMenuOpen(false)}
                  className="block px-3 py-2.5 text-sm text-[var(--color-primary)]/80 hover:text-[var(--color-primary)] hover:bg-[var(--color-muted)]/20 rounded-lg"
                >
                  {cat.name}
                </Link>
              ))}
              <Link to="/about" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2.5 text-sm text-[var(--color-primary)]/80 hover:text-[var(--color-primary)] hover:bg-[var(--color-muted)]/20 rounded-lg">{t('theme.layout.nav.our_story')}</Link>
            </nav>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-[var(--color-primary)] text-[var(--color-border)]">
        <div className="max-w-6xl mx-auto px-6 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <h3 className="text-white text-xl italic mb-4">{store?.name || 'Artisan'}</h3>
              <p className="text-sm text-[var(--color-muted)] leading-relaxed">
                {t('theme.footer.tagline')}
              </p>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-3">{t('theme.footer.shop_heading')}</h4>
              <ul className="space-y-2 text-sm">
                <li><Link to="/products" className="hover:text-white transition">{t('theme.footer.shop_all')}</Link></li>
                {categories.slice(0, 4).map(cat => (
                  <li key={cat._id}>
                    <Link to={`/categories/${cat.slug}`} className="hover:text-white transition">{cat.name}</Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-3">{t('theme.footer.about_heading')}</h4>
              <ul className="space-y-2 text-sm">
                <li><Link to="/about" className="hover:text-white transition">{t('theme.footer.our_story')}</Link></li>
                <li><span className="hover:text-white cursor-pointer">{t('theme.footer.meet_makers')}</span></li>
                <li><span className="hover:text-white cursor-pointer">{t('theme.footer.sustainability')}</span></li>
                <li><Link to="/contact" className="hover:text-white transition">{t('theme.footer.contact')}</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-3">{t('theme.footer.circle_heading')}</h4>
              <p className="text-sm text-[var(--color-muted)] mb-3">{t('theme.footer.circle_subtext')}</p>
              <form onSubmit={e => e.preventDefault()} className="flex gap-2">
                <input
                  type="email"
                  placeholder={t('theme.footer.email_placeholder')}
                  className="flex-1 px-3 py-2 bg-[var(--color-secondary)] border border-[var(--color-border)] rounded text-sm text-white placeholder-[var(--color-muted)] focus:outline-none focus:border-[var(--color-accent)]"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-[var(--color-accent)] hover:bg-[color-mix(in_srgb,var(--color-accent)_80%,black_20%)] text-white rounded text-sm font-medium transition"
                >
                  {t('theme.footer.join_button')}
                </button>
              </form>
            </div>
          </div>
          <div className="border-t border-[var(--color-border)] mt-8 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-[var(--color-muted)]">
            <span>{t('theme.footer.copyright', { year: new Date().getFullYear(), name: store?.name || 'Artisan' })}</span>
            <div className="flex gap-4">
              <span className="hover:text-white cursor-pointer">{t('theme.footer.privacy')}</span>
              <span className="hover:text-white cursor-pointer">{t('theme.footer.terms')}</span>
            </div>
          </div>
        </div>
      </footer>

      {/* Cart Drawer */}
      <CartDrawer isOpen={cartOpen} onClose={closeCart} />

      {/* Mobile Bottom Nav */}
      <MobileBottomNav onCartClick={openCart} />
    </div>
  );
};

export default Layout;
