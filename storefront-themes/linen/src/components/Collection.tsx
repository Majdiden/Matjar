import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { storefrontApi } from '@matjar/theme-shared/api/client';
import { useCategories, useFeaturedProducts } from '@matjar/theme-shared/hooks/useProducts';
import { useStore } from '@matjar/theme-shared/contexts/StoreContext';
import { useThemeSetting } from '@matjar/theme-shared/theme/ThemeProvider';
import { QuickView } from '@matjar/theme-shared/components/discovery/QuickView';
import { Skeleton } from '@matjar/theme-shared/components/primitives/Skeleton';
import { LinenProductCard } from './LinenProductCard';
import { Reveal } from '../lib/Reveal';
import { useStoredState, useEscape, useFocusTrap, useBodyScrollLock } from '../lib/hooks';
import { I } from '../lib/icons';

const PAGE_SIZE = 12;

/** Collapsible filter group (hoisted: defining it inside the page remounted its inputs on every keystroke). */
const Group: React.FC<{ id: string; label: string; open: boolean; onToggle: () => void; children: React.ReactNode }> = ({ label, open, onToggle, children }) => (
  <div className="border-b border-line py-4">
    <button type="button" onClick={onToggle} aria-expanded={open} className="flex min-h-[44px] w-full items-center justify-between py-1 text-start">
      <span className="linen-eyebrow text-ink">{label}</span>
      <I.chevronDown className={`h-4 w-4 text-dune transition-transform duration-300 ${open ? 'rotate-180' : ''}`} />
    </button>
    {open && <div className="pt-3">{children}</div>}
  </div>
);
const SORTS = ['newest', 'price_asc', 'price_desc', 'popular'] as const;

interface Props {
  /** Category slug for a category page; undefined for /products. */
  categorySlug?: string;
  title: string;
  bannerImage?: string;
  description?: string;
}

/**
 * Collection page shared by /products and /categories/:slug.
 * Banner with the title centred over an image → start sidebar filters
 * (availability, price, categories, best sellers) → toolbar (grid/list
 * toggle persisted per browser, native sort, count) → 3-up grid or list →
 * load-more button with a thin progress track. On phones the filters live
 * in a drawer sliding from the start edge.
 */
