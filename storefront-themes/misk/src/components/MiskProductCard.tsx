import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useCart } from '@matjar/theme-shared/contexts/CartContext';
import { useStore } from '@matjar/theme-shared/contexts/StoreContext';
import { useThemeSetting } from '@matjar/theme-shared/theme/ThemeProvider';
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

const PLACEHOLDER = 'https://placehold.co/800x800/f4efe7/14110e?text=%20';

/**
 * Misk product card: a square image on sand, a corner sale ribbon, a wishlist
 * heart and quick-view eye in a mirrored action rail, and a quick-add bar that
 * slides up on hover/focus (always visible on touch, where there is no hover).
 *
 * Ribbon, text alignment, quick-add and the second-image swap are all theme
 * settings, so a merchant can take the card from "busy" to "quiet" without
 * touching code.
 */
export const MiskProductCard: React.FC<Props> = ({
  product, showRating = true, showBadge = true, newDays = 30, onQuickView, variant = 'grid',
}) => {
  const { t } = useTranslation(['theme']);
  const { addItem } = useCart();
  const { formatPrice } = useStore();
  const [adding, setAdding] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);

  const showRibbon = useThemeSetting<boolean>('card_show_ribbon') !== false;
  const showQuickAdd = useThemeSetting<boolean>('card_show_quick_add') !== false;
  const swapImage = useThemeSetting<boolean>('card_second_image') !== false;
  const align = useThemeSetting<string>('card_text_align') || 'center';

  const img = !imgFailed && product.images?.[0] ? product.images[0] : PLACEHOLDER;
  const img2 = swapImage ? product.images?.[1] : undefined;
  const onSale = product.compareAtPrice > product.price;
  const pct = onSale ? Math.round(((product.compareAtPrice - product.price) / product.compareAtPrice) * 100) : 0;
  const isNew = product.createdAt ? Date.now() - new Date(product.createdAt).getTime() < newDays * 86400000 : false;
  const hasOptions = Array.isArray(product.options) && product.options.length > 0;
  const inStock = (product.stock ?? 0) > 0;
  const pre = getPreorderState(product, null, { adding });

  const cta = hasOptions
    ? t('theme.card.select_options')
    : pre.mode === 'preorder' ? t('theme.card.preorder')
    : pre.mode === 'soldOut' || !inStock ? t('theme.card.sold_out')
    : adding ? t('theme.card.adding') : t('theme.card.add');
  const canAdd = !hasOptions && (inStock || pre.mode === 'preorder') && !adding && !pre.ctaDisabled;

  const add = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (hasOptions) { onQuickView?.(product); return; }
    if (!canAdd) return;
    setAdding(true);
    try { await addItem(product._id, 1); } finally { setAdding(false); }
  };

  const list = variant === 'list';
  const actionBtn = 'misk-card-action grid place-items-center rounded-full border border-line bg-white text-ink shadow-[var(--shadow-xs)] transition-colors duration-300 hover:bg-ink hover:text-white';
  const textAlign = list ? 'text-start' : align === 'start' ? 'text-start' : 'text-center';

  return (
    <article className={`group ${list ? 'grid grid-cols-[minmax(110px,36%)_minmax(0,1fr)] gap-4 sm:gap-8' : ''}`}>
      <div className="misk-card-media relative aspect-square overflow-hidden rounded-[var(--radius-sm,6px)] bg-sand">
        <Link to={`/products/${product.slug}`} className="block h-full w-full" aria-label={product.name}>
          <img
            src={img}
            alt={product.name}
            loading="lazy"
            onError={() => setImgFailed(true)}
            className={`h-full w-full object-cover transition-[opacity,transform] duration-500 ${img2 ? 'group-hover:opacity-0' : 'group-hover:scale-[1.04]'}`}
          />
          {img2 && (
            <img src={img2} alt="" aria-hidden loading="lazy" className="absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
          )}
        </Link>

        {showBadge && onSale && showRibbon && (
          <div className="misk-ribbon" aria-hidden><span><b>{t('theme.card.sale')}</b></span></div>
        )}
        {showBadge && onSale && !showRibbon && (
          <span className="absolute start-3 top-3 rounded-full bg-sale px-3 py-1 text-xs font-bold text-white misk-num">−{pct}%</span>
        )}
        {showBadge && !onSale && isNew && (
          <span className="absolute start-3 top-3 rounded-full border border-ink bg-white px-3 py-1 text-xs font-bold text-ink">{t('theme.card.new')}</span>
        )}
        {/* Screen readers get the sale fact as text — the ribbon is decorative. */}
        {showBadge && onSale && showRibbon && <span className="sr-only">{t('theme.card.sale')}</span>}

        <div className="misk-card-actions absolute end-3 top-3 flex flex-col gap-2 opacity-100 transition-opacity duration-300 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
          <WishlistButton
            productId={product._id}
            product={product}
            className={actionBtn}
            renderIcon={(on) => <I.heart className="misk-card-icon" fill={on ? 'currentColor' : 'none'} />}
          />
          {onQuickView && (
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); onQuickView(product); }}
              className={actionBtn}
              aria-label={t('theme.card.quick_view')}
            >
              <I.eye className="misk-card-icon" />
            </button>
          )}
        </div>

        {!list && showQuickAdd && (
          <button
            type="button"
            onClick={add}
            disabled={!hasOptions && !canAdd}
            className="misk-card-bar absolute inset-x-0 bottom-0 h-12 w-full bg-ink text-sm font-bold text-white transition-colors duration-300 hover:bg-gold-ink disabled:bg-line disabled:text-muted"
          >
            {cta}
          </button>
        )}
      </div>

      <div className={`${list ? 'flex flex-col justify-center' : 'pt-4'} ${textAlign}`}>
        <h3 className="font-display text-lg leading-snug text-ink">
          <Link to={`/products/${product.slug}`} className="transition-colors duration-300 hover:text-gold-ink">{product.name}</Link>
        </h3>
        {showRating && (product.reviewCount ?? 0) > 0 && (
          <div className={`mt-1.5 flex ${textAlign === 'text-center' ? 'justify-center' : ''}`}>
            <RatingStars rating={product.averageRating || product.rating || 0} reviewCount={product.reviewCount} size="sm" showCount />
          </div>
        )}
        {/* Flex + gap, not an inline margin: in an RTL paragraph the two
            prices form one bidi run and an inline margin collapses between
            them. Flex ordering still follows direction, so the current
            price stays first. */}
        <p className={`misk-num mt-1.5 flex items-baseline gap-2 text-sm ${textAlign === 'text-center' ? 'justify-center' : 'justify-start'}`}>
          <span className={onSale ? 'font-bold text-ink' : 'text-ink'}>{formatPrice(product.price)}</span>
          {onSale && <s className="text-muted">{formatPrice(product.compareAtPrice)}</s>}
        </p>
        {list && product.shortDescription && <p className="mt-3 line-clamp-3 text-sm text-muted">{product.shortDescription}</p>}
        {list && (
          <button type="button" onClick={add} disabled={!hasOptions && !canAdd} className="misk-btn misk-btn-solid mt-4 self-start">{cta}</button>
        )}
      </div>
    </article>
  );
};

export default MiskProductCard;
