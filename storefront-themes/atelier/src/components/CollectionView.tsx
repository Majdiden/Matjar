import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { storefrontApi } from '@matjar/theme-shared/api/client';
import { useCategories } from '@matjar/theme-shared/hooks/useProducts';
import { useThemeSetting } from '@matjar/theme-shared/theme/ThemeProvider';
import { useStore } from '@matjar/theme-shared/contexts/StoreContext';
import { QuickView } from '@matjar/theme-shared/components/discovery/QuickView';
import { Skeleton } from '@matjar/theme-shared/components/primitives/Skeleton';
import AtelierProductCard from './AtelierProductCard';
import { useOverlayA11y } from '../lib/motion';

type View = 'grid-4' | 'grid-3' | 'grid-2' | 'list';
const VIEW_KEY = 'atelier.view_collection';
const SORTS = [
  { value: '', key: 'featured' }, { value: 'popular', key: 'popular' }, { value: 'newest', key: 'newest' },
  { value: 'price_asc', key: 'price_asc' }, { value: 'price_desc', key: 'price_desc' },
];

interface Props {
  title: string;
  description?: string;
  categorySlug?: string;
  categoryId?: string;
  /** Collection handle — a collection is its own entity, not a category. */
  collectionHandle?: string;
  bannerImage?: string;
}

function useViewport() {
  const [w, setW] = useState(typeof window !== 'undefined' ? window.innerWidth : 1280);
  useEffect(() => { const on = () => setW(window.innerWidth); window.addEventListener('resize', on); return () => window.removeEventListener('resize', on); }, []);
  return w;
}

