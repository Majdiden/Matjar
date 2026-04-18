import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useProducts } from '../hooks/useProducts';
import { ProductCard } from '../components/commerce/ProductCard';
import { Skeleton } from '../components/primitives/Skeleton';
import { useThemeCard } from '../theme/ThemeCardProvider';
import type { Product } from '../types/commerce';

interface SearchResultsProps {
  className?: string;
  accentColor?: string;
  cardLayout?: 'grid' | 'list';
  columns?: number;
  onQuickView?: (product: Product) => void;
  renderCard?: (product: Product) => React.ReactNode;
}

const SearchResults: React.FC<SearchResultsProps> = ({
  className = '',
  accentColor,
  columns = 4,
  onQuickView,
  renderCard: propRenderCard,
}) => {
  const themeCard = useThemeCard();
  const renderCard =
    propRenderCard ||
    (themeCard ? ((p: Product) => themeCard(p, onQuickView)) : undefined);
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  const { products, loading } = useProducts({ search: query, limit: 40 });

  if (!query) {
    return (
      <div className={`max-w-7xl mx-auto px-4 sm:px-6 py-16 text-center ${className}`}>
        <svg className="w-14 h-14 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
        <h1 className="text-2xl font-bold mb-2">Search</h1>
        <p className="text-gray-500">Enter a search term to find products.</p>
      </div>
    );
  }

  return (
    <div className={`max-w-7xl mx-auto px-4 sm:px-6 py-8 ${className}`}>
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-1">
          Search results for "{query}"
        </h1>
        {!loading && (
          <p className="text-gray-500 text-sm">
            {products.length} {products.length === 1 ? 'result' : 'results'} found
          </p>
        )}
      </div>

      {loading ? (
        <Skeleton.ProductGrid count={8} />
      ) : products.length === 0 ? (
        <div className="text-center py-16">
          <svg className="w-14 h-14 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <h2 className="text-xl font-semibold mb-2">No results found</h2>
          <p className="text-gray-500 mb-6">
            Try adjusting your search or browse our collections.
          </p>
          <Link
            to="/products"
            className="inline-block px-6 py-3 rounded-lg text-white font-medium transition hover:opacity-90"
            style={{ backgroundColor: accentColor || 'var(--color-primary, #2563eb)' }}
          >
            Browse All Products
          </Link>
        </div>
      ) : (
        <div className={`grid grid-cols-2 md:grid-cols-${columns} gap-4 md:gap-6`}>
          {products.map((product) =>
            renderCard ? (
              renderCard(product)
            ) : (
              <ProductCard key={product._id} product={product} onQuickView={onQuickView}>
                <ProductCard.Image showBadge showQuickView={!!onQuickView} />
                <ProductCard.Body>
                  <ProductCard.Title />
                  <ProductCard.Rating />
                  <div className="flex items-center justify-between mt-2">
                    <ProductCard.Price showCompareAt />
                    <ProductCard.Actions addToCartText="Add" />
                  </div>
                </ProductCard.Body>
              </ProductCard>
            )
          )}
        </div>
      )}
    </div>
  );
};

export default SearchResults;
