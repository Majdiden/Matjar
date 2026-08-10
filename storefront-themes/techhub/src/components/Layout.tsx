import React, { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useStore } from '@matjar/theme-shared/contexts/StoreContext';
import { useCart } from '@matjar/theme-shared/contexts/CartContext';
import { useCategories } from '@matjar/theme-shared/hooks/useProducts';
import { useMenu, type MenuItem } from '@matjar/theme-shared/hooks/useMenu';
import { useThemeSetting } from '@matjar/theme-shared/theme/ThemeProvider';
import CartDrawer from '@matjar/theme-shared/components/CartDrawer';
import { LanguageSwitcher } from '@matjar/theme-shared/components/LanguageSwitcher';
import { PolicyLinks } from '@matjar/theme-shared/components/PolicyLinks';
import { SearchBar } from '@matjar/theme-shared/components/navigation/SearchBar';
import { MobileBottomNav } from '@matjar/theme-shared/components/navigation/MobileBottomNav';
import { MobileMenu } from '@matjar/theme-shared/components/navigation/MobileMenu';
import { AnnouncementBar } from '@matjar/theme-shared/components/marketing/AnnouncementBar';
import { useTranslation } from 'react-i18next';

/**
 * TechHub Layout — TONMART-style chrome.
 *
 * Header is a two-row affair on desktop:
 *   • Row 1 (dark navy): TONMART wordmark + primary nav + utility links
 *   • Row 2 (white): "Browse all collection" pill + big rounded search
 *     bar + account / wishlist / cart icons
 *
 * Footer is dark navy with a green wordmark, 4-column link grid and a
 * contact strip.
 */