/** Breadcrumb hero, circular category carousel, toolbar, filters (placement is a setting), grid and pagination. */
const CollectionView: React.FC<Props> = ({ title, description, categorySlug, categoryId, collectionHandle, bannerImage }) => {
  const { t } = useTranslation(['theme']);
  const { formatPrice } = useStore();
  const { categories } = useCategories();
  const [params, setParams] = useSearchParams();
  const placement = String(useThemeSetting<string>('filter_placement') || 'start');
  const paginationMode = String(useThemeSetting<string>('pagination') || 'load-more');
  const defaultCols = String(useThemeSetting<string>('default_columns') || '4');
  const perPage = Number(useThemeSetting<number>('products_per_page') || 12);
  const showCats = useThemeSetting<boolean>('collection_show_categories') !== false;
  const globalBanner = useThemeSetting<string>('collection_banner_image');
  const width = useViewport();

  const sort = params.get('sort') || '';
  const minPrice = params.get('min') || '';
  const maxPrice = params.get('max') || '';
  const availability = params.get('avail') || '';
  const page = Math.max(1, Number(params.get('page') || 1));

  const [view, setView] = useState<View>(() => { try { return (localStorage.getItem(VIEW_KEY) as View) || (`grid-${defaultCols}` as View); } catch { return `grid-${defaultCols}` as View; } });
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loaded, setLoaded] = useState(1);
  const [priceMax, setPriceMax] = useState(0);
  const [drawer, setDrawer] = useState(false);
  const [quick, setQuick] = useState<any>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  useOverlayA11y(drawer, () => setDrawer(false), drawerRef);

  const set = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => { if (v == null || v === '') next.delete(k); else next.set(k, v); });
    if (!('page' in patch)) next.delete('page');
    setParams(next, { replace: true });
  };
  const persistView = (v: View) => { setView(v); try { localStorage.setItem(VIEW_KEY, v); } catch { /* ignore */ } };

  const query = useMemo(() => {
    const q: Record<string, string | number> = { limit: perPage };
    if (sort) q.sort = sort;
    if (minPrice) q.minPrice = minPrice;
    if (maxPrice) q.maxPrice = maxPrice;
    if (categoryId) q.category = categoryId;
    return q;
  }, [perPage, sort, minPrice, maxPrice, categoryId]);

  const fetchPage = async (p: number) => {
    const res: any = collectionHandle
      ? await storefrontApi.getCollection(collectionHandle, { ...query, page: p })
      : categorySlug && !categoryId
        ? await storefrontApi.getCategory(categorySlug, { ...query, page: p })
        : await storefrontApi.getProducts({ ...query, page: p });
    const d = res?.data || {};
    return { products: d.products || [], pagination: d.pagination || null };
  };

  useEffect(() => {
    let live = true;
    setLoading(true);
    const first = paginationMode === 'numbered' ? page : 1;
    fetchPage(first).then(({ products, pagination }) => {
      if (!live) return;
      setItems(products); setLoaded(first);
      setTotal(pagination?.total ?? products.length);
      setPages(pagination?.pages ?? pagination?.totalPages ?? 1);
    }).catch(() => { if (live) { setItems([]); setTotal(0); } }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [JSON.stringify(query), page, paginationMode, categorySlug, collectionHandle]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let live = true;
    const q: Record<string, string | number> = { sort: 'price_desc', limit: 1 };
    if (categoryId) q.category = categoryId;
    (categorySlug && !categoryId ? storefrontApi.getCategory(categorySlug, q) : storefrontApi.getProducts(q))
      .then((r: any) => { const p = r?.data?.products?.[0]; if (live && p) setPriceMax(Math.ceil(p.price)); }).catch(() => {});
    return () => { live = false; };
  }, [categoryId, categorySlug]);

  const loadMore = async () => {
    setLoadingMore(true);
    try { const { products } = await fetchPage(loaded + 1); setItems((cur) => [...cur, ...products]); setLoaded((n) => n + 1); }
    finally { setLoadingMore(false); }
  };

  // Availability is applied client-side (the API has no stock facet).
  const visible = availability === 'in' ? items.filter((p) => (p.stock ?? 0) > 0) : availability === 'out' ? items.filter((p) => (p.stock ?? 0) <= 0) : items;
  const inCount = items.filter((p) => (p.stock ?? 0) > 0).length;
  const outCount = items.length - inCount;

  // Force 3 columns below 992px and 2 below 768px regardless of preference.
  const effective: View = width < 768 ? (view === 'list' ? 'list' : 'grid-2') : width < 992 ? (view === 'list' ? 'list' : 'grid-3') : view;
  // With a sidebar the content column is ~280px narrower, so a 4-up grid
  // renders cards visibly smaller than the same card everywhere else. Cap it
  // at 3 columns in that layout so a product card is one size sitewide.
  const hasSidebar = placement === 'start' || placement === 'end';
  const gridCls = effective === 'list' ? 'grid-cols-1'
    : effective === 'grid-2' ? 'grid-cols-2'
    : effective === 'grid-3' ? 'grid-cols-2 md:grid-cols-3'
    : hasSidebar ? 'grid-cols-2 md:grid-cols-3' : 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4';
  const activeChips = [
    minPrice || maxPrice ? { key: 'price', label: `${formatPrice(Number(minPrice || 0))} – ${formatPrice(Number(maxPrice || priceMax))}`, clear: () => set({ min: null, max: null }) } : null,
    availability ? { key: 'avail', label: availability === 'in' ? t('theme.collection.in_stock') : t('theme.collection.out_of_stock'), clear: () => set({ avail: null }) } : null,
  ].filter(Boolean) as { key: string; label: string; clear: () => void }[];

  const banner = bannerImage || globalBanner;
  const isDrawer = placement.startsWith('drawer');
  const drawerSide = placement.replace('drawer-', '') as 'start' | 'top' | 'bottom';

  const filters = (
    <div className="space-y-6">
      <div>
        <p className="flex items-center gap-2 text-[12px] font-extrabold uppercase tracking-[0.16em]"><svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 6h16M7 12h10M10 18h4" /></svg>{t('theme.collection.categories')}</p>
        <ul className="mt-3 flex flex-wrap gap-2">
          {categories.slice(0, 12).map((c: any) => (
            <li key={c._id}><Link to={`/categories/${c.slug}`} onClick={() => setDrawer(false)} className={`inline-block rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-colors duration-300 ${c.slug === categorySlug ? 'border-[#1c1c1c] bg-[#1c1c1c] text-white' : 'border-[#c8c8c8] bg-[#f2f2f2] text-[#1c1c1c] hover:border-[#1c1c1c]'}`}>{c.name}</Link></li>
          ))}
        </ul>
      </div>
      <details open className="border-t border-[#e5e5e5] pt-4">
        <summary className="flex cursor-pointer list-none items-center justify-between text-[12px] font-extrabold uppercase tracking-[0.16em]"><span>{t('theme.collection.availability')}</span>{availability && <button type="button" onClick={(e) => { e.preventDefault(); set({ avail: null }); }} className="text-[11px] font-bold text-[#6b6b6b] at-link-hover">{t('theme.collection.reset')}</button>}</summary>
        <div className="mt-3 space-y-2">
          {[{ v: 'in', n: inCount, l: t('theme.collection.in_stock') }, { v: 'out', n: outCount, l: t('theme.collection.out_of_stock') }].map((o) => (
            <label key={o.v} className={`group/chk flex items-center gap-3 text-[14px] ${o.n === 0 ? 'text-[#a8a8a8]' : 'text-[#1c1c1c]'}`}>
              <input type="checkbox" checked={availability === o.v} disabled={o.n === 0 && availability !== o.v} onChange={(e) => set({ avail: e.target.checked ? o.v : null })} className="peer sr-only" />
              <span className="flex h-[18px] w-[18px] items-center justify-center rounded-[4px] border border-[#d0d0d0] transition-all duration-150 ease-linear peer-checked:border-[#1c1c1c] peer-checked:bg-[#1c1c1c] group-hover/chk:border-[#1c1c1c]"><svg className="h-3 w-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M20 6L9 17l-5-5" /></svg></span>
              <span className="transition-[font-weight,color] duration-200 group-hover/chk:font-medium group-hover/chk:text-[color:var(--atelier-bronze-ink)]">{o.l} ({o.n})</span>
            </label>
          ))}
        </div>
      </details>
      <details open className="border-t border-[#e5e5e5] pt-4">
        <summary className="flex cursor-pointer list-none items-center justify-between text-[12px] font-extrabold uppercase tracking-[0.16em]"><span>{t('theme.collection.price')}</span>{(minPrice || maxPrice) && <button type="button" onClick={(e) => { e.preventDefault(); set({ min: null, max: null }); }} className="text-[11px] font-bold text-[#6b6b6b] at-link-hover">{t('theme.collection.reset')}</button>}</summary>
        <PriceRange max={priceMax || 100} min={Number(minPrice || 0)} value={Number(maxPrice || priceMax || 100)} onCommit={(lo, hi) => set({ min: lo > 0 ? String(lo) : null, max: hi < (priceMax || 100) ? String(hi) : null })} format={formatPrice} />
      </details>
    </div>
  );

  return (
    <div>
      {/* Breadcrumb hero */}
      <div className="relative flex min-h-[220px] items-center justify-center overflow-hidden bg-[#1c1c1c] px-4 py-16 text-center text-white sm:min-h-[280px]">
        {banner && <img src={banner} alt="" className="absolute inset-0 h-full w-full object-cover opacity-60" />}
        <div className="absolute inset-0 bg-black/30" />
        <div className="relative">
          <h1 className="font-display text-[36px] font-medium uppercase leading-tight sm:text-[48px]">{title}</h1>
          <nav aria-label="Breadcrumb" className="mt-3 text-[12px] font-semibold uppercase tracking-[0.14em] text-white/80"><Link to="/" className="at-link-hover-light">{t('theme.layout.nav.home')}</Link><span className="mx-2">•</span><span>{title}</span></nav>
        </div>
      </div>
      {description && <p className="mx-auto max-w-2xl px-4 pt-8 text-center text-[15px] text-[#4a4a4a]">{description}</p>}

      {/* Circular category carousel */}
      {showCats && categories.length > 0 && (
        <div className="mx-auto max-w-[1320px] px-4 pt-10 sm:px-6">
          <CategoryCarousel categories={categories} active={categorySlug} />
        </div>
      )}

      <div className={`mx-auto max-w-[1320px] px-4 py-10 sm:px-6 ${placement === 'start' || placement === 'end' ? 'lg:grid lg:gap-10' : ''} ${placement === 'start' ? 'lg:grid-cols-[280px_1fr]' : placement === 'end' ? 'lg:grid-cols-[1fr_280px]' : ''}`}>
        {(placement === 'start' || placement === 'end') && <aside className={`hidden lg:block ${placement === 'end' ? 'lg:order-2' : ''}`}>{filters}</aside>}
        <div className="min-w-0">
          {placement === 'top' && <div className="mb-8 hidden rounded-[var(--atelier-radius-card)] border border-[#e5e5e5] p-5 lg:block">{filters}</div>}
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-3 border-b border-[#e5e5e5] pb-4">
            <button type="button" onClick={() => setDrawer(true)} className={`at-btn at-btn-outline !min-h-[44px] !px-5 !py-2 text-[12px] ${isDrawer ? '' : 'lg:hidden'}`}><svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 6h16M7 12h10M10 18h4" /></svg>{t('theme.collection.filter')}</button>
            <div className="hidden items-center gap-1.5 sm:flex" role="group" aria-label={t('theme.collection.view')}>
              {(['grid-4', 'grid-3', 'grid-2', 'list'] as View[]).filter((v) => v !== 'grid-4' || defaultCols === '4').map((v) => (
                <button key={v} type="button" onClick={() => persistView(v)} aria-pressed={view === v} aria-label={t(`theme.collection.view_${v.replace('-', '_')}`)} className={`flex h-[42px] w-[42px] items-center justify-center rounded-[5px] transition-colors duration-300 ${view === v ? 'bg-[#000] text-white' : 'bg-[#e9ebeb] text-[#595959] hover:bg-[#000] hover:text-white'}`}>
                  <ViewGlyph v={v} />
                </button>
              ))}
            </div>
            <label className="ms-auto flex items-center gap-2 text-[12px] font-bold uppercase">
              <span className="hidden sm:inline">{t('theme.collection.sort_by')}</span>
              <select value={sort} onChange={(e) => set({ sort: e.target.value || null })} className="at-select min-h-[44px]">
                {SORTS.map((o) => <option key={o.key} value={o.value}>{t(`theme.collection.sort.${o.key}`)}</option>)}
              </select>
            </label>
          </div>
          {activeChips.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-2 border-b border-[#dcdcdc] pb-4">
              {activeChips.map((c) => <button key={c.key} type="button" onClick={c.clear} className="inline-flex items-center gap-2 rounded-full border border-[#c8c8c8] px-3 py-1 text-[12px] font-semibold transition-colors hover:border-[#1c1c1c]">{c.label}<span aria-hidden>×</span></button>)}
              <button type="button" onClick={() => set({ min: null, max: null, avail: null })} className="text-[12px] font-bold uppercase tracking-wider at-link-hover">{t('theme.collection.clear_all')}</button>
            </div>
          )}

          {/* Grid */}
          {loading ? (
            <div className={`mt-8 grid gap-x-5 gap-y-10 ${gridCls}`}>{Array.from({ length: 8 }).map((_, i) => <div key={i}><Skeleton className="aspect-[4/5] rounded-[var(--atelier-radius-card)]" /><Skeleton className="mt-3 h-4 w-3/4" /></div>)}</div>
          ) : visible.length === 0 ? (
            <div className="py-20 text-center"><p className="font-display text-2xl">{t('theme.collection.empty_title')}</p><p className="mt-2 text-sm text-[#6b6b6b]">{t('theme.collection.empty_body')}</p></div>
          ) : (
            <div className={`mt-8 grid gap-x-5 ${effective === 'list' ? 'gap-y-6' : 'gap-y-10'} ${gridCls}`}>
              {visible.map((p) => <AtelierProductCard key={p._id} product={p} view={effective === 'list' ? 'list' : 'grid'} onQuickView={setQuick} />)}
            </div>
          )}

          {/* Pagination */}
          {!loading && total > 0 && (
            <div className="mt-12 flex flex-col items-center gap-4">
              {paginationMode === 'numbered' ? (
                <>
                  <p className="text-[12px] text-[#6b6b6b]">{t('theme.collection.showing_range', { start: (page - 1) * perPage + 1, end: Math.min(page * perPage, total), total })}</p>
                  <nav className="flex items-center gap-1" aria-label="Pagination">
                    <button type="button" disabled={page <= 1} onClick={() => set({ page: String(page - 1) })} className="at-btn at-btn-outline !px-4 !py-2 text-[12px]">{t('theme.collection.prev')}</button>
                    {Array.from({ length: pages }).map((_, i) => <button key={i} type="button" onClick={() => set({ page: String(i + 1) })} aria-current={page === i + 1 ? 'page' : undefined} className={`h-10 w-10 rounded-full text-[13px] font-bold transition-colors ${page === i + 1 ? 'bg-[#1c1c1c] text-white' : 'hover:bg-[#f2f2f2]'}`}>{i + 1}</button>)}
                    <button type="button" disabled={page >= pages} onClick={() => set({ page: String(page + 1) })} className="at-btn at-btn-outline !px-4 !py-2 text-[12px]">{t('theme.collection.next')}</button>
                  </nav>
                </>
              ) : (
                <>
                  <p className="text-[12px] text-[#6b6b6b]">{t('theme.collection.showing', { count: items.length, total })}</p>
                  <div className="h-[7px] w-[250px] overflow-hidden rounded-[20px] bg-[#f2f2f2]"><div className="h-full rounded-[20px] bg-[color:var(--atelier-bronze)] transition-[width] duration-500 ease-linear" style={{ width: `${Math.min(100, (items.length / total) * 100)}%` }} /></div>
                  {loaded < pages && <button type="button" onClick={loadMore} disabled={loadingMore} className="at-btn at-btn-dark">{loadingMore && <span className="at-spinner" />}{t('theme.collection.load_more')}</button>}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Filter drawer (placement setting, and the mobile fallback for sidebars) */}
      <div className={`at-backdrop ${drawer ? 'is-open' : ''}`} onClick={() => setDrawer(false)} aria-hidden />
      <div ref={drawerRef} className={`at-panel ${isDrawer ? `at-panel-${drawerSide}` : 'at-panel-start'} flex flex-col ${drawer ? 'is-open' : ''}`} role={drawer ? 'dialog' : undefined} aria-modal={drawer ? 'true' : undefined} aria-hidden={!drawer} aria-label={t('theme.collection.filter')} tabIndex={-1}>
        <div className="flex items-center justify-between border-b border-[#e5e5e5] px-4 py-3 sm:px-5"><span className="text-[13px] font-extrabold uppercase tracking-[0.16em]">{t('theme.collection.filter')}</span><button type="button" onClick={() => setDrawer(false)} className="at-rotate-hover at-icon-btn h-11 w-11 hover:bg-[#f2f2f2]" aria-label={t('theme.layout.close')}><svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 6l12 12M18 6L6 18" /></svg></button></div>
        <div className={`flex-1 overflow-y-auto at-scrollbar p-4 sm:p-5 ${drawerSide === 'top' || drawerSide === 'bottom' ? 'mx-auto w-full max-w-[1320px] md:grid md:grid-cols-3 md:gap-8 [&>div]:contents' : ''}`}>{filters}</div>
        {/* Sticky footer: results update live; this row makes it visible and closes the sheet. */}
        <div className="at-panel-safe flex items-center gap-3 border-t border-[#e5e5e5] px-4 pt-3 sm:px-5">
          <button type="button" onClick={() => set({ min: null, max: null, avail: null })} disabled={!activeChips.length} className="at-btn at-btn-outline !min-h-[44px] !px-4 text-[12px] disabled:border-transparent">{t('theme.collection.clear_all')}</button>
          <button type="button" onClick={() => setDrawer(false)} className="at-btn at-btn-dark !min-h-[44px] flex-1 text-[12px]">{loading ? <span className="at-spinner" /> : t('theme.collection.show_products', { count: visible.length })}</button>
        </div>
      </div>
      <QuickView product={quick} isOpen={!!quick} onClose={() => setQuick(null)} />
    </div>
  );
};

const ViewGlyph: React.FC<{ v: View }> = ({ v }) => {
  const n = v === 'grid-4' ? 4 : v === 'grid-3' ? 3 : v === 'grid-2' ? 2 : 0;
  if (!n) return <svg className="h-[17px] w-[17px]" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="4" width="18" height="4" rx="1" /><rect x="3" y="10" width="18" height="4" rx="1" /><rect x="3" y="16" width="18" height="4" rx="1" /></svg>;
  const size = v === 'grid-4' ? 'h-[25px] w-[25px]' : 'h-[17px] w-[17px]';
  const w = 18 / n - 1;
  return <svg className={size} viewBox="0 0 24 24" fill="currentColor">{Array.from({ length: n }).map((_, i) => <React.Fragment key={i}><rect x={3 + i * (w + 1)} y="3" width={w} height="8" rx="1" /><rect x={3 + i * (w + 1)} y="13" width={w} height="8" rx="1" /></React.Fragment>)}</svg>;
};

/** Dual-handle price range with quartile tick labels; commits on release. */
const PriceRange: React.FC<{ max: number; min: number; value: number; onCommit: (lo: number, hi: number) => void; format: (n: number) => string }> = ({ max, min, value, onCommit, format }) => {
  const [lo, setLo] = useState(min);
  const [hi, setHi] = useState(value);
  useEffect(() => { setLo(min); setHi(value); }, [min, value]);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(max * f));
  const pctLo = (lo / max) * 100; const pctHi = (hi / max) * 100;
  return (
    <div className="mt-4">
      <div className="relative h-8">
        <div className="absolute top-1/2 h-1 w-full -translate-y-1/2 rounded-full bg-[#e5e5e5]" />
        <div className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-[#1c1c1c]" style={{ insetInlineStart: `${pctLo}%`, width: `${Math.max(0, pctHi - pctLo)}%` }} />
        {[{ v: lo, set: (n: number) => setLo(Math.min(n, hi)) }, { v: hi, set: (n: number) => setHi(Math.max(n, lo)) }].map((h, i) => (
          <input key={i} type="range" min={0} max={max} value={h.v} onChange={(e) => h.set(Number(e.target.value))} onMouseUp={() => onCommit(lo, hi)} onTouchEnd={() => onCommit(lo, hi)} onKeyUp={() => onCommit(lo, hi)}
            onPointerUp={() => onCommit(lo, hi)} onBlur={() => onCommit(lo, hi)}
            className="at-range"
            aria-label={i === 0 ? 'Minimum price' : 'Maximum price'} />
        ))}
      </div>
      <div className="flex justify-between text-[11px] font-semibold text-[#6b6b6b]">{ticks.map((tk, i) => <span key={i}>{tk}</span>)}</div>
      <p className="mt-2 text-[13px] font-bold">{format(lo)} – {format(hi)}</p>
    </div>
  );
};

const CategoryCarousel: React.FC<{ categories: any[]; active?: string }> = ({ categories, active }) => {
  const ref = useRef<HTMLDivElement>(null);
  const { t } = useTranslation(['theme']);
  const scroll = (d: 1 | -1) => { const el = ref.current; if (!el) return; const rtl = document.documentElement.dir === 'rtl'; el.scrollBy({ left: 240 * d * (rtl ? -1 : 1), behavior: 'smooth' }); };
  return (
    <div className="relative">
      <div ref={ref} className="at-hide-scrollbar flex snap-x gap-6 overflow-x-auto scroll-smooth px-1 py-2">
        {categories.map((c) => (
          <Link key={c._id} to={`/categories/${c.slug}`} className="group/cat flex w-[120px] shrink-0 snap-start flex-col items-center text-center">
            <span className={`block h-[100px] w-[100px] overflow-hidden rounded-full border-2 bg-[color:var(--color-accent)] transition-colors duration-300 ${c.slug === active ? 'border-[color:var(--atelier-bronze)]' : 'border-transparent group-hover/cat:border-[#1c1c1c]'}`}>
              {c.image ? <img src={c.image} alt="" className="h-full w-full object-cover transition-transform duration-[450ms] ease-linear group-hover/cat:scale-110" /> : <span className="flex h-full items-center justify-center font-display text-3xl text-[#1c1c1c]/30">{c.name?.[0]}</span>}
            </span>
            <span className="mt-3 text-[13px] font-bold at-link-hover">{c.name}</span>
          </Link>
        ))}
      </div>
      {categories.length > 6 && (
        <>
          <button type="button" onClick={() => scroll(-1)} className="absolute start-0 top-[40px] hidden h-10 w-10 -translate-x-1/2 rtl:translate-x-1/2 items-center justify-center rounded-full bg-white shadow-[0_2px_10px_#0000001a] transition-colors hover:bg-[#1c1c1c] hover:text-white md:flex" aria-label={t('theme.section.hero.prev')}><svg className="h-4 w-4 rtl:rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 6l-6 6 6 6" /></svg></button>
          <button type="button" onClick={() => scroll(1)} className="absolute end-0 top-[40px] hidden h-10 w-10 translate-x-1/2 rtl:-translate-x-1/2 items-center justify-center rounded-full bg-white shadow-[0_2px_10px_#0000001a] transition-colors hover:bg-[#1c1c1c] hover:text-white md:flex" aria-label={t('theme.section.hero.next')}><svg className="h-4 w-4 rtl:rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 6l6 6-6 6" /></svg></button>
        </>
      )}
    </div>
  );
};

export default CollectionView;
