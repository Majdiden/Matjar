/**
 * TonmartProductCard — techhub-specific borderless product card
 * modeled after the TONMART Shopify theme.
 *
 * Default state (compact):
 *   image on tinted square
 *   CATEGORY eyebrow
 *   title (2 lines)
 *   5-star rating row
 *   price
 *
 * Hover state (flips body to reveal):
 *   SELECT COLOR swatches (filled circles, green ring on active)
 *   SELECT SIZE pills (dark fill on active)
 *   CATEGORY eyebrow + title + rating + price
 *   row: [  ADD TO CART  ][ wishlist ][ quick view ]
 *
 * The card is borderless — it sits on the page background. The whole
 * card is a link, but interactive elements inside stopPropagation and
 * call their own handlers.
 */
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '@matjar/theme-shared/contexts/CartContext';
import { useStore } from '@matjar/theme-shared/contexts/StoreContext';
import { useCompare } from '@matjar/theme-shared/components/commerce/ProductCompare';
import type { Product } from '@matjar/theme-shared/types/commerce';
import { getPreorderState } from '@matjar/theme-shared/utils/preorder';
import { WishlistButton } from '@matjar/theme-shared/components/commerce/WishlistButton';
import { useTranslation } from 'react-i18next';

interface Props {
  product: Product & {
    brand?: string;
    shortDescription?: string;
    options?: Array<{ name: string; values: string[] }>;
    attributes?: Record<string, any>;
    specs?: Record<string, any>;
  };
  onQuickView?: (p: Product) => void;
}

/** Extract up to 3 spec chips (brand/ram/storage/screen etc.) from
 *  product.attributes or product.specs. Returns empty array if absent. */
const SPEC_KEYS = ['brand', 'ram', 'storage', 'screen', 'cpu', 'gpu', 'display', 'battery'];
function extractSpecChips(product: Props['product']): string[] {
  const src = product.attributes || product.specs || {};
  if (!src || typeof src !== 'object') return [];
  const chips: string[] = [];
  for (const key of SPEC_KEYS) {
    const val = (src as any)[key] ?? (src as any)[key.toUpperCase()];
    if (val != null && val !== '') {
      chips.push(String(val));
      if (chips.length >= 3) break;
    }
  }
  // If no known keys matched, fall back to first 3 string-y values
  if (chips.length === 0) {
    for (const [, val] of Object.entries(src)) {
      if (typeof val === 'string' || typeof val === 'number') {
        chips.push(String(val));
        if (chips.length >= 3) break;
      }
    }
  }
  return chips;
}

/** Map a color name to a hex fill — falls back to the name (lets CSS
 * color keywords work: "red", "black", etc). */
const COLOR_MAP: Record<string, string> = {
  teal: '#14b8a6',
  green: '#22c55e',
  black: '#000000',
  white: '#ffffff',
  pink: '#f472b6',
  red: '#ef4444',
  blue: '#3b82f6',
  navy: '#0a1f44',
  gray: '#6b7280',
  grey: '#6b7280',
  silver: '#c0c0c0',
  gold: '#f59e0b',
  yellow: '#eab308',
  orange: '#f97316',
  purple: '#a855f7',
  brown: '#92400e',
  beige: '#d6c7a1',
};

const resolveColor = (v: string) => COLOR_MAP[v.toLowerCase()] || v;

