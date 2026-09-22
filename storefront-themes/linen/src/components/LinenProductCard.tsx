import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useCart } from '@matjar/theme-shared/contexts/CartContext';
import { useStore } from '@matjar/theme-shared/contexts/StoreContext';
import { RatingStars } from '@matjar/theme-shared/components/commerce/RatingStars';
import { WishlistButton } from '@matjar/theme-shared/components/commerce/WishlistButton';
import { getPreorderState } from '@matjar/theme-shared/utils/preorder';
import { I } from '../lib/icons';

interface Props {
  product: any;
  showRating?: boolean;
  showBadge?: boolean;
  newDays?: number;
  onQuickView?: (p: any) => void;
  /** list = horizontal card with description (PLP list view) */
  variant?: 'grid' | 'list';
}

const PLACEHOLDER = 'https://placehold.co/800x800/ecdec1/0f0f0f?text=%20';

/**
 * Linen product card: square image on cream, "New" / sale pills, wishlist
 * heart, a quick-view eye, and a full-width add-to-cart bar that slides up
 * on hover/focus (always visible on touch). Title in the heading face,
 * optional rating, price with compare-at.
 */
export const LinenProductCard: React.FC<Props> = ({ product, showRating = true, showBadge = true, newDays = 30, onQuickView, variant = 'grid' }) => {
  const { t } = useTranslation(['theme']);
  const { addItem } = useCart();
  const { formatPrice } = useStore();
  const [adding, setAdding] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);
  const img = !imgFailed && product.images?.[0] ? product.images[0] : PLACEHOLDER;
  const img2 = product.images?.[1];
  const onSale = product.compareAtPrice > product.price;
  const pct = onSale ? Math.round(((product.compareAtPrice - product.price) / product.compareAtPrice) * 100) : 0;
  const isNew = product.createdAt ? Date.now() - new Date(product.createdAt).getTime() < newDays * 86400000 : false;
  const hasOptions = Array.isArray(product.options) && product.options.length > 0;
  const inStock = (product.stock ?? 0) > 0;
  const pre = getPreorderState(product, null, { adding });
  const cta = hasOptions
    ? t('theme.product_card.select_options')
    : pre.mode === 'preorder' ? t('theme.product_card.preorder')
    : pre.mode === 'soldOut' || !inStock ? t('theme.product_card.sold_out')
    : adding ? t('theme.product_card.adding') : t('theme.product_card.add');
  const canAdd = !hasOptions && (inStock || pre.mode === 'preorder') && !adding && !pre.ctaDisabled;

  const add = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (hasOptions) { onQuickView?.(product); return; }
    if (!canAdd) return;
    setAdding(true);
    try { await addItem(product._id, 1); } finally { setAdding(false); }
  };

  const list = variant === 'list';
  return (
    <article className={`group ${list ? 'grid grid-cols-[minmax(120px,38%)_minmax(0,1fr)] gap-5 sm:gap-8' : ''}`}>
      <div className="linen-card-media relative aspect-square overflow-hidden bg-tint-strong">
        <Link to={`/products/${product.slug}`} className="block h-full w-full" aria-label={product.name}>
          <img src={img} alt={product.name} loading="lazy" onError={() => setImgFailed(true)} className={`h-full w-full object-cover transition-opacity duration-500 ${img2 ? 'group-hover:opacity-0' : 'group-hover:scale-[1.03] transition-transform'}`} />
          {img2 && <img src={img2} alt="" aria-hidden loading="lazy" className="absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-500 group-hover:opacity-100" />}
        </Link>
        {showBadge && (onSale || isNew) && (
          <div className="absolute start-3 top-3 flex flex-col gap-1.5">
            {onSale && <span className="rounded-full bg-ink px-3 py-1 text-[0.65rem] font-bold uppercase tracking-[0.14em] text-cream">−{pct}%</span>}
            {isNew && !onSale && <span className="rounded-full border border-ink bg-cream px-3 py-1 text-[0.65rem] font-bold uppercase tracking-[0.14em] text-ink">{t('theme.product_card.new')}</span>}
          </div>
        )}
        <div className="linen-card-actions absolute end-3 top-3 flex flex-col gap-2 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
          <WishlistButton
            productId={product._id}
            product={product}
            className="linen-card-action grid place-items-center rounded-full border border-line bg-cream text-ink transition-colors hover:bg-ink hover:text-cream"
            renderIcon={(on) => <I.heart className="linen-card-icon" fill={on ? 'currentColor' : 'none'} />}
          />
          {onQuickView && (
            <button type="button" onClick={(e) => { e.preventDefault(); onQuickView(product); }} className="linen-card-action grid place-items-center rounded-full border border-line bg-cream text-ink transition-colors hover:bg-ink hover:text-cream" aria-label={t('theme.product_card.quick_view')}>
              <I.eye className="linen-card-icon" />
            </button>
          )}
        </div>
        {!list && (
          <button type="button" onClick={add} disabled={!hasOptions && !canAdd} className="linen-card-bar absolute inset-x-0 bottom-0 h-12 w-full bg-ink text-[0.75rem] font-bold uppercase tracking-[0.16em] text-cream transition-colors hover:bg-bronze disabled:bg-line disabled:text-dune">
            {cta}
          </button>
        )}
      </div>
      <div className={`${list ? 'flex flex-col justify-center' : 'pt-4 text-center'}`}>
        <h3 className="font-heading text-lg leading-snug text-ink">
          <Link to={`/products/${product.slug}`} className="transition-colors hover:text-clay">{product.name}</Link>
        </h3>
        {showRating && (product.reviewCount ?? 0) > 0 && (
          <div className={`mt-1.5 flex ${list ? '' : 'justify-center'}`}><RatingStars rating={product.averageRating || product.rating || 0} reviewCount={product.reviewCount} size="sm" showCount /></div>
        )}
        <p className={`mt-1.5 text-[0.95rem] ${list ? '' : ''}`}>
          {onSale && <s className="me-2 text-dune">{formatPrice(product.compareAtPrice)}</s>}
          <span className={onSale ? 'font-bold text-clay' : 'text-ink'}>{formatPrice(product.price)}</span>
        </p>
        {list && product.shortDescription && <p className="mt-3 line-clamp-3 text-[0.95rem] text-dune">{product.shortDescription}</p>}
        {list && (
          <button type="button" onClick={add} disabled={!hasOptions && !canAdd} className="linen-btn linen-btn-solid mt-4 self-start">{cta}</button>
        )}
      </div>
    </article>
  );
};

export default LinenProductCard;