export const Collection: React.FC<Props> = ({ categorySlug, title, bannerImage, description }) => {
  const { t } = useTranslation(['theme']);
  const { formatPrice } = useStore();
  const [params, setParams] = useSearchParams();
  const { categories, loading: catsLoading } = useCategories();
  const { products: bestSellers } = useFeaturedProducts(3);
  const fallbackBanner = useThemeSetting<string>('plp_banner_image');

  const sort = (SORTS as readonly string[]).includes(params.get('sort') || '') ? (params.get('sort') as string) : 'newest';
  const search = params.get('search') || '';
  const minPrice = params.get('minPrice') || '';
  const maxPrice = params.get('maxPrice') || '';
  const inStockOnly = params.get('stock') === 'in';
  const paramCategory = params.get('category') || '';
  const pageCategory = categorySlug ? categories.find((c: any) => c.slug === categorySlug) : null;
  const categoryId = categorySlug ? (pageCategory?._id as string | undefined) : (paramCategory || undefined);
  const categoriesReady = !categorySlug || !!pageCategory || !catsLoading;

  const [view, setView] = useStoredState<'grid' | 'list'>('linen.collection.view', 'grid');
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
    const q: Record<string, string | number> = { limit: PAGE_SIZE, sort };
    if (search) q.search = search;
    if (minPrice) q.minPrice = minPrice;
    if (maxPrice) q.maxPrice = maxPrice;
    if (categoryId) q.category = categoryId;
    return q;
  }, [sort, search, minPrice, maxPrice, categoryId]);

  const load = async (page: number) => {
    // A category page whose category is unknown (404) falls back to the
    // category endpoint so the empty state still renders.
    const res = categorySlug && !categoryId
      ? await storefrontApi.getCategory(categorySlug, { ...query, page })
      : await storefrontApi.getProducts({ ...query, page });
    const data = res?.data || res;
    return { list: (data?.products || []) as any[], pagination: data?.pagination || null };
  };

  useEffect(() => {
    if (!categoriesReady) return;
    let alive = true;
    setLoading(true);
    load(1).then(({ list, pagination: pg }) => { if (!alive) return; setPages([list]); setPagination(pg); }).finally(() => alive && setLoading(false));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(query), categorySlug, categoriesReady]);

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

  const set = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) { if (v) next.set(k, v); else next.delete(k); }
    setParams(next, { replace: true });
  };
  const activeCount = [minPrice || maxPrice, inStockOnly, paramCategory && !categorySlug, search].filter(Boolean).length;
  const rootCats = categories.filter((c: any) => !c.parent);
  const childrenOf = (id: string) => categories.filter((c: any) => c.parent === id || c.parent?._id === id);

  const toggle = (id: string) => setOpen((o) => ({ ...o, [id]: !o[id] }));

  const filters = (
    <div>
      <div className="flex items-center justify-between border-b border-line pb-4">
        <span className="font-heading text-xl text-ink">{t('theme.collection.filter')}</span>
        {activeCount > 0 && <button type="button" onClick={() => set({ minPrice: null, maxPrice: null, stock: null, category: null, search: null })} className="text-sm text-clay underline-offset-4 hover:underline">{t('theme.collection.clear')}</button>}
      </div>
      <Group id="availability" label={t('theme.collection.availability')} open={!!open.availability} onToggle={() => toggle('availability')}>
        <label className="flex min-h-[44px] cursor-pointer items-center gap-3 text-[0.95rem] text-ink">
          <input type="checkbox" checked={inStockOnly} onChange={(e) => set({ stock: e.target.checked ? 'in' : null })} className="h-5 w-5 accent-[color:var(--color-primary)]" />
          {t('theme.collection.in_stock')}
        </label>
      </Group>
      <Group id="price" label={t('theme.collection.price')} open={!!open.price} onToggle={() => toggle('price')}>
        <form className="flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); set({ minPrice: priceDraft.min || null, maxPrice: priceDraft.max || null }); }}>
          <input inputMode="decimal" aria-label={t('theme.collection.min')} placeholder={t('theme.collection.min')} value={priceDraft.min} onChange={(e) => setPriceDraft((d) => ({ ...d, min: e.target.value }))} className="h-10 w-full min-w-0 border border-line bg-white/70 px-3 text-sm text-ink outline-none focus:border-bronze" />
          <span className="text-dune">–</span>
          <input inputMode="decimal" aria-label={t('theme.collection.max')} placeholder={t('theme.collection.max')} value={priceDraft.max} onChange={(e) => setPriceDraft((d) => ({ ...d, max: e.target.value }))} className="h-10 w-full min-w-0 border border-line bg-white/70 px-3 text-sm text-ink outline-none focus:border-bronze" />
          <button type="submit" className="linen-btn linen-btn-dark h-11 shrink-0 whitespace-nowrap px-3 py-0 text-[0.65rem]">{t('theme.collection.apply')}</button>
        </form>
      </Group>
      {!categorySlug && rootCats.length > 0 && (
        <Group id="category" label={t('theme.collection.category')} open={!!open.category} onToggle={() => toggle('category')}>
          <ul className="space-y-1">
            {rootCats.map((c: any) => {
              const kids = childrenOf(c._id);
              const on = paramCategory === c._id;
              return (
                <li key={c._id}>
                  <div className="flex items-center justify-between">
                    <button type="button" onClick={() => set({ category: on ? null : c._id })} className={`min-h-[44px] py-1 text-start text-[0.95rem] transition-colors hover:text-clay ${on ? 'font-bold text-clay' : 'text-ink'}`}>{c.name}</button>
                    {kids.length > 0 && <button type="button" onClick={() => setOpen((o) => ({ ...o, [`cat-${c._id}`]: !o[`cat-${c._id}`] }))} aria-label={c.name} className="grid h-11 w-11 place-items-center text-dune hover:text-ink">{open[`cat-${c._id}`] ? <I.minus className="h-3.5 w-3.5" /> : <I.plus className="h-3.5 w-3.5" />}</button>}
                  </div>
                  {kids.length > 0 && open[`cat-${c._id}`] && (
                    <ul className="ms-3 border-s border-line ps-3">
                      {kids.map((k: any) => <li key={k._id}><button type="button" onClick={() => set({ category: k._id })} className={`py-1 text-sm hover:text-clay ${paramCategory === k._id ? 'font-bold text-clay' : 'text-dune'}`}>{k.name}</button></li>)}
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
          <p className="linen-eyebrow mb-3 text-ink">{t('theme.collection.best_sellers')}</p>
          <ul className="space-y-3">
            {bestSellers.map((p: any) => (
              <li key={p._id}>
                <Link to={`/products/${p.slug}`} className="group flex items-center gap-3">
                  <span className="h-14 w-14 shrink-0 overflow-hidden bg-sand">{p.images?.[0] && <img src={p.images[0]} alt="" className="h-full w-full object-cover" loading="lazy" />}</span>
                  <span className="min-w-0"><span className="block truncate text-[0.95rem] text-ink group-hover:text-clay">{p.name}</span><span className="text-sm text-dune">{formatPrice(p.price)}</span></span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );

  return (
    <div>
      <div className="relative flex min-h-[220px] items-center justify-center overflow-hidden bg-ink sm:min-h-[300px]">
        {(bannerImage || fallbackBanner) && <img src={bannerImage || fallbackBanner} alt="" className="absolute inset-0 h-full w-full object-cover" />}
        <div className="absolute inset-0 bg-black/45" />
        <div className="relative w-full px-4 py-14 text-center text-cream">
          <p className="linen-eyebrow text-white/85"><Link to="/" className="hover:text-cream">{t('theme.nav.home')}</Link> <span className="mx-2">•</span> {title}</p>
          <h1 className="font-heading mt-3 text-4xl sm:text-5xl">{title}</h1>
          {description && <p className="mx-auto mt-3 max-w-xl text-white/85">{description}</p>}
        </div>
      </div>

      <div className="mx-auto max-w-[1280px] px-4 py-10 sm:px-6 lg:grid lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-12">
        <aside className="hidden lg:block" aria-label={t('theme.collection.filter')}>{filters}</aside>

        <div>
          <div className="mb-8 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setFiltersOpen(true)} className="linen-btn linen-btn-outline h-10 gap-2 px-4 py-0 text-[0.65rem] lg:hidden"><I.filter className="h-4 w-4" /> {t('theme.collection.filter')}{activeCount ? ` (${activeCount})` : ''}</button>
              <div className="hidden items-center gap-1 sm:flex" role="group" aria-label={t('theme.collection.view')}>
                <button type="button" onClick={() => setView('grid')} aria-pressed={view === 'grid'} className={`grid h-10 w-10 place-items-center border transition-colors ${view === 'grid' ? 'border-ink bg-ink text-cream' : 'border-line text-dune hover:text-ink'}`} aria-label={t('theme.collection.grid')}><I.grid className="h-4 w-4" /></button>
                <button type="button" onClick={() => setView('list')} aria-pressed={view === 'list'} className={`grid h-10 w-10 place-items-center border transition-colors ${view === 'list' ? 'border-ink bg-ink text-cream' : 'border-line text-dune hover:text-ink'}`} aria-label={t('theme.collection.list')}><I.list className="h-4 w-4" /></button>
              </div>
              <label className="flex items-center gap-2 text-sm text-dune">
                <span className="hidden sm:inline">{t('theme.collection.sort')}</span>
                <select value={sort} onChange={(e) => set({ sort: e.target.value })} className="h-10 border border-line bg-white/70 pe-8 ps-3 text-sm text-ink outline-none focus:border-bronze">
                  {SORTS.map((s) => <option key={s} value={s}>{t(`theme.collection.sort_${s}`)}</option>)}
                </select>
              </label>
            </div>
            <p className="text-sm text-dune">{t('theme.collection.count', { count: total })}</p>
          </div>

          {search && <p className="mb-6 text-dune">{t('theme.collection.results_for', { term: search })} <button type="button" onClick={() => set({ search: null })} className="ms-2 text-clay underline-offset-4 hover:underline">{t('theme.collection.clear')}</button></p>}

          {loading ? (
            <div className="grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 lg:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <div key={i}><Skeleton className="aspect-square" /><Skeleton className="mt-4 h-5 w-3/4" /></div>)}</div>
          ) : products.length === 0 ? (
            <div className="py-24 text-center">
              <p className="font-heading text-2xl text-ink">{t('theme.collection.empty_title')}</p>
              <p className="mt-2 text-dune">{t('theme.collection.empty_body')}</p>
            </div>
          ) : view === 'list' ? (
            <div className="space-y-10">{products.map((p, i) => <Reveal key={p._id} delay={(i % 2) as 0 | 1}><LinenProductCard product={p} variant="list" onQuickView={setQuick} /></Reveal>)}</div>
          ) : (
            <div className="grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 lg:grid-cols-3">{products.map((p, i) => <Reveal key={p._id} delay={(i % 3) as 0 | 1 | 2}><LinenProductCard product={p} onQuickView={setQuick} /></Reveal>)}</div>
          )}

          {!loading && products.length > 0 && (
            <div className="mt-14 flex flex-col items-center gap-4">
              <p className="text-sm text-dune">{t('theme.collection.showing', { loaded: Math.min(loaded, total), total })}</p>
              <div className="h-[3px] w-56 bg-line"><div className="h-full bg-bronze transition-[width] duration-500" style={{ width: `${total ? Math.min(100, (loaded / total) * 100) : 100}%` }} /></div>
              {hasMore && <button type="button" onClick={loadMore} disabled={more} className="linen-btn linen-btn-solid mt-2">{more ? t('theme.collection.loading') : t('theme.collection.load_more')}</button>}
            </div>
          )}
        </div>
      </div>

      {/* mobile filter drawer */}
      <div className={`fixed inset-0 z-[120] lg:hidden ${filtersOpen ? '' : 'pointer-events-none'}`} aria-hidden={!filtersOpen}>
        <button type="button" tabIndex={-1} aria-label={t('theme.collection.close')} onClick={() => setFiltersOpen(false)} className={`absolute inset-0 bg-black/40 transition-opacity duration-300 ${filtersOpen ? 'opacity-100' : 'opacity-0'}`} />
        <div ref={drawer} role="dialog" aria-modal={filtersOpen ? 'true' : undefined} aria-label={t('theme.collection.filter')} className={`linen-drawer linen-scroll absolute inset-y-0 start-0 flex w-[88vw] max-w-sm flex-col bg-cream outline-none ${filtersOpen ? 'translate-x-0' : 'ltr:-translate-x-full rtl:translate-x-full'}`}>
          <div className="flex items-center justify-end px-4 pt-3">
            <button type="button" onClick={() => setFiltersOpen(false)} className="grid h-11 w-11 place-items-center rounded-full text-ink transition-colors hover:bg-sand" aria-label={t('theme.collection.close')}><I.close className="h-5 w-5" /></button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">{filters}</div>
          <div className="border-t border-line px-4 pt-3" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
            <button type="button" onClick={() => setFiltersOpen(false)} className="linen-btn linen-btn-dark w-full">{t('theme.collection.show_results', { count: total })}</button>
          </div>
        </div>
      </div>

      <QuickView product={quick} isOpen={!!quick} onClose={() => setQuick(null)} />
    </div>
  );
};

export default Collection;
