import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { cn } from '../../utils/cn';
import { Modal } from '../primitives/Modal';
import { PriceDisplay } from '../commerce/PriceDisplay';
import { QuantitySelector } from '../commerce/QuantitySelector';
import { RatingStars } from '../commerce/RatingStars';
import { WishlistButton } from '../commerce/WishlistButton';
import { useCart } from '../../contexts/CartContext';
import type { Product } from '../../types/commerce';
import { useThemeSlot } from '../../theme/ThemeSlotsProvider';

export const SLOT_KEY = 'quickView';

interface QuickViewProps {
  product: Product | null;
  /** Optional — defaults to `!!product` so callers can pass just `product`. */
  isOpen?: boolean;
  onClose: () => void;
  className?: string;
}

/**
 * QuickView modal — premium product preview launched from a product card.
 *
 * Fully token-driven (every colour reads the `--color-*` / `--radius*` /
 * `--shadow-*` / `--duration-*` variables ThemeProvider injects) so the
 * modal inherits each theme's palette and the customizer's light/dark
 * mode — no OS `dark:` variants.
 *
 * Layout: edge-to-edge gallery (swipeable on touch, arrow nav + thumbnail
 * rail on desktop, dot pagination on mobile) beside a clean info column
 * with rating, price + savings chip, variants, stock, quantity and a
 * prominent add-to-cart with success feedback. Entrance animation is a
 * soft fade/rise pair that fully disables under `prefers-reduced-motion`.
 *
 * Accessibility (focus trap, Escape, dialog semantics) comes from the
 * shared Modal primitive; gallery controls carry translated aria labels.
 *
 * The modal auto-resets internal state (selected image, quantity, variant
 * selection) whenever a different product is opened.
 */
