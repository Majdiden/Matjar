import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useProducts, useCategories } from '@matjar/theme-shared/hooks/useProducts';
import ProductCard from '@matjar/theme-shared/components/ProductCard';
import { useTranslation } from 'react-i18next';

const Products: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = parseInt(searchParams.get('page') || '1');
  const sort = searchParams.get('sort') || 'newest';
  const search = searchParams.get('search') || '';
  const category = searchParams.get('category') || '';
  const { t } = useTranslation(['theme']);

  const { products, pagination, loading } = useProducts({ page, sort, search, ...(category && { category }) });
  const { categories } = useCategories();
  const [searchInput, setSearchInput] = useState(search);

  const updateParam = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value) params.set(key, value);
    else params.delete(key);
    if (key !== 'page') params.set('page', '1');
    setSearchParams(params);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="text-3xl font-bold mb-8">
        {category ? categories.find(c => c._id === category)?.name || t('theme.products.page_title') : t('theme.products.page_title')}
      </h1>

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row gap-4 mb-8">
        {/* Search */}
        <form
          className="flex-1"
          onSubmit={(e) => { e.preventDefault(); updateParam('search', searchInput); }}
        >
          <div className="relative">
            <input
              type="text"
              placeholder={t('theme.products.search_placeholder')}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full px-4 py-2.5 border rounded-lg pe-10 focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            <button type="submit" className="absolute end-3 top-1/2 -translate-y-1/2 text-gray-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>
          </div>
        </form>

        {/* Category filter */}
        <select
          value={category}
          onChange={(e) => updateParam('category', e.target.value)}
          className="px-4 py-2.5 border rounded-lg bg-white focus:outline-none"
        >
          <option value="">{t('theme.products.all_categories')}</option>
          {categories.map(cat => (
            <option key={cat._id} value={cat._id}>{cat.name}</option>
          ))}
        </select>

        {/* Sort */}
        <select
          value={sort}
          onChange={(e) => updateParam('sort', e.target.value)}
          className="px-4 py-2.5 border rounded-lg bg-white focus:outline-none"
        >
          <option value="newest">{t('theme.products.sort_newest')}</option>
          <option value="price_asc">{t('theme.products.sort_price_asc')}</option>
          <option value="price_desc">{t('theme.products.sort_price_desc')}</option>
          <option value="popular">{t('theme.products.sort_popular')}</option>
        </select>
      </div>

      {/* Product Grid */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="animate-pulse bg-gray-100 rounded-lg aspect-square" />
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-16">
          <svg className="w-14 h-14 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>
          <p className="text-gray-500 text-lg">{t('theme.products.no_results')}</p>
          {search && (
            <button
              onClick={() => { setSearchInput(''); updateParam('search', ''); }}
              className="mt-4 text-sm underline"
              style={{ color: 'var(--color-primary)' }}
            >
              {t('theme.products.clear_search')}
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {products.map((product: any) => (
              <ProductCard key={product._id} product={product} />
            ))}
          </div>

          {/* Pagination */}
          {pagination && pagination.pages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-8">
              <button
                onClick={() => updateParam('page', String(page - 1))}
                disabled={page <= 1}
                className="px-4 py-2 border rounded-lg disabled:opacity-30 hover:bg-gray-50"
              >
                {t('theme.products.previous')}
              </button>
              <span className="text-sm text-gray-500">
                {t('theme.products.page_of', { page, total: pagination.pages })}
              </span>
              <button
                onClick={() => updateParam('page', String(page + 1))}
                disabled={page >= pagination.pages}
                className="px-4 py-2 border rounded-lg disabled:opacity-30 hover:bg-gray-50"
              >
                {t('theme.products.next')}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Products;
