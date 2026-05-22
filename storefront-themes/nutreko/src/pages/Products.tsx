import React, { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useProducts, useCategories } from '@shared/hooks/useProducts';
import NutrekoProductCard from '../components/NutrekoProductCard';
import { QuickView } from '@shared/components/discovery/QuickView';
import { Skeleton } from '@shared/components/primitives/Skeleton';

/**
 * Nutreko Products page — dark title banner + bold sidebar filters.
 */

const LIME = 'var(--color-primary)';
const headingFont = { fontFamily: 'var(--font-family-heading)' } as const;

const FilterBlock: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="bg-white border-2 border-black mb-5">
    <h3 className="text-[11px] tracking-[0.22em] uppercase font-black px-5 py-3 text-white bg-black">
      {title}
    </h3>
    <div className="p-5">{children}</div>
  </div>
);

const Products: React.FC = () => {
  const { t } = useTranslation(['theme', 'category']);
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

  const { products, loading } = useProducts(params);
  const { categories } = useCategories();

  return (
    <div className="bg-white">
      {/* Title banner */}
      <div className="bg-black text-white py-16 border-b-4" style={{ borderColor: LIME }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-[11px] tracking-[0.3em] uppercase font-bold mb-4 opacity-70">
            <Link to="/" className="hover:opacity-100">{t('theme.products.breadcrumb_home')}</Link>
            <span className="mx-2">/</span>
            <span>{t('theme.products.breadcrumb_shop')}</span>
          </div>
          <h1 className="font-display text-5xl md:text-7xl uppercase leading-[0.95]" style={headingFont}>
            <span style={{ color: LIME }}>{t('theme.products.page_title')}</span>
          </h1>
          <p className="mt-4 text-white/60 max-w-xl">
            {t('theme.products.page_subtitle')}
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-8">
          {/* Sidebar */}
          <aside>
            <FilterBlock title={t('theme.products.filter_categories')}>
              <ul className="space-y-2.5 text-sm">
                <li>
                  <button
                    onClick={() => setParam('category', '')}
                    className={`text-start w-full uppercase tracking-wider text-[12px] ${selectedCategory === '' ? 'font-black' : 'font-bold opacity-70 hover:opacity-100'}`}
                  >
                    {t('theme.products.all_products')}
                  </button>
                </li>
                {categories.slice(0, 10).map((cat) => (
                  <li key={cat._id}>
                    <button
                      onClick={() => setParam('category', cat.slug)}
                      className={`text-start w-full uppercase tracking-wider text-[12px] ${selectedCategory === cat.slug ? 'font-black' : 'font-bold opacity-70 hover:opacity-100'}`}
                    >
                      {cat.name}
                    </button>
                  </li>
                ))}
              </ul>
            </FilterBlock>

            <FilterBlock title={t('theme.products.filter_availability')}>
              <div className="space-y-3 text-sm">
                {[
                  { value: '', label: t('theme.products.all_products') },
                  { value: 'in-stock', label: t('theme.products.in_stock') },
                  { value: 'out-of-stock', label: t('theme.products.out_of_stock') },
                ].map((opt) => (
                  <label key={opt.value} className="flex items-center gap-3 cursor-pointer uppercase text-[12px] font-bold">
                    <input
                      type="radio"
                      name="availability"
                      checked={availability === opt.value}
                      onChange={() => setParam('availability', opt.value)}
                      style={{ accentColor: 'var(--color-primary)' }}
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </FilterBlock>

            <FilterBlock title={t('theme.products.filter_price_range')}>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={priceMin}
                  onChange={(e) => setParam('min', Number(e.target.value))}
                  placeholder={t('category:category.filter.price_min')}
                  className="w-full border-2 border-black px-3 py-2 text-sm font-bold focus:outline-none"
                  onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--color-primary)'; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = ''; }}
                />
                <span className="opacity-40">—</span>
                <input
                  type="number"
                  value={priceMax}
                  onChange={(e) => setParam('max', Number(e.target.value))}
                  placeholder={t('category:category.filter.price_max')}
                  className="w-full border-2 border-black px-3 py-2 text-sm font-bold focus:outline-none"
                  onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--color-primary)'; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = ''; }}
                />
              </div>
            </FilterBlock>

            {/* Deal block */}
            <div className="bg-black text-white p-6 relative overflow-hidden">
              <div className="text-[10px] tracking-[0.3em] uppercase font-black mb-3" style={{ color: LIME }}>{t('theme.products.deal_eyebrow')}</div>
              <h4 className="font-display text-2xl uppercase leading-tight mb-3" style={headingFont}>
                {t('theme.products.deal_heading')}
              </h4>
              <p className="text-xs text-white/60 mb-4">{t('theme.products.deal_body')}</p>
              <Link
                to="/products"
                className="inline-block px-5 py-2.5 text-[10px] tracking-[0.2em] uppercase font-black hover:scale-105 transition"
                style={{ backgroundColor: LIME, color: '#000' }}
              >
                {t('theme.products.deal_cta')}
              </Link>
            </div>
          </aside>

          <div>
            {/* Toolbar */}
            <div className="flex items-center justify-between pb-5 mb-8 border-b-2 border-black">
              <span className="text-sm font-bold uppercase tracking-wider">
                {loading ? t('theme.products.loading') : t('theme.products.count', { count: products.length })}
              </span>
              <select
                value={sort}
                onChange={(e) => setParam('sort', e.target.value)}
                className="text-sm border-2 border-black bg-white px-4 py-2 pe-8 font-bold uppercase focus:outline-none"
              >
                <option value="newest">{t('theme.products.sort_newest')}</option>
                <option value="price-asc">{t('theme.products.sort_price_asc')}</option>
                <option value="price-desc">{t('theme.products.sort_price_desc')}</option>
                <option value="popular">{t('theme.products.sort_popular')}</option>
              </select>
            </div>

            {loading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="aspect-square" />
                ))}
              </div>
            ) : products.length === 0 ? (
              <div className="text-center py-24 opacity-60 font-bold uppercase">
                {t('theme.products.empty')}
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
                {products.map((p) => (
                  <NutrekoProductCard key={p._id} product={p} onQuickView={setQuick} />
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
