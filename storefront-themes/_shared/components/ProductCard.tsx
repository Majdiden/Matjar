import React from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../contexts/StoreContext';
import { useCart } from '../contexts/CartContext';
import { getPreorderState } from '../utils/preorder';
import type { PreorderConfig } from '../types/commerce';

interface Product {
  _id: string;
  name: string;
  slug: string;
  price: number;
  compareAtPrice?: number;
  images: string[];
  rating?: number;
  reviewCount?: number;
  stock: number;
  hasVariants?: boolean;
  options?: unknown[];
  variants?: unknown[];
  preorder?: PreorderConfig;
}

interface ProductCardProps {
  product: Product;
  className?: string;
  imageClassName?: string;
  showAddToCart?: boolean;
  layout?: 'grid' | 'list';
}

const ProductCard: React.FC<ProductCardProps> = ({
  product,
  className = '',
  imageClassName = '',
  showAddToCart = true,
  layout = 'grid',
}) => {
  const { formatPrice } = useStore();
  const { addItem } = useCart();
  const [adding, setAdding] = React.useState(false);
  const requiresOptions = Boolean(
    product.hasVariants || product.variants?.length || product.options?.length
  );

  const handleAdd = async (e: React.MouseEvent) => {
    if (requiresOptions) return;
    e.preventDefault();
    e.stopPropagation();
    setAdding(true);
    try {
      await addItem(product._id);
    } catch (err) {
      console.error('Failed to add to cart:', err);
    } finally {
      setAdding(false);
    }
  };

  const pre = getPreorderState(product, null, { adding });
  const displayPrice = pre.mode !== 'buy' && pre.savingsPct > 0 ? pre.effectivePrice : product.price;
  const strikePrice =
    pre.mode !== 'buy' && pre.savingsPct > 0
      ? pre.originalPrice
      : product.compareAtPrice;
  const discount = strikePrice && strikePrice > displayPrice
    ? Math.round((1 - displayPrice / strikePrice) * 100)
    : 0;
  // A card should only hide the CTA when there's no way for the customer
  // to buy — genuine OOS with no preorder config.
  const canPurchase = product.stock > 0 || !!pre.config;
  const soldOut = pre.mode === 'soldOut' || (product.stock === 0 && !pre.config);

  const imgSrc = product.images?.[0] || 'https://placehold.co/400x400?text=No+Image';

  if (layout === 'list') {
    return (
      <Link to={`/products/${product.slug}`} className={`flex gap-4 p-4 border rounded-lg hover:shadow-md transition ${className}`}>
        <img src={imgSrc} alt={product.name} className={`w-24 h-24 object-cover rounded ${imageClassName}`} />
        <div className="flex-1 min-w-0">
          <h3 className="font-medium truncate">{product.name}</h3>
          <div className="flex items-center gap-2 mt-1">
            <span className="font-bold">{formatPrice(displayPrice)}</span>
            {discount > 0 && strikePrice && (
              <span className="text-sm text-gray-400 line-through">{formatPrice(strikePrice)}</span>
            )}
          </div>
          {pre.mode === 'preorder' && (
            <span className="text-xs text-amber-600 mt-1 block">Pre-order{pre.shipByLabel ? ` — ${pre.shipByLabel}` : ''}</span>
          )}
          {soldOut && <span className="text-xs text-red-500 mt-1">{pre.mode === 'soldOut' ? 'Sold out' : 'Out of stock'}</span>}
        </div>
      </Link>
    );
  }

  return (
    <Link to={`/products/${product.slug}`} className={`group block border rounded-lg overflow-hidden hover:shadow-lg transition ${className}`}>
      <div className="relative aspect-[4/5] overflow-hidden">
        <img
          src={imgSrc}
          alt={product.name}
          className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 ${imageClassName}`}
          loading="lazy"
        />
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          {discount > 0 && (
            <span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded">
              -{discount}%
            </span>
          )}
          {pre.mode === 'preorder' && (
            <span className="bg-amber-500 text-white text-xs font-bold px-2 py-1 rounded">
              Pre-order
            </span>
          )}
        </div>
        {soldOut && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <span className="bg-white text-gray-800 px-3 py-1 rounded font-medium text-sm">
              {pre.mode === 'soldOut' ? 'Sold out' : 'Out of Stock'}
            </span>
          </div>
        )}
      </div>
      <div className="p-3">
        <h3 className="font-medium text-sm truncate">{product.name}</h3>
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-2">
            <span className="font-bold text-base">{formatPrice(displayPrice)}</span>
            {discount > 0 && strikePrice && (
              <span className="text-xs text-gray-400 line-through">{formatPrice(strikePrice)}</span>
            )}
          </div>
          {showAddToCart && canPurchase && (
            <button
              onClick={handleAdd}
              disabled={adding || pre.ctaDisabled}
              className="text-xs bg-primary text-white px-3 py-1.5 rounded hover:bg-primary/90 transition disabled:opacity-50"
              style={{ backgroundColor: 'var(--color-primary, #667eea)' }}
              title={requiresOptions ? 'Select options on the product page' : pre.mode === 'preorder' ? [pre.shipByLabel, pre.depositLabel].filter(Boolean).join(' · ') || undefined : undefined}
            >
              {requiresOptions ? 'Options' : adding ? '...' : pre.mode === 'preorder' ? 'Pre-order' : pre.mode === 'soldOut' ? 'Sold out' : 'Add'}
            </button>
          )}
        </div>
        {product.rating !== undefined && product.rating > 0 && (
          <div className="flex items-center gap-1 mt-1 text-xs text-gray-500">
            <span className="text-yellow-400">{'★'.repeat(Math.round(product.rating))}</span>
            <span>({product.reviewCount || 0})</span>
          </div>
        )}
        {pre.mode === 'preorder' && (
          <div className="mt-1.5 space-y-0.5 text-[11px] text-amber-700 leading-tight">
            {pre.shipByLabel && <div>{pre.shipByLabel}</div>}
            {pre.depositLabel && <div>{pre.depositLabel}</div>}
            {pre.lowRemaining && pre.remaining !== null && (
              <div className="font-semibold">Only {pre.remaining} left</div>
            )}
          </div>
        )}
      </div>
    </Link>
  );
};

export default ProductCard;
