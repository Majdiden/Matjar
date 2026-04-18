import React from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '@shared/contexts/CartContext';
import { useStore } from '@shared/contexts/StoreContext';
import { useThemeSetting } from '@shared/theme/ThemeProvider';
import { getPreorderState } from '@shared/utils/preorder';

/**
 * BeauxeProductCard — rounded pink/cream tile with SALE pill.
 *
 * Image sits on a soft pastel backdrop. SALE badge top-left (pink),
 * wishlist/quick-view icons top-right on hover. Add-to-cart button is
 * a centered pink pill that slides up on hover.
 */

interface Props {
  product: any;
  onQuickView?: (p: any) => void;
}

const BG_PALETTE_DEFAULTS = ['#f8e4e4', '#faf3ec', '#f3ddd1', '#f5e1d8', '#f9ebe6'];

export const BeauxeProductCard: React.FC<Props> = ({ product, onQuickView }) => {
  const { formatPrice } = useStore();
  const { addItem } = useCart();

  const bg1 = useThemeSetting<string>('product_tile_bg_1');
  const bg2 = useThemeSetting<string>('product_tile_bg_2');
  const bg3 = useThemeSetting<string>('product_tile_bg_3');
  const bg4 = useThemeSetting<string>('product_tile_bg_4');
  const bg5 = useThemeSetting<string>('product_tile_bg_5');
  const BG_PALETTE = [
    bg1 || BG_PALETTE_DEFAULTS[0],
    bg2 || BG_PALETTE_DEFAULTS[1],
    bg3 || BG_PALETTE_DEFAULTS[2],
    bg4 || BG_PALETTE_DEFAULTS[3],
    bg5 || BG_PALETTE_DEFAULTS[4],
  ];

  const price = product.price ?? 0;
  const compareAt = product.compareAtPrice ?? 0;
  const onSale = compareAt > price;
  // Pre-order aware: when flagged, the headline price reflects the
  // pre-order discount and the CTA switches to "Pre-order".
  const pre = getPreorderState(product);
  const displayPrice = pre.mode !== 'buy' && pre.savingsPct > 0 ? pre.effectivePrice : price;
  const strikePrice = pre.mode !== 'buy' && pre.savingsPct > 0 ? price : compareAt;
  const pct = onSale
    ? Math.round(((compareAt - price) / compareAt) * 100)
    : pre.savingsPct;
  const image = product.images?.[0] || 'https://placehold.co/600x600/f8e4e4/1d1d3b?text=Product';
  const slug = product.slug || product._id;
  const requiresOptions = Boolean(product.hasVariants || product.variants?.length || product.options?.length);

  const bg = BG_PALETTE[(product._id?.length || 0) % BG_PALETTE.length];

  return (
    <div className="group relative">
      <Link to={`/products/${slug}`} className="block">
        <div
          className="relative aspect-[4/5] overflow-hidden rounded-3xl"
        >
          <img
            src={image}
            alt={product.name}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            loading="lazy"
          />

          {/* Sale / pre-order badge */}
          {(onSale || pre.savingsPct > 0) && (
            <div className="absolute top-4 left-4">
              <span className="inline-block px-3 py-1 text-[10px] font-bold tracking-wider uppercase text-white rounded-full" style={{ backgroundColor: 'var(--color-error)' }}>
                -{pct}% {pre.mode === 'preorder' ? 'Pre-order' : 'Sale'}
              </span>
            </div>
          )}
          {pre.mode === 'preorder' && !onSale && pre.savingsPct === 0 && (
            <div className="absolute top-4 left-4">
              <span className="inline-block px-3 py-1 text-[10px] font-bold tracking-wider uppercase text-white rounded-full" style={{ backgroundColor: 'var(--color-primary)' }}>
                Pre-order
              </span>
            </div>
          )}
          {!onSale && pre.mode === 'buy' && product.isNew && (
            <div className="absolute top-4 left-4">
              <span className="inline-block px-3 py-1 text-[10px] font-bold tracking-wider uppercase text-white rounded-full" style={{ backgroundColor: 'var(--color-primary)' }}>
                New
              </span>
            </div>
          )}

          {/* Hover icons */}
          <div className="absolute top-4 right-4 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition">
            <button
              type="button"
              aria-label="Wishlist"
              onClick={(e) => { e.preventDefault(); }}
              className="w-9 h-9 rounded-full bg-white shadow flex items-center justify-center text-[color:var(--color-primary)] hover:bg-[color:var(--color-primary)] hover:text-white transition"
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
                className="w-9 h-9 rounded-full bg-white shadow flex items-center justify-center text-[color:var(--color-primary)] hover:bg-[color:var(--color-primary)] hover:text-white transition"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.644C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
            )}
          </div>

          {/* CTA pill — buy / pre-order / sold out */}
          <div className="absolute inset-x-0 bottom-4 flex flex-col items-center gap-1 opacity-0 translate-y-4 group-hover:opacity-100 group-hover:translate-y-0 transition duration-300">
            <button
              type="button"
              onClick={(e) => { if (requiresOptions) return; e.preventDefault(); if (!pre.ctaDisabled) addItem(product._id || product.id, 1); }}
              disabled={!requiresOptions && pre.ctaDisabled}
              className="px-7 py-3 rounded-full bg-[color:var(--color-primary)] text-white text-[11px] tracking-[0.22em] uppercase font-semibold hover:bg-[color:var(--color-secondary)] transition disabled:opacity-60"
              title={requiresOptions ? 'Select options on the product page' : pre.mode === 'preorder' ? [pre.shipByLabel, pre.depositLabel].filter(Boolean).join(' · ') || undefined : undefined}
            >
              {requiresOptions ? 'Choose Options' : pre.mode === 'preorder' ? '+ Pre-order' : pre.mode === 'soldOut' ? 'Sold out' : '+ Add to Cart'}
            </button>
            {pre.lowRemaining && pre.remaining !== null && (
              <span className="text-[10px] font-semibold text-white bg-amber-600 px-2 py-0.5 rounded-full">Only {pre.remaining} left</span>
            )}
          </div>
        </div>
      </Link>

      <div className="pt-4 text-center">
        <Link
          to={`/products/${slug}`}
          className="block font-serif text-[17px] text-[color:var(--color-primary)] hover:text-[color:var(--color-secondary)] line-clamp-1"
          style={{ fontFamily: 'var(--font-family-heading)' }}
        >
          {product.name}
        </Link>
        {/* Rating */}
        <div className="flex items-center justify-center gap-1 mt-1.5">
          {[1, 2, 3, 4, 5].map((i) => (
            <svg key={i} className={`w-3 h-3 ${i <= Math.round(product.averageRating || 5) ? 'text-[color:var(--color-secondary)]' : 'text-neutral-200'}`} fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
          ))}
        </div>
        <div className="mt-2 flex items-center justify-center gap-2 text-[15px]">
          {(onSale || pre.savingsPct > 0) && strikePrice > displayPrice && (
            <span className="text-neutral-400 line-through">{formatPrice(strikePrice)}</span>
          )}
          <span className={`font-bold ${onSale || pre.savingsPct > 0 ? 'text-[color:var(--color-error)]' : 'text-[color:var(--color-primary)]'}`}>
            {formatPrice(price)}
          </span>
        </div>
      </div>
    </div>
  );
};

export default BeauxeProductCard;
