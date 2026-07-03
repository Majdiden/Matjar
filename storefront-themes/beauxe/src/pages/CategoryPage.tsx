import React, { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useCategory, useCategories } from '@matjar/theme-shared/hooks/useProducts';
import BeauxeProductCard from '../components/BeauxeProductCard';
import { QuickView } from '@matjar/theme-shared/components/discovery/QuickView';
import { Skeleton } from '@matjar/theme-shared/components/primitives/Skeleton';
import { useTranslation } from 'react-i18next';

const NAVY = 'var(--color-primary)';
const BLUSH = 'var(--color-muted)';

const CategoryPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [quick, setQuick] = useState<any>(null);

  const sort = searchParams.get('sort') || 'newest';
  const { category, products, loading } = useCategory(slug!, { sort, limit: 24 });
  const { categories: allCategories } = useCategories();
  const { t } = useTranslation(['theme']);

  const setSort = (v: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('sort', v);
    setSearchParams(next);
  };

  return (
    <div style={{ backgroundColor: 'var(--color-background)' }}>
      {/* Title banner */}
      <div className="text-center py-16" style={{ backgroundColor: BLUSH }}>
        <div className="text-[11px] tracking-[0.3em] uppercase mb-4" style={{ color: NAVY, opacity: 0.7 }}>
          <Link to="/" className="hover:opacity-100">{t('theme.category.breadcrumb_home')}</Link>
          <span className="mx-2">/</span>
          <Link to="/products" className="hover:opacity-100">{t('theme.category.breadcrumb_shop')}</Link>
          <span className="mx-2">/</span>
          <span style={{ opacity: 1 }}>{category?.name || slug}</span>
        </div>
        <h1
          className="font-serif text-5xl md:text-6xl"
          style={{ fontFamily: 'var(--font-family-heading)', color: NAVY }}
        >
          {category?.name || slug}
        </h1>
        {category?.description && (
          <p className="mt-3 text-sm max-w-md mx-auto" style={{ color: NAVY, opacity: 0.7 }}>
            {category.description}
          </p>
        )}
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-8">
          {/* Sidebar — sibling categories */}
          <aside>
            <div className="bg-white rounded-3xl p-6 border border-pink-100">
              <h3 className="text-[11px] tracking-[0.22em] uppercase font-bold mb-5 pb-3 border-b border-pink-100" style={{ color: NAVY }}>
                {t('theme.category.sidebar_collections')}
              </h3>
              <ul className="space-y-2.5 text-sm">
                <li>
                  <Link to="/products" className="opacity-75 hover:opacity-100" style={{ color: NAVY }}>
                    {t('theme.category.sidebar_all_products')}
                  </Link>
                </li>
                {allCategories.slice(0, 12).map((cat) => (
                  <li key={cat._id}>
                    <Link
                      to={`/categories/${cat.slug}`}
                      className={`transition ${cat.slug === slug ? 'font-bold' : 'opacity-75 hover:opacity-100'}`}
                      style={{ color: NAVY }}
                    >
                      {cat.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </aside>

          <div>
            <div className="flex items-center justify-between pb-5 mb-8 border-b border-pink-100">
              <span className="text-sm opacity-75" style={{ color: NAVY }}>
                {loading ? t('theme.category.loading') : t('theme.category.product_count', { count: products.length })}
              </span>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="text-sm border border-pink-200 bg-white rounded-full px-5 py-2 pe-8 focus:outline-none focus:border-[color:var(--color-secondary)]"
                style={{ color: NAVY }}
              >
                <option value="newest">{t('theme.category.sort_newest')}</option>
                <option value="price-asc">{t('theme.category.sort_price_asc')}</option>
                <option value="price-desc">{t('theme.category.sort_price_desc')}</option>
                <option value="popular">{t('theme.category.sort_popular')}</option>
              </select>
            </div>

            {loading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="aspect-[4/5] rounded-3xl" />
                ))}
              </div>
            ) : products.length === 0 ? (
              <div className="text-center py-24 opacity-60" style={{ color: NAVY }}>
                {t('theme.category.no_products')}
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                {products.map((p) => (
                  <BeauxeProductCard key={p._id} product={p} onQuickView={setQuick} />
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

export default CategoryPage;
