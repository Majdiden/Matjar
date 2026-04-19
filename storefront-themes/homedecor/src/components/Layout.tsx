import React, { useState } from 'react';
import { Outlet, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useStore } from '@shared/contexts/StoreContext';
import { useCart } from '@shared/contexts/CartContext';
import { useCategories } from '@shared/hooks/useProducts';
import { Drawer } from '@shared/components/primitives/Drawer';
import { SearchBar } from '@shared/components/navigation/SearchBar';
import { MobileBottomNav } from '@shared/components/navigation/MobileBottomNav';
import CartDrawer from '@shared/components/CartDrawer';

const Layout: React.FC = () => {
  const { t } = useTranslation('theme');
  const { store } = useStore();
  const { cart, isOpen: cartOpen, openCart, closeCart } = useCart();
  const { categories } = useCategories();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-[#f9f7f4]">
      {/* Sticky Header */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center justify-between h-18 py-4">
            {/* Mobile menu toggle */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden text-gray-500 hover:text-gray-900"
              aria-label="Open menu"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            {/* Logo with house icon */}
            <Link to="/" className="flex items-center gap-2 text-xl font-semibold tracking-wide text-gray-800">
              <svg className="w-5 h-5 text-[#d4a76a]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              {store?.name || 'HomeDecor'}
            </Link>

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center gap-8">
              <Link to="/products" className="text-sm text-gray-500 hover:text-gray-900 transition">{t('theme.nav.shop_all')}</Link>
              {categories.slice(0, 4).map(cat => (
                <Link key={cat._id} to={`/categories/${cat.slug}`} className="text-sm text-gray-500 hover:text-gray-900 transition">
                  {cat.name}
                </Link>
              ))}
            </nav>

            {/* Actions */}
            <div className="flex items-center gap-4">
              <SearchBar variant="compact" className="text-gray-500 hover:text-gray-900 hover:bg-gray-100" />
              <button onClick={openCart} className="relative text-gray-500 hover:text-gray-900">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
                {cart && cart.itemCount > 0 && (
                  <span className="absolute -top-2 -end-2 w-4 h-4 bg-[#d4a76a] text-white text-[10px] rounded-full flex items-center justify-center">
                    {cart.itemCount}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1"><Outlet /></main>

      {/* 3-Column Footer */}
      <footer className="bg-[#2d2d2d] text-gray-400 py-14">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-5 h-5 text-[#d4a76a]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                <h3 className="text-white font-semibold text-lg">{store?.name || 'HomeDecor'}</h3>
              </div>
              <p className="text-sm">{t('theme.footer.tagline')}</p>
            </div>
            <div>
              <h4 className="text-white text-sm font-semibold mb-3">{t('theme.footer.col_shop')}</h4>
              <div className="space-y-2 text-sm">
                <Link to="/products" className="block hover:text-white transition">{t('theme.footer.all_products')}</Link>
                {categories.slice(0, 3).map(cat => (
                  <Link key={cat._id} to={`/categories/${cat.slug}`} className="block hover:text-white transition">{cat.name}</Link>
                ))}
              </div>
            </div>
            <div>
              <h4 className="text-white text-sm font-semibold mb-3">{t('theme.footer.col_help')}</h4>
              <div className="space-y-2 text-sm">
                <p className="hover:text-white transition cursor-pointer">{t('theme.footer.shipping_returns')}</p>
                <p className="hover:text-white transition cursor-pointer">{t('theme.footer.care_instructions')}</p>
                <Link to="/contact" className="hover:text-white transition block">{t('theme.footer.contact_us')}</Link>
              </div>
            </div>
          </div>
          <div className="border-t border-gray-700 pt-6 text-center text-xs">
            {t('theme.footer.copyright', { year: new Date().getFullYear(), name: store?.name || 'HomeDecor' })}
          </div>
        </div>
      </footer>

      {/* Mobile Menu Drawer */}
      <Drawer isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} position="left">
        <div className="p-6 w-72">
          <h2 className="text-lg font-semibold text-gray-800 mb-6">{store?.name || 'HomeDecor'}</h2>
          <nav className="space-y-4">
            <Link to="/products" onClick={() => setMobileMenuOpen(false)} className="block text-gray-600 hover:text-[#d4a76a] transition">
              {t('theme.mobile_menu.shop_all')}
            </Link>
            {categories.map(cat => (
              <Link key={cat._id} to={`/categories/${cat.slug}`} onClick={() => setMobileMenuOpen(false)} className="block text-gray-600 hover:text-[#d4a76a] transition">
                {cat.name}
              </Link>
            ))}
          </nav>
        </div>
      </Drawer>

      {/* Cart Drawer */}
      <CartDrawer isOpen={cartOpen} onClose={closeCart} />

      {/* Mobile Bottom Nav */}
      <MobileBottomNav onCartClick={openCart} />
    </div>
  );
};

export default Layout;
