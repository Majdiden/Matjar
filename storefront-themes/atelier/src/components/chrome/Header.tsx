import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useStore } from '@matjar/theme-shared/contexts/StoreContext';
import { useCart } from '@matjar/theme-shared/contexts/CartContext';
import { useWishlist } from '@matjar/theme-shared/hooks/useWishlist';
import { useMenu, type MenuItem } from '@matjar/theme-shared/hooks/useMenu';
import { useCategories, useFeaturedProducts } from '@matjar/theme-shared/hooks/useProducts';
import { useThemeSetting } from '@matjar/theme-shared/theme/ThemeProvider';
import { LanguageSwitcher } from '@matjar/theme-shared/components/LanguageSwitcher';
import { CurrencySelector } from '@matjar/theme-shared/components/commerce/CurrencySelector';
import { useAtelierUI } from '../../contexts/AtelierUI';
import { useStickyReveal } from '../../lib/motion';
import AnnouncementBar from './AnnouncementBar';

const hrefOf = (item: MenuItem) => item.resolvedUrl || item.url || '/';
const isExternal = (item: MenuItem) => item.type === 'external' || item.target === '_blank';

const IconBtn: React.FC<{ label: string; onClick?: () => void; to?: string; badge?: number; children: React.ReactNode; className?: string }> = ({ label, onClick, to, badge, children, className = '' }) => {
  const inner = (
    <>
      {children}
      {!!badge && badge > 0 && (
        <span className="absolute -top-1.5 -end-2 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[color:var(--atelier-bronze-ink)] px-1 text-[10px] font-bold text-white">{badge}</span>
      )}
    </>
  );
  const cls = `relative inline-flex h-10 w-10 items-center justify-center rounded-full transition-colors duration-300 ease-linear hover:bg-white/15 ${className}`;
  return to ? <Link to={to} aria-label={label} className={cls}>{inner}</Link> : <button type="button" onClick={onClick} aria-label={label} className={cls}>{inner}</button>;
};

const SearchIcon = () => <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>;
const UserIcon = () => <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0116 0" /></svg>;
const HeartIcon = () => <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 21s-8-5-8-11a4 4 0 018-1 4 4 0 018 1c0 6-8 11-8 11z" /></svg>;
const BagIcon = () => <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M6 8h12l1 13H5L6 8z" /><path d="M9 8V6a3 3 0 016 0v2" /></svg>;
const MenuIcon = () => <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 7h16M4 12h16M4 17h16" /></svg>;

