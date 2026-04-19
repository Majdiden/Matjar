import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useCart } from '@shared/contexts/CartContext';
import { useStore } from '@shared/contexts/StoreContext';
import { getPreorderState } from '@shared/utils/preorder';

/**
 * GlowingProductCard — clean editorial card.
 *
 * - Square tinted image with SALE badge in red pill (top-left)
 * - Hover reveal: "ADD TO CART" black bar slides up from bottom
 * - Below image: small uppercase title, Cormorant price row
 */

interface Props {
  product: any;
  onQuickView?: (p: any) => void;
}

export const GlowingProductCard: React.FC<Props> = ({ product, onQuickView }) => {
  const { t } = useTranslation(['theme', 'common']);
  const { formatPrice } = useStore();
  const { addItem } = useCart();

  const price = product.price ?? 0;
  const compareAt = product.compareAtPrice ?? 0;
  const onSale = compareAt > price;
  const pct = onSale ? Math.round(((compareAt - price) / compareAt) * 100) : 0;
  const image = product.images?.[0] || 'https://placehold.co/600x600/f7efe6/888?text=Product';
  const slug = product.slug || product._id;
  const requiresOptions = Boolean(product.hasVariants || product.variants?.length || product.options?.length);
  const preorder = getPreorderState(product, null, { price });
  const isPreorder = preorder.mode === 'preorder';

  return (
    <div className="group relative">
      <Link to={`/products/${slug}`} className="block">
        <div
          className="relative aspect-square overflow-hidden"
        >
          <img
            src={image}
            alt={product.name}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            loading="lazy"
          />

          {/* SALE badge */}
          {onSale && (
            <div className="absolute top-3 left-3">
              <span className="inline-block px-3 py-1 text-[10px] font-bold tracking-wider uppercase bg-red-500 text-white rounded-full">
                {t('theme.product_card.sale_badge', { pct })}
              </span>
            </div>
          )}
          {isPreorder && (
            <div className={`absolute top-3 ${onSale ? 'left-3 mt-8' : 'left-3'}`} style={onSale ? { top: '2.75rem' } : undefined}>
              <span
                className="inline-block px-3 py-1 text-[10px] font-bold tracking-wider uppercase rounded-full text-white"
                style={{ backgroundColor: 'var(--color-primary, #111)' }}
              >
                Pre-order
              </span>
            </div>
          )}

          {/* Wishlist / Quick view icons */}
          <div className="absolute top-3 right-3 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <button
              type="button"
              aria-label="Wishlist"
              onClick={(e) => { e.preventDefault(); }}
              className="w-9 h-9 rounded-full bg-white shadow flex items-center justify-center hover:bg-black hover:text-white transition"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
              </svg>
            </button>
            {onQuickView && (
              <button
                type="button"
                aria-label="Quick view"
                onClick={(e) => { e.preventDefault(); onQuickView(product); }}
                className="w-9 h-9 rounded-full bg-white shadow flex items-center justify-center hover:bg-black hover:text-white transition"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.644C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
            )}
          </div>

          {/* Add to cart slide-up */}
          <button
            type="button"
            onClick={(e) => { if (requiresOptions) return; e.preventDefault(); addItem(product._id || product.id, 1); }}
            className="absolute bottom-0 left-0 right-0 py-3.5 bg-black text-white text-[11px] tracking-[0.22em] uppercase font-semibold translate-y-full group-hover:translate-y-0 transition-transform duration-300"
          >
            {requiresOptions ? t('theme.product_card.choose_options') : t('theme.product_card.add_to_cart')}
          </button>
        </div>
      </Link>

      <div className="pt-4 text-center">
        <Link
          to={`/products/${slug}`}
          className="block text-[13px] tracking-wide text-neutral-800 hover:text-black line-clamp-1"
        >
          {product.name}
        </Link>
        <div className="mt-1.5 flex items-center justify-center gap-3 font-display text-lg">
          {onSale && (
            <span className="text-neutral-400 line-through text-sm">{formatPrice(compareAt)}</span>
          )}
          <span className={onSale ? 'text-red-500' : 'text-black'}>
            {formatPrice(price)}
          </span>
        </div>
      </div>
    </div>
  );
};

export default GlowingProductCard;
