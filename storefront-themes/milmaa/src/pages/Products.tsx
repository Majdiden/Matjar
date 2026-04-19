import React, { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useProducts, useCategories } from '@shared/hooks/useProducts';
import MilmaaProductCard from '../components/MilmaaProductCard';
import { QuickView } from '@shared/components/discovery/QuickView';
import { Skeleton } from '@shared/components/primitives/Skeleton';

/**
 * Milmaa Products page — cream title banner, pastel sidebar, rounded grid.
 */

const TEAL = 'var(--color-primary)';
const DARK_TEAL = 'var(--color-foreground)';
const PINK = 'var(--color-accent)';
const YELLOW = 'var(--color-secondary)';
const CREAM = 'var(--color-background)';
const MUTED = 'var(--color-muted)';
const HEADING_FONT = 'var(--font-family-heading)';

const FilterBlock: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="bg-white rounded-[28px] p-6 mb-5">
    <h3 className="font-serif text-lg font-bold mb-4 pb-3 border-b border-current/10" style={{ fontFamily: HEADING_FONT, color: DARK_TEAL }}>
      {title}
    </h3>
    {children}
  </div>
);

const Products: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [quick, setQuick] = useState<any>(null);

  const selectedCategory = searchParams.get('category') || '';
  const availability = searchParams.get('availability') || '';
  const priceMin = Number(searchParams.get('min') || 0);
  const priceMax = Number(searchParams.get('max') || 0);
  const sort = searchParams.get('sort') || 'newest';

  const setParam = (k: string, v: string | number) => {
    const next = new URLSearchParams(searchParams);
    if (!v) next.delete(k);
    else next.set(k, String(v));
    setSearchParams(next);
  };

  const params = useMemo(() => {
    const p: Record<string, string | number> = { sort, limit: 24 };
    if (selectedCategory) p.category = selectedCategory;
    if (availability) p.availability = availability;
    if (priceMin) p.minPrice = priceMin;
    if (priceMax) p.maxPrice = priceMax;
    return p;
  }, [selectedCategory, availability, priceMin, priceMax, sort]);

  const { t } = useTranslation('theme');
  const { products, loading } = useProducts(params);
  const { categories } = useCategories();

  return (
    <div style={{ backgroundColor: CREAM }}>
      {/* Title banner */}
      <div className="relative overflow-hidden py-20" style={{ backgroundColor: MUTED }}>
        <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full opacity-60" style={{ backgroundColor: PINK }} />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 text-center">
          <div className="text-[11px] tracking-[0.3em] uppercase mb-3 font-bold opacity-70" style={{ color: DARK_TEAL }}>
            <Link to="/" className="hover:opacity-100">{t('theme.products.breadcrumb_home')}</Link>
            <span className="mx-2">/</span>
            <span>{t('theme.products.breadcrumb_shop')}</span>
          </div>
          <h1 className="font-serif text-5xl md:text-6xl font-semibold" style={{ fontFamily: HEADING_FONT, color: DARK_TEAL }}>
            {t('theme.products.page_title')}
          </h1>
          <p className="mt-4 text-base max-w-md mx-auto opacity-75" style={{ color: DARK_TEAL }}>
            {t('theme.products.page_subtitle')}
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-8">
          {/* Sidebar */}
          <aside>
            <FilterBlock title={t('theme.products.filter_category')}>
              <ul className="space-y-2.5 text-sm">
                <li>
                  <button
                    onClick={() => setParam('category', '')}
                    className={`text-left transition ${selectedCategory === '' ? 'font-bold' : 'opacity-70 hover:opacity-100'}`}
                    style={{ color: DARK_TEAL }}
                  >
                    {t('theme.products.all_products')}
                  </button>
                </li>
                {categories.slice(0, 10).map((cat) => (
                  <li key={cat._id}>
                    <button
                      onClick={() => setParam('category', cat.slug)}
                      className={`text-left transition ${selectedCategory === cat.slug ? 'font-bold' : 'opacity-70 hover:opacity-100'}`}
                      style={{ color: DARK_TEAL }}
                    >
                      {cat.name}
                    </button>
                  </li>
                ))}
              </ul>
            </FilterBlock>

            <FilterBlock title={t('theme.products.filter_availability')}>
              <div className="space-y-3 text-sm" style={{ color: DARK_TEAL }}>
                {[
                  { value: '', label: 'All' },
                  { value: 'in-stock', label: 'In stock' },
                  { value: 'out-of-stock', label: 'Out of stock' },
                ].map((opt) => (
                  <label key={opt.value} className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="availability"
                      checked={availability === opt.value}
                      onChange={() => setParam('availability', opt.value)}
                      className="accent-[var(--color-primary)]"
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </FilterBlock>

            <FilterBlock title={t('theme.products.filter_price')}>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  value={priceMin}
                  onChange={(e) => setParam('min', Number(e.target.value))}
                  placeholder="Min"
                  className="w-full border-b-2 border-current/20 py-2 text-sm focus:outline-none focus:border-[var(--color-primary)] bg-transparent"
                  style={{ color: DARK_TEAL }}
                />
                <span className="opacity-40">—</span>
                <input
                  type="number"
                  value={priceMax}
                  onChange={(e) => setParam('max', Number(e.target.value))}
                  placeholder="Max"
                  className="w-full border-b-2 border-current/20 py-2 text-sm focus:outline-none focus:border-[var(--color-primary)] bg-transparent"
                  style={{ color: DARK_TEAL }}
                />
              </div>
            </FilterBlock>

            {/* Promo card */}
            <div className="relative overflow-hidden rounded-[32px] p-7 text-white" style={{ backgroundColor: TEAL }}>
              <div className="absolute -top-6 -right-6 w-32 h-32 rounded-full opacity-30" style={{ backgroundColor: YELLOW }} />
              <div className="relative">
                <div className="text-[10px] tracking-[0.3em] uppercase font-bold mb-3 opacity-90">{t('theme.products.promo_eyebrow')}</div>
                <h4 className="font-serif text-2xl font-bold leading-tight mb-3" style={{ fontFamily: HEADING_FONT }}>
                  {t('theme.products.promo_heading')}
                </h4>
                <p className="text-xs opacity-80 mb-4">{t('theme.products.promo_body')}</p>
                <Link
                  to="/products"
                  className="inline-block px-5 py-2 rounded-full text-xs font-bold"
                  style={{ backgroundColor: '#fff', color: DARK_TEAL }}
                >
                  {t('theme.products.promo_cta')}
                </Link>
              </div>
            </div>
          </aside>

          <div>
            {/* Toolbar */}
            <div className="flex items-center justify-between pb-5 mb-8 border-b-2 border-current/10">
              <span className="text-sm opacity-70" style={{ color: DARK_TEAL }}>
                {t('theme.products.count', { count: products.length })}
              </span>
              <select
                value={sort}
                onChange={(e) => setParam('sort', e.target.value)}
                className="text-sm bg-white rounded-full px-5 py-2.5 pr-8 focus:outline-none font-medium"
                style={{ color: DARK_TEAL }}
              >
                <option value="newest">{t('theme.products.sort_newest')}</option>
                <option value="price-asc">{t('theme.products.sort_price_asc')}</option>
                <option value="price-desc">{t('theme.products.sort_price_desc')}</option>
                <option value="popular">{t('theme.products.sort_popular')}</option>
              </select>
            </div>

            {loading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="aspect-[4/5] rounded-[32px]" />
                ))}
              </div>
            ) : products.length === 0 ? (
              <div className="text-center py-24 opacity-60" style={{ color: DARK_TEAL }}>
                {t('theme.products.empty')}
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                {products.map((p) => (
                  <MilmaaProductCard key={p._id} product={p} onQuickView={setQuick} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <QuickView product={quick} isOpen={!!quick} onClose={() => setQuick(null)} />
    </div>
  );
};

export default Products;
