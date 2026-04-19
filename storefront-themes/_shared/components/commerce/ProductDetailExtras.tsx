import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../contexts/StoreContext';
import { useCart } from '../../contexts/CartContext';
import { reviewsApi } from '../../api/client';
import { useThemeSlot } from '../../theme/ThemeSlotsProvider';

export const SLOT_KEY = 'productDetailExtras';

/**
 * Rich extras shown below the product hero on the PDP.
 * Includes: tabbed Description / Specifications / Reviews,
 * "Frequently bought together" bundle, and "Similar products" grid.
 *
 * Themes drop this in below their main product info section. The visual
 * style is intentionally neutral so it picks up theme colors via CSS vars
 * and inherits the surrounding font family.
 */

interface Spec {
  key: string;
  value: string;
}

interface Review {
  _id: string;
  rating: number;
  title?: string;
  comment?: string;
  // Backend canonical field. The legacy `isVerified` is kept for forward
  // compatibility with any older payloads still floating around.
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

type Tab = 'description' | 'specifications' | 'reviews';

function requiresOptions(product: Card) {
  return Boolean(product.hasVariants || product.variants?.length || product.options?.length);
}

const Stars: React.FC<{ rating: number; size?: 'sm' | 'md' }> = ({ rating, size = 'sm' }) => {
  const full = Math.round(rating);
  const cls = size === 'md' ? 'text-base' : 'text-sm';
  return (
    <span className={`${cls} text-yellow-400 tracking-tight`} aria-label={`${rating} out of 5`}>
      {'★'.repeat(full)}
      <span className="text-gray-300">{'★'.repeat(5 - full)}</span>
    </span>
  );
};

const reviewerName = (r: Review) => {
  const u = r.user;
  if (!u) return 'Anonymous';
  if (u.firstName || u.lastName) return `${u.firstName || ''} ${u.lastName || ''}`.trim();
  return u.name || 'Anonymous';
};

const ProductDetailExtras: React.FC<ProductDetailExtrasProps> = (props) => {
  const Override = useThemeSlot<React.ComponentType<ProductDetailExtrasProps>>(SLOT_KEY);
  if (Override) return <Override {...props} />;
  const {
    product,
    reviews,
    ratingDistribution,
    frequentlyBoughtWith,
    relatedProducts,
    accentColor,
    className = '',
  } = props;
  const { t } = useTranslation(['product', 'common']);
  const { formatPrice } = useStore();
  const { addItem } = useCart();
  const [tab, setTab] = useState<Tab>('description');
  const [bundleSelection, setBundleSelection] = useState<Record<string, boolean>>(() => {
    // Only pre-select non-variant extras — variant items need option choices
    // made on their own PDP and can't be added from here.
    const initial: Record<string, boolean> = { [product._id]: true };
    frequentlyBoughtWith.forEach((p) => {
      if (!requiresOptions(p)) initial[p._id] = true;
    });
    return initial;
  });
  const addableExtras = useMemo(
    () => frequentlyBoughtWith.filter((p) => !requiresOptions(p)),
    [frequentlyBoughtWith]
  );
  const selectedAddableCount = useMemo(
    () => addableExtras.filter((p) => bundleSelection[p._id]).length,
    [addableExtras, bundleSelection]
  );
  const [addingBundle, setAddingBundle] = useState(false);

  // ── Review submission state ───────────────────────────────────
  // We track signed-in status by polling the customer_token in localStorage
  // (the storefront's auth source-of-truth). The reviews list itself is
  // mirrored to local state so a freshly-submitted review appears instantly
  // without waiting for a parent refetch.
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
  const alreadyReviewed = false; // Server enforces uniqueness; we surface 409s as inline errors.

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    setReviewError(null);
    if (reviewComment.trim().length < 5) {
      setReviewError('Please write at least a few words about the product.');
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
      const created: Review | undefined =
        res?.data?.review || res?.responseObject?.review || res?.review;
      if (created) {
        setLocalReviews((prev) => [created, ...prev]);
      }
      setShowReviewForm(false);
      setReviewTitle('');
      setReviewComment('');
      setReviewRating(5);
    } catch (err: any) {
      setReviewError(err?.message || 'Failed to submit review');
    } finally {
      setSubmittingReview(false);
    }
  };

  const accent = accentColor || 'var(--color-primary, #2563eb)';

