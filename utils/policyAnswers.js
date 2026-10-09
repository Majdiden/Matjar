/**
 * Policy answers (PBI 10-11) — the raw facts behind generated policy pages,
 * stored on `tenant.settings.policyAnswers` so the text can be regenerated.
 * Pure, no DB.
 *
 * Only `deliveryAreas` exists so far: asked at signup v2 (10-16) as one line
 * of free text ("Khartoum, Bahri and Omdurman"). Like the brand kit it is
 * `{ ar, en? }`; the signup fills the primary (`ar`) slot with whatever the
 * merchant typed.
 */

/** Max length of the delivery-areas text per language (after trimming). */
export const DELIVERY_AREAS_MAX_LENGTH = 300;

/**
 * Normalise a delivery-areas text typed at signup. Returns
 * `{ value, invalid }`: `value` is `{ ar }` or null when blank; `invalid` is
 * true for a non-string or an over-long text.
 */
export function normalizeDeliveryAreas(raw) {
  if (raw == null) return { value: null, invalid: false };
  if (typeof raw !== "string") return { value: null, invalid: true };
  // Collapse line breaks (one area per line on a phone keyboard) into one
  // readable line, with the comma of the text's own script.
  const comma = /[\u0600-\u06FF]/.test(raw) ? "، " : ", ";
  const text = raw
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join(comma);
  if (!text) return { value: null, invalid: false };
  if (text.length > DELIVERY_AREAS_MAX_LENGTH) return { value: null, invalid: true };
  return { value: { ar: text }, invalid: false };
}
