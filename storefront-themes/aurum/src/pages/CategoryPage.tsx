import React, { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useCategory, useCategories } from '@shared/hooks/useProducts';
import AurumProductCard from '../components/AurumProductCard';
import { QuickView } from '@shared/components/discovery/QuickView';
import { Skeleton } from '@shared/components/primitives/Skeleton';

const CategoryPage: React.FC = () => {
  const { t } = useTranslation(['theme', 'common']);
  const { slug } = useParams<{ slug: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [quick, setQuick] = useState<any>(null);

  const sort = searchParams.get('sort') || 'newest';
  const { category, products, loading } = useCategory(slug!, { sort, limit: 24 });
  const { categories: allCategories } = useCategories();

  const setSort = (v: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('sort', v);
    setSearchParams(next);
  };

  return (
    <div>
      {/* Title banner */}
      <div className="text-center py-16 border-b border-line">
        <div className="text-[11px] tracking-[0.3em] uppercase text-mute mb-4">
          <Link to="/" className="hover:text-ink">{t('theme.products.breadcrumb_home')}</Link>
          <span className="mx-2">/</span>
          <Link to="/products" className="hover:text-ink">{t('theme.products.breadcrumb_shop')}</Link>
          <span className="mx-2">/</span>
          <span className="text-ink">{category?.name || slug}</span>
        </div>
        <h1
          className="text-5xl md:text-6xl text-ink"
          style={{ fontFamily: 'var(--font-family-heading)' }}
        >
          {category?.name || slug}
        </h1>
        {category?.description && (
          <p className="mt-4 text-sm text-mute max-w-md mx-auto">{category.description}</p>
        )}
      </div>

      <div className="max-w-[1440px] mx-auto px-4 sm:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-12">
          {/* Sidebar — sibling categories */}
          <aside>
            <h3 className="text-[11px] tracking-[0.22em] uppercase text-ink mb-5 pb-3 border-b border-line" style={{ fontFamily: 'var(--font-family)' }}>
              {t('theme.category.collections_sidebar')}
            </h3>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link to="/products" className="text-mute hover:text-ink">
                  {t('theme.category.all_products')}
                </Link>
              </li>
              {allCategories.slice(0, 12).map((cat) => (
                <li key={cat._id}>
                  <Link
                    to={`/categories/${cat.slug}`}
                    className={`${cat.slug === slug ? 'text-ink' : 'text-mute hover:text-ink'}`}
                  >
                    {cat.name}
                  </Link>
                </li>
              ))}
            </ul>
          </aside>

          <div>
            {/* Toolbar */}
            <div className="flex items-center justify-between pb-6 mb-8 border-b border-line">
              <span className="text-sm text-mute">
                {loading ? t('theme.products.loading') : t('theme.products.showing_count', { count: products.length })}
              </span>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
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
              <div className="text-center py-24 text-mute">{t('theme.category.empty')}</div>
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

export default CategoryPage;
