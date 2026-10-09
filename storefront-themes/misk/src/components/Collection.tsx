import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { storefrontApi } from '@matjar/theme-shared/api/client';
import { useCategories, useFeaturedProducts } from '@matjar/theme-shared/hooks/useProducts';
import { useStore } from '@matjar/theme-shared/contexts/StoreContext';
import { useThemeSetting } from '@matjar/theme-shared/theme/ThemeProvider';
import { QuickView } from '@matjar/theme-shared/components/discovery/QuickView';
import { Skeleton } from '@matjar/theme-shared/components/primitives/Skeleton';
import { MiskProductCard } from './MiskProductCard';
import { Reveal } from '../lib/Reveal';
import { useStoredState, useEscape, useFocusTrap, useBodyScrollLock } from '../lib/hooks';
import { I } from '../lib/icons';

const SORTS = ['newest', 'price_asc', 'price_desc', 'popular'] as const;

/** Collapsible filter group. Hoisted on purpose: defined inline it would
 *  remount its inputs on every keystroke in the price fields. */
const Group: React.FC<{ label: string; open: boolean; onToggle: () => void; children: React.ReactNode }> = ({ label, open, onToggle, children }) => (
  <div className="border-b border-line py-4">
    <button type="button" onClick={onToggle} aria-expanded={open} className="flex min-h-[44px] w-full items-center justify-between py-1 text-start">
      <span className="misk-eyebrow text-ink">{label}</span>
      <I.chevronDown className={`h-4 w-4 text-muted transition-transform duration-300 ${open ? 'rotate-180' : ''}`} />
    </button>
    {open && <div className="pt-3">{children}</div>}
  </div>
);

interface Props {
  /** Category slug for a category page; undefined for /products. */
  categorySlug?: string;
  /** Collection handle for /collections/:handle. */
  collectionHandle?: string;
  title: string;
  bannerImage?: string;
  description?: string;
}

/**
 * The product listing shared by /products, /categories/:slug and
 * /collections/:handle.
 *
 * Banner (title + breadcrumb + category chips) → filters in the placement the
 * merchant chose (sidebar start/end, a bar above the grid, or a drawer) →
 * toolbar (grid/list toggle persisted per browser, sort, count) → grid or list
 * → load-more or numbered pages. Columns on desktop and on phones are both
 * settings, so a dense catalogue and a sparse one can each look right.
 */
