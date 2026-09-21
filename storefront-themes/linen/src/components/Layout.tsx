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
import { Marquee } from './Marquee';
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
  const { hidden, scrolled } = useHideOnScroll(96);

  const showBar = useThemeSetting<boolean>('show_announcement_bar') !== false;
  const messages = [useThemeSetting<string>('announcement_text'), useThemeSetting<string>('announcement_text_2'), useThemeSetting<string>('announcement_text_3')].filter(Boolean) as string[];
  const popular = (useThemeSetting<string>('popular_searches') || '').split(',').map((s) => s.trim()).filter(Boolean);
  const promo = {
    image: useThemeSetting<string>('mega_image'),
    eyebrow: useThemeSetting<string>('mega_eyebrow'),
    title: useThemeSetting<string>('mega_title'),
    ctaText: useThemeSetting<string>('mega_cta_text'),
    ctaUrl: useThemeSetting<string>('mega_cta_url'),
  };

  const [searchOpen, setSearchOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [mega, setMega] = useState<string | null>(null);
  const timer = useRef<number | null>(null);
  const nav = useRef<HTMLElement>(null);

  const fallback: MenuItem[] = [
    { label: t('theme.nav.all_products'), url: '/products' },
    ...categories.slice(0, 4).map((c) => ({ label: c.name, url: `/categories/${c.slug}` })),
  ];
  const items = menuItems.length ? menuItems : fallback;
  const key = (it: MenuItem, i: number) => it._id || `${it.label}-${i}`;

  const openMega = (k: string) => { if (timer.current) window.clearTimeout(timer.current); timer.current = window.setTimeout(() => setMega(k), OPEN_DELAY); };
  const closeMega = useCallback(() => { if (timer.current) window.clearTimeout(timer.current); timer.current = null; setMega(null); }, []);
  useEffect(() => { closeMega(); setDrawerOpen(false); setSearchOpen(false); }, [location.pathname, closeMega]);
  useEffect(() => {
    if (!mega) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeMega(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mega, closeMega]);

  const iconBtn = 'relative grid h-10 w-10 place-items-center text-ink transition-colors duration-300 hover:text-clay';
  const badge = 'absolute -end-0.5 -top-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-bronze px-1 text-[10px] font-bold text-cream';

  return (
    <div className="flex min-h-screen flex-col bg-cream font-body text-ink">
      <a href="#linen-main" className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-[100] focus:bg-ink focus:px-4 focus:py-2 focus:text-cream">{t('theme.nav.skip')}</a>
      {showBar && <Marquee messages={messages} />}

      <header
        className={`sticky top-0 z-50 bg-cream transition-[transform,box-shadow] duration-300 ${hidden ? '-translate-y-full' : 'translate-y-0'} ${scrolled ? 'shadow-[0_1px_0_var(--color-border)]' : ''}`}
        onMouseLeave={closeMega}
      >
        <div className="mx-auto max-w-[1280px] px-4 sm:px-6">
          <div className="grid h-16 grid-cols-[auto_1fr_auto] items-center gap-4 lg:h-[76px] lg:grid-cols-[1fr_auto_1fr]">
            {/* start: hamburger (mobile) / logo (desktop) */}
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => setDrawerOpen(true)} className={`${iconBtn} lg:hidden`} aria-label={t('theme.nav.menu')} aria-expanded={drawerOpen}>
                <I.menu className="h-6 w-6" />
              </button>
              <Link to="/" className="hidden items-center lg:flex" aria-label={store?.name || 'Home'}>
                {store?.logo ? <img src={store.logo} alt={store.name} className="h-9 w-auto object-contain" /> : <span className="font-heading text-2xl tracking-[0.22em] text-ink">{(store?.name || 'STORE').toUpperCase()}</span>}
              </Link>
            </div>

            {/* centre: logo (mobile) / nav (desktop) */}
            <div className="flex justify-center">
              <Link to="/" className="flex items-center lg:hidden" aria-label={store?.name || 'Home'}>
                {store?.logo ? <img src={store.logo} alt={store.name} className="h-8 w-auto object-contain" /> : <span className="font-heading max-w-[56vw] truncate text-[1.05rem] tracking-[0.14em] text-ink sm:text-xl sm:tracking-[0.2em]">{(store?.name || 'STORE').toUpperCase()}</span>}
              </Link>
              <nav ref={nav} className="hidden items-center lg:flex" aria-label={t('theme.nav.menu')}>
                {items.map((it, i) => {
                  const k = key(it, i);
                  const hasKids = !!it.children?.length;
                  return (
                    <div key={k} className="relative" onMouseEnter={() => (hasKids ? openMega(k) : closeMega())} onFocus={() => (hasKids ? openMega(k) : closeMega())}>
                      <MenuLink item={it} className={`linen-eyebrow flex items-center gap-1 px-3 py-6 text-[0.72rem] transition-colors duration-300 hover:text-clay ${mega === k ? 'text-clay' : 'text-ink'}`}>
                        {it.label}{hasKids && <I.chevronDown className="h-3.5 w-3.5" />}
                      </MenuLink>
                      {hasKids && <span className={`absolute inset-x-3 bottom-4 h-px bg-bronze transition-transform duration-300 ${mega === k ? 'scale-x-100' : 'scale-x-0'}`} />}
                    </div>
                  );
                })}
              </nav>
            </div>

            {/* end: icons */}
            <div className="flex items-center justify-end gap-0.5">
              <div className="hidden lg:block"><LanguageSwitcher /></div>
              <button type="button" onClick={() => setSearchOpen(true)} className={`${iconBtn} hidden lg:grid`} aria-label={t('theme.search.title')}><I.search className="h-5 w-5" /></button>
              <Link to="/wishlist" className={iconBtn} aria-label={t('theme.nav.wishlist')}>
                <I.heart className="h-5 w-5" />
                {wishlistCount > 0 && <span className={badge}>{wishlistCount}</span>}
              </Link>
              <button type="button" onClick={openCart} className={iconBtn} aria-label={t('theme.nav.cart')}>
                <I.bag className="h-5 w-5" />
                {cart && cart.itemCount > 0 && <span className={badge}>{cart.itemCount}</span>}
              </button>
              <Link to="/account" className={`${iconBtn} hidden lg:grid`} aria-label={t('theme.nav.account')}><I.user className="h-5 w-5" /></Link>
            </div>
          </div>
        </div>

        {/* mega menu */}
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

      <main id="linen-main" className="flex-1 pb-20 md:pb-0"><Outlet /></main>

      <Footer />

      <MobileBottomNav onCartClick={openCart} onSearchClick={() => setSearchOpen(true)} />
      <CartDrawer isOpen={cartOpen} onClose={closeCart} />
      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} popular={popular} />
      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} items={menuItems} fallback={fallback} contact={store?.contact} social={store?.socialLinks} />
    </div>
  );
};

export default Layout;