export const TonmartProductCard: React.FC<Props> = ({ product, onQuickView }) => {
  const { t } = useTranslation(['theme']);
  const { formatPrice } = useStore();
  const { addItem } = useCart();
  const compare = useCompare();
  const comparing = compare.isComparing(product._id);
  const compareFull = !comparing && compare.count >= compare.maxItems;
  const specChips = extractSpecChips(product);
  const [adding, setAdding] = useState(false);
  const requiresOptions = Boolean(product.hasVariants || product.variants?.length || product.options?.length);

  // Extract color/size options from the product's option list. Fall back
  // to nothing so the hover block gracefully hides those rows when the
  // product has no variants.
  const colorOpt =
    product.options?.find((o) => /colou?r/i.test(o.name))?.values?.slice(0, 6) || [];
  const sizeOpt =
    product.options?.find((o) => /size/i.test(o.name))?.values?.slice(0, 4) || [];

  const [activeColor, setActiveColor] = useState<string | null>(colorOpt[0] || null);
  const [activeSize, setActiveSize] = useState<string | null>(sizeOpt[0] || null);

  const discount =
    product.compareAtPrice && product.compareAtPrice > product.price
      ? Math.round((1 - product.price / product.compareAtPrice) * 100)
      : 0;

  const imgSrc = product.images?.[0] || 'https://placehold.co/400x400?text=Product';
  const hoverSrc = product.images?.[1];
  const preorder = getPreorderState(product as any, null, { price: product.price });
  const isPreorder = preorder.mode === 'preorder';

  const handleAdd = async (e: React.MouseEvent) => {
    if (requiresOptions) return;
    e.preventDefault();
    e.stopPropagation();
    setAdding(true);
    try {
      await addItem(product._id);
    } catch (err) {
      console.error(err);
    } finally {
      setAdding(false);
    }
  };

  const handleQuickView = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onQuickView?.(product);
  };

  return (
    <Link
      to={`/products/${product.slug}`}
      className="group block relative"
    >
      {/* ─── Image panel ─────────────────────────────────────── */}
      <div className="relative aspect-square rounded-lg overflow-hidden">
        <img
          src={imgSrc}
          alt={product.name}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${hoverSrc ? 'group-hover:opacity-0' : ''}`}
          loading="lazy"
        />
        {hoverSrc && (
          <img
            src={hoverSrc}
            alt={product.name}
            className="absolute inset-0 w-full h-full object-cover opacity-0 group-hover:opacity-100 transition-opacity duration-500"
            loading="lazy"
          />
        )}

        {/* Wishlist heart — techhub's rounded, foreground-tinted treatment */}
        <div className="absolute bottom-3 end-3 z-10">
          <WishlistButton
            productId={product._id}
            product={product}
            className="h-9 w-9 rounded-full flex items-center justify-center bg-white/85 backdrop-blur shadow-sm hover:bg-white transition"
            renderIcon={(active) => (
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2} style={{ color: 'var(--color-foreground)' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            )}
          />
        </div>

        {/* Compare toggle — top-right, subtle */}
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (compareFull) return;
            comparing ? compare.remove(product._id) : compare.add(product);
          }}
          disabled={compareFull}
          title={compareFull ? t('theme.product_card.compare_full') : comparing ? t('theme.product_card.compare_remove') : t('theme.product_card.compare_add')}
          aria-label={t('theme.product_card.toggle_compare')}
          className="absolute top-3 end-3 z-10 px-2 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full border transition disabled:opacity-40"
          style={{
            backgroundColor: comparing ? 'var(--color-primary)' : 'var(--color-background)',
            color: comparing ? '#fff' : 'var(--color-foreground)',
            borderColor: comparing ? 'var(--color-primary)' : 'var(--color-border)',
          }}
        >
          {comparing ? (
            <span className="inline-flex items-center gap-1"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3 shrink-0"><path d="M5 13l4 4L19 7" /></svg>{t('theme.product_card.compare_added')}</span>
          ) : t('theme.product_card.compare')}
        </button>

        {/* Badges */}
        <div className="absolute top-3 start-3 flex flex-col gap-1.5">
          {discount > 0 && (
            <span
              className="text-[10px] font-bold px-2 py-1 rounded text-white"
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              -{discount}%
            </span>
          )}
          {isPreorder && (
            <span
              className="text-[10px] font-bold px-2 py-1 rounded text-white uppercase tracking-wider"
              style={{ backgroundColor: 'var(--color-accent)' }}
            >
              {t('theme.product_card.pre_order_badge')}
            </span>
          )}
          {product.isFeatured && (
            <span
              className="text-[10px] font-bold px-2 py-1 rounded text-white"
              style={{ backgroundColor: 'var(--color-foreground)' }}
            >
              {t('theme.product_card.hot_badge')}
            </span>
          )}
        </div>
      </div>

      {/* ─── Info stack — grid-stack so container sizes to the tallest layer (prevents the hover panel with variants from overflowing into the next card) ─── */}
      <div className="grid mt-4 [&>*]:col-start-1 [&>*]:row-start-1">
        {/* Default state */}
        <div className="transition-opacity duration-300 group-hover:opacity-0 group-hover:pointer-events-none">
          {(product.category as any)?.name || product.brand ? (
            <p
              className="text-[10px] font-bold uppercase tracking-wider mb-1.5"
              style={{ color: 'var(--color-muted)' }}
            >
              {(product.category as any)?.name || product.brand}
            </p>
          ) : null}
          <h3
            className="text-sm font-semibold mb-1.5 line-clamp-2 leading-snug"
            style={{ color: 'var(--color-foreground)' }}
          >
            {product.name}
          </h3>
          {specChips.length > 0 && (
            <div className="flex items-center gap-1 flex-wrap mb-2">
              {specChips.map((chip, idx) => (
                <span
                  key={idx}
                  className="text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded border"
                  style={{
                    borderColor: 'var(--color-border)',
                    color: 'var(--color-muted)',
                    backgroundColor: 'color-mix(in srgb, var(--color-foreground) 3%, transparent)',
                  }}
                >
                  {chip}
                </span>
              ))}
            </div>
          )}
          <div className="flex items-center gap-0.5 mb-2">
            {Array.from({ length: 5 }).map((_, i) => {
              const filled = i < Math.round(Number(product.rating || 0));
              return (
                <svg
                  key={i}
                  className="w-3 h-3"
                  fill={filled ? 'var(--color-accent)' : 'none'}
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  style={{ color: filled ? 'var(--color-accent)' : 'var(--color-border)' }}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.5l2.4 4.86 5.37.78-3.88 3.78.92 5.35L11.48 15.77 6.67 18.27l.92-5.35L3.71 9.14l5.37-.78 2.4-4.86z" />
                </svg>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-base font-black" style={{ color: 'var(--color-foreground)' }}>
              {formatPrice(product.price)}
            </span>
            {discount > 0 && product.compareAtPrice && (
              <span className="text-xs line-through" style={{ color: 'var(--color-muted)' }}>
                {formatPrice(product.compareAtPrice)}
              </span>
            )}
          </div>
        </div>

        {/* Hover layer — stacked in the same grid cell, fades in on top */}
        <div
          className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none group-hover:pointer-events-auto"
        >
          {colorOpt.length > 0 && (
            <div className="mb-2">
              <p
                className="text-[10px] font-bold uppercase tracking-wider mb-1.5"
                style={{ color: 'var(--color-muted)' }}
              >
                {t('theme.product_card.select_color')}
              </p>
              <div className="flex items-center gap-2">
                {colorOpt.map((c) => {
                  const isActive = c === activeColor;
                  return (
                    <button
                      key={c}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setActiveColor(c);
                      }}
                      aria-label={c}
                      className="h-6 w-6 rounded-full transition relative"
                      style={{
                        backgroundColor: resolveColor(c),
                        boxShadow: isActive
                          ? `0 0 0 2px var(--color-background), 0 0 0 4px var(--color-primary)`
                          : 'inset 0 0 0 1px rgba(0,0,0,0.1)',
                      }}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {sizeOpt.length > 0 && (
            <div className="mb-2">
              <p
                className="text-[10px] font-bold uppercase tracking-wider mb-1.5"
                style={{ color: 'var(--color-muted)' }}
              >
                {t('theme.product_card.select_size')}
              </p>
              <div className="flex items-center gap-1.5">
                {sizeOpt.map((sz) => {
                  const isActive = sz === activeSize;
                  return (
                    <button
                      key={sz}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setActiveSize(sz);
                      }}
                      className="px-2.5 py-1 text-[10px] font-bold rounded border transition"
                      style={{
                        backgroundColor: isActive ? 'var(--color-foreground)' : 'transparent',
                        color: isActive ? '#fff' : 'var(--color-foreground)',
                        borderColor: isActive ? 'var(--color-foreground)' : 'var(--color-border)',
                      }}
                    >
                      {sz}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Compact info repeated so the hover panel is self-contained */}
          {colorOpt.length === 0 && sizeOpt.length === 0 && (
            <>
              {(product.category as any)?.name || product.brand ? (
                <p
                  className="text-[10px] font-bold uppercase tracking-wider mb-1.5"
                  style={{ color: 'var(--color-muted)' }}
                >
                  {(product.category as any)?.name || product.brand}
                </p>
              ) : null}
              <h3
                className="text-sm font-semibold mb-1.5 line-clamp-2 leading-snug"
                style={{ color: 'var(--color-foreground)' }}
              >
                {product.name}
              </h3>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-3">
                <span className="text-base font-black" style={{ color: 'var(--color-foreground)' }}>
                  {formatPrice(product.price)}
                </span>
                {discount > 0 && product.compareAtPrice && (
                  <span className="text-xs line-through" style={{ color: 'var(--color-muted)' }}>
                    {formatPrice(product.compareAtPrice)}
                  </span>
                )}
              </div>
            </>
          )}

          {/* Action row: big ADD TO CART pill + heart + gallery */}
          <div className="flex items-center gap-2 mt-1">
            <button
              onClick={handleAdd}
              disabled={adding}
              title={requiresOptions ? t('theme.product_card.choose_options') : undefined}
              className="flex-1 py-2.5 rounded-full text-[10px] font-bold uppercase tracking-wider text-white transition hover:-translate-y-0.5 disabled:opacity-50"
              style={{ backgroundColor: 'var(--color-foreground)' }}
            >
              {requiresOptions ? t('theme.product_card.choose_options') : adding ? t('theme.product_card.adding') : t('theme.product_card.add_to_cart')}
            </button>
            <WishlistButton
              productId={product._id}
              product={product}
              className="h-9 w-9 flex-none rounded-full flex items-center justify-center transition hover:opacity-80 bg-[color-mix(in_srgb,var(--color-foreground)_6%,transparent)]"
              renderIcon={(active) => (
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2} style={{ color: 'var(--color-foreground)' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              )}
            />
            <button
              onClick={handleQuickView}
              aria-label={t('theme.product_card.quick_view')}
              className="h-9 w-9 flex-none rounded-full flex items-center justify-center transition hover:opacity-80"
              style={{
                backgroundColor: 'color-mix(in srgb, var(--color-foreground) 6%, transparent)',
                color: 'var(--color-foreground)',
              }}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </Link>
  );
};

export default TonmartProductCard;
