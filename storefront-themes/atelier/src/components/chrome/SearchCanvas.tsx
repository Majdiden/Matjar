import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { storefrontApi } from '@matjar/theme-shared/api/client';
import { useStore } from '@matjar/theme-shared/contexts/StoreContext';
import { useThemeSetting } from '@matjar/theme-shared/theme/ThemeProvider';
import { useAtelierUI } from '../../contexts/AtelierUI';
import { useOverlayA11y, useTypewriter } from '../../lib/motion';

/**
 * Full-width search panel dropping from the top. The placeholder types
 * itself out; results are predictive (250ms debounce + AbortController,
 * min 3 chars) with a "see all" row past four results.
 */
const SearchCanvas: React.FC = () => {
  const { t } = useTranslation(['theme']);
  const { overlay, close } = useAtelierUI();
  const { formatPrice } = useStore();
  const navigate = useNavigate();
  const isOpen = overlay === 'search';
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const showPopular = useThemeSetting<boolean>('show_search_popular') !== false;
  const popularRaw = useThemeSetting<string>('popular_searches') || '';
  const popularFallback = t('theme.global.popular_searches', { defaultValue: '' });
  const popular = (popularRaw || popularFallback).split(/[,،]/).map((s) => s.trim()).filter(Boolean);
  const image = useThemeSetting<string>('search_image');
  const placeholder = useTypewriter(t('theme.layout.search_placeholder'), isOpen);

  useOverlayA11y(isOpen, close, ref);
  useEffect(() => { if (isOpen) setTimeout(() => inputRef.current?.focus(), 50); else { setQ(''); setResults([]); } }, [isOpen]);

  useEffect(() => {
    const term = q.trim();
    abortRef.current?.abort();
    if (term.length < 3) { setResults([]); setTotal(0); setBusy(false); return; }
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setBusy(true);
    const id = setTimeout(async () => {
      try {
        const res: any = await storefrontApi.getProducts({ search: term, limit: 5 });
        if (ctrl.signal.aborted) return;
        setResults(res?.data?.products || []);
        setTotal(res?.data?.pagination?.total ?? res?.data?.products?.length ?? 0);
      } catch { if (!ctrl.signal.aborted) setResults([]); }
      finally { if (!ctrl.signal.aborted) setBusy(false); }
    }, 250);
    return () => { clearTimeout(id); ctrl.abort(); };
  }, [q]);

  const submit = (term: string) => {
    const v = term.trim();
    if (!v) return;
    close();
    navigate(`/search?q=${encodeURIComponent(v)}`);
  };

  return (
    <>
      <div className={`at-backdrop ${isOpen ? 'is-open' : ''}`} onClick={close} aria-hidden />
      <div ref={ref} className={`at-panel at-panel-top overflow-y-auto at-scrollbar ${isOpen ? 'is-open' : ''}`} role={isOpen ? 'dialog' : undefined} aria-modal={isOpen ? 'true' : undefined} aria-hidden={!isOpen} aria-label={t('theme.layout.search')} tabIndex={-1}>
        <div className="mx-auto max-w-[1320px] px-4 py-8 sm:px-6 sm:py-12">
          <div className="flex items-start justify-between gap-6">
            <h2 className="font-display text-4xl font-medium sm:text-5xl">{t('theme.layout.search')}</h2>
            <button type="button" onClick={close} className="at-flip-close inline-flex h-11 w-11 items-center justify-center rounded-full bg-[#1c1c1c] text-white transition-colors duration-300 hover:bg-[color:var(--atelier-bronze-ink)]" aria-label={t('theme.layout.close')}>
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
          </div>
          <form onSubmit={(e) => { e.preventDefault(); submit(q); }} className="relative mt-6" role="search">
            <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} className="at-input h-14 pe-16 text-base" aria-label={t('theme.layout.search')} />
            <button type="submit" className="absolute end-1.5 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-[#1c1c1c] text-white transition-colors duration-300 hover:bg-[color:var(--atelier-bronze-ink)]" aria-label={t('theme.layout.search')}>
              {busy ? <span className="at-spinner" /> : <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>}
            </button>
          </form>

          {results.length > 0 ? (
            <ul className="mt-6 divide-y divide-[#e5e5e5] rounded-[var(--atelier-radius-card)] border border-[#e5e5e5]">
              {results.slice(0, 4).map((p) => (
                <li key={p._id}>
                  <Link to={`/products/${p.slug}`} onClick={close} className="flex items-center gap-4 p-3 transition-colors duration-300 hover:bg-[color:var(--color-accent)]">
                    <span className="block h-14 w-12 shrink-0 overflow-hidden rounded-[4px] bg-[color:var(--color-accent)]">{p.images?.[0] && <img src={p.images[0]} alt="" className="h-full w-full object-cover" />}</span>
                    <span className="min-w-0 flex-1"><span className="block truncate text-[14px] font-semibold">{p.name}</span><span className="block text-[13px] font-extrabold">{formatPrice(p.price)}</span></span>
                  </Link>
                </li>
              ))}
              {total > 4 && (
                <li><button type="button" onClick={() => submit(q)} className="block w-full p-3 text-center text-[13px] font-bold uppercase tracking-wider at-link-hover">{t('theme.layout.search_see_all', { count: total })}</button></li>
              )}
            </ul>
          ) : q.trim().length >= 3 && !busy ? (
            <p className="mt-6 text-sm text-[#6b6b6b]">{t('theme.layout.search_none')}</p>
          ) : null}

          {showPopular && popular.length > 0 && q.trim().length < 3 && (
            <div className="mt-8 grid gap-8 md:grid-cols-[220px_1px_1fr]">
              <div>
                <p className="at-eyebrow pb-4">{t('theme.layout.search_popular')}</p>
                <ul className="space-y-2">
                  {popular.map((term) => (
                    <li key={term}><button type="button" onClick={() => { setQ(term); submit(term); }} className="text-[15px] at-link-hover">{term}</button></li>
                  ))}
                </ul>
              </div>
              <div className="hidden md:block bg-[#e5e5e5]" aria-hidden />
              <div className="hidden md:block overflow-hidden rounded-[var(--atelier-radius-card)] bg-[color:var(--color-accent)]">
                {image && <img src={image} alt="" className="h-64 w-full object-cover" />}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default SearchCanvas;
