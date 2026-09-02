import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { reviewsApi } from '../api/client';

/**
 * Submit-review hook. The product detail page already gets reviews via
 * `useProduct(slug).reviews`, so this hook only owns the *write* path
 * plus loading + error state for the form.
 *
 * The backend rejects duplicate reviews from the same customer for the
 * same product (one review per customer per product) — that error
 * message bubbles up unchanged.
 */
export function useSubmitReview(onSuccess?: () => void) {
  const { t } = useTranslation();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(
    async (data: { productId: string; rating: number; title?: string; comment: string }) => {
      try {
        setSubmitting(true);
        setError(null);
        await reviewsApi.create(data);
        if (onSuccess) onSuccess();
        return true;
      } catch (err: any) {
        setError(err?.message || t('errors:feedback.review_submit_failed'));
        return false;
      } finally {
        setSubmitting(false);
      }
    },
    [onSuccess, t]
  );

  return { submit, submitting, error };
}
