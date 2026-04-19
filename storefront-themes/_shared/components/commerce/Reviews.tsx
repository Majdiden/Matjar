import React, { useMemo, useState } from 'react';
import { cn } from '../../utils/cn';
import { RatingStars } from './RatingStars';
import { useSubmitReview } from '../../hooks/useReviews';
import { useThemeSlot } from '../../theme/ThemeSlotsProvider';

export const SLOT_KEY = 'reviews';

/**
 * Review record as returned by the storefront product endpoint. Most
 * fields are optional because the schema has accumulated fields over
 * time and older themes already render partial data without crashing.
 */
export interface ReviewItem {
  _id: string;
  rating: number;
  title?: string;
  comment: string;
  customerName?: string;
  user?: { name?: string };
  verifiedPurchase?: boolean;
  createdAt?: string;
}

interface ReviewsProps {
  productId: string;
  reviews: ReviewItem[];
  /**
   * Per-star count distribution: { 1: 2, 2: 0, 3: 1, 4: 5, 5: 23 }. Comes
   * straight from the product detail endpoint. If omitted the bar chart
   * is hidden.
   */
  ratingDistribution?: Record<number, number>;
  /**
   * Whether the customer is signed in. The form is only rendered for
   * signed-in customers — guests see a "sign in to review" prompt.
   */
  isSignedIn?: boolean;
  /**
   * Called after a review is successfully submitted so the parent can
   * refetch the product (the backend appends the new review and updates
   * the rating distribution server-side).
   */
  onSubmitted?: () => void;
  className?: string;
}

/**
 * Reviews — full reviews block for a product detail page. Renders:
 *   1. Summary (average + distribution bars + total count)
 *   2. List of individual reviews with author, date, verified-purchase
 *      badge, optional title, and the comment body
 *   3. Submit form (signed-in customers only)
 *
 * Headless-friendly: uses Tailwind utility classes that themes can
 * override via the `className` prop or by wrapping in their own
 * Card component.
 */
