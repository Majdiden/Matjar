import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { storefrontApi } from '@matjar/theme-shared/api/client';
import { useStore } from '@matjar/theme-shared/contexts/StoreContext';
import { useTypewriter, useEscape, useFocusTrap, useBodyScrollLock } from '../lib/hooks';
import { I } from '../lib/icons';

interface Props {
  open: boolean;
  onClose: () => void;
  popular: string[];
}

const MIN_CHARS = 3;
const DEBOUNCE_MS = 250;
const SHOW_ALL_PAST = 4;

/**
 * Full-width search panel dropping from under the header. The placeholder
 * types itself out (70ms/char). Popular searches sit as a vertical chip list
 * at the start; predictive results (min 3 chars, 250ms debounce, in-flight
 * request aborted on every keystroke) fill the end; a "see all" row appears
 * past four results.
 */
export const SearchOverlay: React.FC<Props> = ({ open, onClose, popular }) => {
  const { t } = useTranslation(['theme']);
  const navigate = useNavigate();
  const { formatPrice } = useStore();
  const panel = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [busy, setBusy] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const placeholder = useTypewriter(t('theme.search.placeholder'), 70, open && !q);

  useEscape(open, onClose);
  useFocusTrap(panel, open);
  useBodyScrollLock(open);

  useEffect(() => { if (!open) { setQ(''); setResults([]); setTotal(0); } }, [open]);

  useEffect(() => {
    const term = q.trim();
    abort.current?.abort();
    if (term.length < MIN_CHARS) { setResults([]); setTotal(0); setBusy(false); return; }
    const ctrl = new AbortController();
    abort.current = ctrl;
    setBusy(true);
    const id = window.setTimeout(async () => {
      try {
        const res = await storefrontApi.getProducts({ search: term, limit: 6 });
        if (ctrl.signal.aborted) return;
        const data = res?.data || res;
        const list = data?.products || [];
        setResults(list);
        setTotal(data?.pagination?.total ?? list.length);
      } catch {
        if (!ctrl.signal.aborted) { setResults([]); setTotal(0); }
      } finally {
        if (!ctrl.signal.aborted) setBusy(false);
      }
    }, DEBOUNCE_MS);
    return () => { window.clearTimeout(id); ctrl.abort(); };
  }, [q]);

  const go = (term: string) => {
    const v = term.trim();
    if (!v) return;
    onClose();
    navigate(`/products?search=${encodeURIComponent(v)}`);
  };

  return (
    <div className={`fixed inset-0 z-[120] ${open ? '' : 'pointer-events-none'}`} aria-hidden={!open}>
      <button type="button" aria-label={t('theme.search.close')} onClick={onClose} className={`absolute inset-0 bg-black/30 transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0'}`} tabIndex={-1} />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={t('theme.search.title')}
        className={`linen-drawer absolute inset-x-0 top-0 max-h-[92vh] overflow-y-auto bg-cream ${open ? 'translate-y-0 opacity-100' : '-translate-y-6 opacity-0'}`}
      >
        <div className="mx-auto max-w-[1280px] px-4 py-8 sm:px-6 sm:py-12">
          <div className="mb-8 flex items-start justify-between gap-6">
            <h2 className="font-heading text-3xl text-ink sm:text-4xl">{t('theme.search.title')}</h2>
            <button type="button" onClick={onClose} className="grid h-11 w-11 place-items-center border border-line text-ink transition-colors hover:bg-ink hover:text-cream" aria-label={t('theme.search.close')}>
              <I.close className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={(e) => { e.preventDefault(); go(q); }} className="relative">
            <label htmlFor="linen-search" className="sr-only">{t('theme.search.title')}</label>
            <input
              id="linen-search"
              ref={input}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              autoComplete="off"
              placeholder=" "
              className="h-16 w-full rounded-full border border-line bg-white/70 pe-20 ps-7 text-lg text-ink outline-none transition-colors focus:border-bronze"
            />
            {!q && (
              <span className="linen-caret pointer-events-none absolute inset-y-0 start-7 flex items-center text-lg text-dune" aria-hidden>
                {placeholder}
              </span>
            )}
            <button type="submit" className="absolute end-2 top-1/2 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-ink text-cream transition-colors hover:bg-bronze" aria-label={t('theme.search.submit')}>
              <I.search className="h-5 w-5" />
            </button>
          </form>

          <div className="mt-10 grid gap-10 md:grid-cols-[220px_minmax(0,1fr)]">
            <div className="md:border-e md:border-line md:pe-8">
              <p className="linen-eyebrow mb-4 text-dune">{t('theme.search.popular')}</p>
              <ul className="flex flex-wrap gap-2 md:flex-col md:items-start md:gap-1">
                {popular.map((p) => (
                  <li key={p}>
                    <button type="button" onClick={() => { setQ(p); go(p); }} className="rounded-full border border-line px-4 py-1.5 text-sm text-ink transition-colors hover:border-bronze hover:text-clay md:border-0 md:px-0 md:py-1 md:text-base">
                      {p}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div aria-live="polite">
              {q.trim().length >= MIN_CHARS ? (
                busy && results.length === 0 ? (
                  <p className="text-dune">{t('theme.search.searching')}</p>
                ) : results.length === 0 ? (
                  <p className="text-dune">{t('theme.search.none', { term: q.trim() })}</p>
                ) : (
                  <ul className="divide-y divide-line">
                    {results.map((p) => (
                      <li key={p._id}>
                        <Link to={`/products/${p.slug}`} onClick={onClose} className="group flex items-center gap-4 py-3">
                          <span className="h-16 w-16 shrink-0 overflow-hidden bg-sand">
                            {p.images?.[0] && <img src={p.images[0]} alt="" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-heading text-lg text-ink group-hover:text-clay">{p.name}</span>
                            <span className="block text-sm text-dune">{formatPrice(p.price)}</span>
                          </span>
                          <I.arrowRight className="h-4 w-4 text-dune rtl:-scale-x-100" />
                        </Link>
                      </li>
                    ))}
                    {total > SHOW_ALL_PAST && (
                      <li className="pt-4">
                        <button type="button" onClick={() => go(q)} className="linen-btn linen-btn-outline">
                          {t('theme.search.see_all', { count: total })}
                        </button>
                      </li>
                    )}
                  </ul>
                )
              ) : (
                <div className="hidden aspect-[16/9] items-end bg-tint-strong p-6 md:flex">
                  <p className="font-heading text-2xl text-ink">{t('theme.search.hint')}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SearchOverlay;
