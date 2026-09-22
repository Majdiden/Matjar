import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useStore } from '@matjar/theme-shared/contexts/StoreContext';
import { WishlistButton } from '@matjar/theme-shared/components/commerce/WishlistButton';
import { RatingStars } from '@matjar/theme-shared/components/commerce/RatingStars';
import { getPreorderState } from '@matjar/theme-shared/utils/preorder';
import { useAtelierUI } from '../contexts/AtelierUI';

export interface CardProduct {
  _id: string;
  name: string;
  slug: string;
  price: number;
  compareAtPrice?: number;
  images?: string[];
  stock?: number;
  averageRating?: number;
  reviewCount?: number;
  hasVariants?: boolean;
  options?: unknown[];
  category?: { name?: string; slug?: string } | string;
  shortDescription?: string;
  description?: string;
  preorder?: any;
}

interface Props {
  product: CardProduct;
  view?: 'grid' | 'list';
  onQuickView?: (p: CardProduct) => void;
  className?: string;
}

export const salePercent = (price: number, compare?: number) =>
  compare && compare > price ? Math.round(((compare - price) / compare) * 100) : 0;

/**
 * Atelier card: primary/secondary image crossfade, `-N%` badge, a hover
 * action rail rising from the bottom of the media, availability line.
 * One component; `view="list"` lays it out horizontally with the extras.
 */
