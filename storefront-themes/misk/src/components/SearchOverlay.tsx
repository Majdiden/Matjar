import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { storefrontApi } from '@matjar/theme-shared/api/client';
import { useStore } from '@matjar/theme-shared/contexts/StoreContext';
import { useEscape, useFocusTrap, useBodyScrollLock } from '../lib/hooks';
import { I } from '../lib/icons';

interface Props {
  open: boolean;
  onClose: () => void;
  popular: string[];
  image?: string;
}

const MIN_CHARS = 3;
const DEBOUNCE_MS = 250;
const SHOW_ALL_PAST = 4;
const PLACEHOLDER = 'https://placehold.co/200x200/f4efe7/14110e?text=%20';

/**
 * Full-width search panel dropping from under the header. Popular searches sit
 * as chips; predictive results (min 3 chars, 250ms debounce, in-flight request
 * aborted on every keystroke) fill the panel, with a "see all" row past four.
 *
 * An editorial image fills the end column on desktop and is dropped entirely
 * on phones, where the results need the width more than the mood does.
 */
export const SearchOverlay: React.FC<Props> = ({ open, onClose, popular, image }) => {
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

  useEscape(open, onClose);
  useFocusTrap(panel, open);
  useBodyScrollLock(open);

  useEffect(() => { if (!open) { setQ(''); setResults([]); setTotal(0); } }, [open]);
  useEffect(() => { if (open) window.setTimeout(() => input.current?.focus(), 60); }, [open]);

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
        const data = (res as any)?.data || res;
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

  const go = (term: string) => { onClose(); navigate(`/products?search=${encodeURIComponent(term)}`); };
  const term = q.trim();

  return (
    <div className={`fixed inset-0 z-[120] ${open ? '' : 'pointer-events-none'}`} aria-hidden={!open}>
      <button
        type="button"
        tabIndex={-1}
        aria-label={t('theme.search.close')}
        onClick={onClose}
        className={`absolute inset-0 bg-black/45 transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0'}`}
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal={open ? 'true' : undefined}
        aria-label={t('theme.search.title')}
        className={`misk-drawer absolute inset-x-0 top-0 max-h-[92vh] overflow-y-auto bg-white outline-none ${open ? 'translate-y-0' : '-translate-y-full'}`}
      >
        <div className="mx-auto max-w-[1320px] px-4 py-5 sm:px-6 sm:py-8">
          <div className="flex items-start gap-3">
            <form className="flex-1" onSubmit={(e) => { e.preventDefault(); if (term) go(term); }}>
              <label className="relative block">
                <span className="sr-only">{t('theme.search.title')}</span>
                <input
                  ref={input}
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder={t('theme.search.placeholder')}
                  className="h-14 w-full border-b-2 border-line bg-transparent pe-12 ps-0 font-display text-xl text-ink outline-none transition-colors focus:border-gold-ink sm:text-2xl"
                />
                <button type="submit" className="absolute end-0 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center text-ink" aria-label={t('theme.search.submit')}>
                  <I.search className="h-6 w-6" />
                </button>
              </label>
            </form>
            <button type="button" onClick={onClose} className="mt-1 grid h-12 w-12 place-items-center rounded-full text-ink transition-colors hover:bg-sand" aria-label={t('theme.search.close')}>
              <I.close className="h-6 w-6" />
            </button>
          </div>

          <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,300px)]">
            <div>
              {term.length > 0 && term.length < MIN_CHARS && <p className="text-sm text-muted">{t('theme.search.hint')}</p>}
              {busy && <p className="text-sm text-muted">{t('theme.search.searching')}</p>}
              {!busy && term.length >= MIN_CHARS && results.length === 0 && (
                <p className="text-sm text-muted">{t('theme.search.none', { term })}</p>
              )}

              {results.length > 0 && (
                <ul className="divide-y divide-line">
                  {results.map((p) => (
                    <li key={p._id}>
                      <Link to={`/products/${p.slug}`} onClick={onClose} className="flex items-center gap-4 py-3 transition-colors hover:bg-sand">
                        <img
                          src={p.images?.[0] || PLACEHOLDER}
                          alt=""
                          loading="lazy"
                          className="h-16 w-16 shrink-0 rounded-[var(--radius-sm,6px)] bg-sand object-cover"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-display text-base text-ink">{p.name}</span>
                          <span className="misk-num block text-sm text-muted">{formatPrice(p.price)}</span>
                        </span>
                        <I.chevronRight className="h-5 w-5 shrink-0 text-muted rtl:-scale-x-100" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}

              {total > SHOW_ALL_PAST && (
                <button type="button" onClick={() => go(term)} className="misk-btn misk-btn-outline mt-5">
                  {t('theme.search.see_all', { count: total })}
                </button>
              )}

              {!term && popular.length > 0 && (
                <div>
                  <p className="misk-eyebrow mb-3 text-muted">{t('theme.search.popular')}</p>
                  <div className="flex flex-wrap gap-2">
                    {popular.map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => go(p)}
                        className="min-h-[44px] rounded-full border border-line px-5 text-sm text-ink transition-colors hover:border-gold-ink hover:bg-sand"
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {image && (
              <div className="hidden overflow-hidden rounded-[var(--radius-lg,18px)] bg-sand lg:block">
                <img src={image} alt="" loading="lazy" className="h-full max-h-64 w-full object-cover" />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SearchOverlay;