export const Collection: React.FC<Props> = ({ categorySlug, collectionHandle, title, bannerImage, description }) => {
  const { t } = useTranslation(['theme']);
  const { formatPrice } = useStore();
  const [params, setParams] = useSearchParams();
  const { categories, loading: catsLoading } = useCategories();
  const { products: bestSellers } = useFeaturedProducts(3);

  // ── settings ──
  const fallbackBanner = useThemeSetting<string>('collection_banner_image');
  const bannerHeight = Number(useThemeSetting<number>('collection_banner_height')) || 320;
  const showChips = useThemeSetting<boolean>('collection_show_chips') !== false;
  const placement = useThemeSetting<string>('filter_placement') || 'start';
  const desktopCols = String(useThemeSetting<string>('default_columns') || '3');
  const mobileCols = String(useThemeSetting<string>('mobile_columns') || '2');
  const mode = useThemeSetting<string>('pagination') || 'load-more';
  const pageSize = Number(useThemeSetting<number>('products_per_page')) || 12;
  const showToggle = useThemeSetting<boolean>('show_grid_toggle') !== false;

  const sort = (SORTS as readonly string[]).includes(params.get('sort') || '') ? (params.get('sort') as string) : 'newest';
  const search = params.get('search') || '';
  const minPrice = params.get('minPrice') || '';
  const maxPrice = params.get('maxPrice') || '';
  const inStockOnly = params.get('stock') === 'in';
  const paramCategory = params.get('category') || '';
  const urlPage = Math.max(1, Number(params.get('page')) || 1);

  const pageCategory = categorySlug ? categories.find((c: any) => c.slug === categorySlug) : null;
  const categoryId = categorySlug ? (pageCategory?._id as string | undefined) : (paramCategory || undefined);
  const categoriesReady = !categorySlug || !!pageCategory || !catsLoading;

  const [view, setView] = useStoredState<'grid' | 'list'>('misk.collection.view', 'grid');
  const [pages, setPages] = useState<any[][]>([]);
  const [pagination, setPagination] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [quick, setQuick] = useState<any>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [open, setOpen] = useState<Record<string, boolean>>({ availability: true, price: true, category: true });
  const [priceDraft, setPriceDraft] = useState({ min: minPrice, max: maxPrice });
  const drawer = useRef<HTMLDivElement>(null);
  useEscape(filtersOpen, () => setFiltersOpen(false));
  useFocusTrap(drawer, filtersOpen);
  useBodyScrollLock(filtersOpen);

  const query = useMemo(() => {
    const q: Record<string, string | number> = { limit: pageSize, sort };
    if (search) q.search = search;
    if (minPrice) q.minPrice = minPrice;
    if (maxPrice) q.maxPrice = maxPrice;
    if (categoryId) q.category = categoryId;
    return q;
  }, [pageSize, sort, search, minPrice, maxPrice, categoryId]);

  const load = async (page: number) => {
    const res = collectionHandle
      ? await storefrontApi.getCollection(collectionHandle, { ...query, page })
      : categorySlug && !categoryId
        ? await storefrontApi.getCategory(categorySlug, { ...query, page })
        : await storefrontApi.getProducts({ ...query, page });
    const data = (res as any)?.data || res;
    return { list: (data?.products || []) as any[], pagination: data?.pagination || null };
  };

  const numbered = mode === 'numbered';

  useEffect(() => {
    if (!categoriesReady) return;
    let alive = true;
    setLoading(true);
    load(numbered ? urlPage : 1)
      .then(({ list, pagination: pg }) => { if (!alive) return; setPages([list]); setPagination(pg); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(query), categorySlug, collectionHandle, categoriesReady, numbered, urlPage]);

  // Keep the price inputs in step with the URL (back button, Clear all).
  useEffect(() => { setPriceDraft({ min: minPrice, max: maxPrice }); }, [minPrice, maxPrice]);

  const loadMore = async () => {
    if (!pagination || pages.length >= pagination.pages) return;
    setMore(true);
    try {
      const { list, pagination: pg } = await load(pages.length + 1);
      setPages((p) => [...p, list]);
      setPagination(pg);
    } finally { setMore(false); }
  };

  const all = pages.flat();
  const products = inStockOnly ? all.filter((p) => (p.stock ?? 0) > 0) : all;
  const total = inStockOnly ? products.length : (pagination?.total ?? products.length);
  const loaded = inStockOnly ? products.length : all.length;
  const hasMore = pagination ? pages.length < pagination.pages : false;
  const totalPages = pagination?.pages || 1;

  const set = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) { if (v) next.set(k, v); else next.delete(k); }
    // Any filter change restarts pagination — page 3 of the old result set is
    // meaningless against the new one.
    if (!('page' in patch)) next.delete('page');
    setParams(next, { replace: true });
  };

  const activeCount = [minPrice || maxPrice, inStockOnly, paramCategory && !categorySlug, search].filter(Boolean).length;
  const rootCats = categories.filter((c: any) => !c.parent);
  const childrenOf = (id: string) => categories.filter((c: any) => c.parent === id || c.parent?._id === id);
  const toggle = (id: string) => setOpen((o) => ({ ...o, [id]: !o[id] }));

  const fieldCls = 'h-10 w-full min-w-0 rounded-full border border-line bg-white px-4 text-sm text-ink outline-none focus:border-gold-ink';

  const filters = (
    <div>
      <div className="flex items-center justify-between border-b border-line pb-4">
        <span className="font-display text-xl text-ink">{t('theme.collection.filter')}</span>
        {activeCount > 0 && (
          <button type="button" onClick={() => set({ minPrice: null, maxPrice: null, stock: null, category: null, search: null })} className="text-sm text-gold-ink underline-offset-4 hover:underline">
            {t('theme.collection.clear')}
          </button>
        )}
      </div>

      <Group label={t('theme.collection.availability')} open={!!open.availability} onToggle={() => toggle('availability')}>
        <label className="flex min-h-[44px] cursor-pointer items-center gap-3 text-sm text-ink">
          <input type="checkbox" checked={inStockOnly} onChange={(e) => set({ stock: e.target.checked ? 'in' : null })} className="h-5 w-5 accent-[color:var(--color-primary)]" />
          {t('theme.collection.in_stock')}
        </label>
      </Group>

      <Group label={t('theme.collection.price')} open={!!open.price} onToggle={() => toggle('price')}>
        <form className="flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); set({ minPrice: priceDraft.min || null, maxPrice: priceDraft.max || null }); }}>
          <input inputMode="decimal" aria-label={t('theme.collection.min')} placeholder={t('theme.collection.min')} value={priceDraft.min} onChange={(e) => setPriceDraft((d) => ({ ...d, min: e.target.value }))} className={`misk-num ${fieldCls}`} />
          <span className="text-muted">–</span>
          <input inputMode="decimal" aria-label={t('theme.collection.max')} placeholder={t('theme.collection.max')} value={priceDraft.max} onChange={(e) => setPriceDraft((d) => ({ ...d, max: e.target.value }))} className={`misk-num ${fieldCls}`} />
          <button type="submit" className="misk-btn misk-btn-solid h-10 min-h-0 shrink-0 whitespace-nowrap px-4 py-0 text-xs">{t('theme.collection.apply')}</button>
        </form>
      </Group>

      {!categorySlug && rootCats.length > 0 && (
        <Group label={t('theme.collection.category')} open={!!open.category} onToggle={() => toggle('category')}>
          <ul className="space-y-1">
            {rootCats.map((c: any) => {
              const kids = childrenOf(c._id);
              const on = paramCategory === c._id;
              return (
                <li key={c._id}>
                  <div className="flex items-center justify-between">
                    <button type="button" onClick={() => set({ category: on ? null : c._id })} className={`min-h-[44px] py-1 text-start text-sm transition-colors hover:text-gold-ink ${on ? 'font-bold text-gold-ink' : 'text-ink'}`}>{c.name}</button>
                    {kids.length > 0 && (
                      <button type="button" onClick={() => setOpen((o) => ({ ...o, [`cat-${c._id}`]: !o[`cat-${c._id}`] }))} aria-label={c.name} className="grid h-11 w-11 place-items-center text-muted hover:text-ink">
                        {open[`cat-${c._id}`] ? <I.minus className="h-3.5 w-3.5" /> : <I.plus className="h-3.5 w-3.5" />}
                      </button>
                    )}
                  </div>
                  {kids.length > 0 && open[`cat-${c._id}`] && (
                    <ul className="ms-3 border-s border-line ps-3">
                      {kids.map((k: any) => (
                        <li key={k._id}>
                          <button type="button" onClick={() => set({ category: k._id })} className={`py-1 text-sm hover:text-gold-ink ${paramCategory === k._id ? 'font-bold text-gold-ink' : 'text-muted'}`}>{k.name}</button>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </Group>
      )}

      {bestSellers.length > 0 && (
        <div className="py-4">
          <p className="misk-eyebrow mb-3 text-ink">{t('theme.collection.best_sellers')}</p>
          <ul className="space-y-3">
            {bestSellers.map((p: any) => (
              <li key={p._id}>
                <Link to={`/products/${p.slug}`} className="group flex items-center gap-3">
                  <span className="h-14 w-14 shrink-0 overflow-hidden rounded-[var(--radius-sm,6px)] bg-sand">
                    {p.images?.[0] && <img src={p.images[0]} alt="" className="h-full w-full object-cover" loading="lazy" />}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-ink group-hover:text-gold-ink">{p.name}</span>
                    <span className="misk-num text-sm text-muted">{formatPrice(p.price)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );

  const gridCls = `grid gap-x-4 gap-y-10 sm:gap-x-6 ${mobileCols === '1' ? 'grid-cols-1' : 'grid-cols-2'} ${desktopCols === '2' ? 'lg:grid-cols-2' : desktopCols === '4' ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`;
  const sidebar = placement === 'start' || placement === 'end';
  const gridTemplate = sidebar
    ? (placement === 'end' ? 'lg:grid lg:grid-cols-[minmax(0,1fr)_280px] lg:gap-12' : 'lg:grid lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-12')
    : '';

  return (
    <div>
      <div className="relative flex items-center justify-center overflow-hidden bg-ink" style={{ minHeight: `${bannerHeight}px` }}>
        {(bannerImage || fallbackBanner) && <img src={bannerImage || fallbackBanner} alt="" className="absolute inset-0 h-full w-full object-cover" />}
        <div className="absolute inset-0 bg-black/50" />
        <div className="relative w-full px-4 py-12 text-center text-white">
          <h1 className="font-display text-4xl sm:text-5xl">{title}</h1>
          <nav className="misk-eyebrow mt-3 text-white/85" aria-label="breadcrumb">
            <Link to="/" className="hover:text-white">{t('theme.nav.home')}</Link>
            <span className="mx-2" aria-hidden>·</span>
            <span>{title}</span>
          </nav>
          {description && <p className="mx-auto mt-3 max-w-xl text-white/85">{description}</p>}

          {showChips && categories.length > 0 && (
            <ul className="misk-rail misk-snap misk-snap-3 mt-8 justify-center md:mx-0 md:flex md:flex-wrap md:gap-6 md:overflow-visible md:p-0">
              {categories.slice(0, 8).map((c: any) => (
                <li key={c._id}>
                  <Link to={`/categories/${c.slug}`} className="group flex flex-col items-center gap-2">
                    <span className="grid h-16 w-16 place-items-center overflow-hidden rounded-full bg-white/95 sm:h-20 sm:w-20">
                      {(c.image || c.imageUrl) && <img src={c.image || c.imageUrl} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" />}
                    </span>
                    <span className="text-sm text-white">{c.name}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className={`mx-auto max-w-[1320px] px-4 py-10 sm:px-6 ${gridTemplate}`}>
        {sidebar && (
          <aside className={`hidden lg:block ${placement === 'end' ? 'lg:order-2' : 'lg:order-1'}`} aria-label={t('theme.collection.filter')}>
            {filters}
          </aside>
        )}

        <div className={sidebar ? (placement === 'end' ? 'lg:order-1' : 'lg:order-2') : ''}>
          {placement === 'top' && (
            <div className="mb-8 hidden rounded-[var(--radius-lg,18px)] border border-line p-5 lg:block">{filters}</div>
          )}

          <div className="mb-8 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setFiltersOpen(true)}
                className={`misk-btn misk-btn-outline h-10 min-h-0 gap-2 px-4 py-0 text-xs ${placement === 'drawer' ? '' : 'lg:hidden'}`}
              >
                <I.filter className="h-4 w-4" /> {t('theme.collection.filter')}{activeCount ? ` (${activeCount})` : ''}
              </button>

              {showToggle && (
                <div className="hidden items-center gap-1 sm:flex" role="group" aria-label={t('theme.collection.view')}>
                  <button type="button" onClick={() => setView('grid')} aria-pressed={view === 'grid'} aria-label={t('theme.collection.grid_view')} className={`grid h-10 w-10 place-items-center rounded-full border transition-colors ${view === 'grid' ? 'border-ink bg-ink text-white' : 'border-line text-muted hover:text-ink'}`}>
                    <I.grid className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={() => setView('list')} aria-pressed={view === 'list'} aria-label={t('theme.collection.list_view')} className={`grid h-10 w-10 place-items-center rounded-full border transition-colors ${view === 'list' ? 'border-ink bg-ink text-white' : 'border-line text-muted hover:text-ink'}`}>
                    <I.list className="h-4 w-4" />
                  </button>
                </div>
              )}

              <label className="flex items-center gap-2 text-sm text-muted">
                <span className="hidden sm:inline">{t('theme.collection.sort')}</span>
                <select value={sort} onChange={(e) => set({ sort: e.target.value })} className="h-10 rounded-full border border-line bg-white pe-8 ps-4 text-sm text-ink outline-none focus:border-gold-ink">
                  {SORTS.map((s) => <option key={s} value={s}>{t(`theme.collection.sort_${s}`)}</option>)}
                </select>
              </label>
            </div>
            <p className="misk-num text-sm text-muted">{t('theme.collection.results', { count: total })}</p>
          </div>

          {search && (
            <p className="mb-6 text-muted">
              {t('theme.collection.results_for', { term: search })}
              <button type="button" onClick={() => set({ search: null })} className="ms-2 text-gold-ink underline-offset-4 hover:underline">{t('theme.collection.clear')}</button>
            </p>
          )}

          {loading ? (
            <div className={gridCls}>{Array.from({ length: 6 }).map((_, i) => <div key={i}><Skeleton className="aspect-square" /><Skeleton className="mt-4 h-5 w-3/4" /></div>)}</div>
          ) : products.length === 0 ? (
            <div className="py-24 text-center">
              <p className="font-display text-2xl text-ink">{t('theme.collection.empty_title')}</p>
              <p className="mt-2 text-muted">{t('theme.collection.empty_body')}</p>
            </div>
          ) : view === 'list' ? (
            <div className="space-y-10">
              {products.map((p, i) => <Reveal key={p._id} delay={(i % 2) as 0 | 1}><MiskProductCard product={p} variant="list" onQuickView={setQuick} /></Reveal>)}
            </div>
          ) : (
            <div className={gridCls}>
              {products.map((p, i) => <Reveal key={p._id} delay={(i % 3) as 0 | 1 | 2}><MiskProductCard product={p} onQuickView={setQuick} /></Reveal>)}
            </div>
          )}

          {!loading && products.length > 0 && !numbered && (
            <div className="mt-14 flex flex-col items-center gap-4">
              <p className="misk-num text-sm text-muted">{t('theme.collection.showing', { loaded: Math.min(loaded, total), total })}</p>
              <div className="h-[3px] w-56 bg-line"><div className="h-full bg-gold transition-[width] duration-500" style={{ width: `${total ? Math.min(100, (loaded / total) * 100) : 100}%` }} /></div>
              {hasMore && <button type="button" onClick={loadMore} disabled={more} className="misk-btn misk-btn-solid mt-2">{more ? t('theme.collection.loading') : t('theme.collection.load_more')}</button>}
            </div>
          )}

          {!loading && products.length > 0 && numbered && totalPages > 1 && (
            <nav className="mt-14 flex items-center justify-center gap-2" aria-label="pagination">
              <button type="button" disabled={urlPage <= 1} onClick={() => set({ page: String(urlPage - 1) })} aria-label={t('theme.collection.prev_page')} className="grid h-11 w-11 place-items-center rounded-full border border-line text-ink transition-colors hover:border-gold-ink disabled:opacity-40">
                <I.chevronLeft className="h-5 w-5 rtl:-scale-x-100" />
              </button>
              {Array.from({ length: totalPages }).slice(0, 7).map((_, i) => {
                const n = i + 1;
                return (
                  <button key={n} type="button" onClick={() => set({ page: String(n) })} aria-current={n === urlPage ? 'page' : undefined} aria-label={t('theme.collection.page', { page: n })} className={`misk-num grid h-11 w-11 place-items-center rounded-full border text-sm transition-colors ${n === urlPage ? 'border-ink bg-ink text-white' : 'border-line text-ink hover:border-gold-ink'}`}>
                    {n}
                  </button>
                );
              })}
              <button type="button" disabled={urlPage >= totalPages} onClick={() => set({ page: String(urlPage + 1) })} aria-label={t('theme.collection.next_page')} className="grid h-11 w-11 place-items-center rounded-full border border-line text-ink transition-colors hover:border-gold-ink disabled:opacity-40">
                <I.chevronRight className="h-5 w-5 rtl:-scale-x-100" />
              </button>
            </nav>
          )}
        </div>
      </div>

      {/* Filter drawer — the only filter UI on phones, and on every width when
          the merchant picks the "drawer" placement. */}
      <div className={`fixed inset-0 z-[120] ${placement === 'drawer' ? '' : 'lg:hidden'} ${filtersOpen ? '' : 'pointer-events-none'}`} aria-hidden={!filtersOpen}>
        <button type="button" tabIndex={-1} aria-label={t('theme.collection.close')} onClick={() => setFiltersOpen(false)} className={`absolute inset-0 bg-black/45 transition-opacity duration-300 ${filtersOpen ? 'opacity-100' : 'opacity-0'}`} />
        <div
          ref={drawer}
          role="dialog"
          aria-modal={filtersOpen ? 'true' : undefined}
          aria-label={t('theme.collection.filter')}
          className={`misk-drawer misk-scroll absolute inset-y-0 start-0 flex w-[88vw] max-w-sm flex-col bg-white outline-none ${filtersOpen ? 'translate-x-0' : 'ltr:-translate-x-full rtl:translate-x-full'}`}
        >
          <div className="flex items-center justify-end px-4 pt-3">
            <button type="button" onClick={() => setFiltersOpen(false)} className="grid h-11 w-11 place-items-center rounded-full text-ink transition-colors hover:bg-sand" aria-label={t('theme.collection.close')}>
              <I.close className="h-5 w-5" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">{filters}</div>
          <div className="border-t border-line px-4 pt-3" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
            <button type="button" onClick={() => setFiltersOpen(false)} className="misk-btn misk-btn-solid w-full">{t('theme.collection.show_results', { count: total })}</button>
          </div>
        </div>
      </div>

      <QuickView product={quick} isOpen={!!quick} onClose={() => setQuick(null)} />
    </div>
  );
};

export default Collection;
