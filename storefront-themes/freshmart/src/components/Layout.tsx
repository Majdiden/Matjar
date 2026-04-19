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
  const { t } = useTranslation(['theme', 'common']);
  const { store } = useStore();
  const { cart, isOpen: cartOpen, openCart, closeCart } = useCart();
  const { categories } = useCategories();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-[#fafff5] pb-16 md:pb-0">
      {/* Announcement Bar */}
      <AnnouncementBar
        message={t('theme.announcement.message')}
        href="/products"
        linkText={t('theme.announcement.link_text')}
        className="bg-[#16a34a] text-white"
      />

      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2 shrink-0">
              <svg className="w-7 h-7 text-[#16a34a]" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M17 8C8 10 5.9 16.17 3.82 21.34L5.71 22l1-2.3A4.49 4.49 0 0 0 8 20C19 20 22 3 22 3c-1 2-8 2-8 2C14 2 17 0 17 0c-3 0-7 4-7 4s-2-2-5-2c0 0 4 4 4 8C9 14.57 7.89 17.31 7 20H9c1-3 3.64-6 8-6 0 0-4.07 4-4 9h2c0-5 3-9 3-9S19 18 19 20h2C21 7 17 8 17 8z"/>
              </svg>
              <span className="text-xl font-extrabold text-[#16a34a]">
                {store?.name || 'FreshMart'}
              </span>
            </Link>

            {/* Desktop Nav */}
            <nav className="hidden lg:flex items-center gap-1">
              <Link to="/" className="px-3 py-2 text-sm font-medium text-gray-600 hover:text-[#16a34a] rounded-lg hover:bg-green-50 transition">{t('theme.nav.home')}</Link>
              <Link to="/products" className="px-3 py-2 text-sm font-medium text-gray-600 hover:text-[#16a34a] rounded-lg hover:bg-green-50 transition">{t('theme.nav.shop_all')}</Link>
              {categories.slice(0, 4).map(cat => (
                <Link
                  key={cat._id}
                  to={`/categories/${cat.slug}`}
                  className="px-3 py-2 text-sm font-medium text-gray-600 hover:text-[#16a34a] rounded-lg hover:bg-green-50 transition"
                >
                  {cat.name}
                </Link>
              ))}
            </nav>

            {/* Right Actions */}
            <div className="flex items-center gap-2">
              {/* Desktop Search */}
              <div className="hidden md:block w-64">
                <SearchBar placeholder="Search fresh products..." className="w-full" />
              </div>

              {/* Mobile Search */}
              <SearchBar variant="compact" className="md:hidden text-gray-500 hover:text-[#16a34a] hover:bg-green-50" />

              {/* Cart */}
              <button
                onClick={openCart}
                className="relative p-2 text-gray-500 hover:text-[#16a34a] rounded-lg hover:bg-green-50 transition"
                aria-label="Cart"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
                </svg>
                {cart && cart.itemCount > 0 && (
                  <span className="absolute -top-0.5 -end-0.5 min-w-[18px] h-[18px] rounded-full bg-[#f59e0b] text-white text-[10px] font-bold flex items-center justify-center px-1">
                    {cart.itemCount > 99 ? '99+' : cart.itemCount}
                  </span>
                )}
              </button>

              {/* Mobile menu toggle */}
              <button
                className="lg:hidden p-2 text-gray-500 hover:text-[#16a34a] rounded-lg hover:bg-green-50 transition"
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
            <nav className="lg:hidden pb-4 border-t border-green-100 pt-3 space-y-1">
              <Link to="/" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2.5 text-sm font-medium text-gray-700 rounded-lg hover:bg-green-50 hover:text-[#16a34a]">{t('theme.nav.home')}</Link>
              <Link to="/products" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2.5 text-sm font-medium text-gray-700 rounded-lg hover:bg-green-50 hover:text-[#16a34a]">{t('theme.nav.shop_all')}</Link>
              {categories.slice(0, 6).map(cat => (
                <Link
                  key={cat._id}
                  to={`/categories/${cat.slug}`}
                  onClick={() => setMobileMenuOpen(false)}
                  className="block px-3 py-2.5 text-sm font-medium text-gray-700 rounded-lg hover:bg-green-50 hover:text-[#16a34a]"
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
      <footer className="bg-[#166534] text-green-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <h3 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-green-300" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M17 8C8 10 5.9 16.17 3.82 21.34L5.71 22l1-2.3A4.49 4.49 0 0 0 8 20C19 20 22 3 22 3c-1 2-8 2-8 2C14 2 17 0 17 0c-3 0-7 4-7 4s-2-2-5-2c0 0 4 4 4 8C9 14.57 7.89 17.31 7 20H9c1-3 3.64-6 8-6 0 0-4.07 4-4 9h2c0-5 3-9 3-9S19 18 19 20h2C21 7 17 8 17 8z"/>
                </svg>
                {store?.name || 'FreshMart'}
              </h3>
              <p className="text-sm text-green-200 leading-relaxed">
                {t('theme.footer.tagline')}
              </p>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-3">{t('theme.footer.col_shop')}</h4>
              <ul className="space-y-2 text-sm">
                <li><Link to="/products" className="hover:text-white transition">{t('theme.footer.all_products')}</Link></li>
                {categories.slice(0, 4).map(cat => (
                  <li key={cat._id}>
                    <Link to={`/categories/${cat.slug}`} className="hover:text-white transition">{cat.name}</Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-3">{t('theme.footer.col_help')}</h4>
              <ul className="space-y-2 text-sm">
                <li><span className="hover:text-white cursor-pointer">{t('theme.footer.delivery_info')}</span></li>
                <li><span className="hover:text-white cursor-pointer">{t('theme.footer.freshness_guarantee')}</span></li>
                <li><span className="hover:text-white cursor-pointer">{t('theme.footer.returns')}</span></li>
                <li><span className="hover:text-white cursor-pointer">{t('theme.footer.faq')}</span></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-3">{t('theme.footer.col_stay_fresh')}</h4>
              <p className="text-sm text-green-200 mb-3">{t('theme.footer.stay_fresh_subtitle')}</p>
              <form onSubmit={e => e.preventDefault()} className="flex gap-2">
                <input
                  type="email"
                  placeholder={t('theme.footer.email_placeholder')}
                  className="flex-1 px-3 py-2 bg-green-900 border border-green-700 rounded-lg text-sm text-white placeholder-green-400 focus:outline-none focus:border-green-500"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#f59e0b] hover:bg-[#d97706] text-white rounded-lg text-sm font-medium transition"
                >
                  {t('theme.footer.join_btn')}
                </button>
              </form>
            </div>
          </div>
          <div className="border-t border-green-800 mt-8 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-green-300">
            <span>{t('theme.footer.copyright', { year: new Date().getFullYear(), name: store?.name || 'FreshMart' })}</span>
            <div className="flex gap-4">
              <span className="hover:text-white cursor-pointer">{t('theme.footer.privacy_policy')}</span>
              <span className="hover:text-white cursor-pointer">{t('theme.footer.terms_of_service')}</span>
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
