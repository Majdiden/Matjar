import React, { useState } from 'react';
import { Outlet, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useStore } from '@shared/contexts/StoreContext';
import { useCart } from '@shared/contexts/CartContext';
import { useCategories } from '@shared/hooks/useProducts';
import { SearchBar } from '@shared/components/navigation/SearchBar';
import { MobileBottomNav } from '@shared/components/navigation/MobileBottomNav';
import { AnnouncementBar } from '@shared/components/marketing/AnnouncementBar';
import CartDrawer from '@shared/components/CartDrawer';

const Layout: React.FC = () => {
  const { t } = useTranslation('theme');
  const { store } = useStore();
  const { cart, isOpen: cartOpen, openCart, closeCart } = useCart();
  const { categories } = useCategories();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col pb-16 md:pb-0">
      {/* Announcement Bar */}
      <AnnouncementBar
        message={t('theme.announcement.bar_text')}
        href="/products"
        linkText={t('theme.announcement.bar_cta')}
      />

      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2 shrink-0">
              {store?.logo ? (
                <img src={store.logo} alt={store.name} className="h-8" />
              ) : (
                <span className="text-xl font-bold" style={{ color: 'var(--color-primary, #2563eb)' }}>
                  {store?.name || 'Store'}
                </span>
              )}
            </Link>

            {/* Desktop Nav */}
            <nav className="hidden lg:flex items-center gap-1">
              <Link to="/" className="px-3 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 rounded-lg hover:bg-gray-50 transition">{t('theme.nav.home')}</Link>
              <Link to="/products" className="px-3 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 rounded-lg hover:bg-gray-50 transition">{t('theme.nav.shop_all')}</Link>
              {categories.slice(0, 5).map(cat => (
                <Link
                  key={cat._id}
                  to={`/categories/${cat.slug}`}
                  className="px-3 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 rounded-lg hover:bg-gray-50 transition"
                >
                  {cat.name}
                </Link>
              ))}
            </nav>

            {/* Right Actions */}
            <div className="flex items-center gap-2">
              {/* Desktop Search */}
              <div className="hidden md:block w-64">
                <SearchBar placeholder="Search..." className="w-full" />
              </div>

              {/* Mobile Search */}
              <SearchBar variant="compact" className="md:hidden text-gray-500 hover:text-gray-700 hover:bg-gray-50" />

              {/* Cart */}
              <button
                onClick={openCart}
                className="relative p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-50 transition"
                aria-label="Cart"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
                {cart && cart.itemCount > 0 && (
                  <span
                    className="absolute -top-0.5 -end-0.5 min-w-[18px] h-[18px] rounded-full text-white text-[10px] font-bold flex items-center justify-center px-1"
                    style={{ backgroundColor: 'var(--color-primary, #2563eb)' }}
                  >
                    {cart.itemCount > 99 ? '99+' : cart.itemCount}
                  </span>
                )}
              </button>

              {/* Mobile menu toggle */}
              <button
                className="lg:hidden p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-50 transition"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                aria-label="Menu"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {mobileMenuOpen
                    ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  }
                </svg>
              </button>
            </div>
          </div>

          {/* Mobile Nav */}
          {mobileMenuOpen && (
            <nav className="lg:hidden pb-4 border-t pt-3 space-y-1 animate-in slide-in-from-top duration-200">
              <Link to="/" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2.5 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-50">{t('theme.nav.home')}</Link>
              <Link to="/products" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2.5 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-50">{t('theme.nav.shop_all')}</Link>
              {categories.slice(0, 6).map(cat => (
                <Link
                  key={cat._id}
                  to={`/categories/${cat.slug}`}
                  onClick={() => setMobileMenuOpen(false)}
                  className="block px-3 py-2.5 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  {cat.name}
                </Link>
              ))}
            </nav>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <h3 className="text-white font-bold text-lg mb-4">{store?.name || 'Store'}</h3>
              <p className="text-sm text-gray-400 leading-relaxed">{store?.description || t('theme.footer.tagline')}</p>
              {store?.socialLinks && (
                <div className="flex gap-3 mt-4">
                  {Object.entries(store.socialLinks).map(([platform, url]) => (
                    <a
                      key={platform}
                      href={url as string}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-700 transition text-xs uppercase"
                    >
                      {platform[0]}
                    </a>
                  ))}
                </div>
              )}
            </div>
            <div>
              <h4 className="text-white font-semibold mb-3">{t('theme.footer.col_shop')}</h4>
              <ul className="space-y-2 text-sm">
                <li><Link to="/products" className="hover:text-white transition">{t('theme.footer.item_all_products')}</Link></li>
                {categories.slice(0, 4).map(cat => (
                  <li key={cat._id}>
                    <Link to={`/categories/${cat.slug}`} className="hover:text-white transition">{cat.name}</Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-3">{t('theme.footer.col_customer_service')}</h4>
              <ul className="space-y-2 text-sm">
                <li><Link to="/contact" className="hover:text-white transition">{t('theme.footer.item_contact_us')}</Link></li>
                <li><span className="hover:text-white cursor-pointer">{t('theme.footer.item_shipping_policy')}</span></li>
                <li><span className="hover:text-white cursor-pointer">{t('theme.footer.item_returns_exchanges')}</span></li>
                <li><span className="hover:text-white cursor-pointer">{t('theme.footer.item_faq')}</span></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-3">{t('theme.footer.col_newsletter')}</h4>
              <p className="text-sm text-gray-400 mb-3">{t('theme.footer.newsletter_desc')}</p>
              <form onSubmit={e => e.preventDefault()} className="flex gap-2">
                <input
                  type="email"
                  placeholder={t('theme.footer.newsletter_email_placeholder')}
                  className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-gray-500"
                />
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg text-sm font-medium text-white transition hover:opacity-90"
                  style={{ backgroundColor: 'var(--color-primary, #2563eb)' }}
                >
                  {t('theme.footer.newsletter_join')}
                </button>
              </form>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-500">
            <span>{t('theme.footer.copyright_html', { year: new Date().getFullYear(), brand: store?.name || 'Store' })}</span>
            <div className="flex gap-4">
              <span className="hover:text-gray-300 cursor-pointer">{t('theme.footer.privacy_policy')}</span>
              <span className="hover:text-gray-300 cursor-pointer">{t('theme.footer.terms_of_service')}</span>
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
