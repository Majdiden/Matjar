import React, { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useCategory, useCategories } from '@shared/hooks/useProducts';
import NutrekoProductCard from '../components/NutrekoProductCard';
import { QuickView } from '@shared/components/discovery/QuickView';
import { Skeleton } from '@shared/components/primitives/Skeleton';

const LIME = 'var(--color-primary)';

const CategoryPage: React.FC = () => {
  const { t } = useTranslation('theme');
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
    <div className="bg-white">
      {/* Title banner */}
      <div className="bg-black text-white py-16 border-b-4" style={{ borderColor: LIME }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-[11px] tracking-[0.3em] uppercase font-bold mb-4 opacity-70">
            <Link to="/" className="hover:opacity-100">{t('theme.category.breadcrumb_home')}</Link>
            <span className="mx-2">/</span>
            <Link to="/products" className="hover:opacity-100">{t('theme.category.breadcrumb_shop')}</Link>
            <span className="mx-2">/</span>
            <span>{category?.name || slug}</span>
          </div>
          <h1 className="font-display text-5xl md:text-7xl uppercase leading-[0.95]" style={{ fontFamily: 'var(--font-family-heading)' }}>
            {category?.name || slug}
          </h1>
          {category?.description && (
            <p className="mt-4 text-white/60 max-w-xl">{category.description}</p>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-8">
          <aside>
            <div className="bg-white border-2 border-black">
              <h3 className="text-[11px] tracking-[0.22em] uppercase font-black px-5 py-3 text-white bg-black">
                {t('theme.category.collections_label')}
              </h3>
              <ul className="p-5 space-y-2.5 text-sm">
                <li>
                  <Link to="/products" className="uppercase tracking-wider text-[12px] font-bold opacity-70 hover:opacity-100">
                    {t('theme.category.all_products')}
                  </Link>
                </li>
                {allCategories.slice(0, 12).map((cat) => (
                  <li key={cat._id}>
                    <Link
                      to={`/categories/${cat.slug}`}
                      className={`uppercase tracking-wider text-[12px] ${cat.slug === slug ? 'font-black' : 'font-bold opacity-70 hover:opacity-100'}`}
                    >
                      {cat.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </aside>

          <div>
            <div className="flex items-center justify-between pb-5 mb-8 border-b-2 border-black">
              <span className="text-sm font-bold uppercase tracking-wider">
                {loading ? t('theme.category.loading') : t('theme.category.count', { count: products.length })}
              </span>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
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
                {t('theme.category.empty')}
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

export default CategoryPage;
