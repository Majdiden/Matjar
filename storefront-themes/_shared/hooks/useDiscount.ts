import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { discountApi } from '../api/client';

/**
 * Validates a discount code against the customer's *server-side* cart.
 * Returns the discount breakdown (amount, type, eligible line ids) so
 * the cart/checkout UI can show "Save $X" before the order is placed.
 *
 * The actual application of the discount happens at order-creation time
 * via the `discountCode` field on the order payload — this hook is
 * purely for UX feedback.
 */
export function useDiscount() {
  const { t } = useTranslation();
  const [validating, setValidating] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const validate = useCallback(async (code: string) => {
    if (!code || !code.trim()) {
      setError(t('errors:feedback.discount_enter_code'));
      setResult(null);
      return null;
    }
    try {
      setValidating(true);
      setError(null);
      const res: any = await discountApi.validate(code.trim());
      const data = res?.data || res?.responseObject || null;
      setResult(data);
      return data;
    } catch (err: any) {
      setError(err?.message || t('errors:feedback.discount_invalid'));
      setResult(null);
      return null;
    } finally {
      setValidating(false);
    }
  }, [t]);

  const clear = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  return { validate, clear, result, validating, error };
}
