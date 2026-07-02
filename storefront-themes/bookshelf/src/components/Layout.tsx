import React, { useState } from 'react';
import { Outlet, Link } from 'react-router-dom';
import { useStore } from '@shared/contexts/StoreContext';
import { useCart } from '@shared/contexts/CartContext';
import { useCategories } from '@shared/hooks/useProducts';
import { useMenu, type MenuItem } from '@shared/hooks/useMenu';
import { Drawer } from '@shared/components/primitives/Drawer';
import { SearchBar } from '@shared/components/navigation/SearchBar';
import { MobileBottomNav } from '@shared/components/navigation/MobileBottomNav';
import { AnnouncementBar } from '@shared/components/marketing/AnnouncementBar';
import CartDrawer from '@shared/components/CartDrawer';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '../../../_shared/components/LanguageSwitcher';

const Layout: React.FC = () => {
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
  const { t } = useTranslation(['theme']);

  return (
    <div className="min-h-screen flex flex-col bg-[#faf5ff]">
      <AnnouncementBar
        message={t('theme.layout.announcement')}
        className="bg-[#7c3aed] text-white text-xs text-center py-1.5 font-medium"
      />

      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-violet-100 shadow-sm">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex items-center justify-between h-16">
            {/* Logo — sits at the start of the header row */}
            <Link to="/" className="text-xl font-bold text-[#7c3aed] tracking-tight flex items-center gap-2">
              <svg className="w-6 h-6 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
              </svg>
              {store?.name || 'BookShelf'}
            </Link>

            <nav className="hidden md:flex items-center gap-6">
              {hasMenu ? (
                menuItems.map(item => {
                  const cls = "text-sm text-gray-600 hover:text-[#7c3aed] transition";
                  const href = itemHref(item);
                  return isExternal(item) ? (
                    <a key={item._id || href} href={href} target={item.target || '_blank'} rel="noopener noreferrer" className={cls}>{item.label}</a>
                  ) : (
                    <Link key={item._id || href} to={href} className={cls}>{item.label}</Link>
                  );
                })
              ) : (
                <>
                  <Link to="/products" className="text-sm text-gray-600 hover:text-[#7c3aed] transition font-medium">
                    {t('theme.layout.nav.browse')}
                  </Link>
                  {categories.slice(0, 4).map(cat => (
                    <Link
                      key={cat._id}
                      to={`/categories/${cat.slug}`}
                      className="text-sm text-gray-600 hover:text-[#7c3aed] transition"
                    >
                      {cat.name}
                    </Link>
                  ))}
                </>
              )}
            </nav>

            <div className="flex items-center gap-3">
              {/* Desktop search (search on mobile lives in the bottom nav) */}
              <div className="hidden md:block w-48">
                <SearchBar
                  placeholder={t('theme.layout.nav.browse')}
                  className="bg-violet-50 border-violet-200 rounded-lg text-sm focus-within:ring-2 focus-within:ring-[#7c3aed]/30"
                />
              </div>

              {/* Language Switcher — desktop only; on mobile it lives inside
                  the hamburger side-menu drawer (below). */}
              <div className="hidden md:flex items-center">
                <LanguageSwitcher />
              </div>

              {/* Cart button */}
              <button
                onClick={openCart}
                className="relative hidden md:inline-flex text-gray-600 hover:text-[#7c3aed] transition"
                aria-label={t('common:aria.cart')}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
                {cart && cart.itemCount > 0 && (
                  <span className="absolute -top-2 -end-2 w-4 h-4 bg-[#7c3aed] text-white text-[10px] rounded-full flex items-center justify-center font-bold">
                    {cart.itemCount}
                  </span>
                )}
              </button>

              {/* Mobile menu toggle — sits at the opposite end from the logo */}
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="md:hidden text-gray-600 hover:text-[#7c3aed]"
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

      <footer className="bg-[#4c1d95] text-violet-200 py-12">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
            <div>
              <h3 className="text-white text-lg font-bold mb-3 flex items-center gap-2">
                <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
                </svg>
                {store?.name || 'BookShelf'}
              </h3>
              <p className="text-sm leading-relaxed">{t('theme.footer.tagline')}</p>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-3 text-sm uppercase tracking-wider">{t('theme.footer.explore_heading')}</h4>
              <div className="flex flex-col gap-2 text-sm">
                <Link to="/products" className="hover:text-white transition">{t('theme.footer.browse_all')}</Link>
                {categories.slice(0, 3).map(cat => (
                  <Link key={cat._id} to={`/categories/${cat.slug}`} className="hover:text-white transition">
                    {cat.name}
                  </Link>
                ))}
              </div>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-3 text-sm uppercase tracking-wider">{t('theme.footer.help_heading')}</h4>
              <div className="flex flex-col gap-2 text-sm">
                <span className="cursor-pointer hover:text-white transition">{t('theme.footer.about_us')}</span>
                <Link to="/contact" className="hover:text-white transition">{t('theme.footer.contact')}</Link>
                <span className="cursor-pointer hover:text-white transition">{t('theme.footer.shipping_returns')}</span>
              </div>
            </div>
          </div>
          <div className="border-t border-violet-800 pt-6 text-center">
            <p className="text-xs text-violet-300">
              {t('theme.footer.copyright', { year: new Date().getFullYear(), name: store?.name || 'BookShelf' })}
            </p>
          </div>
        </div>
      </footer>

      {/* Mobile menu drawer */}
      <Drawer isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} side="left">
        <div className="p-6 bg-white h-full">
          <h2 className="text-lg font-bold text-[#7c3aed] mb-6 flex items-center gap-2" aria-label={t('theme.layout.nav.menu_heading')}>
            <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
            </svg>
            {t('theme.layout.nav.menu_heading')}
          </h2>
          <nav className="flex flex-col gap-4">
            {hasMenu ? (
              menuItems.map(item => {
                const cls = "text-gray-600 hover:text-[#7c3aed]";
                const href = itemHref(item);
                return isExternal(item) ? (
                  <a key={item._id || href} href={href} target={item.target || '_blank'} rel="noopener noreferrer" onClick={() => setMobileMenuOpen(false)} className={cls}>{item.label}</a>
                ) : (
                  <Link key={item._id || href} to={href} onClick={() => setMobileMenuOpen(false)} className={cls}>{item.label}</Link>
                );
              })
            ) : (
              <>
                <Link to="/products" onClick={() => setMobileMenuOpen(false)} className="text-gray-700 font-medium hover:text-[#7c3aed]">
                  {t('theme.layout.nav.browse_all')}
                </Link>
                {categories.map(cat => (
                  <Link
                    key={cat._id}
                    to={`/categories/${cat.slug}`}
                    onClick={() => setMobileMenuOpen(false)}
                    className="text-gray-600 hover:text-[#7c3aed]"
                  >
                    {cat.name}
                  </Link>
                ))}
              </>
            )}
            <LanguageSwitcher />
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
