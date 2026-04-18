import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { reviewsApi } from '../../api/client';
import { useThemeSlot } from '../../theme/ThemeSlotsProvider';

export const SLOT_KEY = 'productReviews';

/**
 * Theme-neutral review block: rating summary, write-a-review form, review list.
 *
 * Themes drop this inside their own Reviews tab. Visual style inherits the
 * surrounding container (colors/fonts) and accepts a single `accentColor` for
 * bars, buttons, and avatars. No tab chrome or related-product grid — the
 * theme provides those.
 *
 * The review list is mirrored to local state so a freshly-submitted review
 * appears instantly without waiting for a parent refetch.
 */

export interface Review {
  _id: string;
  rating: number;
  title?: string;
  comment?: string;
  isVerifiedPurchase?: boolean;
  isVerified?: boolean;
  createdAt?: string;
  user?: { _id?: string; firstName?: string; lastName?: string; name?: string };
  userName?: string;
}

interface ProductReviewsProps {
  product: {
    _id: string;
    rating?: number;
    averageRating?: number;
    reviewCount?: number;
  };
  reviews: Review[];
  ratingDistribution?: { 1: number; 2: number; 3: number; 4: number; 5: number };
  accentColor?: string;
  className?: string;
}

const reviewerName = (r: Review): string => {
  const u = r.user;
  if (u) {
    if (u.firstName || u.lastName) return `${u.firstName || ''} ${u.lastName || ''}`.trim();
    if (u.name) return u.name;
  }
  if (r.userName) return r.userName;
  return 'Anonymous';
};

const Stars: React.FC<{ rating: number; size?: 'sm' | 'md' | 'lg'; color?: string }> = ({
  rating,
  size = 'sm',
  color,
}) => {
  const full = Math.round(rating);
  const cls = size === 'lg' ? 'text-2xl' : size === 'md' ? 'text-base' : 'text-sm';
  return (
    <span
      className={`${cls} tracking-tight inline-flex`}
      style={{ color: color || '#facc15' }}
      aria-label={`${rating} out of 5`}
    >
      <span>{'★'.repeat(full)}</span>
      <span className="opacity-25">{'★'.repeat(5 - full)}</span>
    </span>
  );
};

