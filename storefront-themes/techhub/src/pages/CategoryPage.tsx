/**
 * CategoryPage — TONMART-style single-category collection view.
 * Mirrors the Products page layout (sidebar + grid) but is scoped to
 * one category via `useCategory(slug)`.
 */
import React from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { useCategory, useCategories } from '@shared/hooks/useProducts';
import { Skeleton } from '@shared/components/primitives/Skeleton';
import { TonmartProductCard } from '../components/TonmartProductCard';
import { useTranslation } from 'react-i18next';

const CategoryPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const page = parseInt(searchParams.get('page') || '1');
  const sort = searchParams.get('sort') || 'newest';

  const { category, products, pagination, loading } = useCategory(slug!, { page, sort });
  const { categories } = useCategories();
  const { t } = useTranslation(['theme']);

  const SORT_OPTIONS = [
    { value: 'newest', label: t('theme.category.sort_newest') },
    { value: 'price_asc', label: t('theme.category.sort_price_asc') },
    { value: 'price_desc', label: t('theme.category.sort_price_desc') },
    { value: 'popular', label: t('theme.products.sort_popular') },
  ];

  const updateParam = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value) params.set(key, value);
    else params.delete(key);
    if (key !== 'page') params.set('page', '1');
    setSearchParams(params);
  };

  if (!loading && !category) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 text-center">
        <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--color-foreground)' }}>
          {t('theme.category.not_found_heading')}
        </h2>
        <Link to="/products" className="text-sm underline" style={{ color: 'var(--color-primary)' }}>
          {t('theme.category.browse_all')}
        </Link>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: 'var(--color-background)' }}>
      {/* Title strip */}
      <div
        className="border-b"
        style={{ borderColor: 'var(--color-border)', backgroundColor: 'color-mix(in srgb, var(--color-foreground) 2%, transparent)' }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          <h1
            className="text-2xl md:text-3xl font-black uppercase tracking-tight mb-2"
            style={{ color: 'var(--color-foreground)' }}
          >
            {category?.name || t('theme.category.loading', { defaultValue: 'Loading...' })}
          </h1>
          <nav className="text-xs" style={{ color: 'var(--color-muted)' }}>
            <Link to="/" className="hover:opacity-70">{t('theme.category.breadcrumb_home')}</Link>
            <span className="mx-2">•</span>
            <Link to="/products" className="hover:opacity-70">{t('theme.product_detail.breadcrumb_products')}</Link>
            <span className="mx-2">•</span>
            <span>{category?.name}</span>
          </nav>
          {category?.description && (
            <p className="mt-3 text-sm max-w-2xl" style={{ color: 'var(--color-muted)' }}>
              {category.description}
            </p>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 grid gap-8 lg:grid-cols-[260px_1fr]">
        {/* Sidebar — sibling categories */}
        <aside>
          <div
            className="border rounded-lg p-4"
            style={{ borderColor: 'var(--color-border)' }}
          >
            <h3
              className="text-xs font-bold uppercase tracking-wider mb-3"
              style={{ color: 'var(--color-foreground)' }}
            >
              {t('theme.products.filter_categories')}
            </h3>
            <ul className="space-y-2">
              <li>
                <Link
                  to="/products"
                  className="text-[13px] hover:opacity-80"
                  style={{ color: 'var(--color-foreground)' }}
                >
                  {t('theme.products.filter_all_products')}
                </Link>
              </li>
              {categories.map((cat) => {
                const isActive = cat.slug === slug;
                return (
                  <li key={cat._id}>
                    <Link
                      to={`/categories/${cat.slug}`}
                      className="text-[13px] hover:opacity-80"
                      style={{
                        color: isActive ? 'var(--color-primary)' : 'var(--color-foreground)',
                        fontWeight: isActive ? 700 : 400,
                      }}
                    >
                      {cat.name}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </aside>

        {/* Main column */}
        <div>
          <div
            className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-4 border-b"
            style={{ borderColor: 'var(--color-border)' }}
          >
            <p className="text-xs" style={{ color: 'var(--color-muted)' }}>
              {t('theme.products.product_count', { count: pagination?.total ?? products.length })}
            </p>
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
          </div>

          {loading ? (
            <div className="grid gap-8 grid-cols-2 md:grid-cols-3">
              {Array.from({ length: 9 }).map((_, i) => (
                <Skeleton key={i} className="h-80 rounded-xl" />
              ))}
            </div>
          ) : products.length === 0 ? (
            <div
              className="py-24 text-center rounded-lg border"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted)' }}
            >
              {t('theme.category.no_products')}
            </div>
          ) : (
            <div className="grid gap-8 grid-cols-2 md:grid-cols-3">
              {products.map((p: any) => (
                <TonmartProductCard key={p._id} product={p} />
              ))}
            </div>
          )}

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

export default CategoryPage;