const AtelierProductCard: React.FC<Props> = ({ product, view = 'grid', onQuickView, className = '' }) => {
  const { t } = useTranslation(['theme', 'product']);
  const { formatPrice } = useStore();
  const { addAndConfirm } = useAtelierUI();
  const [adding, setAdding] = useState(false);
  const images = product.images || [];
  const primary = images[0] || 'https://placehold.co/800x1000/f5f1eb/1c1c1c?text=%20';
  const secondary = images[1];
  const pct = salePercent(product.price, product.compareAtPrice);
  const pre = getPreorderState(product as any, null, { adding });
  const needsOptions = !!product.hasVariants || (Array.isArray(product.options) && product.options.length > 0);
  const inStock = (product.stock ?? 0) > 0 || pre.mode === 'preorder';
  const availability = pre.mode === 'preorder' ? t('theme.card.preorder') : inStock ? t('theme.card.in_stock') : t('theme.card.sold_out');
  const availClass = pre.mode === 'preorder' ? 'text-bronze-ink' : inStock ? 'text-[color:var(--atelier-success)]' : 'text-[#8f8f8f]';
  const cat = typeof product.category === 'object' ? product.category : null;

  const add = async () => {
    if (needsOptions || !inStock || adding) return;
    setAdding(true);
    try { await addAndConfirm({ productId: product._id, name: product.name, image: primary }); } finally { setAdding(false); }
  };

  const media = (
    <div className={`group/media at-media relative overflow-hidden at-card bg-[color:var(--color-accent)] ${view === 'list' ? 'w-[270px] max-w-[45%] shrink-0' : ''}`}>
      <Link to={`/products/${product.slug}`} className="block aspect-[4/5]" aria-label={product.name}>
        <img src={primary} alt={product.name} loading="lazy" className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-[400ms] ease-linear ${secondary ? 'group-hover/media:opacity-0' : ''}`} />
        {secondary && <img src={secondary} alt="" loading="lazy" aria-hidden className="absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-[400ms] ease-linear group-hover/media:opacity-100" />}
      </Link>
      {pct > 0 && (
        <span className="absolute top-3 start-3 rounded-full bg-[color:var(--atelier-sale)] px-2.5 py-1 text-[11px] font-extrabold text-white">-{pct}%</span>
      )}
      {/* Hover action rail: rises from the bottom; always visible on touch (no hover). */}
      <div className="absolute inset-x-2 bottom-2 flex items-center justify-center gap-1.5 sm:inset-x-3 sm:bottom-3 sm:gap-2 translate-y-[calc(100%+12px)] opacity-0 transition-[transform,opacity] duration-300 ease-out group-hover/media:translate-y-0 group-hover/media:opacity-100 focus-within:translate-y-0 focus-within:opacity-100 [@media(hover:none)]:translate-y-0 [@media(hover:none)]:opacity-100">
        <WishlistButton
          productId={product._id}
          product={product}
          className="at-icon-btn h-11 w-11 shrink-0 bg-white text-[#1c1c1c] shadow-[0_2px_10px_#0000001a] transition-colors duration-300 hover:bg-[#1c1c1c] hover:text-white"
          renderIcon={(on) => <svg className="h-4 w-4" viewBox="0 0 24 24" fill={on ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8"><path d="M12 21s-8-5-8-11a4 4 0 018-1 4 4 0 018 1c0 6-8 11-8 11z" /></svg>}
        />
        {needsOptions ? (
          <Link to={`/products/${product.slug}`} aria-label={t('theme.card.select_options')} className="at-rail-cta flex h-11 min-w-[44px] flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-full bg-white px-3 text-[11px] font-bold uppercase tracking-wider text-[#1c1c1c] shadow-[0_2px_10px_#0000001a] transition-colors duration-300 hover:bg-[#1c1c1c] hover:text-white">
            <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 7h16M4 12h16M4 17h10" /></svg>
            <span className="at-rail-label">{t('theme.card.select_options')}</span>
          </Link>
        ) : (
          <button type="button" onClick={add} disabled={!inStock || adding} aria-label={pre.mode === 'preorder' ? t('theme.card.preorder') : inStock ? t('theme.card.add_to_cart') : t('theme.card.sold_out')} className="at-rail-cta flex h-11 min-w-[44px] flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-full bg-white px-3 text-[11px] font-bold uppercase tracking-wider text-[#1c1c1c] shadow-[0_2px_10px_#0000001a] transition-colors duration-300 hover:bg-[#1c1c1c] hover:text-white disabled:bg-[#e5e5e5] disabled:text-[#4a4a4a]">
            {adding ? <span className="at-spinner" /> : <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M6 8h12l1 13H5L6 8z" /><path d="M9 8V6a3 3 0 016 0v2" /></svg>}
            <span className="at-rail-label">{pre.mode === 'preorder' ? t('theme.card.preorder') : inStock ? t('theme.card.add_to_cart') : t('theme.card.sold_out')}</span>
          </button>
        )}
        {onQuickView && (
          <button type="button" onClick={() => onQuickView(product)} aria-label={t('theme.card.quick_view')} className="at-icon-btn h-11 w-11 shrink-0 bg-white text-[#1c1c1c] shadow-[0_2px_10px_#0000001a] transition-colors duration-300 hover:bg-[#1c1c1c] hover:text-white">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></svg>
          </button>
        )}
      </div>
    </div>
  );

  const info = (
    <div className={`${view === 'list' ? 'flex-1 ps-6 py-2' : 'pt-4'} min-w-0`}>
      {view === 'list' && cat?.name && (
        <Link to={`/categories/${cat.slug}`} className="text-[10px] font-semibold uppercase tracking-wider text-[#6b6b6b] at-link-hover">{cat.name}</Link>
      )}
      <h3 className={`font-body font-semibold leading-snug ${view === 'list' ? 'text-lg' : 'text-[15px]'}`}>
        <Link to={`/products/${product.slug}`} className="at-link-hover line-clamp-2">{product.name}</Link>
      </h3>
      {(product.reviewCount || 0) > 0 && <RatingStars rating={product.averageRating || 0} reviewCount={product.reviewCount} size="sm" showCount className="mt-1" />}
      <div className="mt-1.5 flex items-baseline gap-2">
        <span className="text-[15px] font-extrabold">{formatPrice(pre.effectivePrice || product.price)}</span>
        {pct > 0 && <s className="text-[13px] text-[#6b6b6b]">{formatPrice(product.compareAtPrice as number)}</s>}
      </div>
      <p className={`mt-1 text-[11px] font-semibold uppercase tracking-wide ${availClass}`}>{availability}</p>
      {view === 'list' && (product.shortDescription || product.description) && (
        <p className="mt-3 line-clamp-3 text-sm text-[#4a4a4a]">{product.shortDescription || String(product.description).replace(/<[^>]+>/g, '')}</p>
      )}
    </div>
  );

  return (
    <article className={`at-grid-item ${view === 'list' ? 'flex gap-2 rounded-[var(--atelier-radius-card)] border border-[#e5e5e5] p-4 transition-shadow hover:shadow-[4px_4px_8px_#0000001a]' : ''} ${className}`}>
      {media}
      {info}
    </article>
  );
};

export default AtelierProductCard;