export function QuickView(props: QuickViewProps) {
  const Override = useThemeSlot<React.ComponentType<QuickViewProps>>(SLOT_KEY);
  if (Override) return <Override {...props} />;
  const { t } = useTranslation(['discovery', 'product']);
  const { product, isOpen, onClose, className } = props;
  const { addItem } = useCart();
  const open = isOpen ?? !!product;

  const [quantity, setQuantity] = useState(1);
  const [selectedImage, setSelectedImage] = useState(0);
  const [adding, setAdding] = useState(false);
  const [justAdded, setJustAdded] = useState(false);
  const [selectedVariantId, setSelectedVariantId] = useState<string | undefined>(undefined);
  const touchStartX = useRef(0);
  const touchDeltaX = useRef(0);

  // Reset state when opening a different product
  useEffect(() => {
    if (product) {
      setSelectedImage(0);
      setQuantity(1);
      setJustAdded(false);
      setSelectedVariantId(product.variants?.[0]?._id);
    }
  }, [product?._id]);

  // NOTE: every hook below MUST run on every render — calling them after the
  // `if (!product) return null` below would change the hook count between
  // null and non-null product renders and crash with React error #310.
  const selectedVariant = product?.variants?.find((v) => v._id === selectedVariantId);
  const effectivePrice = selectedVariant?.price ?? product?.price ?? 0;
  const effectiveCompareAt = selectedVariant?.compareAtPrice ?? product?.compareAtPrice;
  const effectiveStock = selectedVariant?.stock ?? product?.stock;

  const savingsPct = useMemo(() => {
    if (!effectiveCompareAt || effectiveCompareAt <= effectivePrice) return null;
    return Math.round(((effectiveCompareAt - effectivePrice) / effectiveCompareAt) * 100);
  }, [effectivePrice, effectiveCompareAt]);

  if (!product) return null;

  const images = product.images?.length
    ? product.images
    : ['https://placehold.co/600x600?text=No+Image'];

  const prevImage = () => setSelectedImage((i) => (i === 0 ? images.length - 1 : i - 1));
  const nextImage = () => setSelectedImage((i) => (i === images.length - 1 ? 0 : i + 1));

  // Touch swipe on the gallery (mobile has no arrows — dots + swipe).
  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchDeltaX.current = 0;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    touchDeltaX.current = e.touches[0].clientX - touchStartX.current;
  };
  const onTouchEnd = () => {
    if (images.length < 2 || Math.abs(touchDeltaX.current) < 48) return;
    // Physical swipe: finger left advances in LTR reading order; flip in RTL.
    const rtl = typeof document !== 'undefined' && document.documentElement.dir === 'rtl';
    const towardNext = rtl ? touchDeltaX.current > 0 : touchDeltaX.current < 0;
    towardNext ? nextImage() : prevImage();
  };

  const variantLabel = (v: typeof selectedVariant) =>
    v?.optionValues?.map((o) => o.value).join(' / ') || v?.sku || t('discovery:quickview.variant_label');

  const handleAddToCart = async () => {
    setAdding(true);
    try {
      await addItem(product._id, quantity, selectedVariantId);
      setJustAdded(true);
      // Brief celebration before closing so the user sees the success state
      setTimeout(() => {
        onClose();
      }, 700);
    } catch (err) {
      console.error('Failed to add to cart:', err);
    } finally {
      setAdding(false);
    }
  };

  const inStock = effectiveStock === undefined || effectiveStock > 0;
  const lowStock = effectiveStock !== undefined && effectiveStock > 0 && effectiveStock <= 5;

  const floatingBtn: React.CSSProperties = {
    backgroundColor: 'color-mix(in srgb, var(--color-background, #fff) 92%, transparent)',
    color: 'var(--color-foreground, #111)',
  };

  const sectionLabelCls = 'text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-muted,#6b7280)]';

  return (
    <Modal isOpen={open} onClose={onClose} size="xl" className={cn('!p-0 overflow-hidden', className)}>
      {/* Scoped entrance keyframes — the Tailwind animate plugin isn't
          installed in the themes, so the modal's smooth entrance lives
          here. Fully disabled under prefers-reduced-motion. */}
      <style>{`
        @keyframes qv-rise { from { opacity: 0; transform: translateY(14px) scale(0.985); } to { opacity: 1; transform: none; } }
        @keyframes qv-fade { from { opacity: 0; } to { opacity: 1; } }
        .qv-panel { animation: qv-rise var(--duration-base, 250ms) var(--ease-entrance, cubic-bezier(0.16, 1, 0.3, 1)) both; }
        .qv-img { animation: qv-fade var(--duration-base, 250ms) var(--ease-standard, ease-out) both; }
        @media (prefers-reduced-motion: reduce) { .qv-panel, .qv-img { animation: none; } }
      `}</style>

      <div
        className="qv-panel relative"
        style={{
          backgroundColor: 'var(--color-background, #fff)',
          color: 'var(--color-foreground, #111)',
        }}
      >
        {/* Floating close button — overlays the gallery for an edge-to-edge look */}
        <button
          onClick={onClose}
          aria-label={t('discovery:quickview.close_aria')}
          className="absolute top-3 end-3 z-20 h-9 w-9 rounded-[var(--radius-pill,9999px)] backdrop-blur shadow-[var(--shadow-md)] ring-1 ring-black/[0.06] flex items-center justify-center transition-[transform,box-shadow] duration-[var(--duration-fast,150ms)] motion-safe:hover:scale-105 motion-safe:active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary,#2563eb)]"
          style={floatingBtn}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="grid md:grid-cols-2">
          {/* Gallery column */}
          <div
            className="relative flex flex-col"
            style={{ backgroundColor: 'color-mix(in srgb, var(--color-foreground, #111) 4%, var(--color-background, #fff))' }}
          >
            {/* Sale badge */}
            {savingsPct !== null && (
              <div
                className="absolute top-4 start-4 z-10 text-white text-[10px] font-bold uppercase tracking-[0.08em] px-2.5 py-[5px] rounded-[var(--radius-pill,9999px)] shadow-[var(--shadow-sm)] ring-1 ring-white/20"
                style={{ backgroundColor: 'var(--color-error, #e11d48)' }}
              >
                {t('discovery:quickview.save_percent', { percent: savingsPct })}
              </div>
            )}

            {/* Main image — swipeable on touch */}
            <div
              className="relative aspect-square overflow-hidden"
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
              onTouchEnd={onTouchEnd}
            >
              <img
                key={selectedImage}
                src={images[selectedImage]}
                alt={product.name}
                className="qv-img w-full h-full object-cover"
              />

              {/* Dot pagination — the touch affordance (thumbnails cover desktop) */}
              {images.length > 1 && (
                <div
                  className="md:hidden absolute bottom-3 start-1/2 ltr:-translate-x-1/2 rtl:translate-x-1/2 flex gap-1.5 backdrop-blur rounded-[var(--radius-pill,9999px)] px-2.5 py-1.5 shadow-[var(--shadow-sm)]"
                  style={{ backgroundColor: 'color-mix(in srgb, var(--color-background, #fff) 80%, transparent)' }}
                >
                  {images.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setSelectedImage(i)}
                      aria-label={t('discovery:quickview.image_dot_aria', { index: i + 1 })}
                      className={cn('h-1.5 rounded-full transition-all duration-[var(--duration-base,250ms)]', i === selectedImage ? 'w-5' : 'w-1.5')}
                      style={{
                        backgroundColor:
                          i === selectedImage
                            ? 'var(--color-foreground, #111)'
                            : 'color-mix(in srgb, var(--color-foreground, #111) 30%, transparent)',
                      }}
                    />
                  ))}
                </div>
              )}

              {/* Arrow nav (desktop) */}
              {images.length > 1 && (
                <>
                  <button
                    onClick={prevImage}
                    aria-label={t('product:image.thumbnail_aria', { index: selectedImage })}
                    className="hidden md:flex absolute start-3 top-1/2 -translate-y-1/2 h-9 w-9 rounded-[var(--radius-pill,9999px)] backdrop-blur shadow-[var(--shadow-md)] ring-1 ring-black/[0.06] items-center justify-center transition-transform duration-[var(--duration-fast,150ms)] motion-safe:hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary,#2563eb)]"
                    style={floatingBtn}
                  >
                    <svg className="w-4 h-4 rtl:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <button
                    onClick={nextImage}
                    aria-label={t('product:image.thumbnail_aria', { index: selectedImage + 2 })}
                    className="hidden md:flex absolute end-3 top-1/2 -translate-y-1/2 h-9 w-9 rounded-[var(--radius-pill,9999px)] backdrop-blur shadow-[var(--shadow-md)] ring-1 ring-black/[0.06] items-center justify-center transition-transform duration-[var(--duration-fast,150ms)] motion-safe:hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary,#2563eb)]"
                    style={floatingBtn}
                  >
                    <svg className="w-4 h-4 rtl:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </>
              )}
            </div>

            {/* Thumbnail rail (desktop) */}
            {images.length > 1 && (
              <div className="hidden md:flex gap-2 p-3 overflow-x-auto">
                {images.map((src, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedImage(i)}
                    aria-label={t('discovery:quickview.image_dot_aria', { index: i + 1 })}
                    aria-current={i === selectedImage || undefined}
                    className={cn(
                      'relative h-14 w-14 shrink-0 overflow-hidden rounded-[var(--radius-sm,6px)] transition-[opacity,box-shadow] duration-[var(--duration-fast,150ms)]',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary,#2563eb)]',
                      i === selectedImage
                        ? 'ring-2 ring-[var(--color-primary,#2563eb)] ring-offset-1'
                        : 'opacity-60 hover:opacity-100 ring-1 ring-black/[0.06]'
                    )}
                  >
                    <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Info column */}
          <div className="flex flex-col p-6 md:p-8 max-h-[90vh] md:max-h-[80vh] overflow-y-auto">
            <h2
              className="text-2xl md:text-3xl font-bold mb-2 leading-tight"
              style={{ fontFamily: 'var(--font-family-heading, inherit)', color: 'var(--color-foreground, #111)' }}
            >
              {product.name}
            </h2>

            {/* Rating */}
            {product.rating !== undefined && product.rating > 0 && (
              <div className="mb-4">
                <RatingStars rating={product.rating} reviewCount={product.reviewCount} />
              </div>
            )}

            {/* Price */}
            <div className="flex items-baseline gap-3 mb-1">
              <PriceDisplay
                price={effectivePrice}
                compareAtPrice={effectiveCompareAt}
                size="lg"
              />
              {savingsPct !== null && (
                <span
                  className="text-xs font-semibold px-2 py-0.5 rounded-[var(--radius-pill,9999px)]"
                  style={{
                    color: 'var(--color-error, #dc2626)',
                    backgroundColor: 'color-mix(in srgb, var(--color-error, #dc2626) 10%, transparent)',
                  }}
                >
                  {t('discovery:quickview.save_percent', { percent: savingsPct })}
                </span>
              )}
            </div>
            <div className="text-xs text-[var(--color-muted,#6b7280)] mb-5">{t('discovery:quickview.tax_shipping')}</div>

            {/* Short description */}
            {product.shortDescription && (
              <p className="text-sm text-[var(--color-muted,#6b7280)] mb-5 leading-relaxed line-clamp-4">
                {product.shortDescription}
              </p>
            )}

            {/* Variants */}
            {product.variants && product.variants.length > 1 && (
              <div className="mb-5">
                <div className={cn(sectionLabelCls, 'mb-2')}>
                  {t('discovery:quickview.variant_label')}:{' '}
                  <span className="font-normal normal-case tracking-normal">{variantLabel(selectedVariant)}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {product.variants.map((v) => {
                    const selected = selectedVariantId === v._id;
                    return (
                      <button
                        key={v._id}
                        onClick={() => setSelectedVariantId(v._id)}
                        disabled={v.stock === 0}
                        aria-pressed={selected}
                        className={cn(
                          'px-3.5 py-2 rounded-[var(--radius-sm,8px)] border text-sm font-medium min-h-[40px]',
                          'transition-[border-color,background-color,box-shadow] duration-[var(--duration-fast,150ms)]',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary,#2563eb)]',
                          v.stock === 0 && 'opacity-40 cursor-not-allowed line-through'
                        )}
                        style={
                          selected
                            ? {
                                borderColor: 'var(--color-primary, #2563eb)',
                                backgroundColor: 'color-mix(in srgb, var(--color-primary, #2563eb) 8%, transparent)',
                                color: 'var(--color-foreground, #111)',
                                boxShadow: 'inset 0 0 0 1px var(--color-primary, #2563eb)',
                              }
                            : {
                                borderColor: 'var(--color-border, #e5e7eb)',
                                color: 'var(--color-muted, #6b7280)',
                              }
                        }
                      >
                        {variantLabel(v)}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Stock indicator */}
            <div className="mb-5">
              {!inStock ? (
                <div className="inline-flex items-center gap-1.5 text-sm font-medium" style={{ color: 'var(--color-error, #e11d48)' }}>
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: 'var(--color-error, #e11d48)' }} />
                  {t('discovery:quickview.out_of_stock')}
                </div>
              ) : lowStock ? (
                <div className="inline-flex items-center gap-1.5 text-sm font-medium" style={{ color: 'var(--color-accent, #d97706)' }}>
                  <span className="h-2 w-2 rounded-full motion-safe:animate-pulse" style={{ backgroundColor: 'var(--color-accent, #f59e0b)' }} />
                  {t('discovery:quickview.low_stock', { count: effectiveStock })}
                </div>
              ) : (
                <div className="inline-flex items-center gap-1.5 text-sm font-medium" style={{ color: 'var(--color-success, #059669)' }}>
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: 'var(--color-success, #10b981)' }} />
                  {t('discovery:quickview.in_stock')}
                </div>
              )}
            </div>

            {/* Quantity */}
            <div className="flex items-center gap-3 mb-5">
              <span className={sectionLabelCls}>
                {t('discovery:quickview.quantity_label')}
              </span>
              <QuantitySelector
                value={quantity}
                onChange={setQuantity}
                max={effectiveStock}
              />
            </div>

            {/* Actions */}
            <div className="flex gap-2 mt-auto">
              <button
                onClick={handleAddToCart}
                disabled={adding || !inStock || justAdded}
                className={cn(
                  'flex-1 h-12 rounded-[var(--radius,12px)] font-semibold text-white',
                  'shadow-[var(--shadow-sm)] transition-[filter,transform,box-shadow,background-color] duration-[var(--duration-fast,150ms)]',
                  'hover:brightness-110 hover:shadow-[var(--shadow-md)] motion-safe:active:scale-[0.98]',
                  'disabled:opacity-60 disabled:cursor-not-allowed',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary,#2563eb)] focus-visible:ring-offset-2'
                )}
                style={{
                  backgroundColor: justAdded
                    ? 'var(--color-success, #059669)'
                    : 'var(--color-primary, #111827)',
                }}
              >
                {!inStock ? (
                  t('discovery:quickview.out_of_stock')
                ) : justAdded ? (
                  <span className="inline-flex items-center justify-center gap-2">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    {t('discovery:quickview.added')}
                  </span>
                ) : adding ? (
                  <span className="inline-flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                      <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                    </svg>
                    {t('discovery:quickview.adding')}
                  </span>
                ) : (
                  t('discovery:quickview.add_to_cart')
                )}
              </button>

              <WishlistButton
                productId={product._id}
                className="h-12 w-12 rounded-[var(--radius,12px)] border border-[var(--color-border,#e5e7eb)] hover:border-[var(--color-primary,#2563eb)] transition-colors duration-[var(--duration-fast,150ms)] flex items-center justify-center"
              />
            </div>

            {/* View full details */}
            <Link
              to={`/products/${product.slug}`}
              onClick={onClose}
              className="mt-3 text-center text-sm font-medium text-[var(--color-muted,#6b7280)] hover:text-[var(--color-foreground,#111)] underline underline-offset-4 transition-colors duration-[var(--duration-fast,150ms)]"
            >
              {t('discovery:quickview.view_full_details')}
            </Link>
          </div>
        </div>
      </div>
    </Modal>
  );
}
