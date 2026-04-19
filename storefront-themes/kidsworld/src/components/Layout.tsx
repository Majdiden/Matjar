import React, { useState } from 'react';
import { Outlet, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useStore } from '@shared/contexts/StoreContext';
import { useCart } from '@shared/contexts/CartContext';
import { useCategories } from '@shared/hooks/useProducts';
import { Drawer } from '@shared/components/primitives/Drawer';
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
    <div className="min-h-screen flex flex-col bg-[#fffbf0]">
      <AnnouncementBar
        message={t('theme.announcement.message')}
        linkText={t('theme.announcement.link_text')}
        className="bg-gradient-to-r from-[#fbbf24] to-[#f59e0b] text-gray-900 text-xs text-center py-1.5 font-bold"
      />

      <header className="sticky top-0 z-50 bg-white shadow-md">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden text-gray-600 hover:text-[#ec4899]"
              aria-label="Open menu"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            <Link to="/" className="text-2xl font-extrabold tracking-tight">
              <span className="text-[#ec4899]">Kids</span>
              <span className="text-[#8b5cf6]">World</span>
              <span className="text-[#fbbf24] ml-1 animate-bounce inline-block">★</span>
            </Link>

            <nav className="hidden md:flex items-center gap-5">
              <Link to="/products" className="text-sm font-bold text-gray-600 hover:text-[#ec4899] transition">
                {t('theme.nav.all_toys')}
              </Link>
              {categories.slice(0, 4).map(cat => (
                <Link
                  key={cat._id}
                  to={`/categories/${cat.slug}`}
                  className="text-sm font-bold text-gray-600 hover:text-[#8b5cf6] transition"
                >
                  {cat.name}
                </Link>
              ))}
            </nav>

            <div className="flex items-center gap-3">
              {/* Desktop search */}
              <div className="hidden md:block w-48">
                <SearchBar
                  placeholder="Search toys..."
                  className="bg-pink-50 border-pink-200 rounded-full text-sm focus-within:ring-2 focus-within:ring-[#ec4899]/30"
                />
              </div>

              {/* Mobile search */}
              <SearchBar variant="compact" className="md:hidden text-gray-600 hover:text-[#ec4899] hover:bg-pink-50" />

              {/* Cart button */}
              <button
                onClick={openCart}
                className="relative text-gray-600 hover:text-[#ec4899] transition"
                aria-label="Cart"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
                </svg>
                {cart && cart.itemCount > 0 && (
                  <span className="absolute -top-2 -right-2 w-5 h-5 bg-[#fbbf24] text-gray-900 text-[10px] rounded-full flex items-center justify-center font-black">
                    {cart.itemCount}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="bg-gradient-to-r from-[#ec4899] via-[#8b5cf6] to-[#3b82f6] text-white py-12">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
            <div>
              <h3 className="text-xl font-extrabold mb-3">
                {store?.name || 'KidsWorld'} <span className="text-[#fbbf24]">★</span>
              </h3>
              <p className="text-sm text-white/80 leading-relaxed">
                {t('theme.footer.tagline')}
              </p>
            </div>
            <div>
              <h4 className="font-bold mb-3 text-sm uppercase tracking-wider">{t('theme.footer.col_shop')}</h4>
              <div className="flex flex-col gap-2 text-sm text-white/80">
                <Link to="/products" className="hover:text-[#fbbf24] transition">{t('theme.footer.all_toys')}</Link>
                {categories.slice(0, 3).map(cat => (
                  <Link key={cat._id} to={`/categories/${cat.slug}`} className="hover:text-[#fbbf24] transition">
                    {cat.name}
                  </Link>
                ))}
              </div>
            </div>
            <div>
              <h4 className="font-bold mb-3 text-sm uppercase tracking-wider">{t('theme.footer.col_help')}</h4>
              <div className="flex flex-col gap-2 text-sm text-white/80">
                <span className="cursor-pointer hover:text-[#fbbf24] transition">{t('theme.footer.about_us')}</span>
                <Link to="/contact" className="hover:text-[#fbbf24] transition">{t('theme.footer.contact')}</Link>
                <span className="cursor-pointer hover:text-[#fbbf24] transition">{t('theme.footer.shipping_returns')}</span>
              </div>
            </div>
          </div>
          <div className="border-t border-white/20 pt-6 text-center">
            <p className="text-xs text-white/60">
              {t('theme.footer.copyright', { year: new Date().getFullYear(), name: store?.name || 'KidsWorld' })}
            </p>
          </div>
        </div>
      </footer>

      {/* Mobile menu drawer */}
      <Drawer isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} position="left">
        <div className="p-6 bg-white h-full">
          <h2 className="text-lg font-extrabold mb-6">
            <span className="text-[#ec4899]">Kids</span>
            <span className="text-[#8b5cf6]">World</span>
            <span className="text-[#fbbf24] ml-1">★</span>
          </h2>
          <nav className="flex flex-col gap-4">
            <Link to="/products" onClick={() => setMobileMenuOpen(false)} className="text-gray-700 font-bold hover:text-[#ec4899]">
              {t('theme.nav.all_toys')}
            </Link>
            {categories.map(cat => (
              <Link
                key={cat._id}
                to={`/categories/${cat.slug}`}
                onClick={() => setMobileMenuOpen(false)}
                className="text-gray-600 font-medium hover:text-[#8b5cf6]"
              >
                {cat.name}
              </Link>
            ))}
          </nav>
        </div>
      </Drawer>

      <CartDrawer isOpen={cartOpen} onClose={closeCart} />

      {/* Mobile bottom navigation */}
      <MobileBottomNav onCartClick={openCart} />
    </div>
  );
};

export default Layout;
