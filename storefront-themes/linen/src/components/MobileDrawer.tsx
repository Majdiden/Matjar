import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { MenuItem } from '@matjar/theme-shared/hooks/useMenu';
import { LanguageSwitcher } from '@matjar/theme-shared/components/LanguageSwitcher';
import { useEscape, useFocusTrap, useBodyScrollLock } from '../lib/hooks';
import { I } from '../lib/icons';
import { MenuLink, itemHref } from './MegaMenu';

interface Props {
  open: boolean;
  onClose: () => void;
  items: MenuItem[];
  fallback: MenuItem[];
  contact?: { email?: string | null; phone?: string | null } | null;
  social?: Record<string, string>;
}

/**
 * Drill-down navigation drawer on the cream surface: tapping an item with
 * children slides to that level (300ms), a back arrow returns. Search at
 * the top, contact + social at the bottom.
 */
export const MobileDrawer: React.FC<Props> = ({ open, onClose, items, fallback, contact, social }) => {
  const { t } = useTranslation(['theme']);
  const navigate = useNavigate();
  const panel = useRef<HTMLDivElement>(null);
  const [stack, setStack] = useState<MenuItem[]>([]);
  const [term, setTerm] = useState('');
  useEscape(open, onClose);
  useFocusTrap(panel, open);
  useBodyScrollLock(open);
  useEffect(() => { if (!open) { setStack([]); setTerm(''); } }, [open]);

  const level = stack[stack.length - 1];
  const list = level ? level.children || [] : items.length ? items : fallback;
  const socialEntries = Object.entries(social || {}).filter((e): e is [string, string] => typeof e[1] === "string" && !!e[1]);
  // Only add our own "Home" row when the merchant menu has no link to "/".
  const isHomeHref = (u?: string | null) => { const v = String(u || '').trim().replace(/[?#].*$/, '').replace(/\/+$/, ''); return v === '' || v === '/' || /^https?:\/\/[^/]+$/.test(v); };
  const hasHome = (items.length ? items : fallback).some((it) => isHomeHref(itemHref(it)));

  return (
    <div className={`fixed inset-0 z-[120] lg:hidden ${open ? '' : 'pointer-events-none'}`} aria-hidden={!open}>
      <button type="button" tabIndex={-1} aria-label={t('theme.nav.close_menu')} onClick={onClose} className={`absolute inset-0 bg-black/40 transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0'}`} />
      <div
        ref={panel}
        role="dialog"
        aria-modal={open ? 'true' : undefined}
        aria-label={t('theme.nav.menu')}
        className={`linen-drawer absolute inset-y-0 start-0 flex w-[88vw] max-w-sm flex-col bg-cream outline-none ${open ? 'translate-x-0' : 'ltr:-translate-x-full rtl:translate-x-full'}`}
      >
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          {level ? (
            <button type="button" onClick={() => setStack((s) => s.slice(0, -1))} className="flex items-center gap-2 py-2 text-ink" aria-label={t('theme.nav.back')}>
              <I.chevronLeft className="h-5 w-5 rtl:-scale-x-100" />
              <span className="linen-eyebrow">{level.label}</span>
            </button>
          ) : (
            <span className="linen-eyebrow text-dune">{t('theme.nav.menu')}</span>
          )}
          <div className="flex items-center gap-1">
            <LanguageSwitcher className="text-ink" />
            <button type="button" onClick={onClose} className="grid h-11 w-11 place-items-center rounded-full text-ink transition-colors hover:bg-sand" aria-label={t('theme.nav.close_menu')}>
              <I.close className="h-5 w-5" />
            </button>
          </div>
        </div>

        {!level && (
          <form className="border-b border-line px-4 py-3" onSubmit={(e) => { e.preventDefault(); if (term.trim()) { onClose(); navigate(`/products?search=${encodeURIComponent(term.trim())}`); } }}>
            <label className="relative block">
              <span className="sr-only">{t('theme.search.title')}</span>
              <input value={term} onChange={(e) => setTerm(e.target.value)} placeholder={t('theme.search.placeholder')} className="h-11 w-full border border-line bg-white/70 pe-11 ps-4 text-base text-ink outline-none focus:border-bronze" />
              <button type="submit" className="absolute end-1 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center text-ink" aria-label={t('theme.search.submit')}><I.search className="h-5 w-5" /></button>
            </label>
          </form>
        )}

        <div className="relative flex-1 overflow-hidden">
          <ul key={level?._id || level?.label || 'root'} className="linen-drawer h-full overflow-y-auto px-2 py-2 animate-[linen-caption_300ms_var(--linen-reveal-ease)_both]">
            {!level && !hasHome && (
              <li><Link to="/" onClick={onClose} className="flex items-center justify-between px-3 py-3.5 font-heading text-xl text-ink">{t('theme.nav.home')}</Link></li>
            )}
            {list.map((item, i) => {
              const kids = item.children || [];
              return (
                <li key={item._id || i} className="border-t border-line">
                  {kids.length ? (
                    <button type="button" onClick={() => setStack((s) => [...s, item])} className="flex w-full items-center justify-between px-3 py-3.5 text-start font-heading text-xl text-ink transition-colors hover:text-clay">
                      {item.label}
                      <I.chevronRight className="h-5 w-5 text-dune rtl:-scale-x-100" />
                    </button>
                  ) : (
                    <MenuLink item={item} onClick={onClose} className="block px-3 py-3.5 font-heading text-xl text-ink transition-colors hover:text-clay" />
                  )}
                </li>
              );
            })}
            {level && (
              <li className="border-t border-line">
                <MenuLink item={level} onClick={onClose} className="linen-eyebrow flex items-center gap-2 px-3 py-4 text-clay">
                  {t('theme.nav.view_all_in', { name: level.label })} <I.arrowRight className="h-4 w-4 rtl:-scale-x-100" />
                </MenuLink>
              </li>
            )}
          </ul>
        </div>

        <div className="space-y-3 border-t border-line px-4 pt-4 text-sm text-dune" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
          <Link to="/account" onClick={onClose} className="flex min-h-[44px] items-center gap-2 text-ink"><I.user className="h-4 w-4" /> {t('theme.nav.account')}</Link>
          {contact?.phone && <a href={`tel:${contact.phone}`} className="block hover:text-clay" dir="ltr">{contact.phone}</a>}
          {contact?.email && <a href={`mailto:${contact.email}`} className="block hover:text-clay" dir="ltr">{contact.email}</a>}
          {socialEntries.length > 0 && (
            <div className="flex gap-3 pt-1">
              {socialEntries.map(([k, url]) => {
                const Icon = (I as any)[k] || I.share;
                return <a key={k} href={url} target="_blank" rel="noopener noreferrer" aria-label={k} className="grid h-9 w-9 place-items-center border border-line text-ink hover:border-bronze hover:text-clay"><Icon className="h-4 w-4" /></a>;
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MobileDrawer;