export function Reviews(props: ReviewsProps) {
  const Override = useThemeSlot<React.ComponentType<ReviewsProps>>(SLOT_KEY);
  if (Override) return <Override {...props} />;
  const {
    productId,
    reviews,
    ratingDistribution,
    isSignedIn = false,
    onSubmitted,
    className,
  } = props;
  const totalReviews = reviews.length;
  const averageRating = useMemo(() => {
    if (!reviews.length) return 0;
    const sum = reviews.reduce((acc, r) => acc + (r.rating || 0), 0);
    return sum / reviews.length;
  }, [reviews]);

  const dist = ratingDistribution || computeDistribution(reviews);
  const distMax = Math.max(1, ...Object.values(dist));

  return (
    <section className={cn('space-y-8', className)}>
      <header>
        <h2 className="text-2xl font-bold tracking-tight">Customer reviews</h2>
      </header>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
        <div className="flex flex-col items-center md:items-start gap-2">
          <div className="flex items-baseline gap-2">
            <span className="text-5xl font-bold">{averageRating.toFixed(1)}</span>
            <span className="text-gray-500">/ 5</span>
          </div>
          <RatingStars rating={averageRating} size="lg" showCount={false} />
          <p className="text-sm text-gray-500">
            Based on {totalReviews} review{totalReviews === 1 ? '' : 's'}
          </p>
        </div>

        {/* Distribution bars */}
        <div className="space-y-1.5">
          {[5, 4, 3, 2, 1].map((star) => {
            const count = dist[star] || 0;
            const pct = (count / distMax) * 100;
            return (
              <div key={star} className="flex items-center gap-3 text-sm">
                <span className="w-8 text-gray-600">{star}★</span>
                <div className="flex-1 h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                  <div
                    className="h-full bg-yellow-400 transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="w-10 text-end text-gray-500 text-xs">{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Reviews list */}
      {reviews.length === 0 ? (
        <div className="border border-dashed rounded-xl p-8 text-center text-gray-500">
          No reviews yet. Be the first to share your experience.
        </div>
      ) : (
        <ul className="space-y-6">
          {reviews.map((r) => (
            <li key={r._id} className="border-b pb-6 last:border-b-0">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div>
                  <div className="flex items-center gap-2">
                    <RatingStars rating={r.rating} size="sm" showCount={false} />
                    {r.verifiedPurchase && (
                      <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-semibold">
                        Verified
                      </span>
                    )}
                  </div>
                  {r.title && <h4 className="font-semibold mt-1">{r.title}</h4>}
                </div>
                <p className="text-xs text-gray-400 shrink-0">
                  {r.createdAt ? new Date(r.createdAt).toLocaleDateString() : ''}
                </p>
              </div>
              <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{r.comment}</p>
              <p className="text-xs text-gray-500 mt-2">
                — {r.customerName || r.user?.name || 'Anonymous'}
              </p>
            </li>
          ))}
        </ul>
      )}

      {/* Submit form */}
      {isSignedIn ? (
        <ReviewForm productId={productId} onSubmitted={onSubmitted} />
      ) : (
        <div className="border rounded-xl p-6 text-center text-sm text-gray-600 bg-gray-50 dark:bg-gray-900/40">
          <a href="/login" className="font-semibold underline">Sign in</a> to write a review.
        </div>
      )}
    </section>
  );
}

/**
 * The submit form is exported separately so themes that want a different
 * placement (e.g. drawer-based, modal-based) can drop it in directly
 * without rendering the full Reviews block.
 */
export function ReviewForm({
  productId,
  onSubmitted,
}: {
  productId: string;
  onSubmitted?: () => void;
}) {
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState('');
  const [comment, setComment] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);

  const { submit, submitting, error } = useSubmitReview(() => {
    setShowSuccess(true);
    setTitle('');
    setComment('');
    setRating(5);
    if (onSubmitted) onSubmitted();
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) return;
    await submit({ productId, rating, title: title.trim() || undefined, comment: comment.trim() });
  };

  return (
    <form onSubmit={handleSubmit} className="border rounded-xl p-6 space-y-4">
      <h3 className="font-semibold text-lg">Write a review</h3>

      <div>
        <label className="text-sm font-medium mb-1 block">Your rating</label>
        <div className="flex items-center gap-1" role="radiogroup" aria-label="Rating">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={rating === n}
              onClick={() => setRating(n)}
              className="p-1"
            >
              <svg
                className={cn(
                  'w-7 h-7 transition-colors',
                  n <= rating ? 'fill-yellow-400' : 'fill-gray-200 dark:fill-gray-700'
                )}
                viewBox="0 0 20 20"
              >
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="rev-title" className="text-sm font-medium mb-1 block">Title (optional)</label>
        <input
          id="rev-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Sums it up in a few words"
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label htmlFor="rev-comment" className="text-sm font-medium mb-1 block">Your review *</label>
        <textarea
          id="rev-comment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          required
          rows={4}
          placeholder="What did you like or dislike?"
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {showSuccess && (
        <p className="text-sm text-emerald-600">Thanks! Your review was submitted.</p>
      )}

      <button
        type="submit"
        disabled={submitting || !comment.trim()}
        className="px-5 py-2.5 rounded-lg bg-gray-900 text-white font-medium text-sm hover:bg-gray-800 disabled:opacity-50"
      >
        {submitting ? 'Submitting…' : 'Submit review'}
      </button>
    </form>
  );
}

/**
 * Fallback distribution computation when the backend doesn't provide one.
 * Buckets ratings 1–5 into integer counts.
 */
function computeDistribution(reviews: ReviewItem[]): Record<number, number> {
  const out: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const r of reviews) {
    const bucket = Math.max(1, Math.min(5, Math.round(r.rating || 0)));
    out[bucket] = (out[bucket] || 0) + 1;
  }
  return out;
}
