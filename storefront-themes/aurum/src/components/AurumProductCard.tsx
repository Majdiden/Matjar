import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useCart } from '@matjar/theme-shared/contexts/CartContext';
import { useStore } from '@matjar/theme-shared/contexts/StoreContext';
import { getPreorderState } from '@matjar/theme-shared/utils/preorder';

/**
 * AurumProductCard — the theme's signature card.
 *
 * - Square image on a warm light-neutral tile, slow zoom on hover
 * - Uppercase tracked name + muted price line below
 * - Signature add-to-cart: a circular white bag button pinned to the
 *   image's bottom-end corner. Hidden until the card is hovered on
 *   desktop (always visible on touch); hovering the button itself
 *   expands it into a pill that reveals the "Add to Cart" label.
 */

interface Props {
  product: any;
  onQuickView?: (p: any) => void;
}

export const AurumProductCard: React.FC<Props> = ({ product }) => {
  const { t } = useTranslation(['theme', 'product', 'common']);
  const { formatPrice } = useStore();
  const { addItem } = useCart();
  const [adding, setAdding] = useState(false);

  const price = product.price ?? 0;
  const compareAt = product.compareAtPrice ?? 0;
  const onSale = compareAt > price;
  const image = product.images?.[0] || '';
  const slug = product.slug || product._id;
  const requiresOptions = Boolean(product.hasVariants || product.variants?.length || product.options?.length);
  const preorder = getPreorderState(product, null, { price, adding });
  const isPreorder = preorder.mode === 'preorder';
  const isSoldOut = preorder.mode === 'soldOut' || ((product.stock ?? 0) <= 0 && !isPreorder);

  const label = requiresOptions
    ? t('product:card.options')
    : isSoldOut
      ? t('product:card.sold_out')
      : isPreorder
        ? (adding ? t('product:card.reserving') : t('product:card.preorder'))
        : (adding ? t('product:card.adding') : t('product:card.add'));

  const handleAdd = async (e: React.MouseEvent) => {
    if (requiresOptions) return; // let the wrapping link navigate to options
    e.preventDefault();
    if (adding || isSoldOut) return;
    setAdding(true);
    try {
      await addItem(product._id || product.id, 1);
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="group relative">
      <Link to={`/products/${slug}`} className="block">
        <div className="relative aspect-square overflow-hidden bg-tile">
          {image ? (
            <img
              src={image}
              alt={product.name}
              className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-[10px] tracking-[0.3em] uppercase text-mute">
                {t('theme.product_card.no_image')}
              </span>
            </div>
          )}

          {/* PRE-ORDER chip */}
          {isPreorder && (
            <span className="absolute top-3 start-3 px-2.5 py-1 text-[10px] tracking-[0.15em] uppercase font-medium bg-ink text-night">
              {t('theme.product_card.pre_order')}
            </span>
          )}

          {/* Expanding add-to-cart pill — visible on touch, hover-revealed on desktop */}
          <div className="absolute bottom-3 end-3 opacity-100 translate-y-0 md:opacity-0 md:translate-y-2 md:group-hover:opacity-100 md:group-hover:translate-y-0 transition-all duration-300">
            <button
              type="button"
              onClick={handleAdd}
              disabled={isSoldOut && !requiresOptions}
              aria-label={label}
              className="group/btn flex items-center h-11 rounded-full bg-ink text-night shadow-lg overflow-hidden disabled:opacity-60 hover:shadow-xl transition-shadow"
            >
              <span className="w-11 h-11 shrink-0 flex items-center justify-center">
                {adding ? (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
                    <path strokeLinecap="round" d="M12 3a9 9 0 109 9" />
                  </svg>
                ) : (
                  <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.4}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007z" />
                  </svg>
                )}
              </span>
              <span className="max-w-0 group-hover/btn:max-w-[140px] group-hover/btn:pe-5 transition-all duration-300 overflow-hidden whitespace-nowrap text-[11px] tracking-[0.15em] uppercase font-medium">
                {label}
              </span>
            </button>
          </div>
        </div>
      </Link>

      <div className="pt-4">
        <Link
          to={`/products/${slug}`}
          className="block text-[13px] tracking-[0.15em] uppercase font-medium text-ink hover:text-gold transition-colors line-clamp-1"
        >
          {product.name}
        </Link>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          {onSale && (
            <span className="text-mute line-through">{formatPrice(compareAt)}</span>
          )}
          <span className={onSale ? 'text-gold' : 'text-mute'}>
            {formatPrice(preorder.effectivePrice ?? price)}
          </span>
        </div>
      </div>
    </div>
  );
};

export default AurumProductCard;
