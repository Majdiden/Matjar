import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useCart } from '@shared/contexts/CartContext';
import { useStore } from '@shared/contexts/StoreContext';
import { useThemeSetting } from '@shared/theme/ThemeProvider';
import { getPreorderState } from '@shared/utils/preorder';

/**
 * MilmaaProductCard — colorful milk carton tile with rotating
 * pastel background, playful serif title and pink CTA.
 */

interface Props {
  product: any;
  onQuickView?: (p: any) => void;
}

const BG_FALLBACK = ['#2c4a4a', '#f7c1b7', '#5eaaa8', '#fdf6ed', '#ebe0ce'];
const FG_FALLBACK = ['#2c4a4a', '#2c4a4a', '#fdf6ed', '#2c4a4a', '#2c4a4a'];

export const MilmaaProductCard: React.FC<Props> = ({ product, onQuickView }) => {
  const { t } = useTranslation('theme');
  const { formatPrice } = useStore();
  const { addItem } = useCart();

  // Merchant-editable product-tile palette (global theme settings).
  const bg1 = useThemeSetting<string>('product_tile_bg_1');
  const bg2 = useThemeSetting<string>('product_tile_bg_2');
  const bg3 = useThemeSetting<string>('product_tile_bg_3');
  const bg4 = useThemeSetting<string>('product_tile_bg_4');
  const bg5 = useThemeSetting<string>('product_tile_bg_5');
  const fg1 = useThemeSetting<string>('product_tile_fg_1');
  const fg2 = useThemeSetting<string>('product_tile_fg_2');
  const fg3 = useThemeSetting<string>('product_tile_fg_3');
  const fg4 = useThemeSetting<string>('product_tile_fg_4');
  const fg5 = useThemeSetting<string>('product_tile_fg_5');
  const BG_PALETTE = [bg1 || BG_FALLBACK[0], bg2 || BG_FALLBACK[1], bg3 || BG_FALLBACK[2], bg4 || BG_FALLBACK[3], bg5 || BG_FALLBACK[4]];
  const FG_PALETTE = [fg1 || FG_FALLBACK[0], fg2 || FG_FALLBACK[1], fg3 || FG_FALLBACK[2], fg4 || FG_FALLBACK[3], fg5 || FG_FALLBACK[4]];

  const price = product.price ?? 0;
  const compareAt = product.compareAtPrice ?? 0;
  const onSale = compareAt > price;
  const image = product.images?.[0] || 'https://placehold.co/600x700/f6dc68/2c4a4a?text=Milk';
  const slug = product.slug || product._id;
  const requiresOptions = Boolean(product.hasVariants || product.variants?.length || product.options?.length);
  const preorder = getPreorderState(product, null, { price });
  const isPreorder = preorder.mode === 'preorder';

  const idx = (product._id?.length || 0) % BG_PALETTE.length;
  const bg = BG_PALETTE[idx];
  const fg = FG_PALETTE[idx];

  return (
    <div className="group relative">
      <Link to={`/products/${slug}`} className="block">
        <div
          className="relative aspect-[4/5] overflow-hidden rounded-[32px]"
        >
          <img
            src={image}
            alt={product.name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />

          {/* Sale badge */}
          {onSale && (
            <div className="absolute top-4 left-4">
              <span className="inline-block px-3 py-1 text-[10px] font-bold tracking-wider uppercase rounded-full bg-white" style={{ color: fg }}>
                {t('theme.product_card.sale')}
              </span>
            </div>
          )}
          {isPreorder && (
            <div className="absolute top-4 left-4" style={onSale ? { top: '2.75rem' } : undefined}>
              <span
                className="inline-block px-3 py-1 text-[10px] font-bold tracking-wider uppercase rounded-full"
                style={{ backgroundColor: fg, color: bg }}
              >
                {t('theme.product_card.preorder')}
              </span>
            </div>
          )}

          {/* Hover icons */}
          <div className="absolute top-4 right-4 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition">
            <button
              type="button"
              aria-label="Wishlist"
              onClick={(e) => { e.preventDefault(); }}
              className="w-9 h-9 rounded-full bg-white shadow flex items-center justify-center hover:scale-110 transition"
              style={{ color: fg }}
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
                className="w-9 h-9 rounded-full bg-white shadow flex items-center justify-center hover:scale-110 transition"
                style={{ color: fg }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.644C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </Link>

      <div className="pt-4 text-center">
        <Link
          to={`/products/${slug}`}
          className="block font-serif text-xl font-semibold hover:opacity-70 line-clamp-1"
          style={{ fontFamily: 'var(--font-family-heading)', color: 'var(--color-foreground)' }}
        >
          {product.name}
        </Link>
        <div className="mt-2 flex items-center justify-center gap-2 text-base">
          {onSale && (
            <span className="line-through opacity-40">{formatPrice(compareAt)}</span>
          )}
          <span className="font-bold" style={{ color: 'var(--color-foreground)' }}>
            {formatPrice(price)}
          </span>
        </div>
        {requiresOptions ? (
          <Link
            to={`/products/${slug}`}
            className="mt-3 inline-block px-6 py-2.5 rounded-full text-white text-xs font-bold hover:scale-105 transition"
            style={{ backgroundColor: 'var(--color-foreground)' }}
          >
            {t('theme.product_card.choose_options')}
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => addItem(product._id || product.id, 1)}
            className="mt-3 inline-block px-6 py-2.5 rounded-full text-white text-xs font-bold hover:scale-105 transition"
            style={{ backgroundColor: 'var(--color-foreground)' }}
          >
            {t('theme.product_card.add_to_cart')}
          </button>
        )}
      </div>
    </div>
  );
};

export default MilmaaProductCard;
