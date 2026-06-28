/**
 * Techhub-styled override for the shared ProductDetailExtras.
 *
 * Registered via `ThemeSlotsProvider` under the `productDetailExtras` slot.
 * Renders 4 tabs (Description · Specifications · Delivery & Shipping ·
 * Customer Reviews) in the techhub visual language (CSS-var driven,
 * uppercase 11px labels, primary-colored underline indicator), followed
 * by a Frequently Bought Together block and a Similar Products grid
 * that reuses the registered theme card when available.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '@shared/contexts/StoreContext';
import { useCart } from '@shared/contexts/CartContext';
import { reviewsApi } from '@shared/api/client';
import { useThemeCard } from '@shared/theme/ThemeCardProvider';
import { useTranslation } from 'react-i18next';

interface Spec { key: string; value: string }

interface Review {
  _id: string;
  rating: number;
  title?: string;
  comment?: string;
  isVerifiedPurchase?: boolean;
  isVerified?: boolean;
  createdAt?: string;
  user?: { _id?: string; firstName?: string; lastName?: string; name?: string };
}

interface Card {
  _id: string;
  name: string;
  slug: string;
  price: number;
  compareAtPrice?: number;
  images?: string[];
  rating?: number;
  reviewCount?: number;
  stock?: number;
  hasVariants?: boolean;
  options?: unknown[];
  variants?: unknown[];
}

interface ProductDetailExtrasProps {
  product: {
    _id: string;
    name: string;
    description?: string;
    shortDescription?: string;
    specifications?: Spec[];
    sku?: string;
    weight?: number;
    weightUnit?: string;
    tags?: string[];
    rating?: number;
    reviewCount?: number;
  };
  reviews: Review[];
  ratingDistribution?: { 1: number; 2: number; 3: number; 4: number; 5: number };
  frequentlyBoughtWith: Card[];
  relatedProducts: Card[];
  accentColor?: string;
  className?: string;
}

type TabKey = 'description' | 'specifications' | 'delivery' | 'reviews';

function requiresOptions(product: Card) {
  return Boolean(product.hasVariants || product.variants?.length || product.options?.length);
}

const Stars: React.FC<{ rating: number; size?: 'sm' | 'md' }> = ({ rating, size = 'sm' }) => {
  const full = Math.round(rating);
  const cls = size === 'md' ? 'text-base' : 'text-sm';
  return (
    <span className={`${cls} tracking-tight`} aria-label={`${rating} out of 5`} style={{ color: 'var(--color-accent)' }}>
      {'★'.repeat(full)}
      <span style={{ color: 'var(--color-border)' }}>{'★'.repeat(5 - full)}</span>
    </span>
  );
};

const reviewerName = (r: Review, anonymous: string) => {
  const u = r.user;
  if (!u) return anonymous;
  if (u.firstName || u.lastName) return `${u.firstName || ''} ${u.lastName || ''}`.trim();
  return u.name || anonymous;
};

const TechhubProductDetailExtras: React.FC<ProductDetailExtrasProps> = ({
  product,
  reviews,
  ratingDistribution,
  frequentlyBoughtWith,
  relatedProducts,
  className = '',
}) => {
  const { t } = useTranslation(['theme']);
  const { formatPrice } = useStore();
  const { addItem } = useCart();
  const themeCard = useThemeCard();
  const accent = 'var(--color-primary)';

  const specs: Spec[] = useMemo(() => {
    if (product.specifications && product.specifications.length > 0) return product.specifications;
    const fallback: Spec[] = [];
    if (product.sku) fallback.push({ key: t('theme.product_detail_extras.spec_sku', { defaultValue: 'SKU' }), value: product.sku });
    if (product.weight) fallback.push({ key: t('theme.product_detail_extras.spec_weight', { defaultValue: 'Weight' }), value: `${product.weight} ${product.weightUnit || 'kg'}` });
    if (product.tags && product.tags.length > 0) fallback.push({ key: t('theme.product_detail_extras.spec_tags', { defaultValue: 'Tags' }), value: product.tags.join(', ') });
    return fallback;
  }, [product]);

  // Reviews state (ported from shared).
  const [isSignedIn, setIsSignedIn] = useState<boolean>(
    typeof window !== 'undefined' && !!localStorage.getItem('customer_token')
  );
  useEffect(() => {
    const onStorage = () => setIsSignedIn(!!localStorage.getItem('customer_token'));
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const [localReviews, setLocalReviews] = useState<Review[]>(reviews);
  useEffect(() => { setLocalReviews(reviews); }, [reviews]);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewHover, setReviewHover] = useState(0);
  const [reviewTitle, setReviewTitle] = useState('');
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  const totalReviews = localReviews.length;
  const distribution = ratingDistribution || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const maxBucket = Math.max(1, ...Object.values(distribution));

  // Build tab list — hide specs tab when no specs exist.
  const tabs: Array<{ id: TabKey; label: string }> = [
    { id: 'description', label: t('theme.product_detail_extras.tab_description') },
    ...(specs.length > 0 ? [{ id: 'specifications' as TabKey, label: t('theme.product_detail_extras.tab_specifications') }] : []),
    { id: 'delivery', label: t('theme.product_detail_extras.tab_delivery') },
    { id: 'reviews', label: t('theme.product_detail_extras.tab_reviews') },
  ];
  const [tab, setTab] = useState<TabKey>('description');

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    setReviewError(null);
    if (reviewComment.trim().length < 5) {
      setReviewError(t('theme.product_detail_extras.review_min_length', { defaultValue: 'Please write at least a few words about the product.' }));
      return;
    }
    try {
      setSubmittingReview(true);
      const res: any = await reviewsApi.create({
        productId: product._id,
        rating: reviewRating,
        title: reviewTitle.trim() || undefined,
        comment: reviewComment.trim(),
      });
      const created: Review | undefined = res?.data?.review || res?.responseObject?.review || res?.review;
      if (created) setLocalReviews((prev) => [created, ...prev]);
      setShowReviewForm(false);
      setReviewTitle('');
      setReviewComment('');
      setReviewRating(5);
    } catch (err: any) {
      setReviewError(err?.message || t('theme.product_detail_extras.review_submit_failed', { defaultValue: 'Failed to submit review' }));
    } finally {
      setSubmittingReview(false);
    }
  };

  // ── Bundle selection — only non-variant items are pre-selected ────
  const addableExtras = useMemo(
    () => frequentlyBoughtWith.filter((p) => !requiresOptions(p)),
    [frequentlyBoughtWith]
  );
  const [bundleSelection, setBundleSelection] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    addableExtras.forEach((p) => { initial[p._id] = true; });
    return initial;
  });
  const [addingBundle, setAddingBundle] = useState(false);

  const selectedAddable = useMemo(
    () => addableExtras.filter((p) => bundleSelection[p._id]),
    [addableExtras, bundleSelection]
  );
  const bundleTotal = useMemo(
    () => selectedAddable.reduce((sum, p) => sum + p.price, 0),
    [selectedAddable]
  );

  const handleBundleAdd = async () => {
    if (selectedAddable.length === 0) return;
    setAddingBundle(true);
    try {
      for (const p of selectedAddable) {
        await addItem(p._id, 1);
      }
    } finally {
      setAddingBundle(false);
    }
  };

  return (
    <div className={`mt-16 ${className}`}>
      {/* ─── Tabs ─────────────────────────────────────────────── */}
      <div
        className="flex items-center gap-8 border-b overflow-x-auto"
        style={{ borderColor: 'var(--color-border)' }}
      >
        {tabs.map((t) => {
          const isActive = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              data-reviews-anchor={t.id === 'reviews' ? true : undefined}
              className="pb-3 text-xs font-bold uppercase tracking-wider whitespace-nowrap transition relative"
              style={{ color: isActive ? 'var(--color-foreground)' : 'var(--color-muted)' }}
            >
              {t.label}
              {isActive && (
                <span
                  className="absolute start-0 end-0 -bottom-px h-0.5"
                  style={{ backgroundColor: 'var(--color-primary)' }}
                />
              )}
            </button>
          );
        })}
      </div>

      <div className="py-8 text-sm leading-relaxed" style={{ color: 'var(--color-muted)' }}>
        {tab === 'description' && (
          <div className="max-w-3xl whitespace-pre-line">
            {product.shortDescription && (
              <p className="text-base font-semibold mb-4" style={{ color: 'var(--color-foreground)' }}>
                {product.shortDescription}
              </p>
            )}
            {product.description || t('theme.product_detail_extras.no_description')}
            {product.tags && product.tags.length > 0 && (
              <div className="flex gap-2 flex-wrap mt-6">
                {product.tags.map((tag: string) => (
                  <span
                    key={tag}
                    className="px-2.5 py-1 rounded-full text-[11px] border"
                    style={{ borderColor: 'var(--color-border)', color: 'var(--color-foreground)' }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'specifications' && (
          <div className="max-w-3xl">
            <dl className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
              {specs.map((spec, i) => (
                <div
                  key={i}
                  className="grid grid-cols-3 gap-4 py-3 text-sm border-b last:border-0"
                  style={{ borderColor: 'var(--color-border)' }}
                >
                  <dt className="font-bold uppercase tracking-wider text-[11px]" style={{ color: 'var(--color-muted)' }}>
                    {spec.key}
                  </dt>
                  <dd className="col-span-2" style={{ color: 'var(--color-foreground)' }}>{spec.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        {tab === 'delivery' && (
          <div className="max-w-3xl space-y-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--color-foreground)' }}>
                {t('theme.product_detail_extras.delivery_policy_heading')}
              </p>
              <p className="mb-1">{t('theme.product_detail_extras.delivery_policy_line1')}</p>
              <p className="mb-1">{t('theme.product_detail_extras.delivery_policy_line2')}</p>
              <p>{t('theme.product_detail_extras.delivery_policy_line3')}</p>
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--color-foreground)' }}>
                {t('theme.product_detail_extras.shipping_return_heading')}
              </p>
              <p className="mb-1">{t('theme.product_detail_extras.shipping_return_line1')}</p>
              <p className="mb-1">{t('theme.product_detail_extras.shipping_return_line2')}</p>
              <p>{t('theme.product_detail_extras.shipping_return_line3')}</p>
            </div>
          </div>
        )}

        {tab === 'reviews' && (
          <div data-reviews-anchor>
            {/* Rating summary */}
            <div
              className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 pb-8 border-b"
              style={{ borderColor: 'var(--color-border)' }}
            >
              <div className="text-center md:text-start">
                <div className="text-5xl font-black leading-none mb-2" style={{ color: 'var(--color-foreground)' }}>
                  {(product.rating || 0).toFixed(1)}
                </div>
                <Stars rating={product.rating || 0} size="md" />
                <p className="text-[11px] uppercase tracking-wider mt-2" style={{ color: 'var(--color-muted)' }}>
                  {totalReviews === 1 ? t('theme.product_detail_extras.based_on_reviews', { count: totalReviews }) : t('theme.product_detail_extras.based_on_reviews_plural', { count: totalReviews })}
                </p>
              </div>

              <div className="md:col-span-2 space-y-1.5">
                {[5, 4, 3, 2, 1].map((star) => {
                  const count = distribution[star as 1 | 2 | 3 | 4 | 5] || 0;
                  const pct = totalReviews > 0 ? (count / maxBucket) * 100 : 0;
                  return (
                    <div key={star} className="flex items-center gap-3 text-xs">
                      <span className="w-6" style={{ color: 'var(--color-muted)' }}>{star}★</span>
                      <div
                        className="flex-1 h-2 rounded-full overflow-hidden"
                        style={{ backgroundColor: 'color-mix(in srgb, var(--color-foreground) 8%, transparent)' }}
                      >
                        <div
                          className="h-full transition-all"
                          style={{ width: `${pct}%`, backgroundColor: accent }}
                        />
                      </div>
                      <span className="w-8 text-end" style={{ color: 'var(--color-muted)' }}>{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Write-a-review */}
            <div className="mb-8">
              {!showReviewForm ? (
                isSignedIn ? (
                  <button
                    type="button"
                    onClick={() => { setShowReviewForm(true); setReviewError(null); }}
                    className="px-5 py-2.5 rounded-full text-xs font-bold uppercase tracking-wider text-white hover:opacity-90 transition"
                    style={{ backgroundColor: accent }}
                  >
                    {t('theme.product_detail_extras.write_review')}
                  </button>
                ) : (
                  <Link
                    to="/login"
                    className="inline-block px-5 py-2.5 rounded-full text-xs font-bold uppercase tracking-wider border hover:opacity-80 transition"
                    style={{ borderColor: accent, color: accent }}
                  >
                    {t('theme.product_detail_extras.sign_in_to_review')}
                  </Link>
                )
              ) : (
                <form
                  onSubmit={handleSubmitReview}
                  className="border rounded-xl p-5 space-y-4"
                  style={{
                    borderColor: 'var(--color-border)',
                    backgroundColor: 'color-mix(in srgb, var(--color-foreground) 3%, transparent)',
                  }}
                >
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--color-foreground)' }}>
                      {t('theme.product_detail_extras.your_rating')}
                    </p>
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((n) => {
                        const filled = (reviewHover || reviewRating) >= n;
                        return (
                          <button
                            key={n}
                            type="button"
                            onClick={() => setReviewRating(n)}
                            onMouseEnter={() => setReviewHover(n)}
                            onMouseLeave={() => setReviewHover(0)}
                            className="text-3xl leading-none transition"
                            style={{ color: filled ? 'var(--color-accent)' : 'var(--color-border)' }}
                            aria-label={`${n} star${n === 1 ? '' : 's'}`}
                          >
                            ★
                          </button>
                        );
                      })}
                      <span className="ms-2 text-xs" style={{ color: 'var(--color-muted)' }}>{reviewRating}/5</span>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="review-title" className="block text-[11px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--color-foreground)' }}>
                      {t('theme.product_detail_extras.title_optional')}
                    </label>
                    <input
                      id="review-title"
                      type="text"
                      value={reviewTitle}
                      onChange={(e) => setReviewTitle(e.target.value)}
                      maxLength={200}
                      placeholder={t('theme.product_detail_extras.title_placeholder')}
                      className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none"
                      style={{ borderColor: 'var(--color-border)', color: 'var(--color-foreground)' }}
                    />
                  </div>

                  <div>
                    <label htmlFor="review-comment" className="block text-[11px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--color-foreground)' }}>
                      {t('theme.product_detail_extras.your_review')}
                    </label>
                    <textarea
                      id="review-comment"
                      value={reviewComment}
                      onChange={(e) => setReviewComment(e.target.value)}
                      rows={4}
                      maxLength={5000}
                      placeholder={t('theme.product_detail_extras.review_placeholder')}
                      className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none resize-y"
                      style={{ borderColor: 'var(--color-border)', color: 'var(--color-foreground)' }}
                      required
                    />
                  </div>

                  {reviewError && (
                    <p className="text-sm" role="alert" style={{ color: 'var(--color-error, #dc2626)' }}>{reviewError}</p>
                  )}

                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={submittingReview}
                      className="px-5 py-2.5 rounded-full text-xs font-bold uppercase tracking-wider text-white hover:opacity-90 transition disabled:opacity-50"
                      style={{ backgroundColor: accent }}
                    >
                      {submittingReview ? t('theme.product_detail_extras.submitting') : t('theme.product_detail_extras.submit_review')}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowReviewForm(false); setReviewError(null); }}
                      className="px-5 py-2.5 rounded-full text-xs font-bold uppercase tracking-wider border hover:opacity-80 transition"
                      style={{ borderColor: 'var(--color-border)', color: 'var(--color-foreground)' }}
                    >
                      {t('theme.product_detail_extras.cancel')}
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* Review list */}
            {totalReviews === 0 ? (
              <div className="text-center py-12 text-sm" style={{ color: 'var(--color-muted)' }}>
                {t('theme.product_detail_extras.no_reviews')}
              </div>
            ) : (
              <div className="space-y-5">
                {localReviews.map((r) => (
                  <article
                    key={r._id}
                    className="border rounded-xl p-5"
                    style={{ borderColor: 'var(--color-border)' }}
                  >
                    <header className="flex items-start justify-between gap-4 mb-2">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold"
                          style={{ backgroundColor: accent }}
                        >
                          {reviewerName(r, t('theme.product_detail_extras.anonymous')).charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-bold leading-tight" style={{ color: 'var(--color-foreground)' }}>
                            {reviewerName(r, t('theme.product_detail_extras.anonymous'))}
                            {(r.isVerifiedPurchase || r.isVerified) && (
                              <span
                                className="ms-2 text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider"
                                style={{
                                  color: 'var(--color-primary)',
                                  backgroundColor: 'color-mix(in srgb, var(--color-primary) 12%, transparent)',
                                }}
                              >
                                {t('theme.product_detail_extras.verified')}
                              </span>
                            )}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Stars rating={r.rating} />
                            {r.createdAt && (
                              <span className="text-[11px]" style={{ color: 'var(--color-muted)' }}>
                                {new Date(r.createdAt).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </header>
                    {r.title && <p className="font-bold text-sm mb-1" style={{ color: 'var(--color-foreground)' }}>{r.title}</p>}
                    {r.comment && <p className="text-sm leading-relaxed" style={{ color: 'var(--color-muted)' }}>{r.comment}</p>}
                  </article>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── Frequently Bought Together ──────────────────────── */}
      {frequentlyBoughtWith.length > 0 && (
        <section className="mt-12">
          <h2 className="text-xl sm:text-2xl font-black mb-1" style={{ color: 'var(--color-foreground)' }}>
            {t('theme.product_detail_extras.frequently_bought_heading')}
          </h2>
          <p className="text-xs uppercase tracking-wider mb-6" style={{ color: 'var(--color-muted)' }}>
            {t('theme.product_detail_extras.frequently_bought_subtitle')}
          </p>

          <div
            className="border rounded-2xl p-6 grid grid-cols-1 lg:grid-cols-3 gap-6 items-start"
            style={{ borderColor: 'var(--color-border)' }}
          >
            <div className="lg:col-span-2 flex items-center gap-3 overflow-x-auto pb-2">
              {[{ _id: product._id, name: product.name, slug: '', price: 0, images: [] } as Card, ...frequentlyBoughtWith].map((item, i) => {
                const isCurrent = i === 0;
                const needsOptions = !isCurrent && requiresOptions(item);
                return (
                  <React.Fragment key={item._id}>
                    {i > 0 && (
                      <div className="text-2xl select-none flex-shrink-0" style={{ color: 'var(--color-border)' }}>+</div>
                    )}
                    <div className="flex-shrink-0 w-36 text-center">
                      <div
                        className="aspect-square rounded-xl overflow-hidden border mb-2 relative"
                        style={{
                          borderColor: 'var(--color-border)',
                          backgroundColor: 'color-mix(in srgb, var(--color-foreground) 3%, transparent)',
                        }}
                      >
                        <img
                          src={item.images?.[0] || 'https://placehold.co/200x200?text=No+Image'}
                          alt={item.name}
                          className="w-full h-full object-contain p-2"
                        />
                        {!isCurrent && !needsOptions && (
                          <input
                            type="checkbox"
                            checked={!!bundleSelection[item._id]}
                            onChange={(e) =>
                              setBundleSelection({ ...bundleSelection, [item._id]: e.target.checked })
                            }
                            className="absolute top-2 start-2 w-4 h-4"
                            style={{ accentColor: 'var(--color-primary)' }}
                          />
                        )}
                      </div>
                      <p className="text-xs font-bold truncate" style={{ color: 'var(--color-foreground)' }}>{item.name}</p>
                      {isCurrent ? (
                        <p className="text-[11px] uppercase tracking-wider italic mt-0.5" style={{ color: 'var(--color-muted)' }}>
                          {t('theme.product_detail_extras.this_item')}
                        </p>
                      ) : needsOptions ? (
                        <Link
                          to={`/products/${item.slug}`}
                          className="text-[11px] font-bold uppercase tracking-wider mt-0.5 inline-block hover:opacity-70"
                          style={{ color: 'var(--color-primary)' }}
                        >
                          {t('theme.product_detail_extras.choose_options_link')}
                        </Link>
                      ) : (
                        <p className="text-xs mt-0.5" style={{ color: 'var(--color-muted)' }}>{formatPrice(item.price)}</p>
                      )}
                    </div>
                  </React.Fragment>
                );
              })}
            </div>

            <div className="lg:col-span-1 lg:border-s lg:ps-6" style={{ borderColor: 'var(--color-border)' }}>
              <p className="text-[11px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--color-muted)' }}>
                {t('theme.product_detail_extras.addon_total_label')}
              </p>
              <p className="text-2xl font-black mb-3" style={{ color: 'var(--color-foreground)' }}>
                {formatPrice(bundleTotal)}
              </p>
              <p className="text-[11px] uppercase tracking-wider mb-4" style={{ color: 'var(--color-muted)' }}>
                {t('theme.product_detail_extras.extras_selected', { selected: selectedAddable.length, total: addableExtras.length })}
              </p>
              <button
                onClick={handleBundleAdd}
                disabled={addingBundle || selectedAddable.length === 0}
                className="w-full py-3 rounded-full text-xs font-bold uppercase tracking-wider text-white hover:opacity-90 transition disabled:opacity-50"
                style={{ backgroundColor: 'var(--color-primary)' }}
              >
                {addingBundle ? t('theme.product_detail_extras.adding_bundle') : t('theme.product_detail_extras.add_selected_to_cart')}
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ─── Similar products ────────────────────────────────── */}
      {relatedProducts.length > 0 && (
        <section className="mt-12">
          <h2 className="text-xl sm:text-2xl font-black mb-1" style={{ color: 'var(--color-foreground)' }}>
            {t('theme.product_detail_extras.similar_products_heading')}
          </h2>
          <p className="text-xs uppercase tracking-wider mb-6" style={{ color: 'var(--color-muted)' }}>
            {t('theme.product_detail_extras.similar_products_subtitle')}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {relatedProducts.slice(0, 8).map((p) => {
              if (themeCard) {
                return <React.Fragment key={p._id}>{themeCard(p)}</React.Fragment>;
              }
              return (
                <Link
                  key={p._id}
                  to={`/products/${p.slug}`}
                  className="group border rounded-xl overflow-hidden hover:shadow-lg transition"
                  style={{ borderColor: 'var(--color-border)' }}
                >
                  <div
                    className="aspect-[4/5] overflow-hidden"
                    style={{ backgroundColor: 'color-mix(in srgb, var(--color-foreground) 3%, transparent)' }}
                  >
                    <img
                      src={p.images?.[0] || 'https://placehold.co/400x500?text=No+Image'}
                      alt={p.name}
                      loading="lazy"
                      className="w-full h-full object-contain p-3 group-hover:scale-105 transition-transform duration-500"
                    />
                  </div>
                  <div className="p-3">
                    <h3 className="text-sm font-bold truncate" style={{ color: 'var(--color-foreground)' }}>{p.name}</h3>
                    <div className="flex items-center justify-between mt-1.5">
                      <span className="font-black text-sm" style={{ color: 'var(--color-primary)' }}>{formatPrice(p.price)}</span>
                      {p.rating !== undefined && p.rating > 0 && (
                        <span className="text-xs flex items-center gap-1" style={{ color: 'var(--color-muted)' }}>
                          <span style={{ color: 'var(--color-accent)' }}>★</span>
                          {p.rating.toFixed(1)}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
};

export default TechhubProductDetailExtras;