const ProductReviews: React.FC<ProductReviewsProps> = (props) => {
  const Override = useThemeSlot<React.ComponentType<ProductReviewsProps>>(SLOT_KEY);
  if (Override) return <Override {...props} />;
  const {
    product,
    reviews,
    ratingDistribution,
    accentColor = '#111111',
    className = '',
  } = props;
  const [isSignedIn, setIsSignedIn] = useState<boolean>(
    typeof window !== 'undefined' && !!localStorage.getItem('customer_token'),
  );
  useEffect(() => {
    const onStorage = () => setIsSignedIn(!!localStorage.getItem('customer_token'));
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const [localReviews, setLocalReviews] = useState<Review[]>(reviews);
  useEffect(() => { setLocalReviews(reviews); }, [reviews]);

  const [showForm, setShowForm] = useState(false);
  const [rating, setRating] = useState(5);
  const [hover, setHover] = useState(0);
  const [title, setTitle] = useState('');
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (comment.trim().length < 5) {
      setError('Please write at least a few words about the product.');
      return;
    }
    try {
      setSubmitting(true);
      const res: any = await reviewsApi.create({
        productId: product._id,
        rating,
        title: title.trim() || undefined,
        comment: comment.trim(),
      });
      const created: Review | undefined =
        res?.data?.review || res?.responseObject?.review || res?.review;
      if (created) setLocalReviews((prev) => [created, ...prev]);
      setShowForm(false);
      setTitle('');
      setComment('');
      setRating(5);
    } catch (err: any) {
      setError(err?.message || 'Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  };

  const totalReviews = localReviews.length;
  const avgRating = product.averageRating ?? product.rating ?? 0;
  const distribution = ratingDistribution || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const maxBucket = useMemo(
    () => Math.max(1, ...Object.values(distribution)),
    [distribution],
  );

  return (
    <div className={className}>
      {/* Rating summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 pb-8 border-b border-current/10">
        <div className="text-center md:text-left">
          <div className="text-5xl font-bold leading-none mb-2">{avgRating.toFixed(1)}</div>
          <Stars rating={avgRating} size="md" color={accentColor} />
          <p className="text-xs opacity-60 mt-2">
            Based on {totalReviews} review{totalReviews === 1 ? '' : 's'}
          </p>
        </div>

        <div className="md:col-span-2 space-y-1.5">
          {[5, 4, 3, 2, 1].map((star) => {
            const count = distribution[star as 1 | 2 | 3 | 4 | 5] || 0;
            const pct = totalReviews > 0 ? (count / maxBucket) * 100 : 0;
            return (
              <div key={star} className="flex items-center gap-3 text-xs">
                <span className="w-6 opacity-70">{star}★</span>
                <div className="flex-1 h-2 bg-current/10 rounded-full overflow-hidden">
                  <div
                    className="h-full transition-all"
                    style={{ width: `${pct}%`, backgroundColor: accentColor }}
                  />
                </div>
                <span className="w-8 opacity-60 text-right">{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Write a review CTA / form */}
      <div className="mb-8">
        {!showForm ? (
          isSignedIn ? (
            <button
              type="button"
              onClick={() => { setShowForm(true); setError(null); }}
              className="px-5 py-2.5 rounded-lg text-white text-sm font-semibold hover:opacity-90 transition"
              style={{ backgroundColor: accentColor }}
            >
              Write a review
            </button>
          ) : (
            <Link
              to="/login"
              className="inline-block px-5 py-2.5 rounded-lg text-sm font-semibold border hover:bg-current/5 transition"
              style={{ borderColor: accentColor, color: accentColor }}
            >
              Sign in to write a review
            </Link>
          )
        ) : (
          <form onSubmit={handleSubmit} className="border border-current/10 rounded-xl p-5 space-y-4">
            <div>
              <p className="text-sm font-semibold mb-2">Your rating</p>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((n) => {
                  const filled = (hover || rating) >= n;
                  return (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setRating(n)}
                      onMouseEnter={() => setHover(n)}
                      onMouseLeave={() => setHover(0)}
                      className="text-3xl leading-none transition"
                      style={{ color: filled ? '#facc15' : 'currentColor', opacity: filled ? 1 : 0.25 }}
                      aria-label={`${n} star${n === 1 ? '' : 's'}`}
                    >
                      ★
                    </button>
                  );
                })}
                <span className="ml-2 text-xs opacity-60">{rating}/5</span>
              </div>
            </div>

            <div>
              <label htmlFor="review-title" className="block text-sm font-semibold mb-1">
                Title <span className="opacity-50 font-normal">(optional)</span>
              </label>
              <input
                id="review-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={200}
                placeholder="Sum it up in a few words"
                className="w-full px-3 py-2 text-sm border border-current/20 rounded-lg bg-transparent focus:outline-none focus:ring-2"
              />
            </div>

            <div>
              <label htmlFor="review-comment" className="block text-sm font-semibold mb-1">
                Your review
              </label>
              <textarea
                id="review-comment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={4}
                maxLength={5000}
                placeholder="What did you like or dislike? How was the quality?"
                className="w-full px-3 py-2 text-sm border border-current/20 rounded-lg bg-transparent focus:outline-none focus:ring-2 resize-y"
                required
              />
            </div>

            {error && <p className="text-sm text-red-600" role="alert">{error}</p>}

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2.5 rounded-lg text-white text-sm font-semibold hover:opacity-90 transition disabled:opacity-50"
                style={{ backgroundColor: accentColor }}
              >
                {submitting ? 'Submitting…' : 'Submit review'}
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); setError(null); }}
                className="px-5 py-2.5 rounded-lg text-sm font-semibold border border-current/20 hover:bg-current/5 transition"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Review list */}
      {totalReviews === 0 ? (
        <div className="text-center py-12 text-sm opacity-60">
          No reviews yet. Be the first to share your thoughts.
        </div>
      ) : (
        <div className="space-y-5">
          {localReviews.map((r) => (
            <article key={r._id} className="border border-current/10 rounded-xl p-5">
              <header className="flex items-start justify-between gap-4 mb-2">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
                    style={{ backgroundColor: accentColor }}
                  >
                    {reviewerName(r).charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-semibold leading-tight">
                      {reviewerName(r)}
                      {(r.isVerifiedPurchase || r.isVerified) && (
                        <span className="ml-2 text-[10px] text-green-700 bg-green-50 px-1.5 py-0.5 rounded font-medium">
                          Verified Purchase
                        </span>
                      )}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Stars rating={r.rating} color={accentColor} />
                      {r.createdAt && (
                        <span className="text-[11px] opacity-50">
                          {new Date(r.createdAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </header>
              {r.title && <p className="font-semibold text-sm mb-1">{r.title}</p>}
              {r.comment && <p className="text-sm opacity-80 leading-relaxed">{r.comment}</p>}
            </article>
          ))}
        </div>
      )}
    </div>
  );
};

export default ProductReviews;
