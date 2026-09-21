import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useStore } from '@matjar/theme-shared/contexts/StoreContext';
import { useMenu, type MenuItem } from '@matjar/theme-shared/hooks/useMenu';
import { useCategories } from '@matjar/theme-shared/hooks/useProducts';
import { LanguageSwitcher } from '@matjar/theme-shared/components/LanguageSwitcher';
import { useAtelierUI } from '../../contexts/AtelierUI';
import { useOverlayA11y } from '../../lib/motion';
import { SocialIcons } from './Footer';

const hrefOf = (i: MenuItem) => i.resolvedUrl || i.url || '/';

/**
 * Drill-down drawer from the start edge: a search field on top, one level
 * of items at a time (children slide in, a back arrow returns), and the
 * store contact + socials at the bottom.
 */
const MobileDrawer: React.FC = () => {
  const { t } = useTranslation(['theme', 'common']);
  const { overlay, close } = useAtelierUI();
  const { store } = useStore();
  const { items } = useMenu('header');
  const { categories } = useCategories();
  const location = useLocation();
  const navigate = useNavigate();
  const ref = useRef<HTMLDivElement>(null);
  const [stack, setStack] = useState<MenuItem[]>([]);
  const [q, setQ] = useState('');
  const isOpen = overlay === 'menu';
  useOverlayA11y(isOpen, close, ref);
  useEffect(() => { close(); setStack([]); }, [location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  const root: MenuItem[] = items.length
    ? items
    : [{ label: t('theme.layout.nav.home'), url: '/' }, { label: t('theme.layout.nav.shop'), url: '/products', children: categories.map((c: any) => ({ label: c.name, url: `/categories/${c.slug}` })) }, { label: t('theme.layout.nav.wishlist'), url: '/wishlist' }, { label: t('theme.layout.nav.account'), url: '/account' }];
  const current = stack.length ? stack[stack.length - 1].children || [] : root;
  const phone = store?.contact?.phone || store?.contactInfo?.phone;
  const email = store?.contact?.email || store?.contactInfo?.email;

  return (
    <>
      <div className={`at-backdrop lg:hidden ${isOpen ? 'is-open' : ''}`} onClick={close} aria-hidden />
      <div ref={ref} className={`at-panel at-panel-start flex flex-col lg:hidden ${isOpen ? 'is-open' : ''}`} role="dialog" aria-modal="true" aria-label={t('common:aria.menu')} tabIndex={-1}>
        <form onSubmit={(e) => { e.preventDefault(); if (q.trim()) { close(); navigate(`/search?q=${encodeURIComponent(q.trim())}`); } }} className="relative border-b border-[#eaeaea] p-4" role="search">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('theme.layout.search_placeholder')} className="at-input h-11 pe-11 text-[12px] font-semibold uppercase placeholder:normal-case" aria-label={t('theme.layout.search')} />
          <button type="submit" className="absolute end-6 top-1/2 -translate-y-1/2 text-[#1c1c1c]" aria-label={t('theme.layout.search')}>
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
          </button>
        </form>
        <div className="relative flex-1 overflow-hidden">
          <div className="absolute inset-0 flex transition-transform duration-300 ease-linear" style={{ transform: `translateX(${stack.length ? (document.documentElement.dir === 'rtl' ? '100%' : '-100%') : '0'})` }}>
            <ul className="w-full shrink-0 overflow-y-auto at-scrollbar py-2">
              {root.map((it) => (
                <li key={it._id || it.label} className="border-b border-[#f2f2f2]">
                  {(it.children || []).length
                    ? <button type="button" onClick={() => setStack([it])} className="flex w-full items-center justify-between px-5 py-3.5 text-[14px] font-semibold at-link-hover"><span>{it.label}</span><svg className="h-4 w-4 rtl:rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 6l6 6-6 6" /></svg></button>
                    : <Link to={hrefOf(it)} className={`block px-5 py-3.5 text-[14px] font-semibold ${location.pathname === hrefOf(it) ? 'text-[color:var(--atelier-bronze-ink)]' : 'at-link-hover'}`} aria-current={location.pathname === hrefOf(it) ? 'page' : undefined}>{it.label}</Link>}
                </li>
              ))}
            </ul>
            <div className="w-full shrink-0 overflow-y-auto at-scrollbar py-2">
              {stack.length > 0 && (
                <>
                  <button type="button" onClick={() => setStack([])} className="flex w-full items-center gap-2 px-5 py-3.5 text-[12px] font-bold uppercase tracking-wider text-[#6b6b6b] at-link-hover">
                    <svg className="h-4 w-4 rtl:rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 6l-6 6 6 6" /></svg>{t('theme.layout.back')}
                  </button>
                  <Link to={hrefOf(stack[0])} className="block border-b border-[#f2f2f2] px-5 py-3 font-display text-xl">{stack[0].label}</Link>
                  <ul>
                    {current.map((it) => (
                      <li key={it._id || it.label} className="border-b border-[#f2f2f2]">
                        <Link to={hrefOf(it)} className="block px-5 py-3 text-[14px] font-semibold at-link-hover">{it.label}</Link>
                        {(it.children || []).length > 0 && (
                          <ul className="pb-2 ps-5">{it.children!.map((c) => <li key={c._id || c.label}><Link to={hrefOf(c)} className="block px-5 py-2 text-[13px] text-[#4a4a4a] at-link-hover">{c.label}</Link></li>)}</ul>
                        )}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="border-t border-[#eaeaea] p-5 text-[13px]">
          <div className="mb-3"><LanguageSwitcher /></div>
          {phone && <p><span className="font-bold">{t('theme.layout.utility.call')}</span> <a href={`tel:${phone}`} dir="ltr" className="at-link-hover">{phone}</a></p>}
          {email && <p><span className="font-bold">{t('theme.layout.utility.email')}</span> <a href={`mailto:${email}`} className="at-link-hover">{email}</a></p>}
          <SocialIcons className="mt-3" />
        </div>
      </div>
    </>
  );
};

export default MobileDrawer;
