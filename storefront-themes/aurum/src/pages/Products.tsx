import React, { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useProducts, useCategories } from '@matjar/theme-shared/hooks/useProducts';
import AurumProductCard from '../components/AurumProductCard';
import { QuickView } from '@matjar/theme-shared/components/discovery/QuickView';
import { Skeleton } from '@matjar/theme-shared/components/primitives/Skeleton';

/**
 * Aurum Products page — dark editorial collection grid.
 *
 *   ─ Title banner: centered serif h1 + subline + breadcrumb
 *   ─ Body: left sidebar (categories / availability / price) + right grid
 *   ─ Toolbar: count | sort select
 *   ─ Grid: 3 cols (2 on mobile) of AurumProductCard
 */

const Sidebar: React.FC<{
  categories: any[];
  selectedCategory: string;
  onSelectCategory: (slug: string) => void;
  availability: string;
  onAvailability: (v: string) => void;
  priceMin: number;
  priceMax: number;
  onPriceMin: (v: number) => void;
  onPriceMax: (v: number) => void;
}> = ({ categories, selectedCategory, onSelectCategory, availability, onAvailability, priceMin, priceMax, onPriceMin, onPriceMax }) => {
  const { t } = useTranslation(['theme']);

  return (
    <aside className="space-y-10 lg:sticky lg:top-32 self-start">
      {/* Categories */}
      <div>
        <h3 className="text-[11px] tracking-[0.22em] uppercase text-ink mb-5 pb-3 border-b border-line" style={{ fontFamily: 'var(--font-family)' }}>
          {t('theme.products.sidebar_categories')}
        </h3>
        <ul className="space-y-2.5 text-sm">
          <li>
            <button
              onClick={() => onSelectCategory('')}
              className={`text-start transition ${selectedCategory === '' ? 'text-ink' : 'text-mute hover:text-ink'}`}
            >
              {t('theme.products.all_products')}
            </button>
          </li>
          {categories.slice(0, 12).map((cat) => (
            <li key={cat._id}>
              <button
                onClick={() => onSelectCategory(cat.slug)}
                className={`text-start transition ${selectedCategory === cat.slug ? 'text-ink' : 'text-mute hover:text-ink'}`}
              >
                {cat.name}
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Availability */}
      <div>
        <h3 className="text-[11px] tracking-[0.22em] uppercase text-ink mb-5 pb-3 border-b border-line" style={{ fontFamily: 'var(--font-family)' }}>
          {t('theme.products.sidebar_availability')}
        </h3>
        <div className="space-y-3 text-sm">
          {[
            { value: '', labelKey: 'theme.products.availability_all' },
            { value: 'in-stock', labelKey: 'theme.products.availability_in_stock' },
            { value: 'out-of-stock', labelKey: 'theme.products.availability_out_of_stock' },
          ].map((opt) => (
            <label key={opt.value} className="flex items-center gap-3 cursor-pointer text-mute hover:text-ink">
              <input
                type="radio"
                name="availability"
                checked={availability === opt.value}
                onChange={() => onAvailability(opt.value)}
                className="accent-[#c8a24b]"
              />
              {t(opt.labelKey)}
            </label>
          ))}
        </div>
      </div>

      {/* Price */}
      <div>
        <h3 className="text-[11px] tracking-[0.22em] uppercase text-ink mb-5 pb-3 border-b border-line" style={{ fontFamily: 'var(--font-family)' }}>
          {t('theme.products.sidebar_price')}
        </h3>
        <div className="flex items-center gap-3">
          <input
            type="number"
            value={priceMin}
            onChange={(e) => onPriceMin(Number(e.target.value))}
            placeholder={t('theme.products.price_min')}
            className="w-full border-b border-line bg-transparent text-ink py-2 text-sm focus:outline-none focus:border-ink"
          />
          <span className="text-mute">&mdash;</span>
          <input
            type="number"
            value={priceMax}
            onChange={(e) => onPriceMax(Number(e.target.value))}
            placeholder={t('theme.products.price_max')}
            className="w-full border-b border-line bg-transparent text-ink py-2 text-sm focus:outline-none focus:border-ink"
          />
        </div>
      </div>
    </aside>
  );
};

const Products: React.FC = () => {
  const { t } = useTranslation(['theme', 'common']);
  const [searchParams, setSearchParams] = useSearchParams();
  const [quick, setQuick] = useState<any>(null);

  const selectedCategory = searchParams.get('category') || '';
  const availability = searchParams.get('availability') || '';
  const priceMin = Number(searchParams.get('min') || 0);
  const priceMax = Number(searchParams.get('max') || 0);
  const sort = searchParams.get('sort') || 'newest';

  const setParam = (key: string, value: string | number) => {
    const next = new URLSearchParams(searchParams);
    if (!value) next.delete(key);
    else next.set(key, String(value));
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
    <div>
      {/* Title banner */}
      <div className="text-center py-16 border-b border-line">
        <div className="text-[11px] tracking-[0.3em] uppercase text-mute mb-4">
          {t('theme.products.breadcrumb_home')} / <span className="text-ink">{t('theme.products.breadcrumb_shop')}</span>
        </div>
        <h1
          className="text-5xl md:text-6xl text-ink"
          style={{ fontFamily: 'var(--font-family-heading)' }}
        >
          {t('theme.products.title')}
        </h1>
        <p className="mt-4 text-sm text-mute max-w-md mx-auto">
          {t('theme.products.subtitle')}
        </p>
      </div>

      <div className="max-w-[1440px] mx-auto px-4 sm:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-12">
          <Sidebar
            categories={categories}
            selectedCategory={selectedCategory}
            onSelectCategory={(v) => setParam('category', v)}
            availability={availability}
            onAvailability={(v) => setParam('availability', v)}
            priceMin={priceMin}
            priceMax={priceMax}
            onPriceMin={(v) => setParam('min', v)}
            onPriceMax={(v) => setParam('max', v)}
          />

          <div>
            {/* Toolbar */}
            <div className="flex items-center justify-between pb-6 mb-8 border-b border-line">
              <span className="text-sm text-mute">
                {t('theme.products.showing_count', { count: products.length })}
              </span>
              <select
                value={sort}
                onChange={(e) => setParam('sort', e.target.value)}
                className="text-sm border-b border-line bg-transparent text-ink py-1 pe-6 focus:outline-none focus:border-ink [&>option]:bg-night"
              >
                <option value="newest">{t('theme.products.sort_newest')}</option>
                <option value="price-asc">{t('theme.products.sort_price_asc')}</option>
                <option value="price-desc">{t('theme.products.sort_price_desc')}</option>
                <option value="popular">{t('theme.products.sort_popular')}</option>
              </select>
            </div>

            {/* Grid */}
            {loading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-8">
                {Array.from({ length: 9 }).map((_, i) => (
                  <Skeleton key={i} className="aspect-square" />
                ))}
              </div>
            ) : products.length === 0 ? (
              <div className="text-center py-24 text-mute">
                {t('theme.products.empty')}
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-12">
                {products.map((p) => (
                  <AurumProductCard key={p._id} product={p} onQuickView={setQuick} />
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