  // Specs fallback — surface SKU/weight/tags as pseudo-specs if no explicit specs
  const specs: Spec[] = useMemo(() => {
    if (product.specifications && product.specifications.length > 0) return product.specifications;
    const fallback: Spec[] = [];
    if (product.sku) fallback.push({ key: 'SKU', value: product.sku });
    if (product.weight) fallback.push({ key: 'Weight', value: `${product.weight} ${product.weightUnit || 'kg'}` });
    if (product.tags && product.tags.length > 0) fallback.push({ key: 'Tags', value: product.tags.join(', ') });
    return fallback;
  }, [product]);

  const totalReviews = localReviews.length;
  const distribution = ratingDistribution || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const maxBucket = Math.max(1, ...Object.values(distribution));

  // Bundle pricing
  const bundleItems = useMemo(() => {
    const productCard: Card = {
      _id: product._id,
      name: product.name,
      slug: '',
      price: 0, // filled below
      images: [],
    };
    return [productCard, ...frequentlyBoughtWith];
  }, [product, frequentlyBoughtWith]);

  const bundleTotal = useMemo(() => {
    // We don't know the parent product's price here from props (it's a prop on the parent),
    // so the bundle UI uses only the FBW prices for the "add bundle" total since the
    // current product is added separately by its own ATC button.
    return frequentlyBoughtWith
      .filter((p) => bundleSelection[p._id])
      .reduce((sum, p) => sum + p.price, 0);
  }, [frequentlyBoughtWith, bundleSelection]);

  const handleBundleAdd = async () => {
    setAddingBundle(true);
    try {
      const products = frequentlyBoughtWith.filter(
        (p) => bundleSelection[p._id] && !requiresOptions(p)
      );
      for (const product of products) {
        // sequential to avoid hammering the cart endpoint
        await addItem(product._id, 1);
      }
    } finally {
      setAddingBundle(false);
    }
  };

  const tabs: Array<{ id: Tab; label: string; count?: number }> = [
    { id: 'description', label: t('tab.description') },
    { id: 'specifications', label: t('tab.specifications'), count: specs.length },
    { id: 'reviews', label: t('tab.reviews'), count: totalReviews },
  ];

