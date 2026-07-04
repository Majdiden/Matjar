import React, { useState } from 'react';
import { Outlet, Link } from 'react-router-dom';
import { useStore } from '@matjar/theme-shared/contexts/StoreContext';
import { useCart } from '@matjar/theme-shared/contexts/CartContext';
import { useCategories } from '@matjar/theme-shared/hooks/useProducts';
import { useMenu, type MenuItem } from '@matjar/theme-shared/hooks/useMenu';
import CartDrawer from '@matjar/theme-shared/components/CartDrawer';
import { LanguageSwitcher } from '@matjar/theme-shared/components/LanguageSwitcher';
import { SearchBar } from '@matjar/theme-shared/components/navigation/SearchBar';
import { MobileBottomNav } from '@matjar/theme-shared/components/navigation/MobileBottomNav';
import { MobileMenu } from '@matjar/theme-shared/components/navigation/MobileMenu';
import { AnnouncementBar } from '@matjar/theme-shared/components/marketing/AnnouncementBar';
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
  const [menuOpen, setMenuOpen] = useState(false);
  const { t } = useTranslation(['theme']);

  return (
    <div className="min-h-screen flex flex-col bg-white" style={{ '--accent': '#dc2626' } as React.CSSProperties}>
      <AnnouncementBar
        message={t('theme.banner.announcement.text')}
        linkText={t('theme.banner.announcement.cta')}
        href="/products"
        bgColor="#dc2626"
        textColor="#ffffff"
        dismissible
        storageKey="sportzone_announce"
      />

      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#111827] border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="text-xl font-black uppercase tracking-wider text-white">
              <span className="text-[#dc2626]">///</span> {store?.name || 'SportZone'}
            </Link>

            <nav className="hidden md:flex items-center gap-6">
              {hasMenu ? (
                menuItems.map(item => {
                  const cls = "text-sm font-bold uppercase text-gray-300 hover:text-[#dc2626] transition";
                  const href = itemHref(item);
                  return isExternal(item) ? (
                    <a key={item._id || href} href={href} target={item.target || '_blank'} rel="noopener noreferrer" className={cls}>{item.label}</a>
                  ) : (
                    <Link key={item._id || href} to={href} className={cls}>{item.label}</Link>
                  );
                })
              ) : (
                <>
                  <Link to="/products" className="text-sm font-bold uppercase text-gray-300 hover:text-[#dc2626] transition">{t('theme.nav.shop')}</Link>
                  {categories.slice(0, 4).map(cat => (
                    <Link key={cat._id} to={`/categories/${cat.slug}`} className="text-sm font-bold uppercase text-gray-300 hover:text-[#dc2626] transition">
                      {cat.name}
                    </Link>
                  ))}
                </>
              )}
            </nav>

            <div className="flex items-center gap-3">
              {/* Desktop search (mobile search lives in the bottom nav) */}
              <div className="hidden md:block w-52">
                <SearchBar placeholder={t('theme.nav.search_placeholder')} variant="expanded" className="bg-white/5 border-white/10 text-white" />
              </div>

              {/* Language switcher — desktop only; on mobile it lives inside
                  the hamburger side menu (below). */}
              <div className="hidden md:flex items-center">
                <LanguageSwitcher />
              </div>

              <button onClick={openCart} className="relative text-white hover:text-[#dc2626] transition hidden md:block">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
                {cart && cart.itemCount > 0 && (
                  <span className="absolute -top-2 -end-2 w-5 h-5 bg-[#dc2626] text-white text-[10px] rounded-full flex items-center justify-center font-black">
                    {cart.itemCount}
                  </span>
                )}
              </button>

              <button onClick={() => setMenuOpen(!menuOpen)} className="md:hidden text-gray-300">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={menuOpen ? 'M6 18L18 6M6 6l12 12' : 'M4 6h16M4 12h16M4 18h16'} />
                </svg>
              </button>
            </div>
          </div>
        </div>

      </header>

      <MobileMenu isOpen={menuOpen} onClose={() => setMenuOpen(false)} items={menuItems} />

      <main className="flex-1"><Outlet /></main>

      {/* Footer */}
      <footer className="bg-[#111827] text-gray-400 py-12">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div>
              <h3 className="text-white font-black text-lg uppercase mb-2">
                <span className="text-[#dc2626]">///</span> {store?.name || 'SportZone'}
              </h3>
              <p className="text-sm">{t('theme.footer.tagline')}</p>
            </div>
            <div>
              <h4 className="text-white font-bold text-sm uppercase mb-3">{t('theme.footer.shop_heading')}</h4>
              <div className="space-y-2 text-sm">
                <Link to="/products" className="block hover:text-[#dc2626] transition">{t('theme.footer.all_products')}</Link>
                {categories.slice(0, 3).map(cat => (
                  <Link key={cat._id} to={`/categories/${cat.slug}`} className="block hover:text-[#dc2626] transition">{cat.name}</Link>
                ))}
              </div>
            </div>
            <div>
              <h4 className="text-white font-bold text-sm uppercase mb-3">{t('theme.footer.info_heading')}</h4>
              <div className="space-y-2 text-sm">
                <Link to="/about" className="block hover:text-[#dc2626] transition">{t('theme.footer.about_us')}</Link>
                <Link to="/contact" className="block hover:text-[#dc2626] transition">{t('theme.footer.contact')}</Link>
                <span className="block">{t('theme.footer.shipping_policy')}</span>
              </div>
            </div>
            <div>
              <h4 className="text-white font-bold text-sm uppercase mb-3">{t('theme.footer.stay_connected_heading')}</h4>
              <p className="text-sm mb-3">{t('theme.footer.newsletter_teaser')}</p>
              <form className="flex" onSubmit={e => e.preventDefault()}>
                <input type="email" placeholder={t('common:section.newsletter.email_placeholder')} className="flex-1 bg-white/5 border border-white/10 rounded-s px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#dc2626]" />
                <button className="bg-[#dc2626] text-white px-4 py-2 rounded-e text-sm font-black uppercase hover:bg-[#b91c1c] transition">{t('theme.footer.newsletter_submit')}</button>
              </form>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-6 text-center text-xs">
            {t('theme.footer.copyright_html', { year: new Date().getFullYear(), name: store?.name || 'SportZone' })}
          </div>
        </div>
      </footer>

      {/* Mobile bottom nav */}
      <MobileBottomNav onCartClick={openCart} />
      <CartDrawer isOpen={cartOpen} onClose={closeCart} />
    </div>
  );
};

export default Layout;
