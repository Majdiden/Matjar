import React, { useState } from 'react';
import { Outlet, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useStore } from '@matjar/theme-shared/contexts/StoreContext';
import { useCart } from '@matjar/theme-shared/contexts/CartContext';
import { WishlistHeaderLink } from '@matjar/theme-shared/components/commerce/WishlistHeaderLink';
import { useCategories } from '@matjar/theme-shared/hooks/useProducts';
import { useMenu, type MenuItem } from '@matjar/theme-shared/hooks/useMenu';
import { Drawer } from '@matjar/theme-shared/components/primitives/Drawer';
import { SearchBar } from '@matjar/theme-shared/components/navigation/SearchBar';
import { MobileBottomNav } from '@matjar/theme-shared/components/navigation/MobileBottomNav';
import { MobileMenu } from '@matjar/theme-shared/components/navigation/MobileMenu';
import { AnnouncementBar } from '@matjar/theme-shared/components/marketing/AnnouncementBar';
import { useTopStripText, SectionAnchor, TOP_STRIP_ANCHOR } from '@matjar/theme-shared/theme/topStrip';
import CartDrawer from '@matjar/theme-shared/components/CartDrawer';
import { LanguageSwitcher } from '@matjar/theme-shared/components/LanguageSwitcher';
import { useStoreFooter } from '@matjar/theme-shared/hooks/useStoreFooter';
import { SocialIcon } from '@matjar/theme-shared/components/pages/PageIcon';
import { StoreLogo } from '@matjar/theme-shared/components/StoreLogo';

const Layout: React.FC = () => {
  const { t } = useTranslation('theme');
  const topStripText = useTopStripText();
  const footer = useStoreFooter();
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
      {/* Top strip — the merchant's announcement text (My Store), on every page */}
      {topStripText && (
        <SectionAnchor id={TOP_STRIP_ANCHOR} className="">
          <AnnouncementBar
            message={topStripText}
            dismissible={false}
            className="bg-gradient-to-r from-[var(--brand,#fbbf24)] to-[var(--brand,#f59e0b)] text-xs text-center py-1.5 font-bold"
          />
        </SectionAnchor>
      )}

      <header className="sticky top-0 z-50 bg-white shadow-md">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="min-w-0 flex items-center gap-2 text-xl md:text-2xl font-extrabold tracking-tight">
              {store?.logo && (
                <StoreLogo src={store.logo} alt={store?.name || ''} className="h-9 md:h-11 w-auto max-w-[96px] md:max-w-[160px] shrink-0 object-contain rounded-md" />
              )}
              {/* The store's own name; the two-tone theme wordmark only without one.
                  leading-normal + py-1 keep Arabic marks inside the truncate clip box. */}
              {store?.name ? (
                <span className="min-w-0 truncate leading-normal py-1 text-[var(--brand-ink,#ec4899)]">{store.name}</span>
              ) : (
                <>
                  <span className="text-[#ec4899]">Kids</span>
                  <span className="text-[#8b5cf6]">World</span>
                </>
              )}
              <span className="text-[#fbbf24] ms-1 shrink-0 animate-bounce inline-block"><svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 inline-block" aria-hidden="true"><path d="M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.62L12 2 9.19 8.62 2 9.24l5.46 4.73L5.82 21 12 17.27Z" /></svg></span>
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
                  <Link to="/products" className="text-sm font-bold text-gray-600 hover:text-[var(--brand-ink,#ec4899)] transition">
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

              {/* Wishlist button — on every screen size (phones too) */}
              <WishlistHeaderLink
                className="relative inline-flex h-10 w-10 md:h-auto md:w-auto items-center justify-center text-gray-600 hover:text-[var(--brand-ink,#ec4899)] transition"
                icon={
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                  </svg>
                }
                badgeClassName="absolute -top-1 -end-1 md:-top-2 md:-end-2 min-w-[20px] h-5 px-0.5 bg-[#fbbf24] text-gray-900 text-[10px] rounded-full flex items-center justify-center font-black"
              />

              {/* Cart button */}
              <button
                onClick={openCart}
                className="relative text-gray-600 hover:text-[var(--brand-ink,#ec4899)] transition hidden md:block"
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
                className="md:hidden text-gray-600 hover:text-[var(--brand-ink,#ec4899)]"
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

      <footer className="bg-gradient-to-r from-[var(--brand,#ec4899)] via-[var(--brand,#8b5cf6)] to-[var(--brand-strong,#3b82f6)] text-[var(--brand-contrast,#fff)] py-12">
        <div className="max-w-7xl mx-auto px-4">
          <div className={`grid grid-cols-1 ${footer.policies.length > 0 ? 'md:grid-cols-4' : 'md:grid-cols-3'} gap-8 mb-8`}>
            <div>
              <h3 className="text-xl font-extrabold mb-3">
                {footer.logo ? (
                  <span className="inline-flex items-center rounded-2xl bg-white p-2 shadow-sm"><img src={footer.logo} alt={footer.storeName} className="h-14 md:h-16 w-auto max-w-[220px] object-contain rounded-lg" /></span>
                ) : (
                  <>
                    {footer.storeName} <span className="text-[#fbbf24]"><svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 inline-block" aria-hidden="true"><path d="M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.62L12 2 9.19 8.62 2 9.24l5.46 4.73L5.82 21 12 17.27Z" /></svg></span>
                  </>
                )}
              </h3>
              {footer.description && (
                <p className="text-sm text-[color:color-mix(in_srgb,var(--brand-contrast,#fff)_80%,transparent)] leading-relaxed">{footer.description}</p>
              )}
              {footer.social.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-4" aria-label={footer.titles.follow}>
                  {footer.social.map((s) => (
                    <a
                      key={s.platform}
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={s.name}
                      className="w-9 h-9 rounded-full bg-white/20 hover:bg-[#fbbf24] flex items-center justify-center transition"
                    >
                      <SocialIcon platform={s.platform} className="w-4 h-4" />
                    </a>
                  ))}
                </div>
              )}
            </div>
            <div>
              <h4 className="font-bold mb-3 text-sm uppercase tracking-wider">{footer.titles.shop}</h4>
              <div className="flex flex-col gap-2 text-sm text-[color:color-mix(in_srgb,var(--brand-contrast,#fff)_80%,transparent)]">
                {footer.shop.map((l) => (
                  <Link key={l.to} to={l.to} className="hover:text-[#fbbf24] transition">{l.label}</Link>
                ))}
              </div>
            </div>
            <div>
              <h4 className="font-bold mb-3 text-sm uppercase tracking-wider">{footer.titles.help}</h4>
              <div className="flex flex-col gap-2 text-sm text-[color:color-mix(in_srgb,var(--brand-contrast,#fff)_80%,transparent)]">
                {footer.help.map((l) => (
                  <Link key={l.to} to={l.to} className="hover:text-[#fbbf24] transition">{l.label}</Link>
                ))}
              </div>
            </div>
            {footer.policies.length > 0 && (
              <div>
                <h4 className="font-bold mb-3 text-sm uppercase tracking-wider">{footer.titles.policies}</h4>
                <div className="flex flex-col gap-2 text-sm text-[color:color-mix(in_srgb,var(--brand-contrast,#fff)_80%,transparent)]">
                  {footer.policies.map((l) => (
                    <Link key={l.to} to={l.to} className="hover:text-[#fbbf24] transition">{l.label}</Link>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="border-t border-white/20 pt-6 text-center">
            <p className="text-xs text-[color:color-mix(in_srgb,var(--brand-contrast,#fff)_60%,transparent)]">{footer.copyright}</p>
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
