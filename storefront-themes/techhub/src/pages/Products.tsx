/**
 * Products — TONMART-style collection page.
 *
 * Layout:
 *   ┌─ breadcrumb + "PRODUCTS" title strip ─────────────────────┐
 *   ├──────────────┬────────────────────────────────────────────┤
 *   │  left rail   │  toolbar (sort · grid/list · count)        │
 *   │              ├────────────────────────────────────────────┤
 *   │  categories  │                                            │
 *   │  filter-by   │  borderless 3-col product grid             │
 *   │  price range │                                            │
 *   │  brand       │                                            │
 *   └──────────────┴────────────────────────────────────────────┘
 */
import React, { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useProducts, useCategories } from '@shared/hooks/useProducts';
import { Skeleton } from '@shared/components/primitives/Skeleton';
import { TonmartProductCard } from '../components/TonmartProductCard';
import { useTranslation } from 'react-i18next';

type ViewMode = 'grid' | 'list';

const Products: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = parseInt(searchParams.get('page') || '1');
  const sort = searchParams.get('sort') || 'newest';
  const search = searchParams.get('search') || '';
  const categorySlug = searchParams.get('category') || '';
  const minPriceParam = searchParams.get('minPrice') || '';
  const maxPriceParam = searchParams.get('maxPrice') || '';
  const brandParam = searchParams.get('brand') || '';
  const inStockParam = searchParams.get('inStock') || '';

  const { categories } = useCategories();
  const matchedCategory = categorySlug
    ? categories.find((c) => c.slug === categorySlug || c._id === categorySlug)
    : undefined;

  const { products, pagination, loading } = useProducts({
    page,
    sort,
    search,
    limit: 12,
    ...(matchedCategory && { category: matchedCategory._id }),
    ...(minPriceParam && { minPrice: Number(minPriceParam) }),
    ...(maxPriceParam && { maxPrice: Number(maxPriceParam) }),
    ...(brandParam && { brand: brandParam }),
    ...(inStockParam === '1' && { inStock: 1 }),
  });

  const { t } = useTranslation(['theme']);

  const SORT_OPTIONS: Array<{ value: string; label: string }> = [
    { value: 'newest', label: t('theme.products.sort_newest') },
    { value: 'price_asc', label: t('theme.products.sort_price_asc') },
    { value: 'price_desc', label: t('theme.products.sort_price_desc') },
    { value: 'popular', label: t('theme.products.sort_popular') },
  ];

  const [view, setView] = useState<ViewMode>('grid');
  const [minPriceInput, setMinPriceInput] = useState(minPriceParam);
  const [maxPriceInput, setMaxPriceInput] = useState(maxPriceParam);

  const updateParam = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value) params.set(key, value);
    else params.delete(key);
    if (key !== 'page') params.set('page', '1');
    setSearchParams(params);
  };

  const clearAll = () => {
    setMinPriceInput('');
    setMaxPriceInput('');
    setSearchParams(new URLSearchParams());
  };

  // Brand facet derived from the loaded page of products. This is a
  // cheap stand-in for a proper server-side facet aggregation.
  const brandFacets = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of products as any[]) {
      const brand = p.brand || p.manufacturer;
      if (!brand) continue;
      map.set(brand, (map.get(brand) || 0) + 1);
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [products]);

  const activeFilters: Array<{ key: string; label: string }> = [];
  if (matchedCategory) activeFilters.push({ key: 'category', label: matchedCategory.name });
  if (brandParam) activeFilters.push({ key: 'brand', label: brandParam });
  if (inStockParam === '1') activeFilters.push({ key: 'inStock', label: t('theme.products.filter_in_stock') });
  if (minPriceParam || maxPriceParam) {
    activeFilters.push({
      key: 'price',
      label: `$${minPriceParam || '0'} – $${maxPriceParam || '∞'}`,
    });
  }

  const removeFilter = (key: string) => {
    const params = new URLSearchParams(searchParams);
    if (key === 'price') {
      params.delete('minPrice');
      params.delete('maxPrice');
      setMinPriceInput('');
      setMaxPriceInput('');
    } else {
      params.delete(key);
    }
    params.set('page', '1');
    setSearchParams(params);
  };

  return (
    <div style={{ backgroundColor: 'var(--color-background)' }}>
      {/* Page title strip */}
      <div
        className="border-b"
        style={{ borderColor: 'var(--color-border)', backgroundColor: 'color-mix(in srgb, var(--color-foreground) 2%, transparent)' }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          <h1
            className="text-2xl md:text-3xl font-black uppercase tracking-tight mb-2"
            style={{ color: 'var(--color-foreground)' }}
          >
            {matchedCategory?.name || t('theme.products.page_title')}
          </h1>
          <nav className="text-xs" style={{ color: 'var(--color-muted)' }}>
            <Link to="/" className="hover:opacity-70">{t('theme.product_detail.breadcrumb_home')}</Link>
            <span className="mx-2">•</span>
            <span>{matchedCategory?.name || t('theme.products.page_title')}</span>
          </nav>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 grid gap-8 lg:grid-cols-[260px_1fr]">
        {/* ── Left sidebar ──────────────────────────────────────── */}
        <aside className="space-y-6">
          {/* Categories */}
          <FilterCard title={t('theme.products.filter_categories')}>
            <ul className="space-y-2">
              <li>
                <button
                  onClick={() => updateParam('category', '')}
                  className="text-[13px] text-start w-full hover:opacity-80 transition"
                  style={{
                    color: !categorySlug ? 'var(--color-primary)' : 'var(--color-foreground)',
                    fontWeight: !categorySlug ? 700 : 400,
                  }}
                >
                  {t('theme.products.filter_all_products')}
                </button>
              </li>
              {categories.map((cat) => {
                const isActive = cat.slug === categorySlug || cat._id === categorySlug;
                return (
                  <li key={cat._id}>
                    <button
                      onClick={() => updateParam('category', cat.slug || cat._id)}
                      className="text-[13px] text-left w-full hover:opacity-80 transition"
                      style={{
                        color: isActive ? 'var(--color-primary)' : 'var(--color-foreground)',
                        fontWeight: isActive ? 700 : 400,
                      }}
                    >
                      {cat.name}
                    </button>
                  </li>
                );
              })}
            </ul>
          </FilterCard>

          {/* Active filters */}
          {activeFilters.length > 0 && (
            <FilterCard
              title={t('theme.products.filter_by')}
              action={
                <button
                  onClick={clearAll}
                  className="text-[10px] font-bold uppercase tracking-wider hover:opacity-80"
                  style={{ color: 'var(--color-primary)' }}
                >
                  {t('theme.products.filter_clear_all')}
                </button>
              }
            >
              <div className="flex flex-wrap gap-2">
                {activeFilters.map((f) => (
                  <button
                    key={f.key}
                    onClick={() => removeFilter(f.key)}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs border transition hover:opacity-80"
                    style={{
                      borderColor: 'var(--color-border)',
                      color: 'var(--color-foreground)',
                    }}
                  >
                    {f.label}
                    <span style={{ color: 'var(--color-muted)' }}>×</span>
                  </button>
                ))}
              </div>
            </FilterCard>
          )}

          {/* Availability */}
          <FilterCard title={t('theme.products.filter_availability')}>
            <label className="flex items-center gap-2 text-[13px] cursor-pointer" style={{ color: 'var(--color-foreground)' }}>
              <input
                type="checkbox"
                checked={inStockParam === '1'}
                onChange={(e) => updateParam('inStock', e.target.checked ? '1' : '')}
                className="rounded"
              />
              {t('theme.products.filter_in_stock')}
            </label>
          </FilterCard>

          {/* Price range */}
          <FilterCard title={t('theme.products.filter_price')}>
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--color-muted)' }}>
                  {t('theme.products.price_min_label')}
                </div>
                <input
                  type="number"
                  value={minPriceInput}
                  onChange={(e) => setMinPriceInput(e.target.value)}
                  onBlur={() => updateParam('minPrice', minPriceInput)}
                  placeholder="$0"
                  className="w-full px-3 py-2 border rounded text-sm focus:outline-none"
                  style={{ borderColor: 'var(--color-border)' }}
                />
              </div>
              <div className="flex-1">
                <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--color-muted)' }}>
                  {t('theme.products.price_max_label')}
                </div>
                <input
                  type="number"
                  value={maxPriceInput}
                  onChange={(e) => setMaxPriceInput(e.target.value)}
                  onBlur={() => updateParam('maxPrice', maxPriceInput)}
                  placeholder="$∞"
                  className="w-full px-3 py-2 border rounded text-sm focus:outline-none"
                  style={{ borderColor: 'var(--color-border)' }}
                />
              </div>
            </div>
          </FilterCard>

          {/* Brand facet */}
          {brandFacets.length > 0 && (
            <FilterCard title={t('theme.products.filter_brand')}>
              <ul className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {brandFacets.map(([brand, count]) => (
                  <li key={brand}>
                    <label className="flex items-center justify-between gap-2 text-[13px] cursor-pointer" style={{ color: 'var(--color-foreground)' }}>
                      <span className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={brandParam === brand}
                          onChange={(e) => updateParam('brand', e.target.checked ? brand : '')}
                          className="rounded"
                        />
                        {brand}
                      </span>
                      <span style={{ color: 'var(--color-muted)' }}>({count})</span>
                    </label>
                  </li>
                ))}
              </ul>
            </FilterCard>
          )}
        </aside>

        {/* ── Main column ──────────────────────────────────────── */}
        <div>
          {/* Toolbar */}
          <div
            className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-4 border-b"
            style={{ borderColor: 'var(--color-border)' }}
          >
            <p className="text-xs" style={{ color: 'var(--color-muted)' }}>
              {t('theme.products.product_count', { count: pagination?.total ?? products.length })}
            </p>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-muted)' }}>
                <span className="uppercase tracking-wider font-semibold">{t('theme.products.sort_by')}</span>
                <select
                  value={sort}
                  onChange={(e) => updateParam('sort', e.target.value)}
                  className="px-3 py-1.5 border rounded text-xs focus:outline-none bg-transparent"
                  style={{ borderColor: 'var(--color-border)', color: 'var(--color-foreground)' }}
                >
                  {SORT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-1 border rounded overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
                <button
                  onClick={() => setView('grid')}
                  className="p-2 transition"
                  aria-label="Grid view"
                  style={{
                    backgroundColor: view === 'grid' ? 'var(--color-primary)' : 'transparent',
                    color: view === 'grid' ? '#fff' : 'var(--color-muted)',
                  }}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h6v6H4zM14 6h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" />
                  </svg>
                </button>
                <button
                  onClick={() => setView('list')}
                  className="p-2 transition"
                  aria-label="List view"
                  style={{
                    backgroundColor: view === 'list' ? 'var(--color-primary)' : 'transparent',
                    color: view === 'list' ? '#fff' : 'var(--color-muted)',
                  }}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* Grid / list */}
          {loading ? (
            <div className={view === 'grid' ? 'grid gap-6 grid-cols-2 md:grid-cols-3' : 'space-y-4'}>
              {Array.from({ length: 9 }).map((_, i) => (
                <Skeleton key={i} className={view === 'grid' ? 'h-80 rounded-xl' : 'h-40 rounded-xl'} />
              ))}
            </div>
          ) : products.length === 0 ? (
            <div
              className="py-24 text-center rounded-lg border"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted)' }}
            >
              <p className="text-sm mb-4">{t('theme.products.no_results_filters')}</p>
              <button
                onClick={clearAll}
                className="text-xs font-bold uppercase tracking-wider underline"
                style={{ color: 'var(--color-primary)' }}
              >
                {t('theme.products.clear_all_filters')}
              </button>
            </div>
          ) : view === 'grid' ? (
            <div className="grid gap-8 grid-cols-2 md:grid-cols-3">
              {products.map((p: any) => (
                <TonmartProductCard key={p._id} product={p} />
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {products.map((p: any) => (
                <Link
                  key={p._id}
                  to={`/products/${p.slug}`}
                  className="flex gap-5 p-4 border rounded-lg transition hover:shadow-sm"
                  style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-background)' }}
                >
                  <div className="flex-none w-40 h-40 rounded-md overflow-hidden">
                    <img
                      src={p.images?.[0] || 'https://placehold.co/300x300?text=Product'}
                      alt={p.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs mb-1" style={{ color: 'var(--color-muted)' }}>
                      {p.brand || 'Manufacturer'}
                    </p>
                    <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--color-foreground)' }}>
                      {p.name}
                    </h3>
                    <p
                      className="text-sm mb-3 line-clamp-2"
                      style={{ color: 'var(--color-muted)' }}
                    >
                      {p.shortDescription || p.description}
                    </p>
                    <div className="flex items-center gap-3">
                      <span className="text-xl font-bold" style={{ color: 'var(--color-primary)' }}>
                        ${Number(p.price || 0).toFixed(2)}
                      </span>
                      {p.compareAtPrice && p.compareAtPrice > p.price && (
                        <span className="text-sm line-through" style={{ color: 'var(--color-muted)' }}>
                          ${Number(p.compareAtPrice).toFixed(2)}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {/* Pagination */}
          {pagination && pagination.pages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-10">
              <button
                onClick={() => updateParam('page', String(page - 1))}
                disabled={page <= 1}
                className="px-4 py-2 text-xs font-bold uppercase tracking-wider border rounded-full disabled:opacity-30 transition hover:opacity-80"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-foreground)' }}
              >
                {t('theme.products.prev')}
              </button>
              {Array.from({ length: pagination.pages }).slice(0, 7).map((_, i) => {
                const n = i + 1;
                const isActive = n === page;
                return (
                  <button
                    key={n}
                    onClick={() => updateParam('page', String(n))}
                    className="w-9 h-9 rounded-full text-xs font-bold transition"
                    style={{
                      backgroundColor: isActive ? 'var(--color-primary)' : 'transparent',
                      color: isActive ? '#fff' : 'var(--color-foreground)',
                      border: `1px solid ${isActive ? 'var(--color-primary)' : 'var(--color-border)'}`,
                    }}
                  >
                    {n}
                  </button>
                );
              })}
              <button
                onClick={() => updateParam('page', String(page + 1))}
                disabled={page >= pagination.pages}
                className="px-4 py-2 text-xs font-bold uppercase tracking-wider border rounded-full disabled:opacity-30 transition hover:opacity-80"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-foreground)' }}
              >
                {t('theme.products.next_arrow')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/* Small card helper used for every sidebar panel — keeps the JSX above tidy. */
const FilterCard: React.FC<{
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, action, children }) => (
  <div
    className="border rounded-lg p-4"
    style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-background)' }}
  >
    <div className="flex items-center justify-between mb-3">
      <h3
        className="text-xs font-bold uppercase tracking-wider"
        style={{ color: 'var(--color-foreground)' }}
      >
        {title}
      </h3>
      {action}
    </div>
    {children}
  </div>
);

export default Products;
