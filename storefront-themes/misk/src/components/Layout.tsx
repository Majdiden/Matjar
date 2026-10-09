import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useStore } from '@matjar/theme-shared/contexts/StoreContext';
import { useCart } from '@matjar/theme-shared/contexts/CartContext';
import { useCategories } from '@matjar/theme-shared/hooks/useProducts';
import { useWishlist } from '@matjar/theme-shared/hooks/useWishlist';
import { useMenu, type MenuItem } from '@matjar/theme-shared/hooks/useMenu';
import { useThemeSetting } from '@matjar/theme-shared/theme/ThemeProvider';
import CartDrawer from '@matjar/theme-shared/components/CartDrawer';
import { MobileBottomNav } from '@matjar/theme-shared/components/navigation/MobileBottomNav';
import { LanguageSwitcher } from '@matjar/theme-shared/components/LanguageSwitcher';
import { Announcement } from './Announcement';
import { MegaMenu, MenuLink } from './MegaMenu';
import { SearchOverlay } from './SearchOverlay';
import { MobileDrawer } from './MobileDrawer';
import { Footer } from './Footer';
import { useHideOnScroll } from '../lib/hooks';
import { I } from '../lib/icons';

const OPEN_DELAY = 150;

const Layout: React.FC = () => {
  const { t } = useTranslation(['theme']);
  const { store } = useStore();
  const { cart, isOpen: cartOpen, openCart, closeCart } = useCart();
  const { count: wishlistCount } = useWishlist();
  const { categories } = useCategories();
  const { items: menuItems } = useMenu('header');
  const location = useLocation();

  // ── settings ──
  const sticky = useThemeSetting<boolean>('sticky_header') !== false;
  const headerLayout = useThemeSetting<string>('header_layout') || 'logo_start';
  const showUtility = useThemeSetting<boolean>('show_utility_bar') !== false;
  const utilityBg = useThemeSetting<string>('utility_background');
  const utilitySocial = useThemeSetting<boolean>('utility_show_social') !== false;
  const utilityLang = useThemeSetting<boolean>('utility_show_language') !== false;
  const showBar = useThemeSetting<boolean>('show_announcement_bar') !== false;
  const showWishlistIcon = useThemeSetting<boolean>('show_wishlist_icon') !== false;
  const showAccountIcon = useThemeSetting<boolean>('show_account_icon') !== false;
  const floatingWhats = useThemeSetting<boolean>('show_floating_whatsapp') === true;

  const { hidden, scrolled } = useHideOnScroll(96);

  /** Merchant copy wins; otherwise the theme's translations supply it, so a
   *  fresh install reads in the shopper's language instead of English. */
  const msg = (v: string | undefined, key: string) => (v && v.trim()) || t(key, { defaultValue: '' });

  const messages = [
    msg(useThemeSetting<string>('announcement_text'), 'theme.announcement.1'),
    msg(useThemeSetting<string>('announcement_text_2'), 'theme.announcement.2'),
    msg(useThemeSetting<string>('announcement_text_3'), 'theme.announcement.3'),
  ].filter(Boolean);
  const announceInterval = Number(useThemeSetting<number>('announcement_interval')) || 5000;
  const announceBg = useThemeSetting<string>('announcement_background');
  const announceColor = useThemeSetting<string>('announcement_color');

  const popular = msg(useThemeSetting<string>('popular_searches'), 'theme.search.popular_defaults')
    .split(/[,،]/).map((s) => s.trim()).filter(Boolean);
  const showPopular = useThemeSetting<boolean>('show_search_popular') !== false;
  const searchImage = useThemeSetting<string>('search_image');

  const promo = {
    show: useThemeSetting<boolean>('mega_show_promo') !== false,
    image: useThemeSetting<string>('mega_image'),
    eyebrow: msg(useThemeSetting<string>('mega_eyebrow'), 'theme.mega.eyebrow'),
    title: msg(useThemeSetting<string>('mega_title'), 'theme.mega.title'),
    ctaText: msg(useThemeSetting<string>('mega_cta_text'), 'theme.mega.cta'),
    ctaUrl: useThemeSetting<string>('mega_cta_url'),
  };

  const utilityPhone = useThemeSetting<string>('utility_phone');
  const utilityEmail = useThemeSetting<string>('utility_email');
  const contact: any = (store as any)?.contact || (store as any)?.contactInfo || null;
  const phone = (utilityPhone || '').trim() || contact?.phone || '';
  const email = (utilityEmail || '').trim() || contact?.email || '';
  const waNumber = (useThemeSetting<string>('whatsapp_number') || '').replace(/[^\d]/g, '');

  const [searchOpen, setSearchOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [mega, setMega] = useState<string | null>(null);
  const timer = useRef<number | null>(null);

  const fallback: MenuItem[] = [
    { label: t('theme.nav.all_products'), url: '/products' } as MenuItem,
    ...categories.slice(0, 4).map((c) => ({ label: c.name, url: `/categories/${c.slug}` } as MenuItem)),
  ];
  const items = menuItems.length ? menuItems : fallback;
  const key = (it: MenuItem, i: number) => it._id || `${it.label}-${i}`;

  const openMega = (k: string) => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setMega(k), OPEN_DELAY);
  };
  const closeMega = useCallback(() => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = null;
    setMega(null);
  }, []);

  useEffect(() => { closeMega(); setDrawerOpen(false); setSearchOpen(false); }, [location.pathname, closeMega]);
  useEffect(() => {
    if (!mega) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeMega(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mega, closeMega]);

  const social = Object.entries(store?.socialLinks || {}).filter((e): e is [string, string] => typeof e[1] === 'string' && !!e[1]);
  const iconBtn = 'relative grid h-11 w-11 place-items-center rounded-full text-ink transition-colors duration-300 hover:bg-sand hover:text-gold-ink';
  const badge = 'misk-num absolute end-1 top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-gold-ink px-1 text-[10px] font-bold text-white';
  const logoCentered = headerLayout === 'logo_center';

  const Logo = ({ className = '' }: { className?: string }) => (
    <Link to="/" className={`flex items-center ${className}`} aria-label={store?.name || 'Home'}>
      {store?.logo
        ? <img src={store.logo} alt={store.name} className="h-9 w-auto object-contain" />
        : <span className="font-display truncate text-2xl text-ink">{store?.name || 'STORE'}</span>}
    </Link>
  );

  const DesktopNav = () => (
    <nav className="hidden items-center lg:flex" aria-label={t('theme.nav.menu')}>
      {items.map((it, i) => {
        const k = key(it, i);
        const hasKids = !!it.children?.length;
        return (
          <div key={k} className="relative" onMouseEnter={() => (hasKids ? openMega(k) : closeMega())} onFocus={() => (hasKids ? openMega(k) : closeMega())}>
            <MenuLink
              item={it}
              className={`misk-eyebrow flex items-center gap-1 px-4 py-6 transition-colors duration-300 hover:text-gold-ink ${mega === k ? 'text-gold-ink' : 'text-ink'}`}
            >
              {it.label}{hasKids && <I.chevronDown className="h-3.5 w-3.5" />}
            </MenuLink>
            {hasKids && <span className={`absolute inset-x-4 bottom-4 h-px bg-gold transition-transform duration-300 ${mega === k ? 'scale-x-100' : 'scale-x-0'}`} />}
          </div>
        );
      })}
    </nav>
  );

  return (
    <div className="flex min-h-screen flex-col bg-white font-body text-ink">
      <a href="#misk-main" className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-[200] focus:rounded-full focus:bg-ink focus:px-5 focus:py-2.5 focus:text-white">
        {t('theme.nav.skip')}
      </a>

      {showUtility && (
        <div className="hidden border-b border-line lg:block" style={utilityBg ? { background: utilityBg } : undefined}>
          <div className="mx-auto flex max-w-[1320px] items-center justify-between gap-4 px-6 py-2 text-xs text-muted">
            <div className="flex items-center gap-5">
              {phone && (
                <a href={`tel:${phone}`} className="flex items-center gap-1.5 transition-colors hover:text-ink">
                  <I.phone className="h-3.5 w-3.5" />
                  <span className="misk-eyebrow">{t('theme.utility.call_us')}</span>
                  <span dir="ltr" className="misk-num font-bold text-ink">{phone}</span>
                </a>
              )}
              {email && (
                <a href={`mailto:${email}`} className="hidden items-center gap-1.5 transition-colors hover:text-ink xl:flex" dir="ltr">
                  <I.mail className="h-3.5 w-3.5" />{email}
                </a>
              )}
            </div>
            <div className="flex items-center gap-3">
              {utilitySocial && social.slice(0, 5).map(([k, url]) => {
                const Icon = (I as any)[k] || I.instagram;
                return (
                  <a key={k} href={url} target="_blank" rel="noopener noreferrer" aria-label={k} className="grid h-7 w-7 place-items-center rounded-full text-muted transition-colors hover:text-ink">
                    <Icon className="h-4 w-4" />
                  </a>
                );
              })}
              {utilityLang && <div className="shrink-0"><LanguageSwitcher /></div>}
            </div>
          </div>
        </div>
      )}

      {showBar && messages.length > 0 && (
        <Announcement messages={messages} interval={announceInterval} background={announceBg} color={announceColor} />
      )}

      <header
        className={`${sticky ? 'sticky top-0' : 'relative'} z-50 bg-white transition-[transform,box-shadow] duration-300 ${sticky && hidden ? '-translate-y-full' : 'translate-y-0'} ${scrolled ? 'shadow-[0_1px_0_var(--color-border)]' : ''}`}
        onMouseLeave={closeMega}
      >
        <div className="mx-auto max-w-[1320px] px-4 sm:px-6">
          <div className={`grid h-16 items-center gap-4 lg:h-[84px] ${logoCentered ? 'grid-cols-[auto_1fr_auto] lg:grid-cols-[1fr_auto_1fr]' : 'grid-cols-[auto_1fr_auto] lg:grid-cols-[auto_1fr_auto]'}`}>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => setDrawerOpen(true)} className={`${iconBtn} lg:hidden`} aria-label={t('theme.nav.menu')} aria-expanded={drawerOpen}>
                <I.menu className="h-6 w-6" />
              </button>
              {!logoCentered && <Logo className="hidden lg:flex" />}
              {logoCentered && <div className="hidden lg:flex"><DesktopNav /></div>}
            </div>

            <div className={`flex ${logoCentered ? 'justify-center' : 'justify-center lg:justify-center'}`}>
              <Logo className="lg:hidden max-w-[56vw]" />
              {logoCentered ? <Logo className="hidden lg:flex" /> : <div className="hidden lg:flex"><DesktopNav /></div>}
            </div>

            <div className="flex items-center justify-end gap-0.5">
              <button type="button" onClick={() => setSearchOpen(true)} className={iconBtn} aria-label={t('theme.search.title')}>
                <I.search className="h-5 w-5" />
              </button>
              {showAccountIcon && (
                <Link to="/account" className={`${iconBtn} hidden lg:grid`} aria-label={t('theme.nav.account')}><I.user className="h-5 w-5" /></Link>
              )}
              {showWishlistIcon && (
                <Link to="/wishlist" className={iconBtn} aria-label={t('theme.nav.wishlist')}>
                  <I.heart className="h-5 w-5" />
                  {wishlistCount > 0 && <span className={badge}>{wishlistCount}</span>}
                </Link>
              )}
              <button type="button" onClick={openCart} className={iconBtn} aria-label={t('theme.nav.cart')}>
                <I.bag className="h-5 w-5" />
                {cart && cart.itemCount > 0 && <span className={badge}>{cart.itemCount}</span>}
              </button>
            </div>
          </div>
        </div>

        {items.map((it, i) => {
          const k = key(it, i);
          if (!it.children?.length || mega !== k) return null;
          return (
            <div key={k} className="absolute inset-x-0 top-full hidden lg:block" onMouseEnter={() => openMega(k)}>
              <MegaMenu item={it} promo={promo} onNavigate={closeMega} browseLabel={t('theme.nav.browse')} />
            </div>
          );
        })}
      </header>

      <main id="misk-main" className="flex-1"><Outlet /></main>

      <Footer />

      {floatingWhats && waNumber && (
        <a
          href={`https://wa.me/${waNumber}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t('theme.whatsapp.aria')}
          /* Sits above the bottom-nav pill on phones, bottom corner on desktop. */
          className="fixed end-4 z-[90] grid h-14 w-14 place-items-center rounded-full bg-[#25D366] text-white shadow-[var(--shadow-lg)] transition-transform duration-300 hover:scale-105 bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px))] md:bottom-6"
        >
          <I.whatsapp className="h-7 w-7" />
        </a>
      )}

      <MobileBottomNav onCartClick={openCart} onSearchClick={() => setSearchOpen(true)} />
      <CartDrawer isOpen={cartOpen} onClose={closeCart} />
      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} popular={showPopular ? popular : []} image={searchImage} />
      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} items={menuItems} fallback={fallback} contact={contact} social={store?.socialLinks} />
    </div>
  );
};

export default Layout;
