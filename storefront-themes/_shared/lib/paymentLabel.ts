/**
 * Localized payment-method labels.
 *
 * A merchant's payment methods are stored with a label in ONE language (the
 * English default set when the method is enabled), so rendering `method.label`
 * directly leaves "Cash on Delivery" sitting in English on an Arabic
 * storefront. For codes the platform ships we render the translated label and
 * fall back to the merchant's own label for anything bespoke.
 *
 * This lives here, rather than inside the payment picker, because the same
 * label is rendered on the checkout review line, the order-success page and
 * order tracking — all of which previously printed the raw English value.
 */

/** Platform payment codes → i18n key under `payment.method.*`. */
export const KNOWN_METHOD_KEYS: Record<string, string> = {
  cod: 'cod',
  cash_on_delivery: 'cod',
  cashondelivery: 'cod',
  cash: 'cash',
  bank: 'bank_transfer',
  bank_transfer: 'bank_transfer',
  banktransfer: 'bank_transfer',
  wire: 'bank_transfer',
  wire_transfer: 'bank_transfer',
  card: 'card',
  credit_card: 'card',
  debit_card: 'card',
  wallet: 'wallet',
  mobile_wallet: 'wallet',
};

type TFn = (key: string, opts?: Record<string, unknown>) => string;

/** Normalise a code or free-text label to a `KNOWN_METHOD_KEYS` lookup key. */
function normalize(value?: string): string {
  return String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
}

/**
 * Resolve the display label for a payment method.
 *
 * `code` is tried first, then the label itself — an order stores
 * `paymentMethod` as a code ("cod") but older rows stored the English
 * label ("Cash on Delivery"), and both should localize.
 */
export function localizedPaymentMethodLabel(
  method: { code?: string; label?: string } | string | undefined,
  t: TFn,
): string {
  const m = typeof method === 'string' ? { code: method, label: method } : method || {};
  const key = KNOWN_METHOD_KEYS[normalize(m.code)] || KNOWN_METHOD_KEYS[normalize(m.label)];
  if (key) {
    const translated = t(`payment.method.${key}`, { defaultValue: '' });
    if (translated) return translated;
  }
  return m.label || m.code || '';
}

/**
 * Localized description for a KNOWN method. Only ever REPLACES a description
 * the merchant already has — it never invents one for a method that had none.
 */
export function localizedPaymentMethodDescription(
  method: { code?: string; description?: string } | undefined,
  t: TFn,
): string {
  const m = method || {};
  if (!m.description) return '';
  const key = KNOWN_METHOD_KEYS[normalize(m.code)];
  if (key) {
    const translated = t(`payment.method_desc.${key}`, { defaultValue: '' });
    if (translated) return translated;
  }
  return m.description;
}
