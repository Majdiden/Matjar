import React from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '@shared/contexts/CartContext';
import { useStore } from '@shared/contexts/StoreContext';
import { getPreorderState } from '@shared/utils/preorder';

/**
 * NutrekoProductCard — bold black/lime supplements tile.
 *
 * Square product image on light grey backdrop. Chunky black
 * headline, red SALE badge, lime ADD TO CART button slides up
 * on hover. Orange "BEST SELLER" strip across top for featured.
 */

interface Props {
  product: any;
  onQuickView?: (p: any) => void;
}

const LIME = 'var(--color-primary)';
const DARK = 'var(--color-secondary)';

export const NutrekoProductCard: React.FC<Props> = ({ product, onQuickView }) => {
  const { formatPrice } = useStore();
  const { addItem } = useCart();

  const price = product.price ?? 0;
  const compareAt = product.compareAtPrice ?? 0;
  const onSale = compareAt > price;
  const pct = onSale ? Math.round(((compareAt - price) / compareAt) * 100) : 0;
  const image = product.images?.[0] || 'https://placehold.co/600x600/f5f5f5/0a0a0a?text=Product';
  const slug = product.slug || product._id;
  const rating = product.averageRating || 5;
  const reviewCount = product.reviewCount || 0;
  const requiresOptions = Boolean(product.hasVariants || product.variants?.length || product.options?.length);
  const preorder = getPreorderState(product, null, { price });
  const isPreorder = preorder.mode === 'preorder';

  return (
    <div className="group relative bg-white border-2 border-black overflow-hidden hover:border-[var(--color-primary)] transition">
      {/* Top bar: badge + category */}
      <div className="relative">
        <Link to={`/products/${slug}`} className="block">
          <div className="relative aspect-square overflow-hidden">
            <img
              src={image}
              alt={product.name}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              loading="lazy"
            />

            {/* Sale badge */}
            {onSale && (
              <div className="absolute top-0 left-0">
                <span
                  className="inline-block px-4 py-2 text-[11px] font-black tracking-widest uppercase text-white"
                  style={{ backgroundColor: 'var(--color-error)' }}
                >
                  -{pct}% OFF
                </span>
              </div>
            )}
            {isPreorder && (
              <div className="absolute top-0 right-0">
                <span
                  className="inline-block px-4 py-2 text-[11px] font-black tracking-widest uppercase text-white"
                  style={{ backgroundColor: 'var(--color-accent)' }}
                >
                  PRE-ORDER
                </span>
              </div>
            )}
            {!onSale && !isPreorder && product.isNew && (
              <div className="absolute top-0 left-0">
                <span
                  className="inline-block px-4 py-2 text-[11px] font-black tracking-widest uppercase"
                  style={{ backgroundColor: LIME, color: DARK }}
                >
                  NEW
                </span>
              </div>
            )}

            {/* Quick view (on hover) */}
            {onQuickView && (
              <button
                type="button"
                aria-label="Quick view"
                onClick={(e) => { e.preventDefault(); onQuickView(product); }}
                className="absolute top-3 right-3 w-10 h-10 bg-white border-2 border-black flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-[var(--color-primary)] transition"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.644C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
            )}
          </div>
        </Link>
      </div>

      {/* Info */}
      <div className="p-5 border-t-2 border-black">
        {product.categories?.[0] && (
          <div className="text-[10px] tracking-[0.2em] uppercase font-bold mb-2 opacity-60">
            {product.categories[0].name}
          </div>
        )}
        <Link
          to={`/products/${slug}`}
          className="block font-black text-[15px] uppercase tracking-tight leading-tight line-clamp-2 min-h-[38px] hover:text-[var(--color-accent)] transition"
          style={{ fontFamily: 'var(--font-family-heading)' }}
        >
          {product.name}
        </Link>

        {/* Rating */}
        <div className="flex items-center gap-1.5 mt-2">
          <div className="flex">
            {[1, 2, 3, 4, 5].map((i) => (
              <svg key={i} className={`w-3 h-3 ${i <= Math.round(rating) ? '' : 'opacity-20'}`} fill={LIME} viewBox="0 0 24 24">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
            ))}
          </div>
          <span className="text-[10px] font-bold opacity-60">({reviewCount})</span>
        </div>

        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-baseline gap-2">
            <span className="font-black text-xl">{formatPrice(price)}</span>
            {onSale && (
              <span className="text-xs line-through opacity-40">{formatPrice(compareAt)}</span>
            )}
          </div>
        </div>

        {requiresOptions ? (
          <Link
            to={`/products/${slug}`}
            className="mt-4 block w-full py-3 text-center text-[11px] tracking-[0.2em] uppercase font-black border-2 border-black hover:text-black transition"
            style={{ backgroundColor: DARK, color: '#fff' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = LIME; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = DARK; }}
          >
            Choose Options
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => addItem(product._id || product.id, 1)}
            className="mt-4 w-full py-3 text-[11px] tracking-[0.2em] uppercase font-black border-2 border-black hover:text-black transition"
            style={{ backgroundColor: DARK, color: '#fff' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = LIME; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = DARK; }}
          >
            + Add to Cart
          </button>
        )}
      </div>
    </div>
  );
};

export default NutrekoProductCard;
