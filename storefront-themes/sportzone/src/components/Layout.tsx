import React, { useState } from 'react';
import { Outlet, Link } from 'react-router-dom';
import { useStore } from '@matjar/theme-shared/contexts/StoreContext';
import { useCart } from '@matjar/theme-shared/contexts/CartContext';
import { useWishlist } from '@matjar/theme-shared/hooks/useWishlist';
import { useCategories } from '@matjar/theme-shared/hooks/useProducts';
import { useMenu, type MenuItem } from '@matjar/theme-shared/hooks/useMenu';
import CartDrawer from '@matjar/theme-shared/components/CartDrawer';
import { LanguageSwitcher } from '@matjar/theme-shared/components/LanguageSwitcher';
import { useStoreFooter } from '@matjar/theme-shared/hooks/useStoreFooter';
import { SocialIcon } from '@matjar/theme-shared/components/pages/PageIcon';
import { SearchBar } from '@matjar/theme-shared/components/navigation/SearchBar';
import { MobileBottomNav } from '@matjar/theme-shared/components/navigation/MobileBottomNav';
import { MobileMenu } from '@matjar/theme-shared/components/navigation/MobileMenu';
import { AnnouncementBar } from '@matjar/theme-shared/components/marketing/AnnouncementBar';
import { useTopStripText, SectionAnchor, TOP_STRIP_ANCHOR } from '@matjar/theme-shared/theme/topStrip';
import { useTranslation } from 'react-i18next';

const Layout: React.FC = () => {
  const { store } = useStore();
  const footer = useStoreFooter();
  const { cart, isOpen: cartOpen, openCart, closeCart } = useCart();
  const { count: wishlistCount } = useWishlist();
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
  const topStripText = useTopStripText();

  return (
    <div className="min-h-screen flex flex-col bg-white" style={{ '--accent': '#dc2626' } as React.CSSProperties}>
      {/* Top strip — the merchant's announcement text (My Store), on every page */}
      {topStripText && (
        <SectionAnchor id={TOP_STRIP_ANCHOR} className="">
          <AnnouncementBar
            message={topStripText}
            bgColor="#dc2626"
            textColor="#ffffff"
            dismissible={false}
          />
        </SectionAnchor>
      )}

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
              <div className="hidden md:flex items-center text-white">
                <LanguageSwitcher />
              </div>

              <Link to="/wishlist" aria-label={t('common:aria.wishlist')} className="relative text-white hover:text-[#dc2626] transition hidden md:block">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                </svg>
                {wishlistCount > 0 && (
                  <span className="absolute -top-2 -end-2 w-5 h-5 bg-[#dc2626] text-white text-[10px] rounded-full flex items-center justify-center font-black">
                    {wishlistCount}
                  </span>
                )}
              </Link>

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
          <div className={`grid grid-cols-1 ${footer.policies.length > 0 ? 'md:grid-cols-4' : 'md:grid-cols-3'} gap-8 mb-8`}>
            <div>
              <h3 className="text-white font-black text-lg uppercase mb-2">
                {footer.logo ? (
                  <img src={footer.logo} alt={footer.storeName} className="h-8 w-auto object-contain" />
                ) : (
                  <><span className="text-[#dc2626]">///</span> {footer.storeName}</>
                )}
              </h3>
              {footer.description && <p className="text-sm">{footer.description}</p>}
              {footer.social.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-4" aria-label={footer.titles.follow}>
                  {footer.social.map((s) => (
                    <a
                      key={s.platform}
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={s.name}
                      className="w-8 h-8 bg-gray-800 hover:bg-[#dc2626] text-white flex items-center justify-center transition"
                    >
                      <SocialIcon platform={s.platform} className="w-4 h-4" />
                    </a>
                  ))}
                </div>
              )}
            </div>
            <div>
              <h4 className="text-white font-bold text-sm uppercase mb-3">{footer.titles.shop}</h4>
              <div className="space-y-2 text-sm">
                {footer.shop.map((l) => (
                  <Link key={l.to} to={l.to} className="block hover:text-[#dc2626] transition">{l.label}</Link>
                ))}
              </div>
            </div>
            <div>
              <h4 className="text-white font-bold text-sm uppercase mb-3">{footer.titles.help}</h4>
              <div className="space-y-2 text-sm">
                {footer.help.map((l) => (
                  <Link key={l.to} to={l.to} className="block hover:text-[#dc2626] transition">{l.label}</Link>
                ))}
              </div>
            </div>
            {footer.policies.length > 0 && (
              <div>
                <h4 className="text-white font-bold text-sm uppercase mb-3">{footer.titles.policies}</h4>
                <div className="space-y-2 text-sm">
                  {footer.policies.map((l) => (
                    <Link key={l.to} to={l.to} className="block hover:text-[#dc2626] transition">{l.label}</Link>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="border-t border-gray-800 pt-6 text-center text-xs">
            {footer.copyright}
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
