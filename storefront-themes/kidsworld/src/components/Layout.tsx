import React, { useState } from 'react';
import { Outlet, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useStore } from '@matjar/theme-shared/contexts/StoreContext';
import { useCart } from '@matjar/theme-shared/contexts/CartContext';
import { useCategories } from '@matjar/theme-shared/hooks/useProducts';
import { useMenu, type MenuItem } from '@matjar/theme-shared/hooks/useMenu';
import { Drawer } from '@matjar/theme-shared/components/primitives/Drawer';
import { SearchBar } from '@matjar/theme-shared/components/navigation/SearchBar';
import { MobileBottomNav } from '@matjar/theme-shared/components/navigation/MobileBottomNav';
import { MobileMenu } from '@matjar/theme-shared/components/navigation/MobileMenu';
import { AnnouncementBar } from '@matjar/theme-shared/components/marketing/AnnouncementBar';
import CartDrawer from '@matjar/theme-shared/components/CartDrawer';
import { LanguageSwitcher } from '@matjar/theme-shared/components/LanguageSwitcher';
import { PolicyLinks } from '@matjar/theme-shared/components/PolicyLinks';

const Layout: React.FC = () => {
  const { t } = useTranslation('theme');
  const { store } = useStore();
  const { cart, isOpen: cartOpen, openCart, closeCart } = useCart();
  const { categories } = useCategories();
  // Store-managed header nav. When present (new stores ship a seeded
  // "header" menu) it drives the nav; while loading/empty (older stores)
  // we fall back to the category list below so nav never disappears.
  const { items: menuItems } = useMenu('header');
  const hasMenu = menuItems.length > 0;
  const itemHref = (item: MenuItem) => item.resolvedUrl || item.url || '/';
  const isExternal = (item: MenuItem) =>
    item.type === 'external' || item.target === '_blank';
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
            <Link to="/" className="text-2xl font-extrabold tracking-tight">
              <span className="text-[#ec4899]">Kids</span>
              <span className="text-[#8b5cf6]">World</span>
              <span className="text-[#fbbf24] ms-1 animate-bounce inline-block"><svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 inline-block" aria-hidden="true"><path d="M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.62L12 2 9.19 8.62 2 9.24l5.46 4.73L5.82 21 12 17.27Z" /></svg></span>
            </Link>

            <nav className="hidden md:flex items-center gap-5">
              {hasMenu ? (
                menuItems.map(item => {
                  const cls = "text-sm font-bold text-gray-600 hover:text-[#8b5cf6] transition";
                  const href = itemHref(item);
                  return isExternal(item) ? (
                    <a key={item._id || href} href={href} target={item.target || '_blank'} rel="noopener noreferrer" className={cls}>{item.label}</a>
                  ) : (
                    <Link key={item._id || href} to={href} className={cls}>{item.label}</Link>
                  );
                })
              ) : (
                <>
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
                </>
              )}
            </nav>

            <div className="flex items-center gap-3">
              {/* Desktop search */}
              <div className="hidden md:block w-48">
                <SearchBar
                  placeholder={t('theme.products.search_placeholder')}
                  className="bg-pink-50 border-pink-200 rounded-full text-sm focus-within:ring-2 focus-within:ring-[#ec4899]/30"
                />
              </div>

              {/* Language Switcher (desktop only) */}
              <div className="hidden md:flex items-center">
                <LanguageSwitcher />
              </div>

              {/* Cart button */}
              <button
                onClick={openCart}
                className="relative text-gray-600 hover:text-[#ec4899] transition hidden md:block"
                aria-label={t('common:aria.cart')}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
                </svg>
                {cart && cart.itemCount > 0 && (
                  <span className="absolute -top-2 -end-2 w-5 h-5 bg-[#fbbf24] text-gray-900 text-[10px] rounded-full flex items-center justify-center font-black">
                    {cart.itemCount}
                  </span>
                )}
              </button>

              {/* Mobile menu button */}
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="md:hidden text-gray-600 hover:text-[#ec4899]"
                aria-label={t('common:aria.open_menu')}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
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
                {store?.name || 'KidsWorld'} <span className="text-[#fbbf24]"><svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 inline-block" aria-hidden="true"><path d="M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.62L12 2 9.19 8.62 2 9.24l5.46 4.73L5.82 21 12 17.27Z" /></svg></span>
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
                <PolicyLinks className="mt-2" heading={false} linkClassName="hover:text-[#fbbf24] transition" />
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

      {/* Mobile menu */}
      <MobileMenu isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} items={menuItems} />

      <CartDrawer isOpen={cartOpen} onClose={closeCart} />

      {/* Mobile bottom navigation */}
      <MobileBottomNav onCartClick={openCart} />
    </div>
  );
};

export default Layout;
