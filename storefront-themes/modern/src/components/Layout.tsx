import React, { useState } from 'react';
import { Outlet, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useStore } from '@matjar/theme-shared/contexts/StoreContext';
import { useCart } from '@matjar/theme-shared/contexts/CartContext';
import { useCategories } from '@matjar/theme-shared/hooks/useProducts';
import { useMenu, type MenuItem } from '@matjar/theme-shared/hooks/useMenu';
import { useLayoutSetting } from '@matjar/theme-shared/theme/ThemeProvider';
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

  // Global layout settings from the theme customizer. Read reactively via
  // the theme context hook so header/footer restyle LIVE in the editor
  // preview when the merchant switches variants.
  const headerStyle = useLayoutSetting('headerStyle') || 'standard';
  const footerStyle = useLayoutSetting('footerStyle') || 'standard';

  /* ------------------------------------------------------------------ */
  /* Shared header building blocks (identical behavior in all variants)  */
  /* ------------------------------------------------------------------ */

  const renderLogo = (imgCls: string, textCls: string) => (
    <Link to="/" className="flex items-center gap-2 shrink-0">
      {store?.logo ? (
        <img src={store.logo} alt={store.name} className={imgCls} />
      ) : (
        <span className={textCls} style={{ color: 'var(--color-primary, #2563eb)' }}>
          {store?.name || 'Store'}
        </span>
      )}
    </Link>
  );

  // Desktop nav links — store menu when available, else categories.
  const renderNavLinks = (cls: string) =>
    hasMenu ? (
      menuItems.map(item => {
        const href = itemHref(item);
        return isExternal(item) ? (
          <a key={item._id || href} href={href} target={item.target || '_blank'} rel="noopener noreferrer" className={cls}>{item.label}</a>
        ) : (
          <Link key={item._id || href} to={href} className={cls}>{item.label}</Link>
        );
      })
    ) : (
      <>
        <Link to="/" className={cls}>{t('theme.nav.home')}</Link>
        <Link to="/products" className={cls}>{t('theme.nav.shop_all')}</Link>
        {categories.slice(0, 5).map(cat => (
          <Link key={cat._id} to={`/categories/${cat.slug}`} className={cls}>
            {cat.name}
          </Link>
        ))}
      </>
    );

  const renderCartButton = (btnCls: string) => (
    <button
      onClick={openCart}
      className={btnCls}
      aria-label={t('common:aria.cart')}
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
  );

  const renderMenuToggle = (btnCls: string) => (
    <button
      className={btnCls}
      onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
      aria-label={t('common:aria.menu')}
    >
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        {mobileMenuOpen
          ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        }
      </svg>
    </button>
  );

  const navLinkCls = 'px-3 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 rounded-lg hover:bg-gray-50 transition';
  const iconBtnCls = 'p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-50 transition';

  /* ------------------------------------------------------------------ */
  /* Header variants                                                     */
  /* ------------------------------------------------------------------ */

  // "standard" — logo at the start, inline nav, actions at the end.
  const standardHeader = (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          {renderLogo('h-11 w-auto max-w-[180px] object-contain', 'text-xl font-bold')}

          {/* Desktop Nav — store menu when available, else categories */}
          <nav className="hidden lg:flex items-center gap-1">
            {renderNavLinks(navLinkCls)}
          </nav>

          {/* Right Actions */}
          <div className="flex items-center gap-2">
            {/* Desktop Search (search on mobile lives in the bottom nav) */}
            <div className="hidden md:block w-64">
              <SearchBar placeholder={t('theme.products.search_placeholder')} className="w-full" />
            </div>

            {/* Language Switcher — desktop only; on mobile it lives inside
                the hamburger side menu (below). */}
            <div className="hidden md:flex items-center">
              <LanguageSwitcher />
            </div>

            {/* Cart */}
            {renderCartButton(`relative ${iconBtnCls} hidden md:block`)}

            {/* Mobile menu toggle */}
            {renderMenuToggle(`lg:hidden ${iconBtnCls}`)}
          </div>
        </div>
      </div>
    </header>
  );

  // "centered" — logo centered in the top row with actions split around it,
  // primary nav on its own centered row below. Fully RTL-safe: the grid is
  // symmetric and start/end groups use logical justification.
  const centeredHeader = (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 h-16">
          {/* Start group: menu toggle (mobile/tablet) + desktop search */}
          <div className="flex items-center justify-start gap-1">
            {renderMenuToggle(`lg:hidden ${iconBtnCls}`)}
            <div className="hidden md:block w-52 lg:w-64">
              <SearchBar placeholder={t('theme.products.search_placeholder')} className="w-full" />
            </div>
          </div>

          {/* Centered logo */}
          <div className="flex justify-center">
            {renderLogo('h-11 w-auto max-w-[180px] object-contain', 'text-xl font-bold')}
          </div>

          {/* End group: language + cart */}
          <div className="flex items-center justify-end gap-2">
            <div className="hidden md:flex items-center">
              <LanguageSwitcher />
            </div>
            {renderCartButton(`relative ${iconBtnCls} hidden md:block`)}
          </div>
        </div>

        {/* Centered nav row below the logo */}
        <nav className="hidden lg:flex items-center justify-center gap-1 pb-2">
          {renderNavLinks(navLinkCls)}
        </nav>
      </div>
    </header>
  );

  // "minimal" — slimmer bar, quieter chrome: reduced height, smaller logo,
  // lighter nav that collapses into the menu earlier (xl instead of lg),
  // narrower search. Everything stays reachable.
  const minimalHeader = (
    <header className="sticky top-0 z-30 bg-white/95 border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between gap-2 h-14">
          {/* Logo */}
          {renderLogo('h-9 w-auto max-w-[150px] object-contain', 'text-lg font-bold')}

          {/* Nav — collapses into the menu below xl for a quieter bar */}
          <nav className="hidden xl:flex items-center gap-0.5">
            {renderNavLinks('px-2.5 py-1.5 text-sm text-gray-500 hover:text-gray-900 rounded-lg hover:bg-gray-50 transition')}
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-1">
            <div className="hidden md:block w-44">
              <SearchBar placeholder={t('theme.products.search_placeholder')} className="w-full" />
            </div>
            <div className="hidden md:flex items-center">
              <LanguageSwitcher />
            </div>
            {renderCartButton(`relative p-1.5 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-50 transition hidden md:block`)}
            {renderMenuToggle(`xl:hidden p-1.5 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-50 transition`)}
          </div>
        </div>
      </div>
    </header>
  );

  /* ------------------------------------------------------------------ */
  /* Shared footer building blocks                                       */
  /* ------------------------------------------------------------------ */

  const renderSocialLinks = (circleCls: string) =>
    store?.socialLinks ? (
      <div className="flex gap-3">
        {Object.entries(store.socialLinks).map(([platform, url]) => (
          <a
            key={platform}
            href={url as string}
            target="_blank"
            rel="noopener noreferrer"
            className={circleCls}
          >
            {platform[0]}
          </a>
        ))}
      </div>
    ) : null;

  const hasContact = !!(store?.contact?.email || store?.contact?.phone || store?.contact?.address);

  // Store contact details (from Settings → Policies).
  const renderContactList = (listCls: string) =>
    hasContact ? (
      <ul className={listCls}>
        {store?.contact?.email && (
          <li><a href={`mailto:${store.contact.email}`} className="hover:text-white transition">{store.contact.email}</a></li>
        )}
        {store?.contact?.phone && (
          <li dir="ltr"><a href={`tel:${store.contact.phone}`} className="hover:text-white transition">{store.contact.phone}</a></li>
        )}
        {store?.contact?.address && (
          <li className="whitespace-pre-line">{store.contact.address}</li>
        )}
      </ul>
    ) : null;

  const copyright = (
    <span>{t('theme.footer.copyright_html', { year: new Date().getFullYear(), brand: store?.name || 'Store' })}</span>
  );

  /* ------------------------------------------------------------------ */
  /* Footer variants                                                     */
  /* ------------------------------------------------------------------ */

  // "standard" — the current 4-column footer.
  const standardFooter = (
    <footer className="bg-gray-900 text-gray-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <h3 className="text-white font-bold text-lg mb-4">{store?.name || 'Store'}</h3>
            <p className="text-sm text-gray-400 leading-relaxed">{store?.description || t('theme.footer.tagline')}</p>
            {store?.socialLinks && (
              <div className="mt-4">
                {renderSocialLinks('w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-700 transition text-xs uppercase')}
              </div>
            )}
            {renderContactList('mt-4 space-y-1 text-sm text-gray-400')}
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
            </ul>
            {/* Real, merchant-authored policy links (renders nothing until a
                policy is published) replace the old dead placeholder spans. */}
            <PolicyLinks className="mt-2 space-y-2 text-sm" heading={false} linkClassName="hover:text-white transition" />
          </div>
        </div>
        <div className="border-t border-gray-800 mt-8 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-500">
          {copyright}
          <PolicyLinks inline className="flex flex-wrap gap-4" heading={false} linkClassName="hover:text-gray-300 transition" />
        </div>
      </div>
    </footer>
  );

  // "minimal" — one slim band: brand + essential links + compact newsletter,
  // then a thin contact/copyright row. Much less vertical weight, nothing lost.
  const minimalFooter = (
    <footer className="bg-gray-900 text-gray-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            <span className="text-white font-bold">{store?.name || 'Store'}</span>
            <Link to="/products" className="hover:text-white transition">{t('theme.footer.item_all_products')}</Link>
            <Link to="/contact" className="hover:text-white transition">{t('theme.footer.item_contact_us')}</Link>
            <PolicyLinks inline className="flex flex-wrap gap-x-4 gap-y-2" heading={false} linkClassName="hover:text-white transition" />
          </div>
        </div>
        <div className="border-t border-gray-800 mt-5 pt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-sm text-gray-500">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {renderContactList('flex flex-wrap items-center gap-x-4 gap-y-1 text-gray-400')}
            {renderSocialLinks('w-7 h-7 rounded-full bg-gray-800 flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-700 transition text-[10px] uppercase')}
          </div>
          {copyright}
        </div>
      </div>
    </footer>
  );

  // "expanded" — a substantial footer: full-width newsletter band up top
  // (divider band), then a wider grid with a bigger brand block and roomier
  // spacing. All columns and content preserved.
  const expandedFooter = (
    <footer className="bg-gray-900 text-gray-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-12">
          {/* Bigger brand block spanning two columns on large screens */}
          <div className="lg:col-span-2 max-w-md">
            <h3
              className="text-white font-bold text-2xl mb-4"
              style={{ fontFamily: 'var(--font-family-heading, inherit)' }}
            >
              {store?.name || 'Store'}
            </h3>
            <p className="text-sm text-gray-400 leading-relaxed">{store?.description || t('theme.footer.tagline')}</p>
            {store?.socialLinks && (
              <div className="mt-6">
                {renderSocialLinks('w-9 h-9 rounded-full bg-gray-800 flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-700 transition text-xs uppercase')}
              </div>
            )}
            {renderContactList('mt-6 space-y-2 text-sm text-gray-400')}
          </div>
          <div>
            <h4 className="text-white font-semibold mb-4">{t('theme.footer.col_shop')}</h4>
            <ul className="space-y-3 text-sm">
              <li><Link to="/products" className="hover:text-white transition">{t('theme.footer.item_all_products')}</Link></li>
              {categories.slice(0, 4).map(cat => (
                <li key={cat._id}>
                  <Link to={`/categories/${cat.slug}`} className="hover:text-white transition">{cat.name}</Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-4">{t('theme.footer.col_customer_service')}</h4>
            <ul className="space-y-3 text-sm">
              <li><Link to="/contact" className="hover:text-white transition">{t('theme.footer.item_contact_us')}</Link></li>
            </ul>
            <PolicyLinks className="mt-3 space-y-3 text-sm" heading={false} linkClassName="hover:text-white transition" />
          </div>
        </div>
        <div className="border-t border-gray-800 mt-14 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-500">
          {copyright}
          <PolicyLinks inline className="flex flex-wrap gap-4" heading={false} linkClassName="hover:text-gray-300 transition" />
        </div>
      </div>
    </footer>
  );

  const header =
    headerStyle === 'centered' ? centeredHeader :
    headerStyle === 'minimal' ? minimalHeader :
    standardHeader;

  const footer =
    footerStyle === 'minimal' ? minimalFooter :
    footerStyle === 'expanded' ? expandedFooter :
    standardFooter;

  return (
    <div className="min-h-screen flex flex-col pb-16 md:pb-0">
      {/* Announcement Bar */}
      <AnnouncementBar
        message={t('theme.announcement.bar_text')}
        href="/products"
        linkText={t('theme.announcement.bar_cta')}
      />

      {/* Header — variant controlled by the `headerStyle` layout setting */}
      {header}

      <MobileMenu isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} items={menuItems} />

      {/* Main Content */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Footer — variant controlled by the `footerStyle` layout setting */}
      {footer}

      {/* Cart Drawer */}
      <CartDrawer isOpen={cartOpen} onClose={closeCart} />

      {/* Mobile Bottom Nav */}
      <MobileBottomNav onCartClick={openCart} />
    </div>
  );
};

export default Layout;
