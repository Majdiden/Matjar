import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation('product');
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
      <Link
        to={`/products/${product.slug}`}
        className={`flex gap-4 p-4 border border-[var(--color-border,#e5e7eb)] shadow-[var(--shadow-xs)] hover:shadow-[var(--shadow-md)] transition-all duration-[var(--duration-base,250ms)] ease-[var(--ease-emphasized,cubic-bezier(0.2,0,0,1))] ${className}`}
        style={{ borderRadius: 'var(--radius, 12px)' }}
      >
        <img src={imgSrc} alt={product.name} className={`w-24 h-24 object-cover bg-[var(--color-muted,#6b7280)]/5 rounded-[var(--radius-sm,6px)] ${imageClassName}`} onError={(e)=>{const el=e.currentTarget; if(el.src!=='https://placehold.co/200x200?text=No+Image'){el.src='https://placehold.co/200x200?text=No+Image';}}} />
        <div className="flex-1 min-w-0">
          <h3 className="font-medium truncate">{product.name}</h3>
          <div className="flex items-center gap-2 mt-1">
            <span className="font-bold">{formatPrice(displayPrice)}</span>
            {discount > 0 && strikePrice && (
              <span className="text-sm text-gray-400 line-through">{formatPrice(strikePrice)}</span>
            )}
          </div>
          {pre.mode === 'preorder' && (
            <span className="text-xs text-amber-600 mt-1 block">
              {t('card.preorder')}{pre.shipByLabel ? ` — ${pre.shipByLabel}` : ''}
            </span>
          )}
          {soldOut && (
            <span className="text-xs text-red-500 mt-1">
              {pre.mode === 'soldOut' ? t('card.sold_out') : t('card.out_of_stock')}
            </span>
          )}
        </div>
      </Link>
    );
  }

  return (
    <Link
      to={`/products/${product.slug}`}
      className={`group block overflow-hidden bg-[var(--color-background,#fff)] border border-[var(--color-border,#e5e7eb)] transition-all ease-[var(--ease-emphasized,cubic-bezier(0.2,0,0,1))] duration-[var(--duration-base,250ms)] shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-lg)] hover:[transform:var(--hover-lift,translateY(-4px))] hover:border-transparent ${className}`}
      style={{ borderRadius: 'var(--radius, 12px)' }}
    >
      {/* Neutral backdrop keeps the box from collapsing when a product has
          no image or the image 404s — cards stay a uniform height on any
          store. */}
      <div className="relative aspect-[4/5] overflow-hidden bg-[var(--color-muted,#6b7280)]/5">
        <img
          src={imgSrc}
          alt={product.name}
          className={`w-full h-full object-cover transition-transform ease-[var(--ease-standard,cubic-bezier(0.4,0,0.2,1))] duration-[var(--duration-slow,400ms)] group-hover:scale-[1.06] ${imageClassName}`}
          loading="lazy"
          onError={(e) => {
            const el = e.currentTarget;
            if (el.src !== 'https://placehold.co/400x500?text=No+Image') {
              el.src = 'https://placehold.co/400x500?text=No+Image';
            }
          }}
        />
        <div className="absolute top-2 start-2 flex flex-col gap-1">
          {discount > 0 && (
            <span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded">
              -{discount}%
            </span>
          )}
          {pre.mode === 'preorder' && (
            <span className="bg-amber-500 text-white text-xs font-bold px-2 py-1 rounded">
              {t('card.preorder')}
            </span>
          )}
        </div>
        {soldOut && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <span className="bg-white text-gray-800 px-3 py-1 rounded font-medium text-sm">
              {pre.mode === 'soldOut' ? t('card.sold_out') : t('card.out_of_stock')}
            </span>
          </div>
        )}
      </div>
      <div className="p-3">
        <h3 className="font-medium text-sm truncate">{product.name}</h3>
        {/* Price row — own line so a discounted price + strike + % never
            squeezes the CTA off the card. */}
        <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5 mt-2">
          <span
            className="font-bold text-base"
            style={discount > 0 ? { color: 'var(--color-error, #dc2626)' } : undefined}
          >
            {formatPrice(displayPrice)}
          </span>
          {discount > 0 && strikePrice && (
            <span className="text-xs text-[var(--color-muted,#9ca3af)] line-through">{formatPrice(strikePrice)}</span>
          )}
          {discount > 0 && (
            <span className="text-[11px] font-semibold" style={{ color: 'var(--color-error, #dc2626)' }}>-{discount}%</span>
          )}
        </div>
        {product.rating !== undefined && product.rating > 0 && (
          <div className="flex items-center gap-1 mt-1 text-xs text-gray-500">
            <span style={{ color: 'var(--color-accent, #f59e0b)' }}>{'★'.repeat(Math.round(product.rating))}</span>
            <span>({product.reviewCount || 0})</span>
          </div>
        )}
        {/* Full-width CTA below — premium, never clipped on narrow cards. */}
        {showAddToCart && canPurchase && (
          <button
            onClick={handleAdd}
            disabled={adding || pre.ctaDisabled}
            className="w-full mt-3 inline-flex items-center justify-center text-xs font-semibold text-white px-3 py-2 min-h-[36px] rounded-[var(--radius-sm,6px)] transition-all duration-[var(--duration-fast,150ms)] hover:brightness-110 active:scale-95 disabled:opacity-50"
            style={{ backgroundColor: 'var(--color-primary, #667eea)' }}
            title={
              requiresOptions
                ? t('select_options_hint')
                : pre.mode === 'preorder'
                ? [pre.shipByLabel, pre.depositLabel].filter(Boolean).join(' · ') || undefined
                : undefined
            }
          >
            {requiresOptions
              ? t('card.options')
              : adding
              ? t('card.adding')
              : pre.mode === 'preorder'
              ? t('card.preorder')
              : pre.mode === 'soldOut'
              ? t('card.sold_out')
              : t('card.add')}
          </button>
        )}
        {pre.mode === 'preorder' && (
          <div className="mt-1.5 space-y-0.5 text-[11px] text-amber-700 leading-tight">
            {pre.shipByLabel && <div>{pre.shipByLabel}</div>}
            {pre.depositLabel && <div>{pre.depositLabel}</div>}
            {pre.lowRemaining && pre.remaining !== null && (
              <div className="font-semibold">{t('only_remaining', { count: pre.remaining })}</div>
            )}
          </div>
        )}
      </div>
    </Link>
  );
};

export default ProductCard;
