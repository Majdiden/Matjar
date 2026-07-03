import React, { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useProducts, useCategories } from '@matjar/theme-shared/hooks/useProducts';
import GlowingProductCard from '../components/GlowingProductCard';
import { QuickView } from '@matjar/theme-shared/components/discovery/QuickView';
import { Skeleton } from '@matjar/theme-shared/components/primitives/Skeleton';

/**
 * Glowing Products page — editorial collection grid.
 *
 *   ─ Title banner: centered serif h1 + subline + breadcrumb
 *   ─ Body: left sidebar (categories / availability / price) + right grid
 *   ─ Toolbar: count | sort select
 *   ─ Grid: 3 cols (4 on xl) of GlowingProductCard
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
        <h3 className="text-[11px] tracking-[0.22em] uppercase font-semibold text-black mb-5 pb-3 border-b border-neutral-200">
          {t('theme.products.sidebar_categories')}
        </h3>
        <ul className="space-y-2.5 text-sm">
          <li>
            <button
              onClick={() => onSelectCategory('')}
              className={`text-start transition ${selectedCategory === '' ? 'text-black font-semibold' : 'text-neutral-600 hover:text-black'}`}
            >
              {t('theme.products.all_products')}
            </button>
          </li>
          {categories.slice(0, 12).map((cat) => (
            <li key={cat._id}>
              <button
                onClick={() => onSelectCategory(cat.slug)}
                className={`text-start transition ${selectedCategory === cat.slug ? 'text-black font-semibold' : 'text-neutral-600 hover:text-black'}`}
              >
                {cat.name}
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Availability */}
      <div>
        <h3 className="text-[11px] tracking-[0.22em] uppercase font-semibold text-black mb-5 pb-3 border-b border-neutral-200">
          {t('theme.products.sidebar_availability')}
        </h3>
        <div className="space-y-3 text-sm">
          {[
            { value: '', labelKey: 'theme.products.availability_all' },
            { value: 'in-stock', labelKey: 'theme.products.availability_in_stock' },
            { value: 'out-of-stock', labelKey: 'theme.products.availability_out_of_stock' },
          ].map((opt) => (
            <label key={opt.value} className="flex items-center gap-3 cursor-pointer text-neutral-700 hover:text-black">
              <input
                type="radio"
                name="availability"
                checked={availability === opt.value}
                onChange={() => onAvailability(opt.value)}
                className="accent-black"
              />
              {t(opt.labelKey)}
            </label>
          ))}
        </div>
      </div>

      {/* Price */}
      <div>
        <h3 className="text-[11px] tracking-[0.22em] uppercase font-semibold text-black mb-5 pb-3 border-b border-neutral-200">
          {t('theme.products.sidebar_price')}
        </h3>
        <div className="flex items-center gap-3">
          <input
            type="number"
            value={priceMin}
            onChange={(e) => onPriceMin(Number(e.target.value))}
            placeholder={t('theme.products.price_min')}
            className="w-full border-b border-neutral-300 py-2 text-sm focus:outline-none focus:border-black"
          />
          <span className="text-neutral-400">—</span>
          <input
            type="number"
            value={priceMax}
            onChange={(e) => onPriceMax(Number(e.target.value))}
            placeholder={t('theme.products.price_max')}
            className="w-full border-b border-neutral-300 py-2 text-sm focus:outline-none focus:border-black"
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
    <div className="bg-white">
      {/* Title banner */}
      <div className="text-center py-16 border-b border-neutral-100">
        <div className="text-[11px] tracking-[0.3em] uppercase text-neutral-500 mb-4">
          {t('theme.products.breadcrumb_home')} / <span className="text-black">{t('theme.products.breadcrumb_shop')}</span>
        </div>
        <h1
          className="font-display text-5xl md:text-6xl text-black"
          style={{ fontFamily: 'var(--font-family-heading)' }}
        >
          {t('theme.products.title')}
        </h1>
        <p className="mt-3 text-sm text-neutral-500 max-w-md mx-auto">
          {t('theme.products.subtitle')}
        </p>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
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
            <div className="flex items-center justify-between pb-6 mb-8 border-b border-neutral-100">
              <span className="text-sm text-neutral-600">
                {t('theme.products.showing_count', { count: products.length })}
              </span>
              <select
                value={sort}
                onChange={(e) => setParam('sort', e.target.value)}
                className="text-sm border-b border-neutral-300 bg-transparent py-1 pe-6 focus:outline-none focus:border-black"
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
              <div className="text-center py-24 text-neutral-500">
                {t('theme.products.empty')}
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-12">
                {products.map((p) => (
                  <GlowingProductCard key={p._id} product={p} onQuickView={setQuick} />
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