  return (
    <div className={`mt-12 sm:mt-16 ${className}`}>
      {/* ─── Tabbed details ──────────────────────────────────── */}
      <section className="border rounded-2xl overflow-hidden bg-white">
        <div className="border-b flex overflow-x-auto">
          {tabs.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex-shrink-0 px-6 py-4 text-sm font-semibold border-b-2 transition whitespace-nowrap ${
                  active ? '' : 'border-transparent text-gray-500 hover:text-gray-800'
                }`}
                style={active ? { borderColor: accent, color: accent } : undefined}
              >
                {t.label}
                {t.count !== undefined && t.count > 0 && (
                  <span className="ml-2 text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                    {t.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="p-6 sm:p-8">
          {tab === 'description' && (
            <div className="prose prose-sm max-w-none text-gray-700 leading-relaxed">
              {product.shortDescription && (
                <p className="text-base text-gray-900 font-medium mb-4">{product.shortDescription}</p>
              )}
              {product.description ? (
                <div className="whitespace-pre-line">{product.description}</div>
              ) : (
                <p className="text-gray-500">{t('description.no_description')}</p>
              )}
            </div>
          )}

          {tab === 'specifications' && (
            <div>
              {specs.length === 0 ? (
                <p className="text-gray-500 text-sm">{t('specifications.empty')}</p>
              ) : (
                <dl className="divide-y">
                  {specs.map((spec, i) => (
                    <div key={i} className="grid grid-cols-3 gap-4 py-3 text-sm">
                      <dt className="font-medium text-gray-500">{spec.key}</dt>
                      <dd className="col-span-2 text-gray-900">{spec.value}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          )}

          {tab === 'reviews' && (
            <div>
              {/* Rating summary */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 pb-8 border-b">
                <div className="text-center md:text-left">
                  <div className="text-5xl font-bold leading-none mb-2">
                    {(product.rating || 0).toFixed(1)}
                  </div>
                  <Stars rating={product.rating || 0} size="md" />
                  <p className="text-xs text-gray-500 mt-2">
                    {t(totalReviews === 0 ? 'review.based_on_zero' : totalReviews === 1 ? 'review.based_on_one' : 'review.based_on_other', { count: totalReviews })}
                  </p>
                </div>

                <div className="md:col-span-2 space-y-1.5">
                  {[5, 4, 3, 2, 1].map((star) => {
                    const count = distribution[star as 1 | 2 | 3 | 4 | 5] || 0;
                    const pct = totalReviews > 0 ? (count / maxBucket) * 100 : 0;
                    return (
                      <div key={star} className="flex items-center gap-3 text-xs">
                        <span className="w-6 text-gray-600">{star}★</span>
                        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full transition-all"
                            style={{ width: `${pct}%`, backgroundColor: accent }}
                          />
                        </div>
                        <span className="w-8 text-gray-500 text-right">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Write a review CTA / form ─────────────────────── */}
              <div className="mb-8">
                {!showReviewForm ? (
                  isSignedIn ? (
                    <button
                      type="button"
                      onClick={() => { setShowReviewForm(true); setReviewError(null); }}
                      className="px-5 py-2.5 rounded-lg text-white text-sm font-semibold hover:opacity-90 transition"
                      style={{ backgroundColor: accent }}
                      disabled={alreadyReviewed}
                    >
                      {t('review.write_review')}
                    </button>
                  ) : (
                    <Link
                      to="/login"
                      className="inline-block px-5 py-2.5 rounded-lg text-sm font-semibold border hover:bg-gray-50 transition"
                      style={{ borderColor: accent, color: accent }}
                    >
                      {t('review.sign_in_to_review')}
                    </Link>
                  )
                ) : (
                  <form
                    onSubmit={handleSubmitReview}
                    className="border rounded-xl p-5 space-y-4 bg-gray-50"
                  >
                    <div>
                      <p className="text-sm font-semibold mb-2">{t('review.your_rating')}</p>
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
                              className={`text-3xl leading-none transition ${
                                filled ? 'text-yellow-400' : 'text-gray-300'
                              }`}
                              aria-label={t(n === 1 ? 'review.star_aria_one' : 'review.star_aria_other', { count: n })}
                            >
                              ★
                            </button>
                          );
                        })}
                        <span className="ml-2 text-xs text-gray-500">{reviewRating}/5</span>
                      </div>
                    </div>

                    <div>
                      <label htmlFor="review-title" className="block text-sm font-semibold mb-1">
                        {t('review.title_field')} <span className="text-gray-400 font-normal">{t('review.title_optional')}</span>
                      </label>
                      <input
                        id="review-title"
                        type="text"
                        value={reviewTitle}
                        onChange={(e) => setReviewTitle(e.target.value)}
                        maxLength={200}
                        placeholder={t('review.title_placeholder')}
                        className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2"
                        style={{ borderColor: '#e5e7eb' }}
                      />
                    </div>

                    <div>
                      <label htmlFor="review-comment" className="block text-sm font-semibold mb-1">
                        {t('review.comment_field')}
                      </label>
                      <textarea
                        id="review-comment"
                        value={reviewComment}
                        onChange={(e) => setReviewComment(e.target.value)}
                        rows={4}
                        maxLength={5000}
                        placeholder={t('review.comment_placeholder')}
                        className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 resize-y"
                        style={{ borderColor: '#e5e7eb' }}
                        required
                      />
                    </div>

                    {reviewError && (
                      <p className="text-sm text-red-600" role="alert">{reviewError}</p>
                    )}

                    <div className="flex gap-2">
                      <button
                        type="submit"
                        disabled={submittingReview}
                        className="px-5 py-2.5 rounded-lg text-white text-sm font-semibold hover:opacity-90 transition disabled:opacity-50"
                        style={{ backgroundColor: accent }}
                      >
                        {submittingReview ? t('review.submitting') : t('review.submit')}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setShowReviewForm(false); setReviewError(null); }}
                        className="px-5 py-2.5 rounded-lg text-sm font-semibold border hover:bg-white transition"
                      >
                        {t('common:action.cancel')}
                      </button>
                    </div>
                  </form>
                )}
              </div>

              {/* Review list */}
              {totalReviews === 0 ? (
                <div className="text-center py-12 text-sm text-gray-500">
                  {t('review.empty')}
                </div>
              ) : (
                <div className="space-y-5">
                  {localReviews.map((r) => (
                    <article key={r._id} className="border rounded-xl p-5">
                      <header className="flex items-start justify-between gap-4 mb-2">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold"
                            style={{ backgroundColor: accent }}
                          >
                            {reviewerName(r).charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-semibold leading-tight">
                              {reviewerName(r)}
                              {(r.isVerifiedPurchase || r.isVerified) && (
                                <span className="ms-2 text-[10px] text-green-700 bg-green-50 px-1.5 py-0.5 rounded font-medium">
                                  {t('review.verified_purchase')}
                                </span>
                              )}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <Stars rating={r.rating} />
                              {r.createdAt && (
                                <span className="text-[11px] text-gray-400">
                                  {new Date(r.createdAt).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </header>
                      {r.title && <p className="font-semibold text-sm mb-1">{r.title}</p>}
                      {r.comment && <p className="text-sm text-gray-600 leading-relaxed">{r.comment}</p>}
                    </article>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* ─── Frequently bought together ──────────────────────── */}
      {frequentlyBoughtWith.length > 0 && (
        <section className="mt-12">
          <h2 className="text-xl sm:text-2xl font-bold mb-1">{t('bundle.title')}</h2>
          <p className="text-sm text-gray-500 mb-6">{t('bundle.subtitle')}</p>

          <div className="border rounded-2xl p-6 grid grid-cols-1 lg:grid-cols-3 gap-6 items-start bg-white">
            {/* Items */}
            <div className="lg:col-span-2 flex items-center gap-3 overflow-x-auto pb-2">
              {bundleItems.map((item, i) => {
                const needsOptions = i > 0 && requiresOptions(item);
                return (
                  <React.Fragment key={item._id}>
                    {i > 0 && (
                      <div className="text-2xl text-gray-300 select-none flex-shrink-0">+</div>
                    )}
                    <div className="flex-shrink-0 w-36 text-center">
                      <div className="aspect-square rounded-lg overflow-hidden bg-gradient-to-br from-gray-50 to-gray-100 border mb-2 relative">
                        <img
                          src={item.images?.[0] || 'https://placehold.co/200x200?text=No+Image'}
                          alt={item.name}
                          className="w-full h-full object-contain p-2"
                        />
                        {i > 0 && !needsOptions && (
                          <input
                            type="checkbox"
                            checked={!!bundleSelection[item._id]}
                            onChange={(e) =>
                              setBundleSelection({ ...bundleSelection, [item._id]: e.target.checked })
                            }
                            className="absolute top-2 left-2 w-4 h-4"
                            style={{ accentColor: accent as string }}
                          />
                        )}
                      </div>
                      <p className="text-xs font-medium truncate">{item.name}</p>
                      {i > 0 && (
                        needsOptions ? (
                          <Link
                            to={`/products/${item.slug}`}
                            className="text-xs font-semibold mt-0.5 inline-block hover:underline"
                            style={{ color: accent as string }}
                          >
                            {t('bundle.choose_options')}
                          </Link>
                        ) : (
                          <p className="text-xs text-gray-500 mt-0.5">{formatPrice(item.price)}</p>
                        )
                      )}
                      {i === 0 && (
                        <p className="text-xs text-gray-400 italic mt-0.5">{t('bundle.this_item')}</p>
                      )}
                    </div>
                  </React.Fragment>
                );
              })}
            </div>

            {/* Bundle CTA */}
            <div className="lg:col-span-1 lg:border-l lg:pl-6">
              <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">{t('bundle.addon_total')}</p>
              <p className="text-2xl font-bold mb-3">{formatPrice(bundleTotal)}</p>
              <p className="text-xs text-gray-500 mb-4">
                {t(addableExtras.length === 1 ? 'bundle.of_extras_selected_one' : 'bundle.of_extras_selected_other', { selected: selectedAddableCount, total: addableExtras.length })}
              </p>
              <button
                onClick={handleBundleAdd}
                disabled={addingBundle || selectedAddableCount === 0}
                className="w-full py-3 rounded-lg text-white font-semibold hover:opacity-90 transition disabled:opacity-50 text-sm"
                style={{ backgroundColor: accent }}
              >
                {addingBundle ? t('bundle.adding') : t('bundle.add_selected')}
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ─── Similar products ────────────────────────────────── */}
      {relatedProducts.length > 0 && (
        <section className="mt-12">
          <h2 className="text-xl sm:text-2xl font-bold mb-1">{t('similar.title')}</h2>
          <p className="text-sm text-gray-500 mb-6">{t('similar.subtitle')}</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {relatedProducts.slice(0, 8).map((p) => (
              <Link
                key={p._id}
                to={`/products/${p.slug}`}
                className="group border rounded-xl overflow-hidden bg-white hover:shadow-lg transition"
              >
                <div className="aspect-[4/5] bg-gradient-to-br from-gray-50 to-gray-100 overflow-hidden">
                  <img
                    src={p.images?.[0] || 'https://placehold.co/400x500?text=No+Image'}
                    alt={p.name}
                    loading="lazy"
                    className="w-full h-full object-contain p-3 group-hover:scale-105 transition-transform duration-500"
                  />
                </div>
                <div className="p-3">
                  <h3 className="text-sm font-medium truncate">{p.name}</h3>
                  <div className="flex items-center justify-between mt-1.5">
                    <span className="font-bold text-sm">{formatPrice(p.price)}</span>
                    {p.rating !== undefined && p.rating > 0 && (
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <span className="text-yellow-400">★</span>
                        {p.rating.toFixed(1)}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

export default ProductDetailExtras;