// The header/footer are a deep navy so the green wordmark + green accents
// stay legible. (`--color-secondary` is a green tint, which renders the
// "navy" chrome green-on-green and makes the wordmark/phone unreadable.)
const NAVY = '#0f172a';

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
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [collectionOpen, setCollectionOpen] = useState(false);
  const { t } = useTranslation(['theme']);

  const showAnnouncement = useThemeSetting<boolean>('show_announcement_bar') !== false;
  const announcementText = useThemeSetting<string>('announcement_text') ||
    t('theme.banner.announcement.text');

  const isActive = (path: string) =>
    location.pathname === path || (path !== '/' && location.pathname.startsWith(path));

  const brandName = (store?.name || 'TECHHUB').toUpperCase();

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: 'var(--color-background)', color: 'var(--color-foreground)' }}
    >
      {showAnnouncement && (
        <AnnouncementBar
          message={announcementText}
          linkText={t('theme.banner.announcement.cta')}
          href="/products"
          bgColor="var(--color-secondary)"
          textColor="var(--color-background)"
          dismissible
          storageKey="techhub_announce"
        />
      )}

      {/* ═══ HEADER — Row 1: navy nav bar ═════════════════════════ */}
      <header className="sticky top-0 z-40" style={{ backgroundColor: NAVY }}>
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-16 gap-6">
            <Link to="/" className="text-2xl md:text-3xl font-black tracking-tight text-white shrink-0">
              {brandName}
            </Link>

            <nav className="hidden lg:flex items-center gap-8 flex-1 justify-center">
              {hasMenu ? (
                menuItems.map((item) => {
                  const cls = "text-sm font-semibold transition-colors";
                  const href = itemHref(item);
                  return isExternal(item) ? (
                    <a key={item._id || href} href={href} target={item.target || '_blank'} rel="noopener noreferrer" className={cls} style={{ color: 'var(--color-background)' }}>{item.label}</a>
                  ) : (
                    <Link key={item._id || href} to={href} className={cls} style={{ color: isActive(href) ? 'var(--color-primary)' : 'var(--color-background)' }}>{item.label}</Link>
                  );
                })
              ) : (
                <>
                  <Link to="/" className="text-sm font-semibold transition-colors" style={{ color: isActive('/') && location.pathname === '/' ? 'var(--color-primary)' : 'var(--color-background)' }}>{t('theme.nav.home')}</Link>
                  <Link to="/products" className="text-sm font-semibold text-white hover:opacity-80 transition">{t('theme.nav.collections')}</Link>
                  <Link to="/products" className="text-sm font-semibold text-white hover:opacity-80 transition">{t('theme.nav.products')}</Link>
                  {categories.slice(0, 2).map((cat) => (
                    <Link
                      key={cat._id}
                      to={`/categories/${cat.slug}`}
                      className="text-sm font-semibold transition-colors"
                      style={{ color: isActive(`/categories/${cat.slug}`) ? 'var(--color-primary)' : 'var(--color-background)' }}
                    >
                      {cat.name}
                    </Link>
                  ))}
                </>
              )}
            </nav>

            <div className="hidden md:flex items-center gap-5 text-xs text-white">
              <span className="flex items-center gap-1.5">
                <svg className="w-4 h-4" style={{ color: 'var(--color-primary)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h2l2 5-3 2a12 12 0 006 6l2-3 5 2v2a2 2 0 01-2 2A16 16 0 013 5z" />
                </svg>
                <span className="whitespace-nowrap">{t('theme.nav.call_us')} <span style={{ color: 'var(--color-primary)' }}>{t('theme.contact.phone', { defaultValue: '+1 (555) 456-7890' })}</span></span>
              </span>
            </div>

            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="lg:hidden text-white"
              aria-label={t('common:aria.toggle_menu')}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={menuOpen ? 'M6 18L18 6M6 6l12 12' : 'M4 6h16M4 12h16M4 18h16'} />
              </svg>
            </button>
          </div>
        </div>

        {/* ═══ HEADER — Row 2: white search bar ═════════════════ */}
        <div className="hidden md:block border-t" style={{ backgroundColor: 'var(--color-background)', borderColor: 'rgba(255,255,255,0.06)' }}>
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex items-center gap-4 py-3">
              <button
                onClick={() => setCollectionOpen(!collectionOpen)}
                className="flex items-center gap-3 px-5 py-3 rounded-lg text-xs font-bold uppercase tracking-wider text-white whitespace-nowrap transition"
                style={{ backgroundColor: 'var(--color-primary)' }}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
                {t('theme.nav.browse_all')}
              </button>

              <div className="flex-1">
                <SearchBar placeholder={t('theme.nav.search_placeholder')} variant="expanded" />
              </div>

              <LanguageSwitcher />

              <Link
                to="/account"
                className="hidden lg:flex items-center gap-2 text-xs shrink-0"
                aria-label={t('common:aria.account')}
                style={{ color: 'var(--color-foreground)' }}
              >
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14c-4 0-7 2-7 6h14c0-4-3-6-7-6z" />
                </svg>
                <div className="leading-tight">
                  <div className="font-bold text-sm">{t('theme.nav.account')}</div>
                  <div style={{ color: 'var(--color-muted)' }}>{t('theme.nav.hello_login')}</div>
                </div>
              </Link>

              <Link
                to="/wishlist"
                className="relative h-10 w-10 flex items-center justify-center shrink-0"
                aria-label={t('common:aria.wishlist')}
                style={{ color: 'var(--color-foreground)' }}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 016.364 0L12 7.636l1.318-1.318a4.5 4.5 0 116.364 6.364L12 20.364l-7.682-7.682a4.5 4.5 0 010-6.364z" />
                </svg>
                <span className="absolute -top-0.5 -end-0.5 w-5 h-5 text-white text-[10px] rounded-full flex items-center justify-center font-bold" style={{ backgroundColor: 'var(--color-primary)' }}>0</span>
              </Link>

              <button
                onClick={openCart}
                className="relative h-10 w-10 flex items-center justify-center shrink-0"
                aria-label={t('common:aria.open_cart')}
                style={{ color: 'var(--color-foreground)' }}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
                </svg>
                <span
                  className="absolute -top-0.5 -end-0.5 w-5 h-5 text-white text-[10px] rounded-full flex items-center justify-center font-bold"
                  style={{ backgroundColor: 'var(--color-primary)' }}
                >
                  {cart?.itemCount || 0}
                </span>
              </button>
            </div>
          </div>

          {/* Browse-all-collection dropdown */}
          {collectionOpen && (
            <div
              className="absolute start-0 end-0 border-t shadow-lg"
              style={{ backgroundColor: 'var(--color-background)', borderColor: 'var(--color-border)' }}
            >
              <div className="max-w-7xl mx-auto px-4 py-4 grid grid-cols-2 lg:grid-cols-4 gap-2">
                {categories.slice(0, 12).map((cat) => (
                  <Link
                    key={cat._id}
                    to={`/categories/${cat.slug}`}
                    onClick={() => setCollectionOpen(false)}
                    className="px-3 py-2 text-sm rounded hover:bg-slate-50 transition"
                    style={{ color: 'var(--color-foreground)' }}
                  >
                    {cat.name}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

      </header>

      <MobileMenu isOpen={menuOpen} onClose={() => setMenuOpen(false)} items={menuItems} />

      <main className="flex-1">
        <Outlet />
      </main>

      {/* ═══ FOOTER — dark navy ═══════════════════════════════════ */}
      {/* pb is larger on mobile so the fixed MobileBottomNav (md:hidden) never
          covers the copyright row; collapses back to a tight pad from md up. */}
      <footer className="pt-16 pb-24 md:pb-4 mt-12 text-slate-300" style={{ backgroundColor: NAVY }}>
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-10">
            <div>
              <h3 className="text-2xl font-black tracking-tight mb-4" style={{ color: 'var(--color-primary)' }}>
                {brandName}
              </h3>
              <p className="text-sm mb-5 text-slate-400">
                {t('theme.footer.tagline')}
              </p>
              <div className="flex items-center gap-2">
                {['facebook', 'pinterest', 'twitter', 'linkedin', 'vimeo'].map((social) => (
                  <a
                    key={social}
                    href="#"
                    aria-label={social}
                    className="h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition text-white text-xs"
                  >
                    {social[0].toUpperCase()}
                  </a>
                ))}
              </div>
            </div>

            <div>
              <h4 className="font-bold text-sm mb-4 uppercase tracking-wide text-white">{t('theme.footer.help_support_heading')}</h4>
              <div className="space-y-2.5 text-sm text-slate-400">
                <a href="#" className="block hover:text-white transition">{t('theme.footer.shipping_info')}</a>
                <a href="#" className="block hover:text-white transition">{t('theme.footer.returns')}</a>
                <a href="#" className="block hover:text-white transition">{t('theme.footer.how_to_order')}</a>
                <a href="#" className="block hover:text-white transition">{t('theme.footer.how_to_track')}</a>
                <a href="#" className="block hover:text-white transition">{t('theme.footer.size_guide')}</a>
              </div>
            </div>

            <div>
              <h4 className="font-bold text-sm mb-4 uppercase tracking-wide text-white">{t('theme.footer.company_info_heading')}</h4>
              <div className="space-y-2.5 text-sm text-slate-400">
                <a href="#" className="block hover:text-white transition">{t('theme.footer.about_us')}</a>
                <a href="#" className="block hover:text-white transition">{t('theme.footer.our_blog')}</a>
                <a href="#" className="block hover:text-white transition">{t('theme.footer.careers')}</a>
                <a href="#" className="block hover:text-white transition">{t('theme.footer.store_locations')}</a>
                <a href="#" className="block hover:text-white transition">{t('theme.footer.testimonial')}</a>
              </div>
            </div>

            <div>
              <h4 className="font-bold text-sm mb-4 uppercase tracking-wide text-white">{t('theme.footer.customer_care_heading')}</h4>
              <div className="space-y-2.5 text-sm text-slate-400">
                <a href="#" className="block hover:text-white transition">{t('theme.footer.faq')}</a>
                <a href="#" className="block hover:text-white transition">{t('theme.footer.terms_of_service')}</a>
                <a href="#" className="block hover:text-white transition">{t('theme.footer.privacy_policy')}</a>
                <a href="#" className="block hover:text-white transition">{t('theme.footer.contact_us')}</a>
                <a href="#" className="block hover:text-white transition">{t('theme.footer.gift_card')}</a>
                <PolicyLinks className="mt-2.5" heading={false} linkClassName="block hover:text-white transition" />
              </div>
            </div>
          </div>

          {/* Contact strip */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 py-6 border-y border-white/10 text-sm">
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5" style={{ color: 'var(--color-primary)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h2l2 5-3 2a12 12 0 006 6l2-3 5 2v2a2 2 0 01-2 2A16 16 0 013 5z" />
              </svg>
              <span className="text-white font-semibold">{t('theme.footer.available_by_phone')}</span>
              <span style={{ color: 'var(--color-primary)' }}>{t('theme.contact.phone', { defaultValue: '+1 (555) 456-7890' })}</span>
            </div>
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5" style={{ color: 'var(--color-primary)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l9 6 9-6M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <span className="text-white font-semibold">{t('theme.footer.email_label')}</span>
              <span className="text-slate-400">{t('theme.contact.email', { defaultValue: 'info@example.com' })}</span>
            </div>
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5" style={{ color: 'var(--color-primary)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 2M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-white font-semibold">{t('theme.footer.opening_hours_label')}</span>
              <span className="text-slate-400">{t('theme.footer.opening_hours')}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 pt-6 text-xs text-slate-400">
            <span>{t('theme.footer.copyright_html', { year: new Date().getFullYear(), name: store?.name || 'TechHub' })}</span>
            <div className="flex items-center gap-2">
              {['VISA', 'MC', 'PP', 'CIRR', 'AMEX', 'BTC'].map((p) => (
                <span key={p} className="h-6 px-2 rounded bg-white/10 flex items-center text-[10px] font-bold text-white">{p}</span>
              ))}
            </div>
          </div>
        </div>
      </footer>

      <MobileBottomNav onCartClick={openCart} />
      <CartDrawer isOpen={cartOpen} onClose={closeCart} />
    </div>
  );
};

export default Layout;
