import React from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { useCategory } from '@shared/hooks/useProducts';
import ProductCard from '@shared/components/ProductCard';

const CategoryPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const page = parseInt(searchParams.get('page') || '1');
  const sort = searchParams.get('sort') || 'newest';

  const { category, products, pagination, loading } = useCategory(slug!, { page, sort });

  const updateParam = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams);
    params.set(key, value);
    if (key !== 'page') params.set('page', '1');
    setSearchParams(params);
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="animate-pulse bg-gray-100 h-10 w-48 rounded mb-8" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="animate-pulse bg-gray-100 rounded-lg aspect-square" />
          ))}
        </div>
      </div>
    );
  }

  if (!category) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 text-center">
        <h2
          className="text-2xl font-bold mb-2"
          style={{
            color: 'var(--color-foreground)',
            fontFamily: 'var(--font-family-heading)',
          }}
        >
          Category Not Found
        </h2>
        <Link to="/products" className="text-sm underline" style={{ color: 'var(--color-primary)' }}>
          Browse all products
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <nav className="text-sm mb-4" style={{ color: 'var(--color-muted)' }}>
        <Link to="/" className="hover:opacity-80">Home</Link>
        <span className="mx-2">/</span>
        <span style={{ color: 'var(--color-foreground)' }}>{category.name}</span>
      </nav>

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1
            className="text-3xl font-bold"
            style={{
              color: 'var(--color-foreground)',
              fontFamily: 'var(--font-family-heading)',
            }}
          >
            {category.name}
          </h1>
          {category.description && <p className="mt-1" style={{ color: 'var(--color-muted)' }}>{category.description}</p>}
        </div>
        <select
          value={sort}
          onChange={(e) => updateParam('sort', e.target.value)}
          className="px-4 py-2 border rounded-lg bg-white text-sm"
        >
          <option value="newest">Newest</option>
          <option value="price_asc">Price: Low to High</option>
          <option value="price_desc">Price: High to Low</option>
        </select>
      </div>

      {products.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-gray-500">No products in this category yet</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {products.map((product: any) => (
              <ProductCard key={product._id} product={product} />
            ))}
          </div>

          {pagination && pagination.pages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-8">
              <button
                onClick={() => updateParam('page', String(page - 1))}
                disabled={page <= 1}
                className="px-4 py-2 border rounded-lg disabled:opacity-30 hover:bg-gray-50"
              >
                Previous
              </button>
              <span className="text-sm text-gray-500">Page {page} of {pagination.pages}</span>
              <button
                onClick={() => updateParam('page', String(page + 1))}
                disabled={page >= pagination.pages}
                className="px-4 py-2 border rounded-lg disabled:opacity-30 hover:bg-gray-50"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default CategoryPage;