/** Mega menu panel for one top-level item. */
const MegaPanel: React.FC<{ item: MenuItem; onNavigate: () => void }> = ({ item, onNavigate }) => {
  const { t } = useTranslation(['theme']);
  const { formatPrice } = useStore();
  const showProducts = useThemeSetting<boolean>('mega_menu_products') !== false;
  const limit = Number(useThemeSetting<number>('mega_menu_product_limit') || 4);
  const { products } = useFeaturedProducts(showProducts ? limit : 0);
  const children = item.children || [];
  const groups = children.filter((c) => (c.children || []).length > 0);
  const loose = children.filter((c) => !(c.children || []).length);
  const columns = [...groups.map((g) => ({ title: g.label, href: hrefOf(g), links: g.children || [] })), ...(loose.length ? [{ title: item.label, href: hrefOf(item), links: loose }] : [])];
  return (
    <div className="mx-auto grid max-w-[1320px] grid-cols-12 gap-8 px-6 py-10">
      <div className={`${showProducts && products.length ? 'col-span-7' : 'col-span-12'} grid gap-8`} style={{ gridTemplateColumns: `repeat(${Math.min(4, Math.max(1, columns.length))}, minmax(0,1fr))` }}>
        {columns.map((col) => (
          <div key={col.title}>
            <Link to={col.href} onClick={onNavigate} className="at-eyebrow block pb-3 at-link-hover">{col.title}</Link>
            <ul className="space-y-2">
              {col.links.map((l) => (
                <li key={l._id || l.label}>
                  {isExternal(l)
                    ? <a href={hrefOf(l)} target="_blank" rel="noopener noreferrer" className="text-[14px] text-[#3a3a3a] at-link-hover">{l.label}</a>
                    : <Link to={hrefOf(l)} onClick={onNavigate} className="text-[14px] text-[#3a3a3a] at-link-hover">{l.label}</Link>}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      {showProducts && products.length > 0 && (
        <div className="col-span-5 border-s border-[#e5e5e5] ps-8">
          <p className="at-eyebrow pb-3">{t('theme.layout.mega.featured')}</p>
          <div className="grid grid-cols-2 gap-4">
            {products.slice(0, limit).map((p: any) => (
              <Link key={p._id} to={`/products/${p.slug}`} onClick={onNavigate} className="group/mp flex gap-3">
                <span className="block h-16 w-14 shrink-0 overflow-hidden rounded-[4px] bg-[color:var(--color-accent)]">
                  {p.images?.[0] && <img src={p.images[0]} alt="" className="h-full w-full object-cover transition-transform duration-500 ease-linear group-hover/mp:scale-110" />}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-semibold text-[#1c1c1c] group-hover/mp:text-[color:var(--atelier-bronze-ink)]">{p.name}</span>
                  <span className="block text-[13px] font-extrabold text-[#1c1c1c]">{formatPrice(p.price)}</span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

/** The row of logo / nav / icons, reused by the in-flow header and the sticky clone. */
const HeaderRow: React.FC<{ light: boolean; sticky?: boolean }> = ({ light, sticky }) => {
  const { t } = useTranslation(['theme', 'common']);
  const { store } = useStore();
  const { cart } = useCart();
  const { count: wishlistCount } = useWishlist();
  const { items } = useMenu('header');
  const { categories } = useCategories();
  const { open } = useAtelierUI();
  const location = useLocation();
  const [openMega, setOpenMega] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const nav: MenuItem[] = items.length
    ? items
    : [{ label: t('theme.layout.nav.home'), url: '/' }, { label: t('theme.layout.nav.shop'), url: '/products', children: categories.slice(0, 8).map((c: any) => ({ label: c.name, url: `/categories/${c.slug}` })) }];

  useEffect(() => { setOpenMega(null); }, [location.pathname]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpenMega(null); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
  const enter = (key: string) => { window.clearTimeout(timer.current); timer.current = window.setTimeout(() => setOpenMega(key), 150); };
  const leave = () => { window.clearTimeout(timer.current); timer.current = window.setTimeout(() => setOpenMega(null), 120); };

  const textCls = light ? 'text-white' : 'text-white';
  return (
    <div className={`relative ${textCls}`} onMouseLeave={leave}>
      <div className="mx-auto flex h-[var(--atelier-header-h)] max-w-[1320px] items-center justify-between gap-6 px-4 sm:px-6">
        {/* Mobile: hamburger + search */}
        <div className="flex items-center gap-1 lg:hidden">
          <IconBtn label={t('common:aria.menu')} onClick={() => open('menu')}><MenuIcon /></IconBtn>
          <IconBtn label={t('theme.layout.search')} onClick={() => open('search')}><SearchIcon /></IconBtn>
        </div>

        <Link to="/" className="absolute start-1/2 -translate-x-1/2 rtl:translate-x-1/2 lg:static lg:translate-x-0 rtl:lg:translate-x-0 shrink-0" aria-label={store?.name || 'Home'}>
          {store?.logo
            ? <img src={store.logo} alt={store.name} className={`h-9 w-auto max-w-[150px] object-contain ${light ? 'brightness-0 invert' : 'brightness-0 invert'}`} />
            : <span className="font-display text-[26px] font-semibold tracking-tight">{store?.name || 'Store'}</span>}
        </Link>

        <nav className="hidden lg:flex h-full items-center" aria-label={t('theme.layout.nav.main')}>
          {nav.map((item) => {
            const key = item._id || item.label;
            const hasChildren = (item.children || []).length > 0;
            const href = hrefOf(item);
            const active = location.pathname === href;
            const cls = 'at-underline-anim inline-flex h-full items-center px-3 xl:px-4 text-[14px] font-medium transition-colors duration-300 ease-linear hover:text-[color:var(--atelier-bronze-light)]';
            return (
              <div key={key} className="h-full" onMouseEnter={() => hasChildren && enter(key)} onFocus={() => hasChildren && enter(key)}>
                {isExternal(item)
                  ? <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>{item.label}</a>
                  : <Link to={href} className={cls} aria-current={active ? 'page' : undefined} aria-haspopup={hasChildren || undefined} aria-expanded={hasChildren ? openMega === key : undefined}>
                      {item.label}
                      {hasChildren && <svg className="ms-1 h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 9l6 6 6-6" /></svg>}
                    </Link>}
              </div>
            );
          })}
        </nav>

        <div className="flex items-center gap-0.5">
          <span className="hidden lg:inline-flex"><IconBtn label={t('theme.layout.search')} onClick={() => open('search')}><SearchIcon /></IconBtn></span>
          <span className="hidden lg:inline-flex"><IconBtn label={t('theme.layout.account')} to="/account"><UserIcon /></IconBtn></span>
          <span className="hidden md:inline-flex"><IconBtn label={t('theme.layout.wishlist')} to="/wishlist" badge={wishlistCount || 0}><HeartIcon /></IconBtn></span>
          <IconBtn label={t('theme.layout.cart')} onClick={() => open('minicart')} badge={cart?.itemCount || 0}><BagIcon /></IconBtn>
        </div>
      </div>

      {/* Mega menu panels */}
      {nav.map((item) => {
        const key = item._id || item.label;
        if (!(item.children || []).length) return null;
        const isOpen = openMega === key;
        return (
          <div
            key={key}
            className={`absolute inset-x-0 top-full z-40 bg-white text-[#1c1c1c] shadow-[0_18px_40px_#0000001a] transition-[opacity,transform] duration-300 ease-linear ${isOpen ? 'visible translate-y-0 opacity-100' : 'invisible -translate-y-2 opacity-0'}`}
            onMouseEnter={() => enter(key)}
            aria-hidden={!isOpen}
          >
            <MegaPanel item={item} onNavigate={() => setOpenMega(null)} />
          </div>
        );
      })}
      {sticky && null}
    </div>
  );
};

const UtilityBar: React.FC = () => {
  const { t } = useTranslation(['theme']);
  const { store } = useStore();
  const { count } = useWishlist();
  const show = useThemeSetting<boolean>('show_top_strip') !== false;
  const hotlineLabel = useThemeSetting<string>('hotline_label');
  const hotlinePhone = useThemeSetting<string>('hotline_phone');
  const phone = hotlinePhone || store?.contact?.phone || store?.contactInfo?.phone;
  const email = store?.contact?.email || store?.contactInfo?.email;
  if (!show) return null;
  return (
    <div className="at-util-bar hidden lg:block border-b border-white/10 bg-[#141414] text-white/85">
      <div className="mx-auto flex h-9 max-w-[1320px] items-center justify-between px-6 text-[12px]">
        <div className="flex items-center gap-6">
          {phone && <span><span className="font-semibold text-white">{hotlineLabel || t('theme.layout.utility.call')}</span> <a href={`tel:${phone}`} className="at-link-hover-light" dir="ltr">{phone}</a></span>}
          {email && <span><span className="font-semibold text-white">{t('theme.layout.utility.email')}</span> <a href={`mailto:${email}`} className="at-link-hover-light">{email}</a></span>}
        </div>
        <div className="flex items-center gap-4">
          <div className="[&>button]:text-white/85 [&>button]:min-h-0 [&>button]:border-0 [&>button]:px-1 [&>button]:py-0 [&>button]:text-[12px] [&_select]:bg-transparent [&_select]:text-white/85"><CurrencySelector /></div>
          <div className="[&>button]:text-white/85 [&>button]:min-h-0 [&>button]:border-white/25 [&>button]:px-2 [&>button]:py-0.5 [&>button]:text-[12px]"><LanguageSwitcher /></div>
          <Link to="/login" className="at-link-hover-light">{t('theme.layout.utility.login')}</Link>
          <Link to="/register" className="at-link-hover-light">{t('theme.layout.utility.register')}</Link>
          <Link to="/wishlist" className="at-link-hover-light">{t('theme.layout.utility.wishlist', { count: count || 0 })}</Link>
          <Link to="/checkout" className="at-link-hover-light">{t('theme.layout.utility.checkout')}</Link>
        </div>
      </div>
    </div>
  );
};

/**
 * Site header. On the home template it sits absolutely over the hero with
 * light text (setting); elsewhere it is a solid dark bar. A sticky clone
 * reveals on upward scroll and hides on downward scroll (10px dead-zone).
 */
const Header: React.FC = () => {
  const location = useLocation();
  const transparentHome = useThemeSetting<boolean>('header_transparent_home') !== false;
  const stickyEnabled = useThemeSetting<boolean>('sticky_header') !== false;
  const isHome = location.pathname === '/';
  const overlay = transparentHome && isHome;
  const ref = useRef<HTMLDivElement>(null);
  const [headerH, setHeaderH] = useState(120);
  useEffect(() => { if (ref.current) setHeaderH(ref.current.offsetHeight); }, [location.pathname]);
  const { shown } = useStickyReveal(stickyEnabled, headerH);

  return (
    <>
      <div ref={ref} className={`${overlay ? 'absolute inset-x-0 top-0 z-50 bg-gradient-to-b from-black/80 via-black/45 to-transparent' : 'relative z-50 bg-[#1c1c1c]'}`}>
        <AnnouncementBar dark={!overlay} />
        <UtilityBar />
        <HeaderRow light />
      </div>
      {stickyEnabled && (
        <div className={`at-sticky bg-[#1c1c1c] shadow-[0_2px_12px_#0000001f] ${shown ? 'is-shown' : ''}`} aria-hidden={!shown}>
          <HeaderRow light sticky />
        </div>
      )}
    </>
  );
};

export default Header;
